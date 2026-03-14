<div align="center">

<p><img src="https://github.com/denis-g/userscript-discogs-submitter/raw/refs/heads/master/assets/logo.png" style="width: 300px;" alt="" /></p>

[![Make Draft Great Again](https://img.shields.io/badge/Make_Draft_Great-Again-dc3545.svg?style=for-the-badge&logo=discogs)]()
[![Install Discogs Submitter](https://img.shields.io/badge/Install_Script-Now-28a745.svg?style=for-the-badge&logo=tampermonkey)](https://github.com/denis-g/userscript-discogs-submitter/raw/refs/heads/master/discogs-submitter.user.js)

</div>

---

# Discogs Submitter

## Description

**Discogs Submitter** is a userscript designed to automate the process of migrating music releases from popular digital stores to the Discogs database.
It extracts metadata from the source page, normalizes it to meet Discogs formatting standards, and submits it directly as a "Draft".

## Features

- **Metadata Extraction:** Automatically parses artist names (`VA` normalization), release titles, label names (with `Self-released` support), catalog numbers, release dates, and complete tracklists with track artists. If a release is identified as a compilation (e.g., contains "Compiled by ..."), the compiler is automatically prioritized as the primary release artist.
- **Credit Extraction:** Automatically identifies and extracts credit roles from titles and descriptions.
- **Smart Normalization:** Automatically cleans track titles (removes `(Original Mix)`, `[Explicit]`, `(Remastered)`, etc.), standardizes apostrophes, applies **Unicode-aware Title Case**, and cleans whitespace.
- **Cover Art & BPM:** Automatically attaches cover art and includes BPM data in Discogs notes.

## Supported Digital Stores

| Store             | URL Pattern                         | Country | Catalog Number | BPM info | 24-bit | Hi-Res Cover |
| ----------------- | ----------------------------------- | :-----: | :------------: | :------: | :----: | :----------: |
| **Bandcamp**      | `*.bandcamp.com/album/*`            |   🟡    |       🟡       |    ❌    |   ✅   |      ✅      |
| **Qobuz**         | `www.qobuz.com/*/album/*`           |   ❌    |       ❌       |    ❌    |   ✅   |      ✅      |
| **Juno Download** | `www.junodownload.com/products/*`   |   ❌    |       ✅       |    ✅    |   ❌   |      ❌      |
| **Beatport**      | `www.beatport.com/release/*`        |   ❌    |       ✅       |    ✅    |   ✅   |      ✅      |
| **7digital**      | `*.7digital.com/artist/*/release/*` |   ❌    |       ❌       |    ❌    |   ✅   |      ❌      |

<sup>_\* **Bandcamp**: Catalog number extraction depends on the release description text. Country is extracted from the publisher location._</sup>  
<sup>_\* **Juno Download**: Cover art maximum size is 700x700._</sup>  
<sup>_\* **7digital**: Cover art maximum size is 800x800, definitely available for all releases._</sup>

## Supported Credit Roles

The userscript parses track titles and release descriptions for the following credit roles, automatically mapping them to the correct Discogs format:

| Role            | Matched Patterns (examples)                                          |
| --------------- | -------------------------------------------------------------------- |
| **Remix**       | `(Remix By Artist)`, `(Rmx By ...)`, `- Remix By ...`, `(Mix By...)` |
| **Featuring**   | `(feat. Artist)`, `[ft. Artist]`, `Title feat. Artist`, etc.         |
| **Compiled By** | `(Compiled By Artist)`, `Compiled By: Artist`                        |
| **Artwork**     | `Artwork By Artist`, `Art By Artist`, `Artwork: Artist`              |
| **Producer**    | `Produced By Artist`, `(Producer: Artist)`                           |
| **Mastered By** | `Mastered By Artist`, `Mastering: Artist`, `Mastered: Artist`        |

## Store-Specific Nuances

- **Bandcamp**: Metadata formatting can vary significantly between different labels and artists. Always double-check the parsed data to ensure accuracy.
- **Qobuz / Beatport / 7digital**: Artist order is often separated by a comma (`,`) and may not match the official release name. It is recommended to verify these against the label's official information.

## Usage Guide

1. Open a music release page on any supported store.
2. Click the **Discogs Submitter** button (usually located near the album buy/download controls).
3. The floating widget will appear and parse the data automatically.
4. Review the draft in the preview area.
5. Select your preferred **Format** and **Bit Depth** if available.
6. Click **Submit to Discogs** to create your draft.

### Screenshots

![](https://github.com/denis-g/userscript-discogs-submitter/raw/refs/heads/master/screenshots/discogs.png)

<details>
<summary>Bandcamp</summary>

![](https://github.com/denis-g/userscript-discogs-submitter/raw/refs/heads/master/screenshots/bandcamp.png)

</details>

<details>
<summary>Qobuz</summary>

![](https://github.com/denis-g/userscript-discogs-submitter/raw/refs/heads/master/screenshots/qobuz.png)

</details>

<details>
<summary>Juno Download</summary>

![](https://github.com/denis-g/userscript-discogs-submitter/raw/refs/heads/master/screenshots/junodownload.png)

</details>

<details>
<summary>Beatport</summary>

![](https://github.com/denis-g/userscript-discogs-submitter/raw/refs/heads/master/screenshots/beatport.png)

</details>

<details>
<summary>7digital</summary>

![](https://github.com/denis-g/userscript-discogs-submitter/raw/refs/heads/master/screenshots/7digital.png)

</details>

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
[![No Maintenance Intended](https://img.shields.io/badge/No_Maintenance_Intended-%E2%9C%95-dc3545.svg?style=for-the-badge&longCache=true)](https://unmaintained.tech)

## Hall of Fame

<img src="https://contrib.rocks/image?repo=denis-g/userscript-discogs-submitter" alt="Contributors" />

---

<div align="center">

<a href="https://buymeacoffee.com/denis_g">
<sub>Made with <font color="#dc3545">♥</font> for music</sub>
</a>

</div>
