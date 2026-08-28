import { describe, expect, it, vi } from 'vitest';
import { networkRequest } from '@/libs/network';
import { getReleaseIdFromUrl } from '@/utils/url';
import { beatport } from '..';

vi.mock('@/libs/network');
vi.mock('@/utils/url', async (importActual) => {
  const actual = await importActual<typeof import('@/utils/url')>();

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

  it('should filter out featured/remix artists from main track artists', async () => {
    vi.mocked(getReleaseIdFromUrl).mockReturnValue('987654');
    vi.mocked(networkRequest).mockImplementation(async (options) => {
      const url = typeof options.url === 'string' ? options.url : '';

      if (url.includes('refresh-anon-token')) {
        return { access_token: 'fake_token' };
      }

      if (url.includes('/catalog/releases/987654/tracks')) {
        return {
          results: [
            {
              name: 'Track One feat. Artist Three',
              mix_name: 'Original Mix',
              artists: [{ name: 'Artist One' }, { name: 'Artist Two' }, { name: 'Artist Three' }],
              length: '04:30',
              bpm: 172,
            },
            {
              name: 'Track Two',
              mix_name: 'Remixer One Remix',
              artists: [{ name: 'Artist Four' }, { name: 'Remixer One' }],
              length: '05:00',
              bpm: 174,
            },
          ],
        };
      }

      if (url.includes('/catalog/releases/987654')) {
        return {
          name: 'Release Title',
          artists: [{ name: 'Various Artists' }],
          label: { name: 'Label Name' },
          catalog_number: 'CAT002',
          publish_date: '2020-06-04',
          image: { uri: 'cover.jpg' },
        };
      }

      return {};
    });

    const result = await beatport.parse();
    // Verify track 1 (Featuring)
    const track1 = result.tracks[0];

    expect(track1.title).toBe('Track One');
    expect(track1.artists).toHaveLength(2);
    expect(track1.artists[0].name).toBe('Artist One');
    expect(track1.artists[1].name).toBe('Artist Two');
    expect(track1.extraartists).toContainEqual({ name: 'Artist Three', role: 'Featuring' });

    // Verify track 2 (Remixer)
    const track2 = result.tracks[1];

    expect(track2.title).toBe('Track Two (Remixer One Remix)');
    expect(track2.artists).toHaveLength(1);
    expect(track2.artists[0].name).toBe('Artist Four');
    expect(track2.extraartists).toContainEqual({ name: 'Remixer One', role: 'Remix' });
  });
});
