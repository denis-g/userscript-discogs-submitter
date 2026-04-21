<div align="center">

<p><img src="https://github.com/denis-g/userscript-discogs-submitter/raw/refs/heads/master/assets/logo.png" style="width: 300px;" alt="" /></p>

![Make Draft Great Again](https://img.shields.io/badge/Make_Draft_Great-Again-dc3545.svg?style=for-the-badge&logo=discogs)
[![Install Discogs Submitter](https://img.shields.io/badge/Install_Script-Now-28a745.svg?style=for-the-badge&logo=tampermonkey)](https://github.com/denis-g/userscript-discogs-submitter/raw/refs/heads/master/discogs-submitter.user.js)
[![Greasy Fork](https://img.shields.io/badge/Greasy_Fork-View-35b5dc.svg?style=for-the-badge&logo=greasyfork)](https://greasyfork.org/en/scripts/574902-discogs-submitter)

</div>

---

# Discogs Submitter

## Description

**Discogs Submitter** is a userscript designed to automate the process of migrating music releases from popular digital stores to the Discogs database.
It extracts metadata from the source page, normalizes it to meet Discogs formatting standards, and submits it directly as a "Draft".

### Supported Digital Stores

| Store             | Release page URL pattern            | Country | Catalog Number | BPM info | 24-bit | Hi-Res Cover | Web Archive |
| ----------------- |-------------------------------------| :-----: | :------------: | :------: | :----: |:------------:|:-----------:|
| **Bandcamp**      | `*.bandcamp.com/album/*`            |   🟡    |       🟡       |    🟡    |   ✅   |       ✅      |     ✅       |
| **Qobuz**         | `*.qobuz.com/*`                     |   ❌    |       ❌       |    ❌    |   ✅   |      ✅       |      ❌      |
| **Juno Download** | `*.junodownload.com/*`              |   ❌    |       ✅       |    ✅    |   ❌   |      ❌       |      ❌      |
| **Beatport**      | `*.beatport.com/*`                  |   ❌    |       ✅       |    ✅    |   ✅   |      ✅       |      ❌      |
| **7digital**      | `*.7digital.com/artist/*/release/*` |   ❌    |       ❌       |    ❌    |   ✅   |      ❌       |      ❌      |
| **Amazon Music**  | `*.amazon.*/*`                      |   ❌    |       ❌       |    ❌    |   ❌   |      ❌       |      ❌      |
| **Bleep**         | `bleep.com/*`                       |   ❌    |       ✅       |    ❌    |   ✅   |      ❌       |      ❌      |

<div><sup><strong>Bandcamp</strong>: Catalog number and BPM extraction relies on both the release credits and description. Country is extracted from the publisher location.</sup></div>
<div><sup><strong>Juno Download</strong>: Cover art maximum size is 700x700.</sup></div>
<div><sup><strong>7digital</strong>: Cover art maximum size is 800x800, definitely available for all releases.</sup></div>
<div><sup><strong>Web Archive</strong>: Almost all sites had different designs and layouts in different years.</sup></div>

### Screenshots

![Discogs Draft](https://github.com/denis-g/userscript-discogs-submitter/raw/refs/heads/master/screenshots/discogs.png)

<details open>
<summary>Bandcamp</summary>

![Discogs Submitter - Bandcamp](https://github.com/denis-g/userscript-discogs-submitter/raw/refs/heads/master/screenshots/bandcamp.png)

</details>

<details>
<summary>Qobuz</summary>

![Discogs Submitter - Qobuz](https://github.com/denis-g/userscript-discogs-submitter/raw/refs/heads/master/screenshots/qobuz.png)

</details>

<details>
<summary>Juno Download</summary>

![Discogs Submitter - Juno Download](https://github.com/denis-g/userscript-discogs-submitter/raw/refs/heads/master/screenshots/junodownload.png)

</details>

<details>
<summary>Beatport</summary>

![Discogs Submitter - Beatport](https://github.com/denis-g/userscript-discogs-submitter/raw/refs/heads/master/screenshots/beatport.png)

</details>

<details>
<summary>7digital</summary>

![Discogs Submitter - 7digital](https://github.com/denis-g/userscript-discogs-submitter/raw/refs/heads/master/screenshots/7digital.png)

</details>

<details>
<summary>Amazon Music</summary>

![Discogs Submitter - Amazon Music](https://github.com/denis-g/userscript-discogs-submitter/raw/refs/heads/master/screenshots/amazonmusic.png)

</details>

<details>
<summary>Bleep</summary>

![Discogs Submitter - Bleep](https://github.com/denis-g/userscript-discogs-submitter/raw/refs/heads/master/screenshots/bleep.png)

</details>

## Features

- **Metadata Extraction:** Automatically parses artist names (`VA` normalization), release titles, label names (with `Self-released` support), catalog numbers, release dates, and complete tracklists with track artists. If a release is identified as a compilation (e.g., contains "Compiled by..." or "Selected by..."), the compiler is automatically prioritized as the primary release artist.
- **Credit Extraction:** Automatically identifies and extracts credit roles from titles and descriptions, moving them to the "Extra Artists" section while keeping the original title text clean.
- **Smart Normalization:** Automatically filters out technical tags, standardizes punctuation, and applies intelligent casing to all fields.
- **Cover Art & BPM:** Automatically fetches and attaches cover art, ensuring BPM data is included in the Discogs release notes when available.

## Normalization & Transformations

### Smart Capitalization

The script applies a Unicode-aware Title Case to all fields, ensuring consistent formatting regardless of the source. It preserves stylistic casing (e.g., `Sci-Fi`, `iPhone`) and handles common abbreviations.

- **Standardization:** `yet another track (super mix)` → `Yet Another Track (Super Mix)`, `LIVE AT LONDON` → `Live At London`.
- **Preserved Abbreviations:** `DJ`, `VIP`, `EP`, `UK`, `I`, `II`, `III`, etc.
- **Dotted Abbreviations:** `A.I.`, `U.S.A.` are preserved in uppercase.
- **Mixed Case:** `McDonalds`, `bOOm` are preserved exactly as written.
- **Punctuation:** Normalizes apostrophes (`’`, `` ` ``, `´` → `'`) and cleans whitespace around parentheses.

### Title Cleaning

To meet Discogs standards, common technical suffixes and bracketed tags are removed from track titles:
- `Track Title (Original Mix)` → `Track Title`
- `Track Title [Explicit]` → `Track Title`
- `Album Name - 24 bit` → `Album Name`
- `Track Title (156 bpm)` → `Track Title`
- `Track Title - Bonus Track` → `Track Title`

And more...

### Credit Extraction & Movement

The script scans track titles and release descriptions for artist credits. When found, it creates a `Credit` entry and (in most cases) removes the credit from the title to keep it clean.

- **Features:** `Track Title (feat. Artist B)` → Title: `Track Title`, Featuring: `Artist B`.
- **Remixes (Type A):** `Track Title (Remix By Artist C)` → Title: `Track Title (Remix By Artist C)`, Remix: `Artist C`.
- **Remixes (Type B):** `Track Title (Artist D Remix)` → Title: `Track Title (Artist D Remix)`, Remix: `Artist D`.
- **Multiple Remixers:** `Track Title (Artist E & Artist F Remix)` → Title: `Track Title (Artist E & Artist F Remix)`, Remix: `Artist E` & `Artist F`.
- **Production:** `Track Title (prod. by Artist G)` → Title: `Track Title`, Producer: `Artist G`.

And more...

### Artist Joiner Parsing

Artist strings are automatically split into individual artists using common joiners:
- `Artist A, Artist B & Artist C` → `Artist A` (join: `,`), `Artist B` (join: `&`), `Artist C`.

## Supported Credit Roles

The userscript parses track titles and release descriptions for the following credit roles, automatically mapping them to the correct Discogs format:

```text
Featuring, Remix, DJ Mix
Compiled By, Artwork, Producer, Mastered By, Written-By
```

## Usage Guide

1. Open a music release page on any supported store.
2. Click the **Discogs Submitter** button (usually located near the album buy/download controls).
3. The floating widget will appear and parse the data automatically.
4. Review the draft in the preview area.
5. Select your preferred **Format** and **Bit Depth** if available.
6. Click **Submit to Discogs** to create your draft.

## Installation

### Install a Userscript Manager

- [**Tampermonkey**](https://www.tampermonkey.net): Chrome, Microsoft Edge, Safari, Opera Next, and Firefox
- [**Violentmonkey**](https://violentmonkey.github.io): Chrome, Microsoft Edge, and Firefox

### Install the Script

[![Install Discogs Submitter](https://img.shields.io/badge/Install_Script-Now-28a745.svg?style=for-the-badge&logo=tampermonkey)](https://github.com/denis-g/userscript-discogs-submitter/raw/refs/heads/master/discogs-submitter.user.js)

## Something got broken?

Found a bug or have a feature request?

[![**Report a Bug**](https://img.shields.io/badge/Report_a_Bug-Issue-ffc107.svg?style=for-the-badge&logo=github)](https://github.com/denis-g/userscript-discogs-submitter/issues/new?template=bug_report.yml)
[![**Feature Request**](https://img.shields.io/badge/Feature-Request-17a2b8.svg?style=for-the-badge&logo=github)](https://github.com/denis-g/userscript-discogs-submitter/issues/new?template=feature_request.yml)

## Hall of Fame

<img src="https://contrib.rocks/image?repo=denis-g/userscript-discogs-submitter" alt="Contributors" />

---

<div align="center">

<a href="https://buymeacoffee.com/denis_g">
<sub>Made with <font color="#dc3545">♥</font> for music</sub>
</a>

</div>
