// ==UserScript==
// @name         Discogs Submitter
// @version      1.0.0
// @description  Parse release data from Bandcamp, Qobuz, Juno Download, Beatport, 7digital and submit releases to Discogs.
// @license      MIT
// @namespace    discogs-submitter
// @iconURL      https://github.com/denis-g/userscript-discogs-submitter/raw/refs/heads/master/assets/icon.svg
// @updateURL    https://github.com/denis-g/userscript-discogs-submitter/raw/refs/heads/master/discogs-submitter.user.js
// @downloadURL  https://github.com/denis-g/userscript-discogs-submitter/raw/refs/heads/master/discogs-submitter.user.js
// @author       Denis G. <https://github.com/denis-g>
// @homepage     https://github.com/denis-g/userscript-discogs-submitter#readme
// @homepageURL  https://github.com/denis-g/userscript-discogs-submitter#readme
// @supportURL   https://github.com/denis-g/userscript-discogs-submitter/issues
// @match        https://*.bandcamp.com/album/*
// @match        https://www.qobuz.com/*/album/*
// @match        https://www.junodownload.com/products/*
// @match        https://www.beatport.com/release/*
// @match        https://*.7digital.com/artist/*/release/*
// @connect      www.discogs.com
// @connect      www.junodownload.com
// @connect      www.beatport.com
// @connect      api.beatport.com
// @connect      api.7digital.com
// @connect      bcbits.com
// @connect      static.qobuz.com
// @connect      imagescdn.junodownload.com
// @connect      geo-media.beatport.com
// @connect      artwork-cdn.7static.com
// @run-at       document-end
// @grant        GM.setClipboard
// @grant        GM.xmlHttpRequest
// @grant        GM_info
// @grant        unsafeWindow
// ==/UserScript==

'use strict';

(async () => {
  /**
   * Handles rendering of the release preview and other UI elements.
   */
  const Renderer = {
    /**
     * Common CSS styles for the widget and injected buttons.
     */
    widgetStyles: `
      .discogs-submitter {
        --ds-gap: 20px;
        --ds-radius: 12px;
        --ds-color-white: #fafafa;
        --ds-color-black: #212121;
        --ds-color-gray: #666;
        --ds-color-gray-dark: #333;
        --ds-color-primary: #148A66;
        --ds-color-success: #28a745;
        --ds-color-error: #dc3545;
        --ds-color-warning: #ffc107;
        --ds-color-info: #17a2b8;
        --ds-font-sans: 'Helvetica Neue', Helvetica, Arial, sans-serif;
        --ds-font-monospace: 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
      }

      .discogs-submitter,
      .discogs-submitter *,
      .discogs-submitter *::after,
      .discogs-submitter *::before {
        color-scheme: light;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-rendering: optimizeLegibility;
        box-sizing: border-box;
      }

      .discogs-submitter em {
        font-style: oblique;
      }

      .discogs-submitter strong {
        font-weight: bold;
      }

      .discogs-submitter [hidden] {
        display: none !important;
      }

      .discogs-submitter {
        overflow: hidden;
        display: none;
        flex-direction: column;
        justify-content: start;
        gap: var(--ds-gap);
        position: fixed;
        z-index: 999999;
        top: var(--ds-gap);
        right: var(--ds-gap);
        width: calc(100% - (var(--ds-gap) * 2));
        max-width: 500px;
        padding: var(--ds-gap);
        color: var(--ds-color-black);
        font-family: var(--ds-font-sans) !important;
        font-size: 14px;
        font-weight: normal;
        line-height: 1.2;
        text-transform: none;
        text-shadow: none;
        background: var(--ds-color-white);
        border: 2px solid var(--ds-color-gray-dark);
        border-radius: var(--ds-radius);
        outline: 2px solid var(--ds-color-white);
        opacity: 0;
        transition: opacity 0.3s ease, box-shadow 0.6s ease;
      }

      .discogs-submitter.is-open {
        display: flex;
        opacity: 1;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.6), 0 0 30px rgba(0, 0, 0, 0.8);
      }

      .discogs-submitter__content {
        max-height: 60vh;
        overflow: auto;
        -webkit-overflow-scrolling: touch;
      }

      .discogs-submitter__header {
        --icon-size: 24px;
        display: flex;
        align-items: center;
        gap: calc(var(--ds-gap) / 2);
        font-size: 20px;
        font-weight: 600;
      }

      .discogs-submitter__header__logo {
        flex: 0 0 auto;
        width: 1.25em;
        height: 1.25em;
      }

      .discogs-submitter__header__logo.is-loading {
        animation: ds-spinner 1s linear infinite;
      }

      .discogs-submitter__header__title small {
        font-size: 8px;
      }

      .discogs-submitter__header__drag-btn,
      .discogs-submitter__header__close-btn {
        width: var(--icon-size);
        height: var(--icon-size);
      }

      .discogs-submitter__header__drag-btn {
        margin-left: auto;
        display: flex;
        align-items: center;
        justify-content: space-evenly;
        flex-direction: column;
        cursor: grab;
      }

      .discogs-submitter__header__drag-btn::before,
      .discogs-submitter__header__drag-btn::after {
        content: '';
        width: 6px;
        height: 6px;
        background-color: currentColor;
        border-radius: 100%;
        transition: background-color 0.3s ease;
      }

      .discogs-submitter__header__drag-btn.is-draggable {
        cursor: grabbing;
      }

      .discogs-submitter__header__drag-btn:hover::before,
      .discogs-submitter__header__drag-btn:hover::after {
        background-color: var(--ds-color-info);
      }

      .discogs-submitter__header__close-btn {
        position: relative;
        z-index: 1;
        cursor: pointer;
      }

      .discogs-submitter__header__close-btn::before,
      .discogs-submitter__header__close-btn::after {
        position: absolute;
        z-index: 1;
        left: calc(var(--icon-size) / 2 - 1px);
        content: ' ';
        height: var(--icon-size);
        width: 3px;
        background-color: currentColor;
        transition: background-color 0.3s ease;
      }

      .discogs-submitter__header__close-btn::before {
        transform: rotate(45deg);
      }

      .discogs-submitter__header__close-btn::after {
        transform: rotate(-45deg);
      }

      .discogs-submitter__header__close-btn:hover::before,
      .discogs-submitter__header__close-btn:hover::after {
        background-color: var(--ds-color-error);
      }

      .discogs-submitter__preview-container {
        overflow: auto;
        max-height: 330px;
        background:
          linear-gradient(var(--ds-color-white) 30%, rgba(0, 0, 0, 0)),
          linear-gradient(rgba(0, 0, 0, 0), var(--ds-color-white) 70%) 0 100%,
          radial-gradient(farthest-side at 50% 0, rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0)),
          radial-gradient(farthest-side at 50% 100%, rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0)) 0 100%;
        background-repeat: no-repeat;
        background-size: 100% 40px, 100% 40px, 100% 20px, 100% 20px;
        background-attachment: local, local, scroll, scroll;
        scrollbar-width: thin;
        scrollbar-color: var(--ds-color-gray-dark) transparent;
      }

      .discogs-submitter__preview-container::-webkit-scrollbar {
        width: 6px;
      }

      .discogs-submitter__results {
        display: flex;
        flex-wrap: wrap;
        font-family: var(--ds-font-monospace);
        font-size: 10px;
        line-height: normal;
      }

      .discogs-submitter__results__row {
        width: 100%;
        display: grid;
        gap: calc(var(--ds-gap) / 4);
        grid-template-columns: 60px 1fr;
        padding: 2px 0;
        border-bottom: 1px dotted rgba(0, 0, 0, 0.2);
      }

      .discogs-submitter__results__row:hover {
        background: rgba(0, 0, 0, 0.05);
      }

      .discogs-submitter__results__row.is-half {
        width: 50%;
      }

      .discogs-submitter__results__row.is-tracklist {
        grid-template-columns: 20px 1fr 1fr 50px;
      }

      .discogs-submitter__results__row.is-tracklist.is-no-artist {
        grid-template-columns: 20px 1fr 50px;
      }

      .discogs-submitter__results__row.is-notes {
        grid-template-columns: 1fr;
      }

      .discogs-submitter__results__row.is-tracklist > .discogs-submitter__results__body:last-child {
        text-align: right;
      }

      .discogs-submitter__results__head {
        font-weight: bold;
      }

      .discogs-submitter__results__body em {
        font-style: normal;
        padding: 2px 4px;
        display: inline-block;
        vertical-align: baseline;
        background: rgba(0, 0, 0, 0.05);
        border-radius: calc(var(--ds-radius) / 4);
      }

      .discogs-submitter__results__body small {
        font-size: 9px;
      }

      .discogs-submitter__results__body input[type="radio"],
      .discogs-submitter__results__body input[type="checkbox"] {
        position: absolute;
        z-index: -1;
        width: 1px;
        height: 1px;
        opacity: 0;
      }

      .discogs-submitter__results__body label {
        display: inline-flex;
        align-items: center;
        gap: calc(var(--ds-gap) / 4);
        vertical-align: middle;
        color: var(--ds-color-white);
        margin: 0;
        padding: 2px 5px;
        background: var(--ds-color-gray-dark);
        border-radius: calc(var(--ds-radius) / 2);
        cursor: pointer;
        transition: background 0.3s ease;
      }

      .discogs-submitter__results__body input[type="radio"]:checked + label,
      .discogs-submitter__results__body input[type="checkbox"]:checked + label {
        background: var(--ds-color-primary);
      }

      .discogs-submitter__results__body input[type="radio"]:checked + label::before,
      .discogs-submitter__results__body input[type="checkbox"]:checked + label::before {
        content: '';
        width: 8px;
        height: 5px;
        margin-top: -2px;
        border: solid currentColor;
        border-width: 0 0 2px 2px;
        transform: rotate(-45deg);
      }

      .discogs-submitter__results__body input[type="radio"]:disabled + label,
      .discogs-submitter__results__body input[type="checkbox"]:disabled + label {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .discogs-submitter__status-container {
        --status-color: var(--ds-color-gray-dark);
        position: relative;
        z-index: 1;
        display: flex;
        justify-content: space-between;
        align-items: start;
        gap: var(--ds-gap);
        margin-bottom: var(--ds-gap);
        padding: calc(var(--ds-gap) / 2);
        border-left: 4px solid var(--status-color);
        border-radius: calc(var(--ds-radius) / 2);
        transition: border-color 0.3s ease;
      }

      .discogs-submitter__status-container::after {
        content: '';
        position: absolute;
        z-index: -1;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: var(--status-color);
        opacity: 0.1;
        transition: background 0.3s ease;
      }

      .discogs-submitter__status-container.is-success {
        --status-color: var(--ds-color-success);
      }

      .discogs-submitter__status-container.is-error {
        --status-color: var(--ds-color-error);
      }

      .discogs-submitter__status-container.is-info {
        --status-color: var(--ds-color-info);
      }

      .discogs-submitter__status-debug-btn {
        font-size: 18px;
        cursor: pointer;
      }

      .discogs-submitter__actions {
        display: flex;
        flex-wrap: nowrap;
        gap: var(--ds-gap);
      }

      .discogs-submitter__actions__btn-submit {
        display: block;
        width: 100%;
        color: var(--ds-color-white);
        font-size: 16px;
        font-weight: bold;
        text-align: center;
        padding: calc(var(--ds-gap) / 2) calc(var(--ds-gap) / 4);
        background: var(--ds-color-primary);
        border-radius: calc(var(--ds-radius) / 2);
        cursor: pointer;
        transition: background 0.3s ease, opacity 0.3s ease;
        user-select: none;
      }

      .discogs-submitter__actions__btn-submit:hover {
        background: var(--ds-color-black);
      }

      .discogs-submitter__actions__btn-submit.is-disabled {
        opacity: 0.5;
        pointer-events: none;
      }

      .discogs-submitter__copyright {
        display: flex;
        justify-content: center;
        gap: var(--ds-gap);
        font-size: 10px;
        margin: var(--ds-gap) 0 0;
      }

      .discogs-submitter__copyright a {
        color: currentColor;
        text-decoration: none;
      }

      .discogs-submitter__copyright a:hover {
        text-decoration: underline;
      }

      .discogs-submitter__copyright .is-heart {
        display: inline-block;
        vertical-align: middle;
        font-family: var(--ds-font-monospace);
        color: var(--ds-color-error);
        animation: ds-heart 1s ease-in-out infinite;
      }

      @keyframes ds-spinner {
        0% {
          transform: rotate(0);
        }
        100% {
          transform: rotate(360deg);
        }
      }

      @keyframes ds-heart {
        0% {
          transform: scale(1);
        }
        50% {
          transform: scale(1.2);
        }
        100% {
          transform: scale(1);
        }
      }

      .discogs-submitter__inject__btn {
        display: inline-flex;
        vertical-align: middle;
        align-items: center;
        justify-content: center;
        gap: 10px;
        cursor: pointer;
        user-select: none;
      }

      .discogs-submitter__inject__logo {
        display: block;
        width: 1.25em;
        height: 1.25em;
      }

      .discogs-submitter__inject__btn:hover .discogs-submitter__inject__logo {
        animation: ds-spinner 1s linear infinite;
      }

      .discogs-submitter__inject__btn.is-disabled {
        opacity: 0.5;
        pointer-events: none;
      }

      .discogs-submitter__inject__btn.is-bandcamp {
        margin-bottom: 1.5em;
        padding: 8px 5px;
        box-sizing: border-box;
      }

      .discogs-submitter__inject__btn.is-qobuz {
        margin-top: 20px;
        text-transform: none;
      }

      .discogs-submitter__inject__btn.is-qobuz .discogs-submitter__inject__logo {
        margin-top: -4px;
      }

      .discogs-submitter__inject__btn.is-junodownload {
        margin-top: 20px;
      }

      .discogs-submitter__inject__btn.is-beatport {
        margin-top: 8px;
      }
    `,

    /**
     * HTML structure for the widget.
     */
    widgetSkeleton: `
      <div class="discogs-submitter__header">
        <img class="discogs-submitter__header__logo" src="${GM_info.script.icon}" alt="${GM_info.script.name} Logo" />
        <span class="discogs-submitter__header__title">${GM_info.script.name} <small>v${GM_info.script.version}</small></span>
        <div class="discogs-submitter__header__drag-btn" title="Grab to move" role="button"></div>
        <div class="discogs-submitter__header__close-btn" title="Close widget" role="button"></div>
      </div>
      <div class="discogs-submitter__content">
        <div class="discogs-submitter__preview-container"></div>
      </div>
      <div class="discogs-submitter__footer">
        <div class="discogs-submitter__status-container">
          <div class="discogs-submitter__status-text">Waiting...</div>
          <div class="discogs-submitter__status-debug-btn" role="button" title="Copy debug" hidden>🐞</div>
        </div>
        <div class="discogs-submitter__actions">
          <div class="discogs-submitter__actions__btn-submit" role="button" hidden>Submit to Discogs</div>
        </div>
        <div class="discogs-submitter__copyright">
          <a href="${GM_info.script.homepageURL}" target="_blank">Homepage</a>
          <a href="${GM_info.script.supportURL}" target="_blank">Report Bug</a>
          <a href="https://buymeacoffee.com/denis_g" target="_blank">Made with <span class="is-heart">♥</span> for music</a>
        </div>
      </div>
    `,

    /**
     * HTML for the store-injected button.
     */
    injectButtonSkeleton: `
      <div class="discogs-submitter__inject__btn" role="button">
        <img class="discogs-submitter__inject__logo" src="${GM_info.script.icon}" alt="${GM_info.script.name} Logo" />
        <span>${GM_info.script.name}</span>
      </div>
    `,

    /**
     * Renders a styled HTML summary of the parsed release to preview in the widget.
     * @param {Object} release - The cleaned, structured release object.
     * @param {Object} options - Rendering options (selectedFormat, is24Bit, supports).
     * @returns {string} Fully constructed HTML block.
     */
    releasePreview: (release, options) => {
      const { selectedFormat = '', is24Bit = false } = options || {};
      const supports = options?.supports || { formats: [], '24bit': true };
      const availableFormats = supports.formats || [];
      const supports24bit = supports['24bit'];

      const is24BitDisabled = selectedFormat === 'MP3' || !supports24bit;
      const effective24Bit = is24BitDisabled ? false : is24Bit;

      const artists = release.artists?.length ? release.artists.map((a, i, arr) => `<em>${a.name}</em>${a.join && i < arr.length - 1 ? ` ${a.join} ` : ''}`).join('') : '⚠️';
      const extraArtists = release.extraartists?.length ? release.extraartists.map(a => `${a.role} – <em>${a.name}</em>`).join('<br />') : null;
      const title = release.title || '⚠️';
      const format = release.format?.length ? release.format.map(f => `${f.name}, Qty: ${f.qty}`).join(', ') : '⚠️';
      const label = release.labels[0]?.name || '⚠️';
      const number = release.labels[0]?.catno || '⚠️';
      const country = release.country || '–';
      const released = release.released || '⚠️';
      const notes = release.notes ? release.notes.replace(/\n/g, '<br/>') : '–';

      const typeHtml = release.format?.some(f => f.name === 'File')
        ? `
          , Type:
          ${availableFormats
            .map(
              f => `
              <input type="radio" id="ds[format][${f.toLowerCase()}]" name="ds[format]" tabindex="-1" value="${f}" class="is-format" ${selectedFormat === f ? 'checked' : ''} />
              <label for="ds[format][${f.toLowerCase()}]">${f}</label>
            `
            )
            .join('')}
          <input type="checkbox" id="ds[format][24bit]" tabindex="-1" class="is-24bit" ${effective24Bit ? 'checked' : ''} ${is24BitDisabled ? 'disabled' : ''} />
          <label for="ds[format][24bit]">24-bit</label>
        `
        : '';

      const hasTrackArtists = (release.tracks || []).some(t => t.artists && t.artists.length > 0);
      const rowBaseClass = hasTrackArtists ? '' : 'is-no-artist';

      let tracksHtml = `
        <div class="discogs-submitter__results__row is-tracklist ${rowBaseClass}">
          <div class="discogs-submitter__results__head">#</div>
          ${hasTrackArtists ? '<div class="discogs-submitter__results__head">Artist</div>' : ''}
          <div class="discogs-submitter__results__head">Title</div>
          <div class="discogs-submitter__results__head">Duration</div>
        </div>
      `;

      if (release.tracks && release.tracks.length) {
        release.tracks.forEach(track => {
          const trackArtists = track.artists?.length ? track.artists.map((a, i, arr) => `<em>${a.name}</em>${a.join && i < arr.length - 1 ? ` ${a.join} ` : ''}`).join('') : '';
          const trackExtraArtists = track.extraartists?.length ? track.extraartists.map(a => `${a.role} – <em>${a.name}</em>`).join('<br />') : '';

          tracksHtml += `
            <div class="discogs-submitter__results__row is-tracklist ${rowBaseClass}">
              <div class="discogs-submitter__results__body">${track.pos || '⚠️'}</div>
              ${hasTrackArtists ? `<div class="discogs-submitter__results__body">${trackArtists}</div>` : ''}
              <div class="discogs-submitter__results__body">
                <div>${track.title || '⚠️'}</div>
                ${trackExtraArtists ? `<small>${trackExtraArtists}</small>` : ''}
              </div>
              <div class="discogs-submitter__results__body">${track.duration || '⚠️'}</div>
            </div>
          `;
        });
      } else {
        tracksHtml += `
          <div class="discogs-submitter__results__row">
            <div class="discogs-submitter__results__body">⚠️ No tracks found.</div>
          </div>
        `;
      }

      return `
        <div class="discogs-submitter__results">
          <div class="discogs-submitter__results__row">
            <div class="discogs-submitter__results__head">Artist</div>
            <div class="discogs-submitter__results__body">${artists}</div>
          </div>
          <div class="discogs-submitter__results__row">
            <div class="discogs-submitter__results__head">Title</div>
            <div class="discogs-submitter__results__body">${title}</div>
          </div>
          <div class="discogs-submitter__results__row">
            <div class="discogs-submitter__results__head">Label</div>
            <div class="discogs-submitter__results__body">${label}</div>
          </div>
          <div class="discogs-submitter__results__row">
            <div class="discogs-submitter__results__head">Catalog</div>
            <div class="discogs-submitter__results__body">${number}</div>
          </div>
          <div class="discogs-submitter__results__row is-half">
            <div class="discogs-submitter__results__head">Released</div>
            <div class="discogs-submitter__results__body">${released}</div>
          </div>
          <div class="discogs-submitter__results__row is-half">
            <div class="discogs-submitter__results__head">Country</div>
            <div class="discogs-submitter__results__body">${country}</div>
          </div>
          <div class="discogs-submitter__results__row">
            <div class="discogs-submitter__results__head">Format</div>
            <div class="discogs-submitter__results__body">${format}${typeHtml}</div>
          </div>
          ${tracksHtml}
          ${
            extraArtists
              ? `
              <div class="discogs-submitter__results__row is-notes">
                <div class="discogs-submitter__results__head">Credits</div>
                <div class="discogs-submitter__results__body">${extraArtists}</div>
              </div>
                `
              : ''
          }
          <div class="discogs-submitter__results__row is-notes">
            <div class="discogs-submitter__results__head">Notes</div>
            <div class="discogs-submitter__results__body">${notes}</div>
          </div>
        </div>
      `;
    },
  };

  /**
   * Internal helpers for configuration and parsing.
   */
  const Helper = {
    /**
     * Shared templates for artist credits to prevent duplication.
     * @type {string[]}
     */
    GLOBAL_CREDIT_REGEX: [
      // Bracketed: (Credit Artist), (Credit By Artist), [Credit: Artist]
      '(?:\\(|\\[)\\s*{{p}}\\b\\s*(?:by)?\\s*[:\\s-]*(.+?)(?:\\)|\\])',
      // Inline with "by" keyword: "Credit by Artist", "Credit by: Artist"
      '(?:\\s+|^){{p}}\\s+by\\b\\s*[:\\s-]*(.+?)(?=\\s*(?:\\/|;|[A-Z][a-z]+:|,|$))',
      // Inline with colon or dash: "Credit: Artist", "Credit - Artist"
      '(?:\\s+|^){{p}}\\b\\s*[:-]\\s*(.+?)(?=\\s*(?:\\/|;|[A-Z][a-z]+:|,|$))',
    ],

    /**
     * Dynamically generates regex objects for artist credits or string cleaning.
     * Replaces the {{p}} placeholder in templates with the provided phrases.
     * Automatically handles space normalization (escaping spaces as \s+).
     * Strips the \\b word boundary after {{p}} when the phrase ends with a non-word character
     * (e.g., 'f/', 'producer:') to avoid invalid regex assertions.
     * @param {string[]} phrases - List of phrases (e.g. ['remix', 'rmx']).
     * @param {string[]} templates - Regex template strings using '{{p}}' for phrase injection.
     * @returns {RegExp[]} Array of compiled case-insensitive regular expressions.
     */
    buildCreditRegexes: (phrases, templates) =>
      phrases.flatMap(phrase => {
        const p = phrase.replace(/\s+/g, '\\s+');

        return templates.map(t => {
          let finalTemplate = t;
          if (!/[a-zA-Z0-9_]$/.test(phrase)) {
            finalTemplate = finalTemplate.replace(/\{\{p\}\}\\b/g, '{{p}}');
          }
          return new RegExp(finalTemplate.replace(/\{\{p\}\}/g, p), 'i');
        });
      }),

    ignoreCapitalizationMap: new Map(),
    escapedJoiners: [],
    joinerPattern: null,
    oxfordPattern: null,

    /**
     * Initializes pre-calculated performance structures after PATTERNS is defined.
     */
    init: () => {
      PATTERNS.ignoreCapitalization.forEach(ex => {
        Helper.ignoreCapitalizationMap.set(ex.replace(/\./g, '').toUpperCase(), ex);
      });

      Helper.escapedJoiners = PATTERNS.joiners.map(j => j.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

      const strongJoiners = Helper.escapedJoiners.filter(j => j.toLowerCase() !== 'x');
      const xJoiner = Helper.escapedJoiners.find(j => j.toLowerCase() === 'x');
      const strongPattern = `(?:\\s+(?:${strongJoiners.join('|')})(?=\\s+)|\\s*,\\s*)`;

      if (xJoiner) {
        // Standalone X is a joiner ONLY if not immediately followed by another "strong" joiner (to avoid cases like "Adam X and ...")
        const xPattern = `\\s+${xJoiner}(?=\\s+(?!${strongJoiners.join('|')}|,))`;

        Helper.joinerPattern = new RegExp(`((?:${strongPattern})+|${xPattern})`, 'i');
      } else {
        Helper.joinerPattern = new RegExp(`((?:${strongPattern})+)`, 'i');
      }

      const nonCommaJoiners = Helper.escapedJoiners.filter(j => j !== ',');

      Helper.oxfordPattern = nonCommaJoiners.length > 0 ? new RegExp(`,\\s*(${nonCommaJoiners.join('|')})(?:\\s+|$)`, 'ig') : null;
    },
  };

  /**
   * Global patterns for artist joiners, various artists, and artist credits.
   */
  const PATTERNS = {
    joiners: [',', '/', 'And', '&', 'X', 'With', 'w/', 'Vs', 'Vs.', 'Versus'],
    variousArtists: Helper.buildCreditRegexes(
      // normalize various artists to "Various"
      ['Various', 'Various Artists', 'Varios', 'Varios Artistas', 'Různí', 'Různí interpreti', 'VA', 'V\\/A'],
      ['^{{p}}$']
    ),
    removeFromArtistName: [],
    removeFromTitleName: Helper.buildCreditRegexes(
      ['original mix', 'original', 'remastered', 'explicit', 'digital bonus track', 'digital bonus', 'bonus track', 'bonus', '24 bit', '16 bit'],
      // "(Pattern)", "[Pattern]", "- Pattern"
      ['\\(\\s*{{p}}\\s*\\)', '\\[\\s*{{p}}\\s*\\]', '-\\s*{{p}}\\b']
    ),
    artistCredit: {
      Featuring: Helper.buildCreditRegexes(
        ['featuring', 'feat', 'ft', 'f/'],
        [
          // Bracketed: "(feat. Artist)", "[ft Artist]"
          '(?:\\(|\\[)\\s*{{p}}\\b\\.?\\s*(.*?)(?:\\)|\\])',
          // Inline: "feat. Artist" – stops at the next known credit keyword or bracket
          '(?:\\s+|^){{p}}\\b\\.?\\s*(.+?)(?=\\s+\\b(?:feat|ft|prod|remix|vs|with|and|&)\\b|[\\[\\(]|$)',
        ]
      ),
      Remix: Helper.buildCreditRegexes(
        ['remix', 'rmx', 're-mix', 'version', 'edit', 're-edit', 'mix', 'rework', 'rebuild', 'rebuilt'],
        [
          // Bracketed: "(Remix By Artist)", "(Artist Remix)"
          '(?:\\(|\\[)\\s*{{p}}\\b\\s*(?:by)?\\s*[:\\s-]*(.+?)(?:\\)|\\])',
          // Inline with dash prefix: "- Remix By Artist"
          '(?:\\s+|^)-\\s*{{p}}\\b\\s*(?:by)?\\s*[:\\s-]*(.+?)(?=\\s*[\\[\\(]|$)',
        ]
      ),
      'Compiled By': Helper.buildCreditRegexes(
        ['compiled'],
        // default
        Helper.GLOBAL_CREDIT_REGEX
      ),
      Producer: Helper.buildCreditRegexes(
        ['produced', 'producer'],
        // default
        Helper.GLOBAL_CREDIT_REGEX
      ),
      Artwork: Helper.buildCreditRegexes(
        ['artwork', 'art'],
        // default
        Helper.GLOBAL_CREDIT_REGEX
      ),
      'Mastered By': Helper.buildCreditRegexes(
        ['mastered', 'mastering', 'master'],
        // default
        Helper.GLOBAL_CREDIT_REGEX
      ),
      'Written-By': Helper.buildCreditRegexes(
        ['written', 'written-by', 'writing'],
        // default
        Helper.GLOBAL_CREDIT_REGEX
      ),
      'DJ Mix': Helper.buildCreditRegexes(
        ['dj mix', 'dj-mix'],
        // default
        Helper.GLOBAL_CREDIT_REGEX
      ),
    },
    ignoreCapitalization: ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'AM', 'PM', 'AI', 'DJ', 'MC', 'EP', 'CD', 'DVD', 'HD', 'LP', 'DAT', 'NASA', 'FM', 'VHS', 'VIP', 'UK', 'USA', 'UFO', 'WTF'],
  };

  Helper.init();

  /**
   * Adapter for transforming parsed digital store data into Discogs API payload.
   */
  const DiscogsAdapter = {
    /**
     * Builds the Discogs release payload from parsed store data.
     * @param {Object} data - Parsed data from the digital store.
     * @param {string} sourceUrl - The original URL the data was parsed from.
     * @param {Object} [options] - Optional format configuration.
     * @param {string} [options.format='WAV'] - Selected download format.
     * @param {boolean} [options.is24Bit=false] - Whether the release is 24-bit.
     * @returns {Object} Payload with _previewObject, full_data (JSON), and sub_notes.
     */
    buildPayload: (data, sourceUrl, options) => {
      const { format = 'WAV', is24Bit = false } = options || {};

      const releaseArtistsArr = data.artists || [];
      const tracks = data.tracks || [];

      // Determine if all tracks have the same artist list
      const firstTrackArtists = tracks[0]?.artists || [];
      const allTracksShareSameArtists =
        tracks.length > 0 &&
        tracks.every(track => {
          const trackArtists = track.artists || [];

          if (trackArtists.length !== firstTrackArtists.length) {
            return false;
          }

          return trackArtists.every((a, i) => a.name === firstTrackArtists[i].name && a.join === firstTrackArtists[i].join);
        });

      // If all tracks match, we elevate the common track artist to the release level.
      // This ensures that if the artist is the same for all tracks, it's moved to the release level
      // and cleared from individual tracks in the final payload.
      let finalReleaseArtists = releaseArtistsArr;

      if (allTracksShareSameArtists && firstTrackArtists.length > 0) {
        finalReleaseArtists = firstTrackArtists;
      }

      const primaryArtistName = (finalReleaseArtists[0]?.name || '').trim();

      // Check if the final release artists match the track artists (for deduplication)
      const allTracksMatchRelease =
        tracks.length > 0 &&
        tracks.every(track => {
          const trackArtists = track.artists || [];

          if (trackArtists.length !== finalReleaseArtists.length) {
            return false;
          }

          const tNames = trackArtists.map(a => (a.name || '').trim().toLowerCase()).sort();
          const rNames = finalReleaseArtists.map(a => (a.name || '').trim().toLowerCase()).sort();

          return JSON.stringify(tNames) === JSON.stringify(rNames);
        });

      const labelName = data.label && primaryArtistName && data.label === primaryArtistName ? `Not On Label (${primaryArtistName} Self-released)` : data.label || 'Not On Label';
      let formatText = '';

      if (format === 'MP3') {
        formatText = '320 kbps';
      } else if (is24Bit) {
        formatText = '24-bit';
      }

      const totalTracks = data.tracks?.length ? `${data.tracks.length}` : '1';
      const validBpmTracks = (data.tracks || []).filter(track => track.bpm);
      const infoBpm = validBpmTracks.length > 0 ? `BPM's:\n${validBpmTracks.map(track => `${track.position}: ${track.bpm}`).join('\n')}` : '';

      const payload = {
        cover: data.cover || null,
        title: data.title || '',
        artists: finalReleaseArtists.length ? finalReleaseArtists : [{ name: '', join: ',' }],
        extraartists: Utils.groupExtraArtists(data.extraartists || []),
        country: data.country || '',
        released: data.released || '',
        labels: labelName ? [{ name: labelName, catno: data.number || 'none' }] : [],
        format: [{ name: 'File', qty: totalTracks, desc: [format], text: formatText }],
        tracks: (data.tracks || []).map(track => ({
          pos: track.position || '',
          artists: allTracksMatchRelease ? [] : track.artists || [],
          extraartists: Utils.groupExtraArtists(track.extraartists || []),
          title: track.title || '',
          duration: track.duration || '',
        })),
        notes: infoBpm,
      };

      return {
        _previewObject: payload,
        full_data: JSON.stringify(payload),
        sub_notes: `${sourceUrl}\n---\nDigital release in ${format} format has been added.`,
      };
    },
  };

  /**
   * General utility functions for parsing, formatting, and making requests.
   */
  const Utils = {
    /**
     * Trims, collapses multiple spaces/newlines/tabs into a single space,
     * and replaces &nbsp; entities. Returns null if the result is an empty string.
     * Non-string values are returned as-is.
     * @param {*} str - The value to clean.
     * @returns {string|null|*} Cleaned string, null if empty, or the original value if not a string.
     */
    cleanString: str => {
      if (typeof str !== 'string' && !(str instanceof String)) {
        return str;
      }

      return (
        str
          .replace(/&nbsp;/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim() || null
      );
    },

    /**
     * Normalizes duration strings/numbers.
     * @param {string|number} rawDuration - Raw duration value.
     * @returns {string|null} Normalized duration or null if invalid.
     */
    normalizeDuration: rawDuration => {
      if (!rawDuration) {
        return null;
      }

      const trimmed = String(rawDuration).trim();

      // Seconds based (ex. 326 or 397.24) - Bandcamp, Juno Download, 7digital
      if (/^\d+(\.\d+)?$/.test(trimmed)) {
        const totalSeconds = Math.round(parseFloat(trimmed));
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        const timeParts = [minutes, seconds].map(val => String(val).padStart(2, '0'));

        if (hours > 0) {
          timeParts.unshift(hours);
        } else {
          // Remove leading zero from minutes if no hours (e.g., "05:23" -> "5:23")
          timeParts[0] = parseInt(timeParts[0], 10).toString();
        }

        return timeParts.join(':');
      }

      // Standard HMS/MS based (ex. 01:23 or 01:23:45) - Qobuz
      const hmsMatch = trimmed.match(/^(\d+:)?\d{1,2}:\d{2}$/);

      if (hmsMatch) {
        const parts = trimmed.split(':').map(p => p.padStart(2, '0'));

        // If HH is 00, remove it
        if (parts.length === 3 && parseInt(parts[0], 10) === 0) {
          parts.shift();
        }

        // Remove leading zero from first segment (H or M)
        parts[0] = parseInt(parts[0], 10).toString();

        return parts.join(':');
      }

      return trimmed;
    },

    /**
     * Normalizes release dates into YYYY-MM-DD or YYYY format.
     * @param {string} date - Raw date string.
     * @returns {string|null} Normalized date (ISO-like) or raw input.
     */
    normalizeReleaseDate: date => {
      if (!date) {
        return null;
      }

      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      // 05 Aug 2024 or Aug 2024 - Bandcamp
      const gmtMatch = date.match(/(?:(\d{1,2})\s+)?([a-z]{3,})\s+(\d{4})/i);

      if (gmtMatch) {
        const day = gmtMatch[1] ? String(gmtMatch[1]).padStart(2, '0') : '00';
        const monthStr = gmtMatch[2].substring(0, 3).toLowerCase();
        const monthIndex = months.findIndex(m => m.toLowerCase() === monthStr);
        const year = gmtMatch[3];

        if (monthIndex !== -1) {
          return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${day}`;
        }
      }

      // 05/08/2024 - 7digital
      const euroDateMatch = date.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);

      if (euroDateMatch) {
        const day = euroDateMatch[1].padStart(2, '0');
        const month = euroDateMatch[2].padStart(2, '0');
        const year = euroDateMatch[3];

        return `${year}-${month}-${day}`;
      }

      // 14 April, 2011 - Juno Download
      const dateMatch = date.match(/(\d{1,2})\s+([a-z]{3,}),?\s+(\d{4})/i);

      if (dateMatch) {
        const day = dateMatch[1].padStart(2, '0');
        const monthStr = dateMatch[2].substring(0, 3).toLowerCase();
        const monthIndex = months.findIndex(m => m.toLowerCase() === monthStr);
        const year = dateMatch[3];

        if (monthIndex !== -1) {
          return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${day}`;
        }
      }

      const yearOnlyMatch = date.match(/\b(19|20)\d{2}\b/);

      if (yearOnlyMatch) {
        return yearOnlyMatch[0];
      }

      return date;
    },

    /**
     * Extracts text or attribute value from a DOM element safely.
     * @param {string} target - CSS selector.
     * @param {HTMLElement|Document|null} [parent=null] - Context within which to search.
     * @param {string} [attribute=''] - Attribute to retrieve instead of inner text.
     * @param {boolean} [keepNewlines=false] - Whether to preserve newlines in the output.
     * @returns {string|null} Extracted text/value.
     */
    getTextFromTag: (target, parent = null, attribute = '', keepNewlines = false) => {
      const context = parent || document;
      const result = context.querySelector(target);

      if (!result) {
        return null;
      }

      if (attribute !== '') {
        return Utils.cleanString(result.getAttribute(attribute));
      }

      const text = result.innerText || result.textContent || '';

      return keepNewlines ? text : Utils.cleanString(text);
    },

    /**
     * Parses a string of artists separated by joiners.
     * @param {string} artistString - The raw string of artists.
     * @param {Array<{name: string, role: string}>} [extraArtists] - Collector for any credits found during internal normalization.
     * @returns {Array<{name: string, join: string}>} List of artist objects with name and trailing joiner.
     */
    parseArtists: (artistString, extraArtists = null) => {
      if (!artistString) {
        return [];
      }

      if (Helper.oxfordPattern) {
        artistString = artistString.replace(Helper.oxfordPattern, ' $1 ');
      }

      const parts = artistString.split(Helper.joinerPattern);
      const artists = [];

      for (let i = 0; i < parts.length; i += 2) {
        const rawName = parts[i].trim();
        const join = parts[i + 1] || null;

        if (rawName) {
          // Use normalizeArtists to clean the name, but keep our join property
          // We pass isSubcall=true to avoid recursive splitting
          const normalized = Utils.normalizeArtists(rawName, extraArtists, true);

          if (normalized.length > 0) {
            const artist = { ...normalized[0] };

            if (join) {
              const originalJoin = PATTERNS.joiners.find(j => j.toLowerCase() === join.trim().toLowerCase());

              artist.join = originalJoin || join;
            } else {
              artist.join = ',';
            }

            artists.push(artist);
          }
        }
      }

      return artists;
    },

    /**
     * Normalizes and standardizes the release-level artist list.
     * Implements "Compiled By" elevation (promoting compilers to main artists for VA releases),
     * various artists detection, and fallback to "Various" for releases with > 5 artists.
     * @param {string|string[]} rawArtists - Raw artist(s) name(s) from the source page.
     * @param {Array<{name: string, role: string}>} [extraArtists] - Accumulated credits.
     * @returns {Array<{name: string, join: string}>} Normalized list of release artists.
     */
    normalizeMainArtists: (rawArtists, extraArtists = null) => {
      const normalized = Utils.normalizeArtists(rawArtists, extraArtists);
      const vaPatterns = PATTERNS.variousArtists;

      // If "Compiled By" is in extraArtists, use it as main artist
      if (Array.isArray(extraArtists)) {
        const compilers = extraArtists.filter(a => a.role === 'Compiled By');

        if (compilers.length > 0) {
          // Deduplicate compilers case-insensitively and handle overlapping names
          const uniqueCompilers = [];

          compilers.forEach(c => {
            const currentName = c.name.toLowerCase();
            const existingIndex = uniqueCompilers.findIndex(u => {
              const uName = u.name.toLowerCase();

              return uName.includes(currentName) || currentName.includes(uName);
            });

            if (existingIndex === -1) {
              uniqueCompilers.push(c);
            } else if (currentName.length > uniqueCompilers[existingIndex].name.toLowerCase().length) {
              // Keep the longer (usually more descriptive) name
              uniqueCompilers[existingIndex] = c;
            }
          });

          return uniqueCompilers.map(c => ({ name: c.name, join: ',' }));
        }
      }

      if (normalized.length > 5) {
        return [{ name: 'Various', join: ',' }];
      }

      if (Array.isArray(vaPatterns) && vaPatterns.length > 0) {
        const isVA = normalized.some(a => vaPatterns.some(pattern => pattern.test(a.name)));

        if (isVA) {
          return [{ name: 'Various', join: ',' }];
        }
      }

      return normalized;
    },

    /**
     * Standardizes casing to Title Case, cleans whitespace, and handles abbreviations.
     * @param {string} str - The string to capitalize.
     * @returns {string} The capitalized string.
     */
    capitalizeString: str => {
      if (!str) {
        return '';
      }

      let cleaned = String(str).trim();

      // Standardizes apostrophes and accents
      // (’, `, ´ -> ')
      cleaned = cleaned.replace(/[’`´]/g, "'");

      // Cleans whitespace inside parentheses
      // "( text )" -> "(text)"
      cleaned = cleaned.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');

      // Standardize casing to Title Case
      return cleaned
        .split(/(\s+|(?=[/])|(?<=[/]))/)
        .map(word => {
          if (!word || /\s+/.test(word) || word === '/') {
            return word;
          }

          // Find the alphanumeric core (including Unicode letters/numbers) to check against exceptions and capitalize
          const match = word.match(/^([^\p{L}\p{N}]*)(.*?)(([^\p{L}\p{N}]*))$/iu);

          if (!match) {
            return word;
          }

          const prefix = match[1];
          const core = match[2];
          const suffix = match[3];

          // preserve dotted abbreviations like "A.I." or "U.S.A." (all uppercase)
          if (/^[A-Z](?:\.[A-Z])+\.?$/i.test(core + suffix)) {
            return prefix + (core + suffix).toUpperCase();
          }

          const upperCore = core.toUpperCase();
          const upperCoreNoDots = upperCore.replace(/\./g, '');
          const exception = Helper.ignoreCapitalizationMap.get(upperCoreNoDots);

          if (exception) {
            return prefix + exception + suffix;
          }

          if (core.length > 0) {
            const capitalizedCore = core.charAt(0).toUpperCase() + core.slice(1).toLowerCase();
            return prefix + capitalizedCore + suffix;
          }

          return word;
        })
        .join('');
    },

    /**
     * Merges multiple credits for the same artist into a single entry with combined roles.
     * @param {Array<{name: string, role: string}>} artists - List of artist credits.
     * @returns {Array<{name: string, role: string}>} Grouped artist credits.
     */
    groupExtraArtists: artists => {
      if (!Array.isArray(artists) || !artists.length) {
        return [];
      }

      const grouped = new Map();

      artists.forEach(a => {
        if (!a.name || !a.role) {
          return;
        }

        const name = a.name.trim();

        if (!grouped.has(name)) {
          grouped.set(name, new Set());
        }

        grouped.get(name).add(a.role.trim());
      });

      return Array.from(grouped.entries()).map(([name, roles]) => ({
        name,
        role: Array.from(roles).join(', '),
      }));
    },

    /**
     * Cleans and standardizes artist names while extracting credits.
     * @param {string|string[]} artists - Artist name(s) to normalize.
     * @param {Array<{name: string, role: string}>} [extraArtists] - Collector for credits found inside the artist string.
     * @param {boolean} [isSubcall=false] - Internal flag to prevent infinite recursion during splitting.
     * @returns {Array<{name: string, join: string}>} List of cleaned artist objects.
     */
    normalizeArtists: (artists, extraArtists = null, isSubcall = false) => {
      if (!artists) {
        return [{ name: '', join: ',' }];
      }

      if (Array.isArray(artists) && !isSubcall) {
        artists = artists.filter(Boolean).join(', ');
      }

      if (typeof artists === 'string' && !isSubcall) {
        return Utils.parseArtists(artists, extraArtists);
      }

      const artistList = Array.isArray(artists) ? artists : [artists];
      const normalized = artistList
        .map(raw => {
          if (!raw) {
            return null;
          }

          let cleaned = Utils.cleanString(raw);

          if (Array.isArray(extraArtists)) {
            Object.entries(PATTERNS.artistCredit).forEach(([role, patterns]) => {
              patterns.forEach(pattern => {
                let match = cleaned.match(pattern);
                while (match) {
                  if (match[1]) {
                    const items = Utils.parseArtists(match[1], extraArtists);

                    items.forEach(it => {
                      if (it.name && !extraArtists.some(ex => ex.name === it.name && ex.role === role)) {
                        extraArtists.push({ name: it.name, role });
                      }
                    });
                  }

                  cleaned = cleaned
                    .replace(pattern, '')
                    .replace(/\s{2,}/g, ' ')
                    .trim();

                  match = cleaned.match(pattern);
                }
              });
            });
          }

          const patternsToRemove = PATTERNS.removeFromArtistName;

          if (Array.isArray(patternsToRemove)) {
            patternsToRemove.forEach(pattern => {
              cleaned = cleaned.replace(pattern, '').trim();
            });
          }

          return Utils.capitalizeString(cleaned);
        })
        .filter(Boolean);

      return normalized.map(name => ({ name, join: ',' }));
    },

    /**
     * Cleans track titles, standardizes casing, and extracts artist credits.
     * @param {string} rawTitle - The original track title.
     * @param {Array<{name: string, role: string}>} [extraArtists] - Collector for credits found inside the title.
     * @returns {string} The cleaned track title.
     */
    normalizeTrackTitle: (rawTitle, extraArtists = null) => {
      if (!rawTitle) {
        return '';
      }

      let title = Utils.capitalizeString(rawTitle);

      if (Array.isArray(extraArtists)) {
        Object.entries(PATTERNS.artistCredit).forEach(([role, patterns]) => {
          patterns.forEach(pattern => {
            let match = title.match(pattern);
            while (match) {
              if (match[1]) {
                const items = Utils.parseArtists(match[1], extraArtists);

                items.forEach(it => {
                  if (it.name && !extraArtists.some(ex => ex.name === it.name && ex.role === role)) {
                    extraArtists.push({ name: it.name, role });
                  }
                });
              }

              title = title
                .replace(pattern, '')
                .replace(/\s{2,}/g, ' ')
                .trim();

              match = title.match(pattern);
            }
          });
        });
      }

      PATTERNS.removeFromTitleName.forEach(pattern => {
        title = title.replace(pattern, '').trim();
      });

      return Utils.cleanString(title);
    },

    /**
     * Helper to perform cross-origin requests using GM.xmlHttpRequest via a Promise.
     * @param {Object} options - Standard GM.xmlHttpRequest options.
     * @param {number} [retries=2] - Number of times to retry the request on failure/timeout.
     * @param {number} [timeout=15000] - Request timeout in milliseconds.
     * @returns {Promise<string|Blob>} Resolves with responseText or response Blob on success.
     */
    networkRequest: (options, retries = 2, timeout = 15000) => {
      const attempt = currentTry =>
        new Promise((resolve, reject) => {
          const config = {
            method: 'GET',
            timeout,
            responseType: 'text',
            ...options,
          };

          GM.xmlHttpRequest({
            ...config,
            onload: response => {
              if (response.status >= 200 && response.status < 300) {
                resolve(config.responseType === 'text' ? response.responseText : response.response);
              } else {
                reject(new Error(`HTTP Error: ${response.status} ${response.statusText || ''}`.trim()));
              }
            },
            onerror: response => {
              reject(new Error(`Network Error: ${response.status} ${response.statusText || ''}`.trim() || 'Connection failed'));
            },
            ontimeout: () => reject(new Error('Request timed out')),
          });
        }).catch(error => {
          if (currentTry < retries) {
            console.warn(`[Discogs Submitter] Request failed (${error.message}). Retrying... (${currentTry + 1}/${retries})`);

            return attempt(currentTry + 1);
          }

          throw error;
        });

      return attempt(0);
    },
  };

  /**
   * Registry of supported digital stores containing logic for parsing and UI injection.
   */
  const DigitalStoreRegistry = {
    /**
     * List of all supported digital stores.
     * @type {Array<Object>}
     */
    list: [
      {
        id: 'bandcamp',
        test: url => /bandcamp\.com\/album\//i.test(url),
        target: '.tralbumCommands',
        injectButton: (button, target) => {
          button.classList.add('follow-unfollow');

          target.insertAdjacentElement('afterend', button);
        },
        supports: {
          formats: ['WAV', 'FLAC', 'AIFF', 'MP3'],
          '24bit': true,
        },
        parse: () => {
          const data = unsafeWindow.TralbumData;
          const albumCreditsText = Utils.getTextFromTag('.tralbum-credits', null, '', true);

          const albumCover = Utils.getTextFromTag('a.popupImage', null, 'href');
          const albumExtraArtists = [];

          if (albumCreditsText) {
            // Split by lines and parse each line separately to avoid greediness
            albumCreditsText.split(/\r?\n/).forEach(line => {
              const trimmedLine = line.trim();

              if (trimmedLine) {
                Utils.normalizeTrackTitle(trimmedLine, albumExtraArtists);
              }
            });
          }

          const albumArtists = Utils.normalizeMainArtists(data?.artist, albumExtraArtists);
          const albumTitle = Utils.normalizeTrackTitle(data?.current?.title, albumExtraArtists);
          let albumLabel = null;
          let labelCountry = null;
          let albumReleased = null;

          const albumTracks = data?.trackinfo?.map((track, i) => {
            const rawTitle = track.title;
            // Pre-clean title from technical tags before Artist - Title splitting.
            // This prevents suffixes like "- 24 bit" from being mistaken for track title delimiters.
            let cleanTitleForSplit = rawTitle;

            PATTERNS.removeFromTitleName.forEach(pattern => {
              cleanTitleForSplit = cleanTitleForSplit.replace(pattern, '').trim();
            });

            const titleRow = cleanTitleForSplit.match(/^(.+?)(?:\s+-\s*|\s*-\s+)(.+)$/);

            const position = `${i + 1}`;
            const extraartists = [];
            const artists = titleRow ? Utils.normalizeArtists(titleRow[1], extraartists) : albumArtists;
            const title = Utils.normalizeTrackTitle(titleRow ? titleRow[2] : rawTitle, extraartists);
            const duration = Utils.normalizeDuration(track.duration);

            return {
              position,
              extraartists,
              artists,
              title,
              duration,
            };
          });

          const locationTag = document.querySelector('#band-name-location');

          if (locationTag) {
            const rawLocation = Utils.getTextFromTag('.location', locationTag);

            // Extracts only the country part (e.g., "Bristol, UK" -> "UK")
            labelCountry = rawLocation ? rawLocation.split(',').pop().trim() : null;
            albumLabel = Utils.getTextFromTag('.title', locationTag);
          }

          if (!albumLabel) {
            const albumCredits = document.querySelector('.tralbum-credits');

            if (albumCredits) {
              const nodes = albumCredits.querySelectorAll('a, span, div');
              const items = Array.from(nodes)
                .map(el => Utils.cleanString(el.textContent))
                .filter(Boolean);

              items.some(el => {
                if (/(?:label|released\s+on)/i.test(el) && el.length < 100) {
                  const match = el.match(/(?:label|released\s+on)[:\s-]*(.+)/i);

                  if (match && match[1]) {
                    albumLabel = Utils.cleanString(match[1]);

                    return true;
                  }
                }

                return false;
              });

              if (!albumLabel && items.length) {
                albumLabel = items.find(it => it.length > 1) || null;
              }
            }
          }

          if (!albumLabel) {
            albumLabel = Utils.getTextFromTag('[itemprop="publisher"]');
          }

          const rawReleaseDate = data.current.release_date;
          const rawPublishDate = data.current.publish_date;
          albumReleased = Utils.normalizeReleaseDate(rawReleaseDate);

          // Bandcamp date fallback logic (Bandcamp launched Sept 2008)
          if (albumReleased && rawPublishDate) {
            const dateParts = albumReleased.split('-');
            const year = parseInt(dateParts[0], 10);
            const month = dateParts[1] ? parseInt(dateParts[1], 10) : 0;

            if (year < 2008 || (year === 2008 && month < 9)) {
              const published = Utils.normalizeReleaseDate(rawPublishDate);

              if (published) {
                albumReleased = published;
              }
            }
          }

          return {
            cover: albumCover,
            extraartists: albumExtraArtists,
            artists: albumArtists,
            title: albumTitle,
            label: albumLabel,
            country: labelCountry,
            released: albumReleased,
            tracks: albumTracks,
          };
        },
      },
      {
        id: 'qobuz',
        test: url => /qobuz\.com\/.*\/album\//i.test(url),
        target: '.album-meta',
        injectButton: (button, target) => {
          button.classList.add('btn-secondary');

          target.appendChild(button);

          // load all tracks, by default loads max 50 tracks
          unsafeWindow.infiniteScroll('/v4/ajax/album/load-tracks');
        },
        supports: {
          formats: ['WAV', 'FLAC', 'AIFF', 'MP3'],
          '24bit': true,
        },
        parse: async () => {
          const getData = async () => {
            try {
              const scripts = document.querySelectorAll('script[type="application/ld+json"]');
              let foundData = null;

              Array.from(scripts).some(script => {
                const jsonData = JSON.parse(script.textContent);

                if (jsonData['@type'] === 'Product') {
                  foundData = jsonData;

                  return true;
                }

                return false;
              });

              return foundData;
            } catch (error) {
              throw new Error(`Failed to fetch Qobuz data: ${error.message}`);
            }
          };
          const data = await getData();

          let albumCover = Utils.getTextFromTag('.album-cover__image', null, 'src');
          const albumExtraArtists = [];
          const albumArtists = Utils.normalizeMainArtists(Utils.getTextFromTag('.album-meta__title .artist-name'), albumExtraArtists);
          const albumTitle = Utils.normalizeTrackTitle(Utils.getTextFromTag('.album-meta__title .album-title'), albumExtraArtists);
          const albumLabel = Utils.getTextFromTag('.album-meta__item a[href*="/label/"]');
          const albumReleased = data?.releaseDate;
          const albumTracks = Array.from(document.querySelectorAll('#playerTracks > .player__item')).map((track, i) => {
            const artistRow = Utils.getTextFromTag('.track__item--artist', track);

            const position = `${i + 1}`;
            const extraartists = [];
            const artists = [artistRow].filter(Boolean).length ? Utils.normalizeArtists([artistRow], extraartists) : albumArtists;
            const title = Utils.normalizeTrackTitle(Utils.getTextFromTag('.track__item--name', track), extraartists);
            const duration = Utils.normalizeDuration(Utils.getTextFromTag('.track__item--duration', track));

            return {
              position,
              extraartists,
              artists,
              title,
              duration,
            };
          });

          if (albumCover) {
            albumCover = albumCover.replace('_600', '_max');
          }

          return {
            cover: albumCover,
            extraartists: albumExtraArtists,
            artists: albumArtists,
            title: albumTitle,
            label: albumLabel,
            released: albumReleased,
            tracks: albumTracks,
          };
        },
      },
      {
        id: 'junodownload',
        test: url => /junodownload\.com\/products\//i.test(url),
        target: '#product-action-btns',
        injectButton: (button, target) => {
          button.classList.add('btn', 'btn-cta');

          target.insertAdjacentElement('afterend', button);
        },
        supports: {
          formats: ['WAV', 'FLAC', 'AIFF', 'MP3'],
          '24bit': false,
        },
        parse: async () => {
          const getData = async () => {
            const urlSplit = location.href.split('/');
            const releaseId = urlSplit[urlSplit.length - 2];
            const getMeta = async () => {
              try {
                const responseText = await Utils.networkRequest({
                  method: 'GET',
                  url: `https://www.junodownload.com/api/1.2/playlist/getplaylistdetails/?product_key=${releaseId}&output_type=json`,
                });
                const jsonData = JSON.parse(responseText);

                return jsonData.items;
              } catch (error) {
                throw new Error(`Failed to fetch Juno metadata: ${error.message}`);
              }
            };
            const meta = await getMeta();

            return meta;
          };
          const data = await getData();

          const albumCover = Utils.getTextFromTag('.product-image-for-modal', null, 'data-src-full');
          const albumExtraArtists = [];
          const albumArtists = Utils.normalizeMainArtists(
            data[0].releaseArtists.map(item => item.name),
            albumExtraArtists
          );
          const albumTitle = Utils.normalizeTrackTitle(data[0].releaseTitle, albumExtraArtists);
          const albumLabel = data[0].label.name;
          let labelNumber = null;
          const albumReleased = Utils.normalizeReleaseDate(Utils.getTextFromTag('#product-page-digi [itemprop="datePublished"]'));
          const albumTracks = data.map((track, i) => {
            const position = `${i + 1}`;
            const extraartists = [];
            const artists = Utils.normalizeArtists(
              track.artists.map(item => item.name),
              extraartists
            );
            const title = Utils.normalizeTrackTitle(track.version ? `${track.title} (${track.version})` : track.title, extraartists);
            const duration = Utils.normalizeDuration(track.length);
            const bpm = track.bpm;

            return {
              position,
              extraartists,
              artists,
              title,
              duration,
              bpm,
            };
          });

          Array.from(document.querySelectorAll('#product-page-digi .mb-2')).forEach(el => {
            const html = el.innerHTML || '';
            const match = html.match(/<strong>Cat:<\/strong>.*?([a-z0-9\s-]+)<br>/i);

            if (match && match[1]) {
              labelNumber = Utils.cleanString(match[1]);
            }
          });

          return {
            cover: albumCover,
            extraartists: albumExtraArtists,
            artists: albumArtists,
            title: albumTitle,
            label: albumLabel,
            number: labelNumber,
            released: albumReleased,
            tracks: albumTracks,
          };
        },
      },
      {
        id: 'beatport',
        test: url => /beatport\.com\/release\//i.test(url),
        target: '[class^="ReleaseDetailCard-style__Controls"]',
        injectButton: (button, target) => {
          button.classList.add('primary', 'hzHZaW');

          target.appendChild(button);
        },
        supports: {
          formats: ['WAV', 'FLAC', 'AIFF', 'MP3'],
          '24bit': true,
        },
        parse: async () => {
          const getData = async () => {
            const urlSplit = location.href.split('/');
            const releaseId = urlSplit[urlSplit.length - 1];
            const accessToken = unsafeWindow.__NEXT_DATA__?.props?.pageProps?.anonSession?.access_token;
            const getMeta = async () => {
              try {
                const responseText = await Utils.networkRequest({
                  url: `https://api.beatport.com/v4/catalog/releases/${releaseId}`,
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                  },
                });
                const jsonData = JSON.parse(responseText);

                return jsonData;
              } catch (error) {
                throw new Error(`Beatport metadata request failed: ${error.message}`);
              }
            };
            const getTracks = async () => {
              try {
                const responseText = await Utils.networkRequest({
                  url: `https://api.beatport.com/v4/catalog/releases/${releaseId}/tracks?per_page=100`,
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                  },
                });
                const jsonData = JSON.parse(responseText);

                return jsonData.results;
              } catch (error) {
                throw new Error(`Beatport tracks request failed: ${error.message}`);
              }
            };
            const meta = await getMeta();
            const tracks = await getTracks();

            return { ...meta, tracks };
          };
          const data = await getData();

          const albumCover = data.image.uri;
          const albumExtraArtists = [];
          const albumArtists = Utils.normalizeMainArtists(
            data.artists.map(item => item.name),
            albumExtraArtists
          );
          const albumTitle = Utils.normalizeTrackTitle(data.name, albumExtraArtists);
          const albumLabel = data.label.name;
          const labelNumber = data.catalog_number;
          const albumReleased = data.publish_date;
          const albumTracks = data.tracks.map((track, i) => {
            const position = `${i + 1}`;
            const extraartists = [];
            const artists = Utils.normalizeArtists(
              track.artists.map(item => item.name),
              extraartists
            );
            const title = Utils.normalizeTrackTitle(track.mix_name !== '' ? `${track.name} (${track.mix_name})` : track.name, extraartists);
            const duration = track.length;
            const bpm = track.bpm;

            return {
              position,
              extraartists,
              artists,
              title,
              duration,
              bpm,
            };
          });

          return {
            cover: albumCover,
            extraartists: albumExtraArtists,
            artists: albumArtists,
            title: albumTitle,
            label: albumLabel,
            number: labelNumber,
            released: albumReleased,
            tracks: albumTracks,
          };
        },
      },
      {
        id: '7digital',
        test: url => /7digital\.com\/artist\/[^/]+\/release\/[^/]+/i.test(url),
        target: '.release-purchase',
        injectButton: (button, target) => {
          button.classList.add('btn-primary');

          target.insertAdjacentElement('afterend', button);
        },
        supports: {
          formats: ['FLAC', 'MP3'],
          '24bit': true,
        },
        parse: async () => {
          const getData = async () => {
            const releaseId = Utils.getTextFromTag('.release-info', null, 'data-releaseid');
            const getMeta = async () => {
              try {
                const responseText = await Utils.networkRequest({
                  method: 'GET',
                  url: `https://api.7digital.com/1.2/release/tracks?releaseid=${releaseId}&pagesize=100&imagesize=800&usageTypes=download&oauth_consumer_key=7digital.com`,
                  headers: {
                    Accept: 'application/json',
                  },
                });
                const jsonData = JSON.parse(responseText);

                return jsonData.tracks;
              } catch (error) {
                throw new Error(`7digital metadata request failed: ${error.message}`);
              }
            };
            const meta = await getMeta();

            return meta;
          };
          const data = await getData();

          const albumCover = data[0].release.image;
          const albumExtraArtists = [];
          const albumArtists = Utils.normalizeMainArtists([data[0].release.artist.name], albumExtraArtists);
          const albumTitle = Utils.normalizeTrackTitle(data[0].release.title, albumExtraArtists);
          const albumLabel = data[0].release.label.name;
          const albumReleased = Utils.normalizeReleaseDate(Utils.getTextFromTag('.release-data-label + .release-data-info'));
          const albumTracks = data.map((track, i) => {
            const rawArtists = track.artist.name.split(',').map(name => name.trim());

            const position = `${i + 1}`;
            const extraartists = [];
            const artists = Utils.normalizeArtists(rawArtists, extraartists);
            const title = Utils.normalizeTrackTitle(track.title, extraartists);
            const duration = Utils.normalizeDuration(track.duration);

            return {
              position,
              extraartists,
              artists,
              title,
              duration,
            };
          });

          return {
            cover: albumCover,
            extraartists: albumExtraArtists,
            artists: albumArtists,
            title: albumTitle,
            label: albumLabel,
            released: albumReleased,
            tracks: albumTracks,
          };
        },
      },
    ],

    /**
     * Detects the correct digital store based on the current window location.
     * Iterates through the supported stores list and executes their test functions.
     * @returns {Object|undefined} The matched digital store object, or undefined if none matched.
     */
    detectByLocation: () => DigitalStoreRegistry.list.find(p => p.test(location.href)),
  };

  /**
   * Creates the main widget interface for submitting releases.
   */
  class UiWidget {
    constructor() {
      this.WIDGET_ID = GM_info.script.namespace;

      this.ui = {};

      this.currentDigitalStore = null;
      this.currentPayload = null;
      this.lastRawData = null;

      this.selectedFormat = null;
      this.is24Bit = false;

      this.isDragging = false;
      this.offset = { x: 0, y: 0 };

      this.handleMouseMove = this.handleMouseMove.bind(this);
      this.handleMouseUp = this.handleMouseUp.bind(this);
      this.handlePageChange = this.handlePageChange.bind(this);

      this.currentUrl = location.href;
      this.observer = null;
      this.pageChangeTimer = null;
    }

    injectStyles() {
      if (!document.getElementById(`${this.WIDGET_ID}-styles`)) {
        const style = document.createElement('style');

        style.id = `${this.WIDGET_ID}-styles`;
        style.textContent = Renderer.widgetStyles;

        document.head.appendChild(style);
      }
    }

    buildDOM() {
      const container = document.createElement('aside');
      const btnInjectWrapper = document.createElement('div');

      container.id = this.WIDGET_ID;
      container.className = 'discogs-submitter';
      container.innerHTML = Renderer.widgetSkeleton;

      document.body.appendChild(container);

      btnInjectWrapper.innerHTML = Renderer.injectButtonSkeleton;
      this.ui.injectBtn = btnInjectWrapper.querySelector('.discogs-submitter__inject__btn');

      this.ui.widget = container;
      this.ui.header = container.querySelector('.discogs-submitter__header');
      this.ui.headerDragBtn = container.querySelector('.discogs-submitter__header__drag-btn');
      this.ui.headerCloseBtn = container.querySelector('.discogs-submitter__header__close-btn');
      this.ui.headerLogo = container.querySelector('.discogs-submitter__header__logo');
      this.ui.statusContainer = container.querySelector('.discogs-submitter__status-container');
      this.ui.statusText = container.querySelector('.discogs-submitter__status-text');
      this.ui.statusDebugCopyBtn = container.querySelector('.discogs-submitter__status-debug-btn');
      this.ui.previewContainer = container.querySelector('.discogs-submitter__preview-container');
      this.ui.actionsSubmitBtn = container.querySelector('.discogs-submitter__actions__btn-submit');

      this.handlePageChange();
    }

    /**
     * Sets the loading spinner state in the header.
     * @param {boolean} isActive - Whether the spinner should be active.
     */
    setLoader(isActive) {
      if (isActive) {
        this.ui.headerLogo.classList.add('is-loading');
      } else {
        this.ui.headerLogo.classList.remove('is-loading');
      }
    }

    /**
     * Updates the status message and styling.
     * @param {string} message - The message to display.
     * @param {string} [status='info'] - Status level ('info', 'success', 'error').
     */
    setStatus(message, status = 'info') {
      this.ui.statusText.innerHTML = message;

      this.ui.statusContainer.classList.remove('is-error', 'is-success', 'is-info');
      this.ui.statusContainer.classList.add(`is-${status}`);
    }

    /**
     * Triggers the parsing process for the current digital store.
     */
    async executeParsing() {
      this.setStatus('Parsing current release...', 'info');
      this.setLoader(true);

      this.ui.statusDebugCopyBtn.hidden = true;
      this.ui.actionsSubmitBtn.hidden = true;

      this.ui.previewContainer.innerHTML = '';

      delete this.ui.statusContainer.dataset.rawJson;

      try {
        this.ui.injectBtn.classList.add('is-disabled');

        this.lastRawData = await this.currentDigitalStore.parse();

        this.renderPayload();

        this.setStatus('Parsed successfully. Ready to submit.<br/><strong><em>Please review your draft before publishing on Discogs!</em></strong>', 'success');
      } catch (error) {
        this.currentPayload = null;
        this.lastRawData = null;

        this.setStatus(`${error?.message || error}`, 'error');

        const errorString = `
          URL: ${window.location.href}\n
          Version: ${GM_info.script.version}\n
          Error Trace:\n${error?.stack || error}
        `;

        this.ui.statusContainer.dataset.rawJson = errorString;

        this.ui.statusDebugCopyBtn.hidden = false;
        this.ui.actionsSubmitBtn.hidden = true;
      } finally {
        this.setLoader(false);

        this.ui.injectBtn.classList.remove('is-disabled');
      }
    }

    /**
     * Handles URL/page changes, updating the current digital store and the inject button.
     */
    handlePageChange() {
      if (this.pageChangeTimer) {
        clearTimeout(this.pageChangeTimer);
      }

      this.pageChangeTimer = setTimeout(() => {
        const newUrl = location.href;
        const urlChanged = newUrl !== this.currentUrl;

        if (urlChanged) {
          this.currentUrl = newUrl;

          this.ui.widget.classList.remove('is-open');

          // Reset internal state on URL change to prevent stale data
          this.currentPayload = null;
          this.lastRawData = null;
          this.ui.previewContainer.innerHTML = '';
          this.setStatus('Ready to parse...', 'info');
          this.ui.actionsSubmitBtn.hidden = true;
          this.ui.statusDebugCopyBtn.hidden = true;
        }

        this.currentDigitalStore = DigitalStoreRegistry.detectByLocation();

        if (!this.currentDigitalStore) {
          if (this.ui.injectBtn && this.ui.injectBtn.parentNode) {
            this.ui.injectBtn.remove();
          }

          return;
        }

        // Ensure button has correct digital store class
        this.ui.injectBtn.classList.add(`is-${this.currentDigitalStore.id}`);

        // Validate selected format for the current digital store
        const supportedFormats = this.currentDigitalStore.supports?.formats || [];

        if (supportedFormats.length > 0 && !supportedFormats.includes(this.selectedFormat)) {
          [this.selectedFormat] = supportedFormats;
        }

        // Check if button is in the correct place
        const target = document.querySelector(this.currentDigitalStore.target);

        if (target && !target.contains(this.ui.injectBtn) && this.ui.injectBtn.parentNode !== target) {
          this.currentDigitalStore.injectButton(this.ui.injectBtn, target);
        }
      }, 300);
    }

    /**
     * Sets up MutationObserver and History API patches for SPA navigation.
     */
    setupObservers() {
      // Observe DOM changes for late-loading elements
      this.observer = new MutationObserver(mutations => {
        let shouldRedetect = false;

        for (const mutation of mutations) {
          // Ignore non-element nodes (comments, text nodes) or changes inside our own widget
          if (mutation.target.nodeType !== 1 || (this.ui.widget && this.ui.widget.contains(mutation.target))) {
            continue;
          }

          // Focused detection: ignore script/style tags and other irrelevant metadata
          if (['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'SVG'].includes(mutation.target.tagName)) {
            continue;
          }

          if (mutation.addedNodes.length || mutation.removedNodes.length) {
            shouldRedetect = true;

            break;
          }
        }

        if (shouldRedetect) {
          this.handlePageChange();
        }
      });

      this.observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      // Observe URL changes (history API)
      window.addEventListener('popstate', this.handlePageChange);

      // Monkey-patch pushState/replaceState for SPA navigation detection
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;
      const self = this;

      history.pushState = function () {
        originalPushState.apply(this, arguments);

        self.handlePageChange();
      };

      history.replaceState = function () {
        originalReplaceState.apply(this, arguments);

        self.handlePageChange();
      };
    }

    /**
     * Builds the payload and renders the summary preview.
     */
    renderPayload() {
      if (!this.lastRawData) {
        return;
      }

      this.currentPayload = DiscogsAdapter.buildPayload(this.lastRawData, window.location.href, {
        format: this.selectedFormat,
        is24Bit: this.is24Bit,
      });

      const previewObj = this.currentPayload._previewObject;
      const rawJsonString = JSON.stringify(previewObj, null, 2);

      this.ui.previewContainer.innerHTML = Renderer.releasePreview(previewObj, {
        selectedFormat: this.selectedFormat,
        is24Bit: this.is24Bit,
        supports: this.currentDigitalStore ? this.currentDigitalStore.supports : null,
      });

      this.ui.statusContainer.dataset.rawJson = rawJsonString;

      this.ui.actionsSubmitBtn.hidden = false;
      this.ui.statusDebugCopyBtn.hidden = false;

      this.setStatus('Parsed successfully. Ready to submit.<br/><strong><em>Please review your draft before publishing on Discogs!</em></strong>', 'success');
    }

    /**
     * Handles copying the raw JSON layout to the clipboard.
     */
    async handleDebugCopy() {
      const textToCopy = this.ui.statusContainer.dataset.rawJson;

      if (!textToCopy) {
        return;
      }

      this.setLoader(true);

      const btnOriginalText = this.ui.statusDebugCopyBtn.textContent;

      try {
        await GM.setClipboard(textToCopy, 'text');

        console.log('[Discogs Submitter] Raw JSON:', JSON.parse(textToCopy));

        this.ui.statusDebugCopyBtn.textContent = '✅';

        setTimeout(() => {
          this.ui.statusDebugCopyBtn.textContent = btnOriginalText;

          this.setLoader(false);
        }, 2000);
      } catch (err) {
        this.ui.statusDebugCopyBtn.textContent = '⛔';

        setTimeout(() => {
          this.ui.statusDebugCopyBtn.textContent = btnOriginalText;

          this.setLoader(false);
        }, 2000);
      }
    }

    /**
     * Sends the current payload to the Discogs submission endpoint.
     */
    async handleSubmit() {
      if (!this.currentPayload) {
        return;
      }

      this.setStatus('Sending to Discogs...', 'info');
      this.setLoader(true);

      this.ui.actionsSubmitBtn.classList.add('is-disabled');

      try {
        const formData = new FormData();

        formData.append('full_data', this.currentPayload.full_data);
        formData.append('sub_notes', this.currentPayload.sub_notes);

        const response = await Utils.networkRequest({
          method: 'POST',
          url: 'https://www.discogs.com/submission/release/create',
          data: formData,
        });

        const jsonData = JSON.parse(response);

        if (jsonData && jsonData.id) {
          if (this.lastRawData.cover) {
            this.setStatus('Draft created. Uploading cover image...', 'info');

            try {
              const coverBlob = await Utils.networkRequest({
                url: this.lastRawData.cover,
                method: 'GET',
                responseType: 'blob',
              });

              const imageFormData = new FormData();
              imageFormData.append('image', coverBlob, 'cover.jpg');
              imageFormData.append('pos', '1');

              await Utils.networkRequest({
                method: 'POST',
                url: `https://www.discogs.com/release/${jsonData.id}/images/upload`,
                data: imageFormData,
              });

              this.setStatus('Draft and cover uploaded successfully!', 'success');

              this.ui.actionsSubmitBtn.hidden = true;

              unsafeWindow.open(`https://www.discogs.com/release/edit/${jsonData.id}`, '_blank');

              setTimeout(() => {
                this.ui.widget.classList.remove('is-open');
              }, 5000);
            } catch (imageError) {
              console.error('[Discogs Submitter] Cover upload failed:', imageError);

              const errorMessage = imageError instanceof Error ? imageError.message : String(imageError);

              this.setStatus(`Draft created, but cover upload failed: ${errorMessage}`, 'warning');

              this.ui.actionsSubmitBtn.hidden = true;

              unsafeWindow.open(`https://www.discogs.com/release/edit/${jsonData.id}`, '_blank');
            }
          } else {
            this.setStatus(`Draft successfully created! ID: ${jsonData.id}`, 'success');

            this.ui.actionsSubmitBtn.hidden = true;

            unsafeWindow.open(`https://www.discogs.com/release/edit/${jsonData.id}`, '_blank');

            setTimeout(() => {
              this.ui.widget.classList.remove('is-open');
            }, 5000);
          }
        } else {
          throw new Error('Response missing release ID');
        }
      } catch (error) {
        this.setStatus(`Failed to create Discogs draft:<br/>${error?.message || error}`, 'error');
      } finally {
        this.setLoader(false);

        this.ui.actionsSubmitBtn.classList.remove('is-disabled');
      }
    }

    /**
     * Binds UI event listeners.
     */
    bindEvents() {
      this.ui.headerCloseBtn.addEventListener('click', () => this.ui.widget.classList.remove('is-open'));

      this.ui.injectBtn.addEventListener('click', () => {
        if (this.ui.injectBtn.classList.contains('is-disabled')) {
          return;
        }

        if (!this.ui.widget.classList.contains('is-open')) {
          this.ui.widget.classList.add('is-open');
        }

        this.executeParsing();
      });

      this.ui.previewContainer.addEventListener('change', e => {
        if (e.target.classList.contains('is-format')) {
          this.selectedFormat = e.target.value;

          if (this.lastRawData) {
            this.renderPayload();
          }
        } else if (e.target.classList.contains('is-24bit')) {
          this.is24Bit = e.target.checked;

          if (this.lastRawData) {
            this.renderPayload();
          }
        }
      });

      this.ui.statusDebugCopyBtn.addEventListener('click', () => this.handleDebugCopy());
      this.ui.actionsSubmitBtn.addEventListener('click', () => this.handleSubmit());
    }

    /**
     * Normalizes mouse or touch coordinates.
     * @param {MouseEvent|TouchEvent} e - The event object.
     * @returns {{x: number, y: number}} The x and y coordinates.
     */
    getCoords(e) {
      if (e.touches && e.touches.length > 0) {
        return {
          x: e.touches[0].pageX,
          y: e.touches[0].pageY,
        };
      }

      return {
        x: e.pageX,
        y: e.pageY,
      };
    }

    /**
     * Handles the dragging movement of the widget.
     * @param {MouseEvent|TouchEvent} e
     */
    handleMouseMove(e) {
      if (!this.isDragging) {
        return;
      }

      const coords = this.getCoords(e);
      const rootRect = this.ui.widget.getBoundingClientRect();
      const left = Math.min(Math.max(0, coords.x - this.offset.x), window.innerWidth - rootRect.width);
      const top = Math.min(Math.max(0, coords.y - this.offset.y), window.innerHeight - rootRect.height);

      this.ui.widget.style.left = `${left}px`;
      this.ui.widget.style.top = `${top}px`;
    }

    /**
     * Stops the dragging process.
     */
    handleMouseUp() {
      if (!this.isDragging) {
        return;
      }

      this.isDragging = false;

      this.ui.headerDragBtn.classList.remove('is-draggable');

      document.removeEventListener('mousemove', this.handleMouseMove);
      document.removeEventListener('touchmove', this.handleMouseMove);
      document.removeEventListener('mouseup', this.handleMouseUp);
      document.removeEventListener('touchend', this.handleMouseUp);
    }

    /**
     * Binds events for widget draggability.
     */
    bindDraggableEvent() {
      const handleDown = e => {
        // Only left click
        if (e.type === 'mousedown' && e.button !== 0) {
          return;
        }

        // Prevent dragging if widget is closing or closed
        if (!this.ui.widget.classList.contains('is-open')) {
          return;
        }

        e.preventDefault();

        this.isDragging = true;

        const coords = this.getCoords(e);
        const rect = this.ui.widget.getBoundingClientRect();

        this.offset.x = coords.x - rect.left;
        this.offset.y = coords.y - rect.top;

        this.ui.headerDragBtn.classList.add('is-draggable');

        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('touchmove', this.handleMouseMove, { passive: false });
        document.addEventListener('mouseup', this.handleMouseUp);
        document.addEventListener('touchend', this.handleMouseUp);
      };

      this.ui.headerDragBtn.addEventListener('mousedown', handleDown);
      this.ui.headerDragBtn.addEventListener('touchstart', handleDown, { passive: false });
    }

    /**
     * Initializes the widget lifecycle.
     */
    init() {
      if (document.getElementById(this.WIDGET_ID)) {
        return;
      }

      this.currentDigitalStore = DigitalStoreRegistry.detectByLocation();

      this.injectStyles();
      this.buildDOM();
      this.bindDraggableEvent();
      this.bindEvents();
      this.setupObservers();
    }
  }

  /**
   * Initialize the widget.
   */
  try {
    const app = new UiWidget();

    app.init();
  } catch (error) {
    console.error('discogs-submitter init error', error);
  }
})();
