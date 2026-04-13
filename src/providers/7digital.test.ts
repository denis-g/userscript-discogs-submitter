import { describe, expect, it, vi } from 'vitest';
import * as network from '@/core/network';
import { sevendigital } from './7digital';

vi.mock('@/core/network');

describe('7digital provider', () => {
  it('should parse release data from API response', async () => {
    document.body.innerHTML = `
      <div class="release-info" data-releaseid="12345"></div>
      <div class="release-data-label">Release Date</div>
      <div class="release-data-info">13 Apr 2026</div>
    `;

    vi.mocked(network.networkRequest).mockResolvedValue(JSON.stringify({
      tracks: [
        {
          title: 'Track One',
          version: 'Radio Edit',
          artist: { name: 'Artist Name' },
          duration: 300,
          release: {
            title: 'Album Title',
            artist: { name: 'Artist Name' },
            label: { name: 'Label Name' },
            image: 'cover.jpg',
          },
        },
      ],
    }));

    const result = await sevendigital.parse();

    expect(result.title).toBe('Album Title');
    expect(result.artists[0].name).toBe('Artist Name');
    expect(result.label).toBe('Label Name');
    expect(result.released).toBe('2026-04-13');
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0].title).toBe('Track One (Radio Edit)');
    expect(result.cover).toBe('cover.jpg');
  });
});
