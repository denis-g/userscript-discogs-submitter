import { describe, expect, it } from 'vitest';
import { getManyTextFromTags, getTextFromTag } from './dom';

describe('dom utilities', () => {
  describe('getTextFromTag', () => {
    it('extracts text from a simple element', () => {
      document.body.innerHTML = '<span class="test">Hello World</span>';
      expect(getTextFromTag('.test')).toBe('Hello World');
    });

    it('extracts attribute from an element', () => {
      document.body.innerHTML = '<meta property="og:title" content="Expected Title">';
      expect(getTextFromTag('meta[property="og:title"]', document, 'content')).toBe('Expected Title');
    });

    it('preserves newlines when keepNewlines is true', () => {
      document.body.innerHTML = '<div id="test">Line 1<br>Line 2</div>';
      expect(getTextFromTag('#test', document, '', true)).toBe('Line 1\nLine 2');
    });

    it('returns null for missing element', () => {
      document.body.innerHTML = '<div></div>';
      expect(getTextFromTag('.missing')).toBeNull();
    });

    it('handles parent context correctly', () => {
      document.body.innerHTML = `
        <div id="p1"><span class="c">V1</span></div>
        <div id="p2"><span class="c">V2</span></div>
      `;

      const p1 = document.getElementById('p1');
      const p2 = document.getElementById('p2');

      expect(getTextFromTag('.c', p1)).toBe('V1');
      expect(getTextFromTag('.c', p2)).toBe('V2');
    });
  });

  describe('getManyTextFromTags', () => {
    it('extracts multiple matching elements', () => {
      document.body.innerHTML = `
        <span class="item">Item 1</span>
        <span class="item">Item 2</span>
        <span class="other">Item 3</span>
      `;
      expect(getManyTextFromTags('.item')).toEqual(['Item 1', 'Item 2']);
    });

    it('handles newline preservation in multiple elements', () => {
      document.body.innerHTML = `
        <div class="item">L1<br>L2</div>
        <div class="item">L3<br>L4</div>
      `;
      expect(getManyTextFromTags('.item', document, true)).toEqual(['L1\nL2', 'L3\nL4']);
    });

    it('returns empty array if no matches found', () => {
      document.body.innerHTML = '<div></div>';
      expect(getManyTextFromTags('.missing')).toEqual([]);
    });
  });
});
