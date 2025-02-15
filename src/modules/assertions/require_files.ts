import { getPullRequestFiles } from "src/infra";
import { Files, PR } from "src/domain";
import { RequirementViolation } from "src/domain/exceptions";

/**
 * compares the diff between the base commit of the PR and
 * the head commit; if no files were found then it will explode
 *
 * @returns {File}
 */
export const requireFiles = async (pr: PR): Promise<Files> => {
  const files = await getPullRequestFiles(pr.number);

  if (!files?.length) {
    throw new RequirementViolation(
      [
        "There were no files found to be associated",
        "with the PR within context"
      ].join(" ")
    );
  }

  return files;
};
