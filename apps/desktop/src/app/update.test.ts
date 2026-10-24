// S.6: the window's update line says only what he can act on.
import { describe, expect, it } from 'vitest';
import { updateLine } from './UpdateLine';

describe('the update line', () => {
  it('ready: restart; went bad: go back; downloading, failed, none: nothing', () => {
    expect(updateLine({ state: 'ready', version: '2026.10.2-26' })).toEqual({ text: 'bise 2026.10.2-26 is ready', act: 'restart' });
    expect(updateLine({ state: 'went_bad', version: '2026.10.2-26' })).toEqual({ text: "the new bise didn't start right", act: 'go back' });
    expect(updateLine({ state: 'downloading', version: '2026.10.2-26' })).toBeNull();
    expect(updateLine({ state: 'failed', version: '2026.10.2-26', why: 'signature' })).toBeNull();
    expect(updateLine({ state: 'none' })).toBeNull();
  });
});
