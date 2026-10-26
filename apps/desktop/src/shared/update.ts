// One update prompt for every project (single-update): each hub's daemon checks the release
// channel on its own and opens its own new-release item (kind `update`, place `release:<id>` —
// the same release id on every hub, the bise binary and its versions being shared), so one new
// release shows one item per project in the window's one inbox. This module knows that shape and
// what the window does with it, pure (no React, no store, no Electron): the inbox's one list
// keeps one card of each release (listed.ts and machine/cards.ts, through dedupeUpdates), his
// answer to it goes to every hub that asks (updatePeers, machine/cards.ts: one install, every hub
// switches onto it), and the badge and the notifications count and knock once (main/counts.ts,
// main/notify/run.ts). The rest stays the hub's: running that release closes the item
// (update_card.rs), and closing on `later` is per-hub. Shared by the renderer and the main
// process, so it lives beside api.ts. Owner: amb-home.
import type { Card } from '../proto';

/** `release:` — the prefix of a new-release item's place (update_card.rs place_of). */
export const RELEASE_PLACE = 'release:';

/** Any card shape as it came off the wire: `isUpdate`/`releaseKey` check the fields themselves. */
export type PlaceCard = { readonly kind?: unknown; readonly place?: unknown };

/** A new-release item: kind `update` about a place `release:<id>` (one per hub). */
export function isUpdate(c: PlaceCard): boolean {
  return c.kind === 'update' && typeof c.place === 'string' && c.place.startsWith(RELEASE_PLACE);
}

/** The release a new-release item is about: `release:7e187ba` → `7e187ba`; '' for any other card. */
export function releaseKey(c: PlaceCard): string {
  return isUpdate(c) ? (c.place as string).slice(RELEASE_PLACE.length) : '';
}

/**
 * The cards the window lists of those given: for each release, one card of it — bise's own (the
 * home hub's), else the first in the list's own order — every other card as it came. The inbox's
 * order sorts before this (order.ts), so 'first' is the oldest; a card he answered or closed is
 * dropped by the caller before this, so the next one of the release shows. Pure.
 */
export function dedupeUpdates<T extends PlaceCard & { readonly project: string }>(cards: readonly T[], home: string): readonly T[] {
  const ups = cards.filter(isUpdate);
  if (ups.length < 2) return cards;
  const pick = new Map<string, T>();
  for (const c of ups) {
    const k = releaseKey(c);
    const was = pick.get(k);
    if (was === undefined || (was.project !== home && c.project === home)) pick.set(k, c);
  }
  const keep = new Set(pick.values());
  return cards.filter((c) => !isUpdate(c) || keep.has(c));
}

/**
 * The hubs his answer or close of an update item goes to: every project whose row lists an open
 * card of the same release, in the rows' order, each with its own card id (ids are per hub) — one
 * install (`bise update`), every hub switches onto it; `later` closes them all. The card he
 * answered is one of them (its row lists it). Not an update card, or its project's row no longer
 * lists it: only the project itself, the answer stays where he made it. Pure.
 */
export interface UpdatePeer {
  readonly project: string;
  readonly card: number;
}

/** A project's row as updatePeers reads it (the projects rows, or any shape holding their cards). */
export type PeerRow = { readonly project: string; readonly cards?: readonly (PlaceCard & { readonly id: number })[] };

export function updatePeers(rows: readonly PeerRow[], project: string, card: number): readonly UpdatePeer[] {
  const mine = rows.find((r) => r.project === project)?.cards?.find((c) => c.id === card);
  const release = mine === undefined ? '' : releaseKey(mine);
  if (release === '') return [{ project, card }];
  return rows.flatMap((r) => {
    const c = r.cards?.find((x) => releaseKey(x) === release);
    return c === undefined ? [] : [{ project: r.project, card: c.id }];
  });
}

/**
 * Which of a batch of new cards knock as a notification: a release's item knocks once — the
 * first of it in the batch posts, the rest of the batch and of the releases that already knocked
 * (`posted`) never; plain cards post as they come. Pure.
 */
export function knockUpdates<T extends Card>(fresh: readonly T[], posted: ReadonlySet<string>): { readonly post: readonly T[]; readonly keys: readonly string[] } {
  const post: T[] = [];
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const c of fresh) {
    const k = releaseKey(c);
    if (k !== '' && (posted.has(k) || seen.has(k))) continue;
    post.push(c);
    if (k !== '') {
      seen.add(k);
      keys.push(k);
    }
  }
  return { post, keys };
}
