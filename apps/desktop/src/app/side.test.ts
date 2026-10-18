// The sidebar's signs and words, the frame's widths (designer's desktop-screens v6/v7, signed).
import { describe, expect, it } from 'vitest';
import type { Agent, ProjectRow } from '@/proto';
import { computerDot, crumbGoOf, crumbOf, folds, moreWords, panelAt, panelWords, panelProject, projectSide, signOf, turnShort } from './side';
import { keyAction, type KeyLike } from './keys';
import { newWords } from './Sidebar';

const NOW = new Date(2026, 9, 7, 14, 0).getTime();
const agent = (name: string, status: Agent['status'], over: Partial<Agent> = {}): Agent => ({
  name, dir: name, main: false, status, archived: false, title: 'product page speed', purpose: '', since_ms: NOW - 60_000, waits: 0, watching: [], ...over,
});
const row = (over: Partial<ProjectRow> = {}): ProjectRow => ({ project: 'acme-1', name: 'storefront', path: '/x', git: true, home: false, order: 1, agents: 3, working: 0, waits: 0, running: true, ...over });

describe('an agent sign', () => {
  it('asks him first: ? in the accent with his pink count, no end words', () => {
    expect(signOf(agent('search', 'working', { waits: 1 }), NOW)).toMatchObject({ g: '?', tone: 'acc', end: '', count: 1 });
  });
  it('at work: ∿ in ink and its turn time', () => {
    expect(signOf(agent('perf', 'working', { turn_ms: 14 * 60_000 }), NOW)).toMatchObject({ g: '∿', tone: 'ink', end: '14 min', count: 0 });
    expect(signOf(agent('perf', 'working', { since_ms: NOW - 6 * 60_000 }), NOW).end).toBe('6 min');
  });
  it('waiting on someone: ⋯ with who on hover; failed: ✗ and failed in err', () => {
    const w = signOf(agent('a', 'waiting'), NOW);
    expect(w).toMatchObject({ g: '⋯', end: 'waiting' });
    expect(w.title).toBe('waiting · product page speed');
    expect(signOf(agent('ci-fix', 'failed'), NOW)).toMatchObject({ g: '✗', tone: 'err', end: 'failed', endTone: 'err' });
  });
  it('a next wake: ◷ and its time; done: ✓ done in text-2; at rest: ○ idle, the head chip\'s word', () => {
    const wake = new Date(2026, 9, 7, 14, 20).getTime();
    expect(signOf(agent('deploy-watch', 'idle'), NOW, wake)).toMatchObject({ g: '◷', end: '14:20' });
    expect(signOf(agent('size-filter', 'done'), NOW)).toMatchObject({ g: '✓', tone: 'dim', end: 'done' });
    expect(signOf(agent('x', 'idle'), NOW)).toMatchObject({ g: '○', end: 'idle' });
  });
  it('turn words are short', () => {
    expect([turnShort(40_000), turnShort(6 * 60_000), turnShort(72 * 60_000), turnShort(120 * 60_000), turnShort(84 * 3_600_000)]).toEqual(['now', '6 min', '1 h', '2 h', '3 d']);
  });
});

describe('the fold of quiet agents', () => {
  it('folds a done agent quiet for over an hour, never one at rest, that waits, works, failed or wakes', () => {
    const old = NOW - 61 * 60_000;
    expect(folds(agent('a', 'done', { since_ms: old }), NOW)).toBe(true);
    expect(folds(agent('a', 'idle', { since_ms: old }), NOW)).toBe(false);
    expect(folds(agent('a', 'done', { since_ms: NOW - 59 * 60_000 }), NOW)).toBe(false);
    expect(folds(agent('a', 'done', { since_ms: old, waits: 1 }), NOW)).toBe(false);
    expect(folds(agent('a', 'failed', { since_ms: old }), NOW)).toBe(false);
    expect(folds(agent('a', 'done', { since_ms: old }), NOW, NOW + 1000)).toBe(false);
  });
  it("says '3 more today', or '3 more' when one is older than today", () => {
    const today = [1, 2, 3].map((i) => agent(`a${String(i)}`, 'done', { since_ms: NOW - 3 * 3_600_000 }));
    expect(moreWords(today, NOW)).toBe('3 more today');
    expect(moreWords([...today.slice(1), agent('old', 'done', { since_ms: NOW - 86_400_000 })], NOW)).toBe('3 more');
  });
});

describe("a project's row", () => {
  it("the number at work and his pink count; quiet says nothing (its mark does); a gone folder or a refusal in err", () => {
    expect(projectSide(row({ working: 2, waits: 1 }))).toEqual({ text: '2', err: false, count: 1 });
    expect(projectSide(row({ working: 3 }))).toEqual({ text: '3', err: false, count: 0 });
    expect(projectSide(row())).toEqual({ text: '', err: false, count: 0 });
    expect(projectSide(row({ waits: 2 }))).toEqual({ text: '', err: false, count: 2 });
    expect(projectSide(row({ missing: true }))).toMatchObject({ text: 'folder gone', err: true });
  });
});

describe('the frame', () => {
  it('the panel: open by default from 1100 px, closed below, his choice kept, sliding over under 1000 px', () => {
    expect(panelAt(1400, undefined)).toEqual({ docked: true, open: true });
    expect(panelAt(1050, undefined)).toEqual({ docked: true, open: false });
    expect(panelAt(1400, false)).toEqual({ docked: true, open: false });
    expect(panelAt(1050, true)).toEqual({ docked: true, open: true });
    expect(panelAt(800, true)).toEqual({ docked: false, open: false });
  });
  it("the panel's project: the route's, every project's on bise's thread, none without a project or on the global screens", () => {
    expect(panelProject({ screen: 'thread', project: 'p', agent: 'perf' }, 'h', 1)).toBe('p');
    expect(panelProject({ screen: 'bise' }, 'h', 2), "bise's own thread: every project's").toBe('');
    expect(panelProject({ screen: 'thread', project: 'h', agent: 'main' }, 'h', 2)).toBe('');
    expect(panelProject({ screen: 'bise' }, 'h', 0), 'no project yet: no panel').toBeUndefined();
    expect(panelProject({ screen: 'artifacts', project: '' }, 'h', 2)).toBeUndefined();
    expect(panelProject({ screen: 'settings' }, 'h', 2)).toBeUndefined();
  });
  it("the crumb: 'storefront › perf', a project's main is the project", () => {
    const name = () => 'storefront';
    expect(crumbOf({ screen: 'thread', project: 'p', agent: 'perf' }, name)).toEqual(['storefront', 'perf']);
    expect(crumbOf({ screen: 'thread', project: 'p', agent: 'main' }, name)).toEqual(['storefront']);
    expect(crumbOf({ screen: 'scheduled' }, name)).toEqual(['scheduled']);
    // /agents and /archived are two lists, each its own crumb (designer m_19489)
    expect(crumbOf({ screen: 'agents', project: 'p' }, name)).toEqual(['storefront', 'agents']);
    expect(crumbOf({ screen: 'agents', project: 'p', archived: true }, name)).toEqual(['storefront', 'archived']);
  });
  it("an earlier crumb goes where it names: the project's main, that agent, that screen; the last stays plain", () => {
    const name = () => 'storefront';
    // an agent's thread: the agent's name is where he is (the last, plain), the project → its main
    expect(crumbGoOf({ screen: 'thread', project: 'p', agent: 'perf' }, name)).toEqual([
      { c: 'storefront', go: { screen: 'thread', project: 'p', agent: 'main' } },
    ]);
    // a log: the project → its main, the agent → its thread, its own word stays plain (the last)
    expect(crumbGoOf({ screen: 'log', project: 'p', agent: 'perf' }, name)[1]).toEqual({ c: 'perf', go: { screen: 'thread', project: 'p', agent: 'perf' } });
    // a project's lists (agents, archived, changes…): their word is the last, where he is; the project's name is the way back
    expect(crumbGoOf({ screen: 'agents', project: 'p' }, name)).toEqual([{ c: 'storefront', go: { screen: 'thread', project: 'p', agent: 'main' } }]);
    expect(crumbGoOf({ screen: 'agents', project: 'p', archived: true }, name)).toEqual([{ c: 'storefront', go: { screen: 'thread', project: 'p', agent: 'main' } }]);
    expect(crumbGoOf({ screen: 'changes', project: 'p' }, name)).toEqual([{ c: 'storefront', go: { screen: 'thread', project: 'p', agent: 'main' } }]);
    expect(crumbGoOf({ screen: 'prs', project: 'p' }, name)).toEqual([{ c: 'storefront', go: { screen: 'thread', project: 'p', agent: 'main' } }]);
    expect(crumbGoOf({ screen: 'environments', project: 'p' }, name)).toEqual([{ c: 'storefront', go: { screen: 'thread', project: 'p', agent: 'main' } }]);
    expect(crumbGoOf({ screen: 'artifacts', project: 'p' }, name)).toEqual([{ c: 'storefront', go: { screen: 'thread', project: 'p', agent: 'main' } }]);
    // a feature, a commit and a branch: their word (the last) names one thing of the project, so the
    // project's name is the only way back
    expect(crumbGoOf({ screen: 'feature', project: 'p', name: 'billing' }, name)).toEqual([{ c: 'storefront', go: { screen: 'thread', project: 'p', agent: 'main' } }]);
    expect(crumbGoOf({ screen: 'commit', project: 'p', sha: 'a1b2c3d4e5f6' }, name)).toEqual([{ c: 'storefront', go: { screen: 'thread', project: 'p', agent: 'main' } }]);
    expect(crumbGoOf({ screen: 'branch', project: 'p', branch: 'sb/x' }, name)).toEqual([{ c: 'storefront', go: { screen: 'thread', project: 'p', agent: 'main' } }]);
    // settings: its word goes to its root, the page's stays plain; a report and a lab: nothing before
    expect(crumbGoOf({ screen: 'settings', page: 'general' }, name)).toEqual([{ c: 'settings', go: { screen: 'settings' } }]);
    expect(crumbGoOf({ screen: 'report' }, name)).toEqual([]);
    // one place: nothing to go
    expect(crumbGoOf({ screen: 'thread', project: 'p', agent: 'main' }, name)).toEqual([]);
    expect(crumbGoOf({ screen: 'bise' }, name)).toEqual([]);
    // every project's artifacts: its word is the only crumb, the last
    expect(crumbGoOf({ screen: 'artifacts', project: '' }, name)).toEqual([]);
  });
  it('the keys: ⌘\\ the sidebar, ⌥⌘0 the panel, ⌘N add a project, ⌘, settings', () => {
    const k = (code: string, m: Partial<KeyLike> = {}): KeyLike => ({ key: '', code, metaKey: true, altKey: false, ctrlKey: false, shiftKey: false, ...m });
    const ctx = { route: { screen: 'bise' as const }, projects: [], agents: () => [], typing: false };
    expect(keyAction(k('Backslash'), ctx)).toEqual({ frame: 'sidebar' });
    expect(keyAction(k('Digit0', { altKey: true }), ctx)).toEqual({ frame: 'panel' });
    expect(keyAction(k('Digit0'), ctx)).toEqual({ go: { screen: 'bise' } });
    expect(keyAction(k('KeyN'), ctx)).toEqual({ addProject: true });
    expect(keyAction(k('Comma'), ctx)).toEqual({ go: { screen: 'settings' } });
  });
});

describe("the artifacts row's new ones (tui-parity R17)", () => {
  it("'1 new · designer' when one agent made them, '3 new' from several, nothing when none", () => {
    expect(newWords(1, ['designer'])).toBe('1 new · designer');
    expect(newWords(3, ['perf', 'search'])).toBe('3 new');
    expect(newWords(0, [])).toBe('');
  });
});

describe('R9/S3: an agent waiting on someone, in the sidebar (the TUI panel)', () => {
  it("another agent: a pause, '…' and how long, 'continues when <who> answers' on hover; him: ? in the accent", () => {
    expect(signOf(agent('search', 'waiting', { waiting_on: { who: 'agent', name: 'perf' } }), NOW)).toMatchObject({ g: '…', tone: 'ink', end: '1 min', count: 0, title: 'continues when perf answers · 1 min · product page speed' });
    expect(signOf(agent('perf', 'idle', { waiting_on: { who: 'you' } }), NOW)).toMatchObject({ g: '?', tone: 'acc', count: 0, title: 'asks you · product page speed' });
  });
  it("waiting on main: the row's words name it 'bise', as everywhere in the window (shownName)", () => {
    expect(signOf(agent('search', 'waiting', { waiting_on: { who: 'agent', name: 'main' } }), NOW).title).toBe('continues when bise answers · 1 min · product page speed');
  });
});

describe('agent-waiting-states A: a pause in AGENTS, an alarm leaves it idle', () => {
  const bench = { id: 7, kind: 'bg' as const, what: 'cargo bench', since_ms: NOW - 180_000, resumes: true };
  const gate = { id: 4, kind: 'file' as const, what: 'the nightly gate goes red', noted: true, since_ms: NOW - 16 * 3_600_000, until_ms: NOW + 8 * 3_600_000 };
  it("a pause: '…' in ink, its duration at the end, the line on hover", () => {
    expect(signOf(agent('perf', 'idle', { watching: [bench] }), NOW)).toMatchObject({ g: '…', tone: 'ink', end: '3 min', title: 'continues when cargo bench ends · running for 3 min · product page speed' });
  });
  it('an alarm: ○ idle, never waiting', () => {
    expect(signOf(agent('main', 'idle', { watching: [gate] }), NOW)).toMatchObject({ g: '○', end: 'idle' });
  });
});

describe('the computer-use mark beside an agent (S29/L19 W3)', () => {
  const base = { agent: 'perf', key: 'h.perf', project: 'acme-1' } as const;
  it("the core's mark: ink while it drives, accent when he took the wheel, dim stopped; its words on hover; none without a row", () => {
    expect(computerDot({ ...base, kind: 'driving', mark: '↖', words: 'driving Chrome · amazon.fr' })).toEqual({ g: '↖', tone: 'ink', title: 'driving Chrome · amazon.fr' });
    expect(computerDot({ ...base, kind: 'paused', mark: '?', words: 'you took the wheel · ⏎ give it back' })).toMatchObject({ g: '?', tone: 'acc' });
    expect(computerDot({ ...base, kind: 'stopped', mark: '↖', words: 'stopped · write to it to go on' })).toMatchObject({ g: '↖', tone: 'dim' });
    expect(computerDot(undefined)).toBeNull();
  });
});

describe('panelWords', () => {
  it("drops the count at zero (designer m_18734): 'artifacts', and nothing after ↗ when narrow", () => {
    expect(panelWords(false, 5)).toBe('artifacts · 5');
    expect(panelWords(true, 5)).toBe('5');
    expect(panelWords(false, 0)).toBe('artifacts');
    expect(panelWords(true, 0)).toBe('');
  });
});

describe('resize (designer m_19374)', () => {
  it('the sidebar: 200-400, folds under 160, the main column never under 520', async () => {
    const { sideWidthOf, panelWidthOf, keptWidth } = await import('./resize');
    expect(sideWidthOf(300, 1400, 320)).toBe(300);
    expect(sideWidthOf(180, 1400, 320)).toBe(200);
    expect(sideWidthOf(150, 1400, 320)).toBe('fold');
    expect(sideWidthOf(900, 1400, 320)).toBe(400);
    expect(sideWidthOf(390, 1100, 320)).toBe(260);
    expect(panelWidthOf(200, 1400, 240)).toBe(320);
    expect(panelWidthOf(900, 1400, 240)).toBe(640);
    expect(panelWidthOf(700, 1400, 240)).toBe(640);
    expect(keptWidth('x', 200, 400, 240)).toBe(240);
    expect(keptWidth(999, 200, 400, 240)).toBe(400);
  });
});
