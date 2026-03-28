import { execSync } from 'node:child_process';
import fs from 'node:fs';
import process from 'node:process';

const FILE_PATH = 'discogs-submitter.user.js';
const VERSION_REGEX = /(@version\s+)[0-9.]+/;

/**
 * Automates the versioning process for the userscript.
 * Bumps the NPM version and syncs it with the userscript header.
 */
function updateVersion() {
  try {
    // Bump version and get the new version
    console.warn('[Husky] Bumping version...');

    const rawVersion = execSync('npm version patch --no-git-tag-version', { encoding: 'utf8' }).trim();
    const version = rawVersion.startsWith('v') ? rawVersion.slice(1) : rawVersion;

    if (!fs.existsSync(FILE_PATH)) {
      throw new Error(`Source file ${FILE_PATH} not found.`);
    }

    // Read the userscript file and update the @version tag
    const content = fs.readFileSync(FILE_PATH, 'utf8');

    if (VERSION_REGEX.test(content)) {
      const updatedContent = content.replace(VERSION_REGEX, `$1${version}`);
      fs.writeFileSync(FILE_PATH, updatedContent, 'utf8');

      // Stage the modified files back to the commit
      execSync(`git add package.json package-lock.json ${FILE_PATH}`);

      console.warn(`[Husky] Successfully updated version to ${version} and staged changes.`);
    }
    else {
      throw new Error(`Could not find @version tag in ${FILE_PATH}`);
    }
  }
  catch (error) {
    throw new Error(`Version auto-update failed: ${error.message}`);
  }
}

/**
 * Husky `pre-commit` hook in JavaScript.
 * Orchestrates linting and automated versioning.
 */
function preCommit() {
  try {
    // Run lint-staged to ensure code quality
    console.warn('[Husky] Running lint-staged...');

    execSync('npx lint-staged', { stdio: 'inherit' });

    // Check if the userscript was modified and needs a version bump
    const stagedFiles = execSync('git diff --cached --name-only', { encoding: 'utf8' });

    if (stagedFiles.includes(FILE_PATH)) {
      console.warn('[Husky] Userscript changes detected. Running version auto-update...');

      updateVersion();
    }
  }
  catch (error) {
    console.error(`[Husky] Pre-commit hook failed: ${error.message}`);

    process.exit(1);
  }
}

preCommit();
