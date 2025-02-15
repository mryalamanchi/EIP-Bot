import { getPullNumber } from "src/infra";
import { CriticalError } from "src/domain/exceptions";

export const requirePullNumber = () => {
  const pullNumber = getPullNumber();

  if (!pullNumber) {
    throw new CriticalError(
      "Build does not have a PR number associated with it; quitting..."
    );
  }

  return pullNumber;
};
