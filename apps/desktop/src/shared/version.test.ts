import { describe, expect, it } from 'vitest';
import { shortVersion } from './version';

describe('shortVersion (designer m_25699)', () => {
  it('the version, not the tag', () => {
    expect(shortVersion('desktop-v2026.10.2')).toBe('2026.10.2');
    expect(shortVersion('v2026.10.2')).toBe('2026.10.2');
    expect(shortVersion('2026.10.2-26')).toBe('2026.10.2-26');
    expect(shortVersion('desktop-2026.10.1')).toBe('desktop-2026.10.1');
  });
});
