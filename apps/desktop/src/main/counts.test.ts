import { describe, expect, it } from 'vitest';
import { badgeOf, CountKeeper, titleOf } from './counts';

const card = (id: number): Record<string, unknown> => ({ id });

describe('CountKeeper', () => {
  it("counts bise's notifications ask while the inbox lists it: one number (designer m_25690)", () => {
    const k = new CountKeeper();
    expect(k.apply({ ev: 'projects', projects: [{ project: 'shop', waits: 2, working: 0 }] })).toEqual({ waiting: 2, working: 0 });
    expect(k.ask(true)).toEqual({ waiting: 3, working: 0 });
    expect(k.ask(true)).toBeNull();
    expect(k.ask(false)).toEqual({ waiting: 2, working: 0 });
  });

  it('sums every project: its row cards, else its waits; working from the rows', () => {
    const k = new CountKeeper();
    expect(
      k.apply({
        ev: 'projects',
        projects: [
          { project: 'home', cards: [card(1)], working: 0 },
          { project: 'shop', waits: 2, working: 3 },
          { project: 'telemetry', working: 1 },
        ],
      }),
    ).toEqual({ waiting: 3, working: 4 });
  });

  it("a hub's own cards event wins over its row, and counts before the rows list it", () => {
    const k = new CountKeeper();
    expect(k.apply({ ev: 'cards', project: 'home', cards: [card(1), card(2)] })).toEqual({ waiting: 2, working: 0 });
    expect(k.apply({ ev: 'projects', projects: [{ project: 'home', cards: [], working: 1 }] })).toEqual({ waiting: 2, working: 1 });
    expect(k.apply({ ev: 'cards', project: 'home', cards: [] })).toEqual({ waiting: 0, working: 1 });
  });

  it("bise's own cards (`others`: a drop asking him) count with his, as the inbox lists them", () => {
    const k = new CountKeeper();
    expect(k.apply({ ev: 'cards', project: 'home', cards: [card(1)], others: [card(2)] })).toEqual({ waiting: 2, working: 0 });
  });

  it('one update prompt, one count: a release waiting in several projects counts once, as the inbox lists it (single-update)', () => {
    const upd = (place: string): Record<string, unknown> => ({ id: 3, kind: 'update', place, agent: 'main' });
    const k = new CountKeeper();
    expect(
      k.apply({
        ev: 'projects',
        projects: [
          { project: 'home', cards: [upd('release:7e187ba'), card(1)], working: 0 },
          { project: 'shop', cards: [upd('release:7e187ba'), card(2)], working: 0 },
          { project: 'telemetry', cards: [upd('release:a1b2c3d')], working: 1 },
        ],
      }),
    ).toEqual({ waiting: 4, working: 1 });
    // a hub's own cards event holds the same: still once
    expect(k.apply({ ev: 'cards', project: 'shop', cards: [upd('release:7e187ba'), card(2)] })).toBeNull();
    expect(k.counts).toEqual({ waiting: 4, working: 1 });
    // the release settles in one hub, still asks in the other: the count stays one
    expect(k.apply({ ev: 'projects', projects: [{ project: 'home', cards: [card(1)], working: 0 }, { project: 'shop', cards: [upd('release:7e187ba'), card(2)], working: 0 }, { project: 'telemetry', cards: [upd('release:a1b2c3d')], working: 1 }] })).toBeNull();
    // gone everywhere (its hubs' own lists say so too: a cards event wins over its row): the plain cards
    k.apply({ ev: 'cards', project: 'shop', cards: [card(2)] });
    expect(k.apply({ ev: 'projects', projects: [{ project: 'home', cards: [card(1)], working: 0 }, { project: 'shop', cards: [card(2)], working: 0 }, { project: 'telemetry', cards: [], working: 1 }] })).toEqual({ waiting: 2, working: 1 });
  });

  it('null when nothing changed or the event is not a count', () => {
    const k = new CountKeeper();
    expect(k.apply({ ev: 'projects', projects: [] })).toBeNull();
    expect(k.apply({ ev: 'agents', project: 'x', agents: [] })).toBeNull();
    k.apply({ ev: 'cards', project: 'a', cards: [card(1)] });
    expect(k.apply({ ev: 'cards', project: 'a', cards: [card(2)] })).toBeNull();
    expect(k.counts).toEqual({ waiting: 1, working: 0 });
  });

  it('ignores malformed rows and values', () => {
    const k = new CountKeeper();
    expect(k.apply({ ev: 'projects', projects: [null, 3, { name: 'x' }, { project: 'p', waits: -2, working: 'many' }] })).toBeNull();
  });
});

describe('badge and title', () => {
  it('the badge is the waiting count, none at 0, 99+ past 99', () => {
    expect(badgeOf({ waiting: 0, working: 5 })).toBe('');
    expect(badgeOf({ waiting: 2, working: 0 })).toBe('2');
    expect(badgeOf({ waiting: 120, working: 0 })).toBe('99+');
  });
  it('the title names what waits and what works', () => {
    expect(titleOf({ waiting: 0, working: 0 })).toBe('bise');
    expect(titleOf({ waiting: 2, working: 3 })).toBe('bise · 2 waiting · 3 working');
    expect(titleOf({ waiting: 0, working: 1 })).toBe('bise · 1 working');
  });
});
