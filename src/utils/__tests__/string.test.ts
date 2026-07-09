import { describe, expect, it } from 'vitest';
import { capitalizeString, cleanString, escapeHtml, extractBpm } from '../string';

describe('cleanString', () => {
  it('trims whitespace and collapses multiple spaces', () => {
    expect(cleanString('  hello   world  ')).toBe('hello world');
    expect(cleanString('\n\t  hello \n world \t')).toBe('hello world');
  });

  it('handles &nbsp; entities', () => {
    expect(cleanString('hello&nbsp;world')).toBe('hello world');
    expect(cleanString('hello&NBSP;world')).toBe('hello world');
  });

  it('can preserve internal whitespace if requested', () => {
    expect(cleanString('  hello   world  ', false)).toBe('hello   world');
  });

  it('strips zero-width and invisible formatting characters', () => {
    // Zero-width space / non-joiner / joiner, word joiner, BOM, soft hyphen, directional marks
    expect(cleanString('Arti\u200Bst')).toBe('Artist');
    expect(cleanString('Track\u200C\u200DName')).toBe('TrackName');
    expect(cleanString('Label\u2060\uFEFF')).toBe('Label');
    expect(cleanString('Rec\u00ADord')).toBe('Record');
    expect(cleanString('\u200EArtist\u200F')).toBe('Artist');
  });

  it('strips bidirectional formatting controls', () => {
    // Arabic letter mark, embedding/override (U+202A-U+202E), isolates (U+2066-U+2069)
    expect(cleanString('\u061CArtist')).toBe('Artist');
    expect(cleanString('\u202AArt\u202Bist\u202C')).toBe('Artist');
    expect(cleanString('\u202DArt\u202Eist')).toBe('Artist');
    expect(cleanString('\u2066Art\u2067ist\u2068\u2069')).toBe('Artist');
  });

  it('normalizes non-breaking spaces to regular spaces', () => {
    expect(cleanString('hello\u00A0world')).toBe('hello world');
    // Preserved-whitespace mode still normalizes the nbsp itself
    expect(cleanString('a\u00A0b', false)).toBe('a b');
  });

  it('normalizes typographic ellipses to three dots', () => {
    expect(cleanString('Track Title…')).toBe('Track Title...');
    expect(cleanString('Wait⋯ what')).toBe('Wait... what');
  });

  it('normalizes dash variants to a plain hyphen', () => {
    expect(cleanString('Artist – Title')).toBe('Artist - Title');
    expect(cleanString('Artist — Title')).toBe('Artist - Title');
    expect(cleanString('A ― B')).toBe('A - B');
    expect(cleanString('5−3')).toBe('5-3');
    expect(cleanString('Ｆｕｌｌ－width')).toBe('Ｆｕｌｌ-width');
  });

  it('returns null for empty or non-string input', () => {
    expect(cleanString('')).toBe(null);
    expect(cleanString('   ')).toBe(null);
    expect(cleanString(null)).toBe(null);
    expect(cleanString(undefined)).toBe(null);
    expect(cleanString(123 as any)).toBe(null);
  });
});

describe('capitalizeString', () => {
  it('standardizes basic track titles to Title Case', () => {
    expect(capitalizeString('yet another track')).toBe('Yet Another Track');
    expect(capitalizeString('LIVE AT LONDON')).toBe('Live At London');
    expect(capitalizeString('I AM Emotional')).toBe('I Am Emotional');
    expect(capitalizeString('AM I Emotional?')).toBe('Am I Emotional?');
    expect(capitalizeString('A.M. Radio')).toBe('A.M. Radio');
    expect(capitalizeString('9 AM')).toBe('9 AM');
    expect(capitalizeString('10:30 PM')).toBe('10:30 PM');
    expect(capitalizeString('9AM')).toBe('9AM');
    expect(capitalizeString('10PM')).toBe('10PM');
  });

  it('handles abbreviations and preserved words from ignore map', () => {
    expect(capitalizeString('dj artist name')).toBe('DJ Artist Name');
    expect(capitalizeString('vip mix')).toBe('VIP Mix');
    expect(capitalizeString('A.I. revolution')).toBe('A.I. Revolution');
    expect(capitalizeString('usa anthem')).toBe('USA Anthem');
  });

  it('preserves stylistic mixed case', () => {
    expect(capitalizeString('iPhone')).toBe('iPhone');
    expect(capitalizeString('McDonalds')).toBe('McDonalds');
  });

  it('cleans punctuation and whitespace', () => {
    expect(capitalizeString('Track title (  Mix  )')).toBe('Track Title (Mix)');
    expect(capitalizeString('It`s a track title')).toBe('It\'s A Track Title');
    expect(capitalizeString('It´s another track title')).toBe('It\'s Another Track Title');
  });

  it('handles empty input gracefully', () => {
    expect(capitalizeString('')).toBe('');
    expect(capitalizeString(null)).toBe('');
    expect(capitalizeString(undefined)).toBe('');
  });
});

describe('extractBpm', () => {
  it('extracts bpm values reliably', () => {
    expect(extractBpm('track title 123 bpm')).toBe(123);
    expect(extractBpm('track title 123bpm')).toBe(123);
    expect(extractBpm('track title - 123 bpm')).toBe(123);
    expect(extractBpm('track title - 123bpm')).toBe(123);
    expect(extractBpm('track title (123 bpm)')).toBe(123);
    expect(extractBpm('track title (123bpm)')).toBe(123);
    expect(extractBpm('track title [123 BPM]')).toBe(123);
    expect(extractBpm('track title [123BPM]')).toBe(123);
    expect(extractBpm('no bpm here')).toBeUndefined();
  });
});

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(escapeHtml('Rock & Roll')).toBe('Rock &amp; Roll');
    expect(escapeHtml('say "hi"')).toBe('say &quot;hi&quot;');
    expect(escapeHtml('it\'s')).toBe('it&#39;s');
  });

  it('returns an empty string for empty or nullish input', () => {
    expect(escapeHtml('')).toBe('');
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('leaves safe text untouched', () => {
    expect(escapeHtml('Artist Name - Track Title')).toBe('Artist Name - Track Title');
  });
});
