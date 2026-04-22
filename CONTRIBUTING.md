# Contributing to Discogs Submitter

Thank you for your interest in contributing! This project follows strict engineering standards to ensure reliability across multiple music platforms.

## Development Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/denis-g/userscript-discogs-submitter.git
    cd userscript-discogs-submitter
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Build userscript:**
    ```bash
    npm run build
    ```

## Adding a New Provider

Adding a new digital store is the most common way to contribute. Please follow these steps:

1.  **Create the adapter:** Create `src/providers/[storename].ts`. Implement the `StoreAdapter` interface.
2.  **Define selectors:** Use specific CSS selectors for the `target` (where the button is injected).
3.  **Implement parsing:** Extract data into the `ReleaseData` structure.
4.  **Register:** Add your provider to the list in `src/providers/index.ts`.
5.  **Test:** Create `src/providers/[storename].test.ts` with mock DOM data.

## Coding Standards

To maintain a clean and professional codebase, we enforce the following rules:

### No Abbreviations
Readability is our top priority. NEVER use short variable names like `a`, `t`, `i`, `el`, or `it`.
*   **Bad:** `tracks.map(t => t.title)`
*   **Good:** `tracks.map(track => track.title)`

### Mandatory Documentation (JSDoc)
All exported functions, interfaces, and public methods MUST have JSDoc comments.
*   Include a clear description of **what** and **why**.
*   Define all `@param` and `@returns` (except for `void` returns).
*   Provide an `@example` for complex logic or utilities.

### Strict Typing
Avoid `any`. Use TypeScript's strict mode to its full potential. If you need a new data structure, define it in `src/types/index.ts`.

### CSS Standards
Our UI styles are located in `src/assets/*.css`. We follow these principles:
*   **BEM Methodology:** Use BEM-like naming for classes (e.g., `discogs-submitter__header__title`).
*   **Scoped Styling:** All classes must be prefixed with `discogs-submitter` to avoid collisions with the host website.
*   **CSS Variables:** Use the predefined variables in `widget.css` for colors, gaps, and border-radius.
*   **Vite Raw Imports:** CSS files are imported in TS via `import css from './style.css?raw'` and injected dynamically.

### Linting & Formatting
The project uses [Antfu ESLint Config](https://github.com/antfu/eslint-config) to enforce code style and catch common errors.
*   **Automated Formatting:** ESLint handles both linting and formatting.
*   **Pre-commit:** We use `husky` and `lint-staged` to automatically check and format your code before every commit.
*   **Manual Fixes:** Always run `npm run lint:fix` before committing if you have local formatting issues.

## Testing & Quality

We follow a **Test-Driven Development (TDD)** approach using **Vitest**. Every bug fix or new feature must include a corresponding test.

### Testing Guidelines:
*   **Location:** Provider tests go in `src/providers/[name].test.ts`, utility tests in `src/core/utils/[name].test.ts`.
*   **DOM Mocking:** Since we parse real websites, use `JSDOM` (provided by Vitest environment) to mock the necessary HTML structures.
*   **Regex Testing:** For new parsing patterns, add exhaustive test cases to ensure no regressions in artist/title detection.

Before submitting a Pull Request, ensure all checks pass:

```bash
# Run type checking
npm run typecheck

# Run linter (uses cache for speed)
npm run lint

# Run all tests
npm run test:run
```

## Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/). This is enforced by `commitlint`.
*   `chore: update dependencies`
*   `docs: update contributing guidelines`
*   `feat: add Beatport provider`
*   `fix: resolve incorrect duration parsing on Bandcamp`

## Pull Request Checklist

- [ ] My code follows the **no-abbreviation** rule.
- [ ] Every new function or method is documented with **JSDoc**.
- [ ] I have added **unit tests** for my changes.
- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes.
- [ ] All tests pass via `npm run test:run`.
