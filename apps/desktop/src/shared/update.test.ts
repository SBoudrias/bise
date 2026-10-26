// One update prompt for every project: the shared shape's unit tests (single-update). Fake rows
// and cards only, no store, no Electron.
import { describe, expect, it } from 'vitest';
import type { Card } from '../proto';
import { dedupeUpdates, isUpdate, knockUpdates, releaseKey, updatePeers, type PeerRow } from './update';

const P = 'acme-1a2b3c4d';
const B = 'bise-home-00000000';
const OTHER = 'beta-5e6f7a8b';

/** an update card of release `rel` in `project` (id tells them apart); `rel` null: a plain card. */
const up = (project: string, id: number, rel: string | null, over: Partial<Card> = {}): Card => ({
  id,
  project,
  kind: rel === null ? 'question' : 'update',
  agent: 'main',
  question: 'bise v2026.10.2-5 is out',
  options: [
    { n: 1, label: 'update now · your agents keep running' },
    { n: 2, label: 'later' },
    { n: 3, label: 'release notes ↗' },
  ],
  urgent: false,
  since_ms: 1000 + id,
  ...(rel === null ? {} : { place: `release:${rel}` }),
  ...over,
});

describe('the one update prompt (shared/update)', () => {
  it('an update card is kind update about a release place; anything else is not, whatever its kind', () => {
    expect(isUpdate(up(P, 1, '7e187ba'))).toBe(true);
    expect(releaseKey(up(P, 1, '7e187ba'))).toBe('7e187ba');
    // no place, another place, or another kind: not the release item
    expect(isUpdate(up(P, 1, null))).toBe(false);
    expect(releaseKey({ kind: 'update', place: 'wt:dark' })).toBe('');
    expect(isUpdate({ kind: 'question', place: 'release:7e187ba' })).toBe(false);
    expect(releaseKey({ kind: 'question', place: 'release:7e187ba' })).toBe('');
  });

  it("one release, one card: the home hub's, else the first in the list's order; other releases and plain cards stay", () => {
    const a = up(P, 4, '7e187ba');
    const b = up(B, 9, '7e187ba');
    const c = up(OTHER, 2, '7e187ba');
    const next = up(P, 5, 'a1b2c3d');
    const q = up(P, 6, null);
    // home's card wins wherever it sits in the order
    expect(dedupeUpdates([a, b, c, next, q], B).map((x) => x.id)).toEqual([9, 5, 6]);
    expect(dedupeUpdates([c, b, a, next, q], B).map((x) => x.id)).toEqual([9, 5, 6]);
    // no home card: the first in the order
    expect(dedupeUpdates([c, a, next, q], B).map((x) => x.id)).toEqual([2, 5, 6]);
    expect(dedupeUpdates([a, c, next, q], B).map((x) => x.id)).toEqual([4, 5, 6]);
    // one card of the release, or none: the list as it came
    expect(dedupeUpdates([a, next, q], B)).toHaveLength(3);
    expect(dedupeUpdates([q], B)).toHaveLength(1);
    expect(dedupeUpdates([], B)).toHaveLength(0);
  });

  it("his answer goes to every hub whose row lists an open card of the same release, in the rows' order", () => {
    const rows = (cards: readonly Card[]): readonly PeerRow[] => cards.map((c) => ({ project: c.project, cards: [c] }));
    const rel = [up(P, 4, '7e187ba'), up(B, 9, '7e187ba'), up(OTHER, 2, '7e187ba')];
    // each hub by its own card id (ids are per hub)
    expect(updatePeers(rows(rel), P, 4)).toEqual([{ project: P, card: 4 }, { project: B, card: 9 }, { project: OTHER, card: 2 }]);
    // a row without its cards (not loaded), or listing another release, is not a peer
    expect(updatePeers([...rows(rel).slice(0, 2), { project: OTHER }], P, 4)).toEqual([{ project: P, card: 4 }, { project: B, card: 9 }]);
    const other = [up(OTHER, 3, 'a1b2c3d')];
    expect(updatePeers([...rows(rel).slice(0, 2), ...rows(other)], P, 4)).toEqual([{ project: P, card: 4 }, { project: B, card: 9 }]);
    // a plain card, or one its row no longer lists: the project alone
    expect(updatePeers(rows([up(P, 4, null)]), P, 4)).toEqual([{ project: P, card: 4 }]);
    expect(updatePeers(rows([up(B, 9, '7e187ba')]), P, 4)).toEqual([{ project: P, card: 4 }]);
  });

  it('a batch of new cards knocks once per release: the first of it posts, the rest never; plain cards always post', () => {
    const a = up(P, 4, '7e187ba');
    const b = up(B, 9, '7e187ba');
    const next = up(P, 5, 'a1b2c3d');
    const q = up(P, 6, null);
    expect(knockUpdates([a, b, next, q], new Set())).toEqual({ post: [a, next, q], keys: ['7e187ba', 'a1b2c3d'] });
    // the release already knocked: its cards post no more, the others do
    expect(knockUpdates([a, b, next, q], new Set(['7e187ba']))).toEqual({ post: [next, q], keys: ['a1b2c3d'] });
    expect(knockUpdates([a, next], new Set(['7e187ba', 'a1b2c3d']))).toEqual({ post: [], keys: [] });
  });
});
