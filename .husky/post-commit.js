import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const RELEASE_PREFIX = 'chore(release):';

/**
 * Returns the last commit's subject line.
 *
 * @returns The first line of `git log -1 --pretty=%s`.
 */
function getLastCommitSubject() {
  return execSync('git log -1 --pretty=%s', { encoding: 'utf8' }).trim();
}

/**
 * Returns the last commit's full raw message (subject + body).
 *
 * @returns Output of `git log -1 --pretty=%B`, with trailing whitespace stripped.
 */
function getLastCommitMessage() {
  return execSync('git log -1 --pretty=%B', { encoding: 'utf8' }).trimEnd();
}

/**
 * Returns the list of files changed in the last commit.
 *
 * @returns Array of file paths.
 */
function getLastCommitFiles() {
  return execSync('git diff-tree --no-commit-id --name-only -r HEAD', { encoding: 'utf8' })
    .split('\n')
    .map(file => file.trim())
    .filter(Boolean);
}

/**
 * Bumps the patch version in package.json, rebuilds the userscript, and creates a release commit
 * containing only the version-related artifacts. The triggering developer commit's full message
 * is embedded in the release body so `git log` shows what's actually in the release.
 */
function bumpAndCommit() {
  // Capture the developer commit message before any new commit happens
  const sourceMessage = getLastCommitMessage();

  console.warn('\x1B[33m[Husky] src/ changed. Bumping version...\x1B[0m');
  execSync('npm version patch --no-git-tag-version', { stdio: 'inherit' });

  const { version } = JSON.parse(readFileSync('./package.json', 'utf8'));

  console.warn('\x1B[33m[Husky] Rebuilding userscript...\x1B[0m');
  execSync('npm run build', { stdio: 'inherit' });

  console.warn('\x1B[33m[Husky] Creating release commit...\x1B[0m');
  execSync('git add package.json package-lock.json discogs-submitter.user.js');

  const releaseMessage = `${RELEASE_PREFIX} v${version}\n\n${sourceMessage}`;

  execSync('git commit --no-verify -F -', { input: releaseMessage, stdio: ['pipe', 'inherit', 'inherit'] });

  console.warn(`\x1B[32m[Husky] Released v${version}\x1B[0m`);
}

/**
 * Husky `post-commit` hook. Bumps the version and rebuilds the userscript when the previous
 * commit touched `src/`. Skips itself when the previous commit was already a release commit
 * to prevent infinite recursion.
 */
function postCommit() {
  try {
    const subject = getLastCommitSubject();

    if (subject.startsWith(RELEASE_PREFIX)) {
      return;
    }

    const files = getLastCommitFiles();
    const srcChanged = files.some(file => file.startsWith('src/'));

    if (!srcChanged) {
      return;
    }

    bumpAndCommit();
  }
  catch (error) {
    // Post-commit failures cannot undo the developer's commit; surface the error but exit cleanly.
    console.error(`\x1B[31m[Husky] Post-commit hook failed: ${error.message}\x1B[0m`);
  }
}

postCommit();
