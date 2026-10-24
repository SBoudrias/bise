import { describe, expect, it } from 'vitest';
import { aboutPanel } from './about';

describe("aboutPanel (the macOS About panel: his app's name, its real build)", () => {
  it('the name everywhere (a try build: its own)', () => {
    expect(aboutPanel('bise', 'desktop-v2026.10.1')).toEqual({ applicationName: 'bise', applicationVersion: '2026.10.1' });
    expect(aboutPanel('bise try', '2026.10.1-3')).toEqual({ applicationName: 'bise try', applicationVersion: '2026.10.1-3' });
  });
  it('the version as he reads it elsewhere (shortVersion, designer m_25699): the version, not the tag', () => {
    expect(aboutPanel('bise', 'v2026.10.2')).toEqual({ applicationName: 'bise', applicationVersion: '2026.10.2' });
    expect(aboutPanel('bise', 'desktop-2026.10.1')).toEqual({ applicationName: 'bise', applicationVersion: 'desktop-2026.10.1' });
  });
  it('a dev run (no VERSION) says only the name: the version falls back to Electron default, never a wrong one', () => {
    expect(aboutPanel('bise', null)).toEqual({ applicationName: 'bise' });
  });
});
