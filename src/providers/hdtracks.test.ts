import { describe, expect, it, vi } from 'vitest';
import { hdtracks } from './hdtracks';

// Mock unsafeWindow for getVisibleText if needed
if (typeof (globalThis as any).unsafeWindow === 'undefined') {
  (globalThis as any).unsafeWindow = globalThis.window;
}

describe('hdtracks provider', () => {
  it('should parse release data from DOM', async () => {
    document.body.innerHTML = `
      <div class="list-page">
        <div class="list-info">
          <div class="list-cover" style="background-image: url(&quot;https://images.hdtracks.com/album_cover.jpg&quot;)"></div>
          <div class="list-artist">Artist Name</div>
          <p>Label Name</p>
          <div class="list-title">
            <h2>Album Title</h2>
          </div>
        </div>
        <div class="list-content">
          <div class="tracks-table">
            <div class="list tracks-table-header"></div>
            <div class="list">
              <ul>
                <li>
                  <div class="item-cell artist">Artist Name</div>
                  <div class="item-cell title">Track One</div>
                  <div class="item-cell duration">
                    <div class="duration-container">05:00</div>
                  </div>
                </li>
              </ul>
            </div>
          </div>
          <div class="list-footer">
            <p>2026-01-01</p>
          </div>
        </div>
        </div>
      </div>
    `;

    // Mock getSelection for getVisibleText
    window.getSelection = vi.fn().mockReturnValue({
      removeAllRanges: vi.fn(),
      addRange: vi.fn(),
      toString: () => 'Track One',
    });

    const result = await hdtracks.parse();

    expect(result.title).toBe('Album Title');
    expect(result.artists[0].name).toBe('Artist Name');
    expect(result.label).toBe('Label Name');
    expect(result.released).toBe('2026-01-01');
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0].title).toBe('Track One');
    expect(result.tracks[0].pos).toBe('1');
    expect(result.cover).toBe('https://images.hdtracks.com/album_cover.jpg');
  });
});
