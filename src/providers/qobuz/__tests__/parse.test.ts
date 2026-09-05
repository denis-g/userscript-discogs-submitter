// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { qobuz } from '..';

describe('qobuz provider', () => {
  it('should parse release data from JSON-LD and DOM', async () => {
    document.body.innerHTML = `
      <script type="application/ld+json">
        {
          "@type": "Product",
          "name": "Album Title",
          "releaseDate": "2026-01-01"
        }
      </script>
      <div class="album-meta">
        <div class="album-meta__title">
          <span class="artist-name">Artist Name</span>
          <span class="album-title">Album Title</span>
        </div>
        <div class="album-meta__item">
          <a href="/label/Label Name">Label Name</a>
        </div>
      </div>
      <img class="album-cover__image" src="cover_600.jpg" />
      <div id="playerTracks">
        <div class="player__item">
          <div class="track__item--name">Track One</div>
          <div class="track__item--artist">Artist Name</div>
          <div class="track__item--duration">05:00</div>
        </div>
      </div>
    `;

    const result = await qobuz.parse();

    expect(result.title).toBe('Album Title');
    expect(result.artists[0].name).toBe('Artist Name');
    expect(result.label).toBe('Label Name');
    expect(result.released).toBe('2026-01-01');
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0].title).toBe('Track One');
    expect(result.cover).toBe('cover_max.jpg');
    expect(result.thumb).toBe('cover_600.jpg');
  });

  it.each([
    ['https://example.com/images/covers/cover_600.jpg', 'https://example.com/images/covers/cover_max.jpg'],
    ['https://example.com/images/covers/cover_230.jpg', 'https://example.com/images/covers/cover_max.jpg'],
    ['https://example.com/images/covers/cover_150.jpg', 'https://example.com/images/covers/cover_max.jpg'],
    ['https://example.com/images/covers/cover_300.jpg', 'https://example.com/images/covers/cover_max.jpg'],
    ['https://example.com/images/covers/cover_800.jpg', 'https://example.com/images/covers/cover_max.jpg'],
  ])('should transform cover URL from %s to %s', async (sourceUrl, expectedMaxUrl) => {
    document.body.innerHTML = `
      <img class="album-cover__image" src="${sourceUrl}" />
      <div id="playerTracks"></div>
    `;

    const result = await qobuz.parse();

    expect(result.cover).toBe(expectedMaxUrl);
    expect(result.thumb).toBe(sourceUrl);
  });
});
