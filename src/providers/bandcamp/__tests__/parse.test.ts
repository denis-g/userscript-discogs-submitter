// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { bandcamp } from '..';

/** Stubs `unsafeWindow` so `isWebarchive()` sees a Wayback Machine URL. */
function stubWebarchiveUrl(): void {
  (globalThis as any).unsafeWindow = {
    location: { href: 'https://web.archive.org/web/timestamp/http://example.bandcamp.com/album/title' },
  };
}

describe('bandcamp provider', () => {
  afterEach(() => {
    delete (globalThis as any).unsafeWindow;
  });

  it('should match web.archive.org URLs that preserve the original port (e.g. :80)', () => {
    const archivedWithPort = 'https://web.archive.org/web/timestamp/http://example.bandcamp.com:80/album/title';

    expect(bandcamp.test(archivedWithPort)).toBe(true);
  });

  it('should parse basic album data from DOM', async () => {
    document.body.innerHTML = `
      <div id="name-section">
        <h2 class="trackTitle" itemprop="name">Album Title</h2>
        <h3 class="album-artist">by <span itemprop="byArtist">Artist Name</span></h3>
      </div>
      <div id="band-name-location">
        <span class="title">Label Name</span>
        <span class="location">London, UK</span>
      </div>
      <table id="track_table">
        <tr class="track_row_view">
          <td class="title"><span>Track One</span></td>
          <td class="time">5:00</td>
        </tr>
        <tr class="track_row_view">
          <td class="title"><a href="#">Track Two</a></td>
          <td class="time">4:00</td>
        </tr>
      </table>
      <div class="tralbum-credits">
        released April 13, 2026
      </div>
    `;

    const result = await bandcamp.parse();

    expect(result.title).toBe('Album Title');
    expect(result.artists[0].name).toBe('Artist Name');
    expect(result.label).toBe('Label Name');
    expect(result.released).toBe('2026-04-13');
    expect(result.tracks).toHaveLength(2);
    expect(result.tracks[0].title).toBe('Track One');
    expect(result.tracks[0].duration).toBe('5:00');
    expect(result.tracks[1].title).toBe('Track Two');
    expect(result.tracks[1].duration).toBe('4:00');
  });

  it('should handle missing label by falling back to publisher', async () => {
    document.body.innerHTML = `
      <span itemprop="publisher">Publisher Name</span>
    `;

    const result = await bandcamp.parse();

    expect(result.label).toBe('Publisher Name');
  });

  it('should read release date from .tralbumData on a web.archive.org snapshot', async () => {
    stubWebarchiveUrl();
    document.body.innerHTML = `
      <div id="name-section">
        <h2 class="trackTitle" itemprop="name">Legacy Album</h2>
      </div>
      <div class="tralbumData">
        released April 13, 2026
      </div>
    `;

    const result = await bandcamp.parse();

    expect(result.released).toBe('2026-04-13');
  });

  it('should read release date from .tralbum-credits on a newer web.archive.org snapshot', async () => {
    stubWebarchiveUrl();
    document.body.innerHTML = `
      <div id="name-section">
        <h2 class="trackTitle" itemprop="name">Album Title</h2>
      </div>
      <div class="tralbumData tralbum-about">Some description without a date.</div>
      <div class="tralbumData tralbum-credits">released April 14, 2023</div>
    `;

    const result = await bandcamp.parse();

    expect(result.released).toBe('2023-04-14');
  });

  it('should read artist from #name-section on a newer web.archive.org snapshot', async () => {
    stubWebarchiveUrl();
    document.body.innerHTML = `
      <div id="name-section">
        <h2 class="trackTitle" itemprop="name">Album Title</h2>
        <h3>by <span><a href="#">Artist Name</a></span></h3>
      </div>
    `;

    const result = await bandcamp.parse();

    expect(result.artists[0].name).toBe('Artist Name');
  });

  it('should read cover from #tralbumArt on a web.archive.org snapshot', async () => {
    stubWebarchiveUrl();
    document.body.innerHTML = `
      <div id="name-section">
        <h2 class="trackTitle" itemprop="name">Legacy Album</h2>
      </div>
      <div id="tralbumArt">
        <img src="https://example.com/cover.jpg" itemprop="image">
      </div>
    `;

    const result = await bandcamp.parse();

    expect(result.thumb).toBe('https://example.com/cover.jpg');
    expect(result.cover).toBe('https://example.com/cover.jpg');
  });

  it('should read artist from schema.org MusicGroup meta on a web.archive.org snapshot', async () => {
    stubWebarchiveUrl();
    document.body.innerHTML = `
      <div id="name-section">
        <h2 class="trackTitle" itemprop="name">Legacy Album</h2>
      </div>
      <div itemscope itemtype="http://schema.org/MusicGroup">
        <meta itemprop="name" content="Legacy Artist">
      </div>
    `;

    const result = await bandcamp.parse();

    expect(result.artists[0].name).toBe('Legacy Artist');
  });

  describe('pre-2008 date filter', () => {
    function buildDateFixture(dateText: string): void {
      document.body.innerHTML = `
        <div id="name-section">
          <h2 class="trackTitle" itemprop="name">Album</h2>
        </div>
        <div class="tralbum-credits">released ${dateText}</div>
      `;
    }

    it('nulls release date earlier than 2008-09 (Bandcamp launch month)', async () => {
      buildDateFixture('December 31, 2007');

      const result = await bandcamp.parse();

      expect(result.released).toBeNull();
    });

    it('nulls release date in 2008 before September', async () => {
      buildDateFixture('August 31, 2008');

      const result = await bandcamp.parse();

      expect(result.released).toBeNull();
    });

    it('keeps release date from 2008-09 onward', async () => {
      buildDateFixture('September 01, 2008');

      const result = await bandcamp.parse();

      expect(result.released).toBe('2008-09-01');
    });
  });

  it('reads cover from `a.popupImage` on the live (non-archive) layout', async () => {
    document.body.innerHTML = `
      <div id="name-section">
        <h2 class="trackTitle" itemprop="name">Album</h2>
      </div>
      <a class="popupImage" href="https://example.com/cover-full.jpg">
        <img src="https://example.com/cover-thumb.jpg" />
      </a>
    `;

    const result = await bandcamp.parse();

    expect(result.thumb).toBe('https://example.com/cover-thumb.jpg');
    expect(result.cover).toBe('https://example.com/cover-full.jpg');
  });
});
