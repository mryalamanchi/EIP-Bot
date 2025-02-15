import { setFailed } from "@actions/core";
import {
  requireEvent,
  requireFiles,
  requirePr,
  requirePullNumber
} from "#/assertions";
import { postComment } from "#/components";
import {
  isNockDisallowedNetConnect,
  isNockNoMatchingRequest,
  NodeEnvs,
  Results
} from "src/domain";
import { uniq } from "lodash";
import { requestReviewers } from "#/approvals";
import { processError } from "src/domain/exceptions";
import { multiLineString } from "#/utils";
import { testFile } from "#/main/test_file";
import { purifyTestResults } from "#/main/purify_test_results";
import { getCommentMessage } from "#/main/get_comment_message";

export const _main_ = async () => {
  // Verify correct environment and request context
  requireEvent();
  requirePullNumber();
  const pr = await requirePr();

  // Collect the changes made in the given PR from base <-> head for eip files
  const files = await requireFiles(pr);
  let results: Results = [];
  for await (const file of files) {
    try {
      const dirtyTestResults = await testFile(file);
      const testResults = await purifyTestResults(dirtyTestResults);
      results.push(testResults);
    } catch (err: any) {
      processError(err, {
        gracefulTermination: (message) => {
          results.push({
            filename: file.filename,
            successMessage: message
          });
        },
        requirementViolation: (message) => {
          results.push({
            filename: file.filename,
            errors: [message]
          });
        },
        unexpectedError: (message, data) => {
          console.log(JSON.stringify(data, null, 2));
          message = `An unexpected error occurred (cc @alita-moore): ${message}`;
          results.push({
            filename: file.filename,
            errors: [message]
          });
        }
      });
    }
  }

  if (!results.filter((res) => res.errors).length) {
    const commentMessage = getCommentMessage(
      results,
      "All tests passed; auto-merging..."
    );
    await postComment(commentMessage);
    console.log(commentMessage);
    return;
  }

  const commentMessage = getCommentMessage(results);
  await postComment(commentMessage);
  await requestReviewers(
    uniq(results.flatMap((res) => res.mentions).filter(Boolean) as string[])
  );

  console.log(commentMessage);
  return setFailed(commentMessage);
};

export const _main = (_main_: () => Promise<undefined | void>) => async () => {
  const isProd = process.env.NODE_ENV === NodeEnvs.production;

  try {
    return await _main_();
  } catch (error: any) {
    if (isNockDisallowedNetConnect(error) || isNockNoMatchingRequest(error)) {
      throw error;
    }
    const message = multiLineString("\n")(
      `A critical exception has occurred (cc @alita-moore):`,
      `\tMessage: ${error.error || error.message?.toLowerCase()}`,
      error.data && `\tData:\n${JSON.stringify(error.data, null, 2)}`
    );
    console.log(message);

    if (isProd) {
      await postComment(message);
    }

    setFailed(message);

    throw message;
  }
};

export const main = _main(_main_);
