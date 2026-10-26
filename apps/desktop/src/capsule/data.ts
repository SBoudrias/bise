// The spotlight's data from the store: every project's agents and cards as one SpotData, read
// through the store's own slices (a change re-reads only when one of them changed: the snapshot
// is cached on the identity of the slices it was built from). toSpotData is the pure mapping from
// the generated row shapes (src/proto) to the spotlight's view types.
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { Agent, Card, ProjectRow } from '@/proto';
import { sortCards } from '@/inbox/order';
import { dedupeUpdates } from '@/shared/update';
import { threadKey, useProjects, useStore, useThreadOrder } from '@/store';
import type { SpotCard, SpotData, SpotFront } from '@/spotlight';
import { previewLines, type PreviewLine } from '@/spotlight/preview';
import { useNow } from '@/app/clock';
import { signOf } from '@/app/side';

export function cardKind(c: Card): SpotCard['kind'] {
  if (c.approval !== true) return 'question';
  // a batch of drafts to send (amb-core's batched card) reads as ✉
  return c.kind.includes('draft') ? 'drafts' : 'approval';
}

export function toSpotData(
  projects: readonly ProjectRow[],
  agentsOf: (project: string) => readonly Agent[],
  cardsOf: (project: string) => readonly Card[],
  front: SpotFront | null,
  now: number,
): SpotData {
  const mine = [...projects].sort((a, b) => a.order - b.order);
  const home = mine.find((p) => p.home);
  return {
    projects: mine
      .filter((p) => !p.home)
      .map((p) => ({ id: p.project, name: p.name, path: p.path, branch: p.branch ?? 'main', agents: p.agents, waits: p.waits, working: p.working, missing: p.missing })),
    ...(home === undefined ? {} : { home: { id: home.project, waits: home.waits, working: home.working } }),
    agents: mine.flatMap((p) =>
      agentsOf(p.project).map((a) => {
        const s = signOf(a, now);
        return {
          name: a.name, project: p.project, status: a.status, title: a.title, purpose: a.purpose, archived: a.archived,
          main: a.main, note: a.note, since: a.doing?.since_ms ?? (a.status === 'working' && a.turn_ms != null ? now - a.turn_ms : a.since_ms), sign: { g: s.g, tone: s.tone },
        };
      }),
    ),
    cards: cardsInOrder(mine, cardsOf),
    front,
  };
}

/**
 * Every project's cards in the window's inbox order (the hub's rank, then the oldest: sortCards),
 * each with its project word as the block says it: 'bise' for the home's (one-inbox 3, amb-home).
 * One update prompt (single-update): a release's items are one card of it here too, bise's own
 * when the home hub asks (shared/update.ts dedupeUpdates).
 */
function cardsInOrder(mine: readonly ProjectRow[], cardsOf: (project: string) => readonly Card[]): SpotCard[] {
  const all = mine.flatMap((p) => cardsOf(p.project).map((c) => ({ ...c, project: p.project, pname: p.home ? 'bise' : p.name })));
  const one = dedupeUpdates(sortCards(all), mine.find((p) => p.home)?.project ?? '');
  return one.map((c) => ({ id: `${c.project}.${String(c.id)}`, card: c.id, agent: c.agent, project: c.project, text: c.question, kind: cardKind(c), pname: c.pname }));
}

/** How many of a thread's newest entries the selected agent's preview reads (its last actions). */
const PREVIEW_PAGE = 12;

/**
 * R07-a: the agent the spotlight's keyboard is on, followed while it stays there (its thread's
 * newest page, then live), and its last actions for that row's right column. Another row, or the
 * spot closing, stops the follow, unless another part of the capsule follows that thread too
 * (main's thread for his asks: `keep`). None: no agent selected or no actions yet.
 */
export function useAgentPreview(sel: { readonly id: string; readonly project: string; readonly name: string } | null, keep: string | null): { readonly id: string; readonly lines: readonly PreviewLine[] } | null {
  const store = useStore();
  const id = sel?.id ?? null;
  const project = sel?.project ?? null;
  const name = sel?.name ?? null;
  const key = project === null || name === null ? '' : threadKey(project, name);
  useEffect(() => {
    if (project === null || name === null) return;
    // a short pause: arrows held through the list don't subscribe to every agent on the way
    const t = window.setTimeout(() => {
      store.subscribeThread(project, name, PREVIEW_PAGE);
    }, 120);
    return () => {
      window.clearTimeout(t);
      if (key !== keep) store.unsubscribeThread(project, name);
    };
  }, [store, project, name, key, keep]);
  const order = useThreadOrder(key);
  // the minute clock, not Date.now() in render: the ages also move on while he looks
  const now = useNow();
  return useMemo(() => {
    if (id === null) return null;
    const entries = order.order.slice(-PREVIEW_PAGE).flatMap((pos) => store.entry(key, pos) ?? []);
    return { id, lines: previewLines(entries, now) };
  }, [id, order, store, key, now]);
}

/** Every project's agents and cards, with what's in front, re-read only when a slice changes. */
export function useSpotData(front: SpotFront | null): SpotData {
  const store = useStore();
  const projects = useProjects();
  // a project's cards are its row's (store reads.ts cards): 'projects' tells them
  const keys = ['projects', ...projects.map((p) => `agents:${p.project}`)].join('|');
  const subscribe = useCallback(
    (cb: () => void) => {
      const offs = keys === '' ? [] : keys.split('|').map((k) => store.subscribe(k, cb));
      return () => {
        offs.forEach((off) => {
          off();
        });
      };
    },
    [store, keys],
  );
  const cache = useRef<{ parts: readonly unknown[]; value: SpotData } | null>(null);
  const snapshot = (): SpotData => {
    const parts: unknown[] = [projects, front, ...projects.flatMap((p) => [store.agents(p.project), store.cards(p.project)])];
    const c = cache.current;
    if (c !== null && c.parts.length === parts.length && c.parts.every((x, i) => x === parts[i])) return c.value;
    const value = toSpotData(projects, (p) => store.agents(p), (p) => store.cards(p), front, Date.now());
    cache.current = { parts, value };
    return value;
  };
  return useSyncExternalStore(subscribe, snapshot);
}
