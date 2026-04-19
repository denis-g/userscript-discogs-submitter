import { describe, expect, it } from 'vitest';
import { amazonmusic } from './amazonmusic';

describe('amazonmusic provider', () => {
  it('should parse release data from HTML document', async () => {
    // Mock the DOM
    document.body.innerHTML = `
      <div id="main_content">
        <music-detail-header
          image-src="cover.jpg"
          headline="Album Title"
          primary-text="Artist Name"
          tertiary-text="2 SONGS  •  8 MINUTES  •  APR 19 2024">
        </music-detail-header>

        <div class="music-tertiary-text">℗© 2024: Label Name</div>

        <music-container>
          <music-text-row>
            <div class="col1">
              <music-link>Track Title 1</music-link>
            </div>
            <div class="col3">
              <music-link title="Artist Name feat. Artist Name 2">Artist Name feat. Artist Name 2</music-link>
            </div>
            <div class="col4">
              <music-link title="3:48">3:48</music-link>
            </div>
          </music-text-row>
          <music-text-row>
            <div class="col1">
              <music-link>Track Title 2</music-link>
            </div>
            <!-- Test missing artist column fallback -->
            <div class="col4">
              <music-link title="4:53">4:53</music-link>
            </div>
          </music-text-row>
        </music-container>
      </div>
    `;

    const result = await amazonmusic.parse();

    expect(result.title).toBe('Album Title');
    expect(result.artists[0].name).toBe('Artist Name');
    expect(result.label).toBe('Label Name');
    expect(result.released).toBe('2024-04-19');
    expect(result.cover).toBe('cover.jpg');

    expect(result.tracks).toHaveLength(2);

    expect(result.tracks[0].position).toBe('1');
    expect(result.tracks[0].title).toBe('Track Title 1');
    expect(result.tracks[0].artists[0].name).toBe('Artist Name');
    expect(result.tracks[0].artists[0].join).toBe(',');
    expect(result.tracks[0].extraartists).toHaveLength(1);
    expect(result.tracks[0].extraartists[0].name).toBe('Artist Name 2');
    expect(result.tracks[0].extraartists[0].role).toBe('Featuring');
    expect(result.tracks[0].duration).toBe('3:48');

    expect(result.tracks[1].position).toBe('2');
    expect(result.tracks[1].title).toBe('Track Title 2');
    expect(result.tracks[1].artists[0].name).toBe('Artist Name');
    expect(result.tracks[1].duration).toBe('4:53');
  });
});
