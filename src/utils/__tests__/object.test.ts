import { describe, expect, it } from 'vitest';
import { getValueByPath, setValueByPath } from '../object';

describe('object utils', () => {
  describe('getValueByPath', () => {
    it('should resolve a simple path', () => {
      const object = { a: 1 };

      expect(getValueByPath(object, 'a')).toBe(1);
    });

    it('should resolve a nested path', () => {
      const object = { a: { b: { c: 3 } } };

      expect(getValueByPath(object, 'a.b.c')).toBe(3);
    });

    it('should resolve array elements', () => {
      const object = { a: [{ b: 1 }, { b: 2 }] };

      expect(getValueByPath(object, 'a.1.b')).toBe(2);
    });

    it('should return undefined for non-existent path', () => {
      const object = { a: 1 };

      expect(getValueByPath(object, 'b.c')).toBeUndefined();
    });

    it('should return the object if path is empty', () => {
      const object = { a: 1 };

      expect(getValueByPath(object, '')).toEqual(object);
    });
  });

  describe('setValueByPath', () => {
    it('should set a simple value', () => {
      const object: any = {};

      setValueByPath(object, 'a', 1);
      expect(object.a).toBe(1);
    });

    it('should set a nested value', () => {
      const object: any = {};

      setValueByPath(object, 'a.b.c', 3);
      expect(object.a.b.c).toBe(3);
    });

    it('should create arrays for numeric keys', () => {
      const object: any = {};

      setValueByPath(object, 'a.0.b', 1);
      expect(Array.isArray(object.a)).toBe(true);
      expect(object.a[0].b).toBe(1);
    });

    it('should not throw on empty path', () => {
      const object = {};

      expect(() => setValueByPath(object, '', 1)).not.toThrow();
    });

    it('should prevent prototype pollution', () => {
      const object: any = {};

      setValueByPath(object, '__proto__.polluted', true);
      expect((Object.prototype as any).polluted).toBeUndefined();
    });
  });
});
