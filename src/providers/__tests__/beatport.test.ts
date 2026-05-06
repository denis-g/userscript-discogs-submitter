import { describe, expect, it, vi } from 'vitest';
import { networkRequest } from '@/core';
import { getReleaseIdFromUrl } from '@/utils';
import { beatport } from '../beatport';

vi.mock('@/core');
vi.mock('@/utils', async (importActual) => {
  const actual = await importActual<typeof import('@/utils')>();

  return {
    ...actual,
    getReleaseIdFromUrl: vi.fn(),
  };
});

describe('beatport provider', () => {
  it('should parse release data from API responses', async () => {
    vi.mocked(getReleaseIdFromUrl).mockReturnValue('1368940');
    vi.mocked(networkRequest).mockImplementation(async (options) => {
      const url = typeof options.url === 'string' ? options.url : '';

      if (url.includes('refresh-anon-token')) {
        return { access_token: 'fake_token' };
      }

      if (url.includes('/catalog/releases/1368940/tracks')) {
        return {
          results: [
            {
              name: 'Track One',
              mix_name: 'Original Mix',
              artists: [{ name: 'Artist Name' }],
              length: '05:00',
              bpm: 124,
            },
          ],
        };
      }

      if (url.includes('/catalog/releases/1368940')) {
        return {
          name: 'Album Title',
          artists: [{ name: 'Artist Name' }],
          label: { name: 'Label Name' },
          catalog_number: 'CAT001',
          publish_date: '2026-04-13',
          image: { uri: 'cover.jpg' },
        };
      }

      return {};
    });

    const result = await beatport.parse();

    expect(result.title).toBe('Album Title');
    expect(result.artists[0].name).toBe('Artist Name');
    expect(result.label).toBe('Label Name');
    expect(result.released).toBe('2026-04-13');
    expect(result.number).toBe('CAT001');
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0].title).toBe('Track One');
    expect(result.tracks[0].bpm).toBe(124);
  });
});
