import { describe, expect, it } from 'vitest';
import { cleanString } from '@/core/utils/string';

describe('juno download parsing', () => {
  it('should correctly extract labelNumber from normalized HTML snippet', () => {
    const rawHtml = '<div class="mb-2"><strong>Cat:</strong>&nbsp;123456<br> ...';
    // Normalize &nbsp; and other entities as done in the provider
    const html = rawHtml.replace(/&nbsp;/g, ' ');
    const match = html.match(/<strong>Cat:<\/strong>([^<]+)<br>/i);

    expect(match).not.toBeNull();

    if (match) {
      const labelNumber = cleanString(match[1]);

      expect(labelNumber).toBe('123456');
    }
  });

  it('should handle different spacing and case variations', () => {
    const rawHtml = '<div class="mb-2"><strong>CAT:</strong> 123456 <br>';
    const html = rawHtml.replace(/&nbsp;/g, ' ');
    const match = html.match(/<strong>Cat:<\/strong>([^<]+)<br>/i);

    expect(match).not.toBeNull();

    if (match) {
      const labelNumber = cleanString(match[1]);

      expect(labelNumber).toBe('123456');
    }
  });
});
