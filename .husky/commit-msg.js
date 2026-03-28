import { execSync } from 'node:child_process';
import process from 'node:process';

/**
 * Husky `commit-msg` hook in JavaScript.
 * Validates the commit message using commitlint.
 */
function commitMsg() {
  try {
    const editMsgFile = process.argv[2];

    if (!editMsgFile) {
      throw new Error('No commit message file provided.');
    }

    // Execute commitlint to validate the message
    execSync(`npx --no -- commitlint --edit "${editMsgFile}"`, { stdio: 'inherit' });
  }
  catch (error) {
    console.error(`[Husky] Commit message validation failed: ${error.message}`);

    process.exit(1);
  }
}

commitMsg();
