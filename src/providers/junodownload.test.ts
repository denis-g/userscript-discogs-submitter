import { describe, expect, it, vi } from 'vitest';
import { networkRequest } from '@/core';
import { getReleaseIdFromUrl } from '@/utils';
import { junodownload } from './junodownload';

vi.mock('@/core');
vi.mock('@/utils', async (importActual) => {
  const actual = await importActual<typeof import('@/utils')>();

  return {
    ...actual,
    getReleaseIdFromUrl: vi.fn(),
  };
});

describe('juno download provider', () => {
  it('should parse release data from API and DOM', async () => {
    vi.mocked(getReleaseIdFromUrl).mockReturnValue('123456');
    vi.mocked(networkRequest).mockResolvedValue({
      items: [
        {
          title: 'Track One',
          version: 'Original Mix',
          artists: [{ name: 'Artist Name' }],
          length: '05:00',
          bpm: 124,
          releaseArtists: [{ name: 'Artist Name' }],
          releaseTitle: 'Album Title',
          label: { name: 'Label Name' },
        },
      ],
    });

    document.body.innerHTML = `
      <div id="product-page-digi">
        <span itemprop="datePublished">2026-04-13</span>
        <div class="mb-2"><strong>Cat:</strong> CAT001<br></div>
        <img class="product-image-for-modal" data-src-full="cover.jpg" />
      </div>
    `;

    const result = await junodownload.parse();

    expect(result.title).toBe('Album Title');
    expect(result.artists[0].name).toBe('Artist Name');
    expect(result.label).toBe('Label Name');
    expect(result.released).toBe('2026-04-13');
    expect(result.number).toBe('CAT001');
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0].title).toBe('Track One');
  });
});
