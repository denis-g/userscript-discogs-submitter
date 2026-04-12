import { execSync } from 'node:child_process';
import process from 'node:process';

const MIN_NODE_VERSION = 22;

/**
 * Ensures the developer is using the required Node.js version.
 */
function checkNodeVersion() {
  const currentVersion = process.versions.node.split('.')[0];

  if (Number.parseInt(currentVersion, 10) < MIN_NODE_VERSION) {
    console.error(`\x1B[31m[Husky] Error: Node.js v${MIN_NODE_VERSION} or higher is required.\x1B[0m`);
    console.error(`\x1B[31m[Husky] Current version: v${process.version}\x1B[0m`);

    process.exit(1);
  }
}

/**
 * Automates the versioning process for the userscript.
 */
function updateVersion() {
  try {
    console.warn('\x1B[33m[Husky] Bumping version...\x1B[0m');
    execSync('npm version patch --no-git-tag-version', { stdio: 'inherit' });

    console.warn('\x1B[33m[Husky] Rebuilding userscript with new version...\x1B[0m');
    execSync('npm run build', { stdio: 'inherit' });

    console.warn('\x1B[33m[Husky] Staging updated files...\x1B[0m');
    execSync('git add package.json package-lock.json discogs-submitter.user.js');

    console.warn('\x1B[32m[Husky] Successfully updated version, rebuilt and staged changes.\x1B[0m');
  }
  catch (error) {
    throw new Error(`Version auto-update and build failed: ${error.message}`);
  }
}

/**
 * Husky `pre-commit` hook.
 */
function preCommit() {
  try {
    checkNodeVersion();

    console.warn('\x1B[36m[Husky] Running tests...\x1B[0m');
    execSync('npm run test:run', { stdio: 'inherit' });

    console.warn('\x1B[36m[Husky] Running lint-staged...\x1B[0m');
    execSync('npx lint-staged', { stdio: 'inherit' });

    const stagedFiles = execSync('git diff --cached --name-only', { encoding: 'utf8' })
      .split('\n')
      .map(f => f.trim())
      .filter(Boolean);

    const srcFilesChanged = stagedFiles.some(file => file.startsWith('src/'));

    if (srcFilesChanged) {
      console.warn('\x1B[33m[Husky] Detected changes in src/. Triggering auto-version...\x1B[0m');

      updateVersion();
    }
  }
  catch (error) {
    console.error(`\x1B[31m[Husky] Pre-commit hook failed: ${error.message}\x1B[0m`);

    process.exit(1);
  }
}

preCommit();
