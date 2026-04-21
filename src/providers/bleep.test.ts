import { describe, expect, it } from 'vitest';
import { bleep } from './bleep';

describe('bleep provider', () => {
  it('should have correct ID and test regex', () => {
    expect(bleep.id).toBe('bleep');
    expect(bleep.test('https://bleep.com/release/123-artist-title')).toBe(true);
    expect(bleep.test('https://bleep.com/tracks/123')).toBe(true);
    expect(bleep.test('https://google.com')).toBe(false);
  });

  it('should parse release data correctly', async () => {
    // Mock DOM structure for Bleep
    document.body.innerHTML = `
      <div class="product-page">
        <div class="main-product-image">
          <img src="https://bleep.com/cover.jpg" />
        </div>
        <div class="product-details">
          <dd class="artist">
            <ul class="main-artists">
              <li><a href="/artist/1">Main Artist 1</a></li>
              <li><a href="/artist/2">Main Artist 2</a></li>
            </ul>
            <ul class="featured-artists">
              <li><a href="/artist/3">Featured Artist 1</a></li>
            </ul>
          </dd>
          <h1 class="release-title">Album Title</h1>
          <div class="label">Label</div>
          <div class="catalogue-number">12345</div>
          <div class="product-release-date">April 16, 2026</div>
        </div>
        <ul class="track-list">
          <li>
            <span class="track-artist">
              <span class="track-main-artists"><a href="/artist/4">Track Main Artist</a></span>
              <span class="track-featured-artists"><a href="/artist/5">Track Featured Artist</a></span>
            </span>
            <span class="track-name"><span itemprop="name">Track Title</span></span>
            <span class="track-duration">4:26</span>
          </li>
        </ul>
      </div>
    `;

    const result = await bleep.parse();

    expect(result.cover).toBe('https://bleep.com/cover.jpg');
    expect(result.artists).toEqual([
      { name: 'Main Artist 1', join: ',' },
      { name: 'Main Artist 2', join: ',' },
    ]);
    expect(result.extraartists).toContainEqual({ name: 'Featured Artist 1', role: 'Featuring', join: ',' });
    expect(result.title).toBe('Album Title');
    expect(result.label).toBe('Label');
    expect(result.number).toBe('12345');
    expect(result.released).toBe('2026-04-16');
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0].title).toBe('Track Title');
    expect(result.tracks[0].duration).toBe('4:26');
    expect(result.tracks[0].artists).toEqual([
      { name: 'Track Main Artist', join: ',' },
    ]);
    expect(result.tracks[0].extraartists).toContainEqual({
      name: 'Track Featured Artist',
      role: 'Featuring',
      join: ',',
    });
  });
  it('should parse release data correctly (alternative single-artist markup)', async () => {
    document.body.innerHTML = `
      <div class="product-page">
        <div class="main-product-image">
          <img src="https://bleep.com/cover2.jpg" />
        </div>
        <div class="product-details">
          <dd class="artist">
            <a href="/artist/4">
              <span itemprop="name">Artist 4</span>
            </a>
          </dd>
          <h1 class="release-title">Single Artist Album</h1>
          <div class="label">Label 2</div>
          <div class="catalogue-number">67890</div>
          <div class="product-release-date">January 1, 2025</div>
        </div>
        <ul class="track-list">
          <li>
            <span class="track-name"><span itemprop="name">Track One</span></span>
            <span class="track-duration">3:00</span>
          </li>
        </ul>
      </div>
    `;

    const result = await bleep.parse();

    expect(result.artists).toEqual([{ name: 'Artist 4', join: ',' }]);
    expect(result.extraartists).toHaveLength(0);
    expect(result.title).toBe('Single Artist Album');
    expect(result.tracks[0].artists).toEqual([{ name: 'Artist 4', join: ',' }]);
  });
});
