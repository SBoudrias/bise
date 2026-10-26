// One update prompt for every project (single-update), in his words: one new release of bise,
// every hub opens its own new-release item — the window lists one of them, and his answer goes to
// every hub that asks. Fake rows and cards only (tests/feature/inputs).
import { describe, expect, it } from 'vitest';
import { answer, card, cardAnswered, close, pick, projects, row } from './inputs';
import { feature } from './run';

type Card = ReturnType<typeof card>;
type ProjectRow = ReturnType<typeof row>;

const BISE = 'bise-home-00000000';
const ACME = 'acme-1a2b3c4d';
const BETA = 'beta-5e6f7a8b';
const REL = 'release:7e187ba';
const NOTES = 'https://github.com/gvergnaud/bise/releases/tag/v2026.10.2-5';

/** a hub's new-release item (update_card.rs): kind update, place release:<id>, options 1/2/3. */
const upd = (project: string, id: number): Card =>
  card({
    project,
    id,
    kind: 'update',
    agent: 'main',
    question: 'bise v2026.10.2-5 is out',
    place: REL,
    approval: true,
    options: [
      { n: 1, label: 'update now · your agents keep running' },
      { n: 2, label: 'later' },
      { n: 3, label: 'release notes ↗', act: { act: 'open', url: NOTES } },
    ],
  });
const rowOf = (project: string, name: string, cards: readonly Card[] = []): ProjectRow =>
  row({ project, name, cards: [...cards], waits: cards.length });
const home = (cards: readonly Card[] = []): ProjectRow => ({ ...rowOf(BISE, 'bise', cards), home: true });
/** The ids the inbox lists, as `project-id`. */
const ids = (cards: readonly { project: string; id: number }[]): string[] => cards.map((c) => `${c.project}-${String(c.id)}`);
/** the projects his answers with this reply went to, in order */
const answers = (sent: readonly unknown[], reply: string): string[] =>
  sent.flatMap((c) => {
    const o = c as { cmd?: unknown; project?: unknown; reply?: unknown };
    return o.cmd === 'answer' && o.reply === reply && typeof o.project === 'string' ? [o.project] : [];
  });

describe('one update prompt for every project', () => {
  it("one new release, one item: bise's own (the home hub's), wherever it sits; another release is another item", () => {
    const w = feature().given(projects(home([upd(BISE, 5)]), rowOf(ACME, 'acme', [upd(ACME, 9)]), rowOf(BETA, 'beta', [upd(BETA, 2)])));
    expect(ids(w.view.inbox())).toEqual([`${BISE}-5`]);
    // bise's own gone (he answered it in its terminal: its row no longer lists it): another hub's shows
    w.given(projects(home(), rowOf(ACME, 'acme', [upd(ACME, 9)]), rowOf(BETA, 'beta', [upd(BETA, 2)])));
    expect(ids(w.view.inbox())).toEqual([`${ACME}-9`]);
    // a newer release is its own item (one hub can be ahead of the others)
    const next = card({ ...upd(BETA, 3), place: 'release:a1b2c3d' });
    w.given(projects(home(), rowOf(ACME, 'acme', [upd(ACME, 9)]), rowOf(BETA, 'beta', [upd(BETA, 2), next])));
    expect(ids(w.view.inbox())).toEqual([`${ACME}-9`, `${BETA}-3`]);
  });

  it("'1 update now' goes to every hub that asks, each by its own card: the prompt leaves everywhere at once", () => {
    const w = feature().given(projects(home([upd(BISE, 5)]), rowOf(ACME, 'acme', [upd(ACME, 9)]), rowOf(BETA, 'beta', [upd(BETA, 2)])));
    w.does(answer(BISE, 5, '1'));
    expect(answers(w.sent(), '1')).toEqual([BISE, ACME, BETA]);
    expect(ids(w.view.inbox())).toEqual([]);
    // the hubs' rows lag: still listed there, never here, through a reload too
    w.given(projects(home([upd(BISE, 5)]), rowOf(ACME, 'acme', [upd(ACME, 9)]), rowOf(BETA, 'beta', [upd(BETA, 2)])));
    expect(ids(w.view.inbox())).toEqual([]);
    w.reload();
    expect(ids(w.view.inbox())).toEqual([]);
    // a minute on, their rows still list the cards: the answers went stale (the hub never took
    // them), one item asks again — one, not one per hub
    w.later(61_000).given(projects(home([upd(BISE, 5)]), rowOf(ACME, 'acme', [upd(ACME, 9)]), rowOf(BETA, 'beta', [upd(BETA, 2)])));
    expect(ids(w.view.inbox())).toEqual([`${BISE}-5`]);
    // one hub settled (its rows dropped its card): the others settle too
    w.given(cardAnswered(BETA, 2), projects(home(), rowOf(ACME, 'acme'), rowOf(BETA, 'beta')));
    expect(ids(w.view.inbox())).toEqual([]);
  });

  it("'2 later' closes the prompt on every hub; a plain question's answer still goes to its own hub only", () => {
    const q = card({ project: ACME, id: 12, agent: 'perf', question: 'which bench?', options: [{ n: 1, label: 'cold' }, { n: 2, label: 'warm' }] });
    const w = feature().given(projects(home([upd(BISE, 5)]), rowOf(ACME, 'acme', [upd(ACME, 9), q]), rowOf(BETA, 'beta', [upd(BETA, 2)])));
    w.does(answer(ACME, 9, '2'));
    expect(answers(w.sent(), '2')).toEqual([BISE, ACME, BETA]);
    expect(ids(w.view.inbox())).toEqual([`${ACME}-12`]);
    w.does(answer(ACME, 12, '1'));
    expect(answers(w.sent(), '1')).toEqual([ACME]);
    expect(ids(w.view.inbox())).toEqual([]);
  });

  it("'3 release notes' opens the page once, sends nothing, the prompt stays; a close without an answer closes it everywhere", () => {
    const w = feature().given(projects(home([upd(BISE, 5)]), rowOf(ACME, 'acme', [upd(ACME, 9)]), rowOf(BETA, 'beta', [upd(BETA, 2)])));
    // the hub's row gives option 3 its act: the window opens the link, nothing is sent
    w.does(pick(BISE, 5, 3));
    expect(w.effects()).toEqual([{ out: 'fx', fx: { fx: 'openExternal', args: [NOTES] } }]);
    expect(w.sent()).toHaveLength(0);
    expect(ids(w.view.inbox())).toEqual([`${BISE}-5`]);
    w.does(close(BISE, 5));
    expect(w.sent().filter((c) => c.cmd === 'close').map((c) => c.project)).toEqual([BISE, ACME, BETA]);
    expect(ids(w.view.inbox())).toEqual([]);
  });

  it('a hub whose row is not loaded yet is not answered: its own item shows once its row comes', () => {
    const unloaded = { ...rowOf(BETA, 'beta'), cards: undefined } as ProjectRow;
    const w = feature().given(projects(home([upd(BISE, 5)]), rowOf(ACME, 'acme', [upd(ACME, 9)]), unloaded));
    expect(ids(w.view.inbox())).toEqual([`${BISE}-5`]);
    w.does(answer(BISE, 5, '1'));
    expect(answers(w.sent(), '1')).toEqual([BISE, ACME]);
    // its row loads with the same release: it still asks, on its own
    w.given(projects(home(), rowOf(ACME, 'acme'), rowOf(BETA, 'beta', [upd(BETA, 2)])));
    expect(ids(w.view.inbox())).toEqual([`${BETA}-2`]);
  });
});
