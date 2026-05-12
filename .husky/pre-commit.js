import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import process from 'node:process';

const BUILD_ARTIFACT = 'discogs-submitter.user.js';

/**
 * Extracts the minimum required Node.js major version from `package.json` `engines.node`.
 * Falls back to `0` if the field is missing or unparseable so the check becomes a no-op.
 *
 * @returns The required major version, or `0` when nothing is declared.
 */
function getMinNodeVersion() {
  const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
  const engines = pkg.engines?.node || '';
  const major = engines.match(/\d+/);

  return major ? Number.parseInt(major[0], 10) : 0;
}

/**
 * Ensures the developer is using the Node.js version declared in `package.json` `engines.node`.
 */
function checkNodeVersion() {
  const minNodeVersion = getMinNodeVersion();
  const currentMajor = Number.parseInt(process.versions.node.split('.')[0], 10);

  if (currentMajor < minNodeVersion) {
    console.error(`\x1B[31m[Husky] Error: Node.js v${minNodeVersion} or higher is required.\x1B[0m`);
    console.error(`\x1B[31m[Husky] Current version: v${process.version}\x1B[0m`);

    process.exit(1);
  }
}

/**
 * Removes the userscript build artifact from the staged set if it sneaked in.
 * The artifact is rebuilt and committed automatically by the `post-commit` hook,
 * so manually staging it would produce a duplicate copy in history.
 * Use `git commit --no-verify` to bypass this guard if a manual override is needed.
 */
function unstageBuildArtifact() {
  const stagedFiles = execSync('git diff --cached --name-only', { encoding: 'utf8' })
    .split('\n')
    .map(file => file.trim())
    .filter(Boolean);

  if (!stagedFiles.includes(BUILD_ARTIFACT)) {
    return;
  }

  console.warn(`\x1B[33m[Husky] Unstaging ${BUILD_ARTIFACT} — built artifact, rebuilt automatically in the release commit.\x1B[0m`);
  execSync(`git reset HEAD -- ${BUILD_ARTIFACT}`, { stdio: 'pipe' });
}

/**
 * Husky `pre-commit` hook. Validates code via lint-staged + tests.
 * Lint runs first so cheap formatting failures abort early before the slower test pass.
 * Version bump and rebuild happen in `post-commit` once the developer's commit is finalized.
 */
function preCommit() {
  try {
    checkNodeVersion();
    unstageBuildArtifact();

    console.warn('\x1B[36m[Husky] Running lint-staged...\x1B[0m');
    execSync('npx lint-staged', { stdio: 'inherit' });

    console.warn('\x1B[36m[Husky] Running tests...\x1B[0m');
    execSync('npm run test:run', { stdio: 'inherit' });
  }
  catch (error) {
    console.error(`\x1B[31m[Husky] Pre-commit hook failed: ${error.message}\x1B[0m`);

    process.exit(1);
  }
}

preCommit();
