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
3.  **Install Userscript Manager:**
    - Ensure you have [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/) installed in your browser.
4.  **Build userscript:**
    ```bash
    npm run build
    ```
5.  **Install userscript:**
    - Copy the contents of `discogs-submitter.user.js` into a new user script in your userscript manager.


## Development Protocol

We follow a strict development protocol to ensure consistency and reliability.

### Autonomous Providers
Each music store is unique. Keep scraping logic (selectors, JSON-LD parsing, regex for catalog numbers) inside the provider file. Use core utilities from `src/domain/normalizers/` for normalization (artists, titles, dates, labels). Do not reinvent normalization logic.

### Fresh State Mandate
Before proposing or applying any changes to a file, always read its current content from the disk. Never rely on stale information from your editor or previous build cycles.

### Surgical Changes
Touch only what you must. Avoid broad refactorings or "cleanup" of unrelated code. Every change should trace directly to the task at hand.

## Project Structure

The project follows a **Modular Monolith with Component Co-location** pattern. The full architecture is documented in `CONTEXT.md`. In short:

- **Layer folder** (`src/app/`, `src/libs/`, `src/domain/`, `src/providers/`, `src/ui/`) — contains only module folders, each shaped as `<name>/index.ts` + optional companions (`template.html`, `styles.css`, `types.ts`, `__tests__/`).
- **Collection folder** (`src/config/`, `src/utils/`, `src/domain/normalizers/`) — contains flat `<topic>.ts` files plus a shared `__tests__/`.

Where to put what:
- Class / controller / engine → `<layer>/<name>/index.ts`
- Utility function or constant → `<collection>/<topic>.ts`
- Internal helper inside a module → flat `.ts` file beside its `index.ts`
- Tests → `__tests__/` next to the module or inside the collection

## Adding a New Provider

Adding a new digital store is the most common way to contribute. Please follow these steps:

1.  **Create the adapter folder:** `src/providers/[storename]/index.ts`. Implement the `StoreAdapter` interface (`id`, `test`, `supports`, `parse`).
2.  **URL matching:** Use `matchUrls(...)` from `@/utils/url` in the `test` predicate to declare which page URLs the provider handles.
3.  **Implement parsing:** Extract data into the `ReleaseData` structure inside `parse()`. Reuse normalizers from `@/domain/normalizers/`.
4.  **Register:** Add your provider to the `list` in `src/providers/index.ts`.
5.  **Test:** Create `src/providers/[storename]/__tests__/parse.test.ts` with mock DOM data. Add `// @vitest-environment happy-dom` at the top if you touch the DOM.
6.  **(Optional) Store-specific styles:** Drop a `styles.css` inside the provider folder:
    ```
    src/providers/[storename]/
    ├── index.ts
    ├── styles.css         ← auto-discovered via `import.meta.glob`, no wiring needed
    └── __tests__/parse.test.ts
    ```
    The styles are injected as a scoped `<style>` tag only when the user lands on a matching page and removed automatically on navigation away. Rarely needed — the widget and inject button are `position: fixed` and don't depend on the host DOM. Use this only to fix visual quirks caused by the store's own CSS leaking into our widget elements (e.g. `img { opacity: 0.5 }` overriding our cover image — see `src/providers/bleep/styles.css` for a real example).
7.  **(Optional) Provider-private API types:** If the store API returns complex types, put them in `src/providers/[storename]/types.ts` so they don't leak into shared `types.ts`.
8.  **(Optional) Pre-parse hook:** If the store needs DOM settlement before scraping (SPA rendering, lazy-loaded tracks), implement `beforeParse?: () => Promise<void> | void` on the adapter. It runs once before `parse()` and must swallow its own failures. See `src/providers/qobuz/index.ts` for a real example (it triggers Qobuz's `infiniteScroll` loader so every track is in the DOM).

## Coding Standards

To maintain a clean and professional codebase, we enforce the following rules:

### No Abbreviations
Readability is our top priority. NEVER use short variable names like `i`, `e`, `el` and etc.
*   **Bad:** `tracks.map(t => t.title)`
*   **Good:** `tracks.map(track => track.title)`

### Mandatory Documentation (JSDoc)
All exported functions, interfaces, and public methods MUST have JSDoc comments.
*   Include a clear description of **what** and **why**.
*   Define all `@param` and `@returns` (except for `void` returns).
*   Provide an `@example` for complex logic or utilities.

### Strict Typing
Avoid `any`. Use TypeScript's strict mode to its full potential. Cross-layer contracts go in `src/types.ts`. Provider-private API types go in `src/providers/<store>/types.ts`. Module-internal types stay in `src/<module>/types.ts`.

### CSS Standards
CSS is **co-located** with the component it styles, following the project's auto-discovery convention:
*   **Global stylesheets** in `src/assets/styles/` — collected by `import.meta.glob` and injected once at startup by `StylesInjector`. Files are prefixed with a numeric band (`10-reset`, `20-variables`, `30-inputs`, `40-buttons`) so the cascade order is encoded in the alphabetical filename order; pick an unused number in the right band when adding a new file.
*   **Component styles** as `styles.css` next to the component's `index.ts` (e.g., `src/ui/widget/styles.css`, `src/ui/widget/preview/styles.css`, `src/ui/inject-button/styles.css`). The widget glob-discovers every `styles.css` inside `src/ui/widget/`; the inject button imports its own.
*   **Provider styles** as `src/providers/<store>/styles.css` — auto-discovered and injected lazily when the user lands on a matching page.

We follow these principles:
*   **BEM Methodology:** Use BEM-like naming for classes (e.g., `discogs-submitter__header__title`).
*   **Scoped Styling:** All classes must be prefixed with `discogs-submitter` to avoid collisions with the host website.
*   **CSS Variables:** Use the predefined variables in `src/assets/styles/20-variables.css` for colors, gaps, and border-radius.
*   **Vite Inline Imports:** CSS files are imported in TS via `import css from './style.css?inline'` or auto-discovered via `import.meta.glob` and injected dynamically.

### HTML Templates & Accessibility
The widget is rendered into the host page via `<div>` / `<svg>` elements (so host-page CSS resets don't bleed into our UI), which means accessibility semantics have to be added explicitly. Every interactive element must be reachable by keyboard *and* announceable by screen readers.

**Mandatory attributes on non-native button elements** (`<div>` / `<svg>` acting as a button):
*   `role="button"` — tells assistive tech this is a button.
*   `tabindex="0"` — makes the element focusable in document tab order.
*   `aria-label="<concise action description>"` — read by screen readers; `title` alone is unreliable.

**Mandatory event wiring** for those same elements — always use `bindActivation(element, handler)` from `@/utils/dom` instead of `element.addEventListener('click', handler)`. The helper wires click *and* `Enter` / `Space` keyboard activation in one call, so keyboard users get the same affordance as mouse users.

**Common shapes:**
*   **Icon button** (SVG with `<use>`): `<svg class="discogs-submitter__button is-icon ..." role="button" tabindex="0" title="..." aria-label="..."><use href="#ds-icon-..."></use></svg>`. The inner `<use>` is decorative — the `<svg>` itself carries the role + label.
*   **Text button** (DIV with visible label): `<div class="discogs-submitter__button ..." role="button" tabindex="0" aria-label="...">Label</div>`. Visible text serves as the accessible name, but always include `aria-label` for clarity and consistency with the icon-button pattern.

**Common ARIA patterns used in this project:**
*   **Dialog/sidebar shell** (`Widget.buildPopup`) — `role="dialog"` + `aria-modal="false"` + `aria-label`.
*   **Live status banners** — `role="status"` + `aria-live="polite"` on the container; the inner text node is updated dynamically and the change is announced.
*   **Busy/loading state** — `role="status"` + `aria-busy="true"` + `aria-label="Loading"`; visibility is toggled via CSS, which also hides the element from assistive tech when not active.
*   **Custom `<select>` (`Select`)** — trigger uses `role="combobox"` + `aria-haspopup="listbox"` + `aria-expanded` (kept in sync with open state in `toggleDropdown` / `closeDropdown`); list uses `role="listbox"` + `aria-multiselectable`; items use `role="option"` + `aria-selected`.
*   **Editable contenteditable spans** — `role="textbox"` + `aria-label`. Multi-line textareas additionally set `aria-multiline="true"`.
*   **Decorative SVG icons** (icons inside a labelled button, list markers) — `aria-hidden="true"` so the icon isn't announced separately from its parent's label.

**Bottom line:** if you add a new clickable element that isn't a native `<button>` / `<a>` / `<input>`, give it `role="button"` + `tabindex="0"` + `aria-label`, and wire it through `bindActivation`. No exceptions.

### Linting & Formatting
The project uses [Antfu ESLint Config](https://github.com/antfu/eslint-config) to enforce code style and catch common errors.
*   **Automated Formatting:** ESLint handles both linting and formatting.
*   **Pre-commit:** We use `husky` and `lint-staged` to automatically check and format your code before every commit.
*   **Manual Fixes:** Always run `npm run lint:fix` before committing if you have local formatting issues.

### Automated Release Commits
A `post-commit` Husky hook keeps the userscript artifact in sync with the version field:
*   If your commit touches any file under `src/`, the hook automatically runs `npm version patch`, rebuilds `discogs-submitter.user.js`, and appends a follow-up commit titled `chore(release): vX.Y.Z` containing only `package.json`, `package-lock.json`, and the rebuilt userscript.
*   Commits that don't touch `src/` (docs, configs, tests in isolation) are left alone — no version bump, no rebuild.
*   The auto-commit is created with `--no-verify` so it doesn't re-trigger the test suite. Recursion is prevented by skipping any commit whose subject starts with `chore(release):`.

## Testing & Quality

We follow a **Test-Driven Development (TDD)** approach using **Vitest**. Every bug fix or new feature must include a corresponding test.

### Testing Guidelines:
*   **Location:** Tests live next to the code they cover:
    *   Module tests inside the module folder: `src/providers/<store>/__tests__/parse.test.ts`, `src/libs/template/__tests__/render.test.ts`.
    *   Collection tests at the collection root: `src/domain/normalizers/__tests__/<topic>.test.ts`, `src/utils/__tests__/<topic>.test.ts`.
*   **DOM Mocking:** Since we parse real websites, use `happy-dom` to mock the necessary HTML structures. The default Vitest environment is `node`; add `// @vitest-environment happy-dom` at the top of any test file that touches the DOM.
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

We use [Conventional Commits](https://www.conventionalcommits.org/). This is enforced by `commitlint` via the `commit-msg` Husky hook.
*   `chore: update dependencies`
*   `docs: update contributing guidelines`
*   `feat: add Beatport provider`
*   `fix: resolve incorrect duration parsing on Bandcamp`

Rules inherited from `@commitlint/config-conventional` that you'll hit most often:
*   **Header (subject) ≤ 100 characters.** If you exceed this, commitlint blocks the commit with `header-max-length`. Move detail to the body instead of cramming it into the subject.
*   **Body lines ≤ 100 characters.** Wrap long bullet/explanation lines (`body-max-line-length`).
*   **Blank line between subject and body** is required when a body is present.
*   The `subject-case` rule is intentionally disabled so non-English subjects are allowed.

## Pull Request Checklist

- [ ] My code follows the **no-abbreviation** rule.
- [ ] Every new function or method is documented with **JSDoc**.
- [ ] I have added **unit tests** for my changes.
- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes.
- [ ] All tests pass via `npm run test:run`.
