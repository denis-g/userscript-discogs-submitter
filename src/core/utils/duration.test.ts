import { describe, expect, it } from 'vitest';
import { normalizeDuration } from '@/core/utils/duration';

describe('normalizeDuration', () => {
  it('handles seconds (Bandcamp/Juno/7digital style)', () => {
    expect(normalizeDuration(326)).toBe('5:26');
    expect(normalizeDuration('397.24')).toBe('6:37');
    expect(normalizeDuration(3661)).toBe('1:01:01');
  });

  it('handles HMS/MS strings (Qobuz style)', () => {
    expect(normalizeDuration('00:23')).toBe('0:23');
    expect(normalizeDuration('01:23')).toBe('1:23');
    expect(normalizeDuration('00:01:23')).toBe('1:23');
  });

  it('handles leading zeros correctly', () => {
    expect(normalizeDuration('00:01')).toBe('0:01');
    expect(normalizeDuration('05:01')).toBe('5:01');
    expect(normalizeDuration('01:05:01')).toBe('1:05:01');
  });

  it('handles null/undefined gracefully', () => {
    expect(normalizeDuration(null)).toBe('');
    expect(normalizeDuration(undefined)).toBe('');
  });
});
