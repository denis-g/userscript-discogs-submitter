import { describe, expect, it } from 'vitest';
import { bandcamp } from './bandcamp';

describe('bandcamp provider', () => {
  it('should parse basic album data from DOM', async () => {
    document.body.innerHTML = `
      <div id="name-section">
        <h2 class="trackTitle" itemprop="name">Album Title</h2>
        <h3 class="album-artist">by <span itemprop="byArtist">Artist Name</span></h3>
      </div>
      <script data-tralbum='{
        "artist": "Artist Name",
        "current": { "title": "Album Title", "release_date": "13 Apr 2026 00:00:00 GMT" },
        "trackinfo": [
          { "title": "Track One", "duration": 300, "file": { "mp3-128": "..." } }
        ]
      }'></script>
      <div id="band-name-location">
        <span class="title">Label Name</span>
        <span class="location">London, UK</span>
      </div>
    `;

    const result = await bandcamp.parse();

    expect(result.title).toBe('Album Title');
    expect(result.artists[0].name).toBe('Artist Name');
    expect(result.label).toBe('Label Name');
    expect(result.released).toBe('2026-04-13');
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0].title).toBe('Track One');
    expect(result.tracks[0].duration).toBe('5:00');
  });

  it('should handle missing label by falling back to publisher', async () => {
    document.body.innerHTML = `
      <script data-tralbum='{ "artist": "A", "current": { "title": "T" }, "trackinfo": [] }'></script>
      <span itemprop="publisher">Publisher Name</span>
    `;

    const result = await bandcamp.parse();

    expect(result.label).toBe('Publisher Name');
  });
});
