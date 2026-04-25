import { describe, expect, it } from 'vitest';
import { capitalizeString, cleanString, extractBpm } from '@/core/utils/string';

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
