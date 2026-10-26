import { describe, expect, it } from 'vitest';
import type { Card } from '../../proto';
import { Arrivals, bundleIdOf, effectOf, knocks, langOf, ncPrefsOf, noteOf, testNote, titleOf } from './plan';

const card = (o: Partial<Card> = {}): Card => ({
  id: 7,
  project: 'acme-1',
  kind: 'question',
  agent: 'search',
  question: 'reindex tonight at 2:00, or now?',
  options: [
    { n: 1, label: 'tonight at 2:00' },
    { n: 2, label: 'now' },
  ],
  urgent: false,
  since_ms: 1,
  ...o,
});
const acme = { name: 'acme', home: false };

describe('notify plan: what one notification says (designer m_14211)', () => {
  it("title: '<agent> asks · <project>', main is bise, bise's home names no project, fr", () => {
    expect(titleOf(card(), acme, 'en')).toBe('search asks · acme');
    expect(titleOf(card({ agent: 'main' }), acme, 'en')).toBe('bise asks · acme');
    expect(titleOf(card(), { name: 'bise', home: true }, 'en')).toBe('search asks');
    expect(titleOf(card(), acme, 'fr')).toBe('search demande · acme');
    // a plan an agent proposes (plan-ok): its own words
    expect(titleOf(card({ kind: 'plan', agent: 'lean-install' }), acme, 'en')).toBe('lean-install proposes a plan · acme');
    expect(titleOf(card({ kind: 'plan', agent: 'lean-install' }), acme, 'fr')).toBe('lean-install propose un plan · acme');
    // the one update prompt is bise's own, never a project's (single-update)
    const upd = noteOf(card({ kind: 'update', agent: 'main', place: 'release:7e187ba', approval: true, options: [{ n: 1, label: 'update now' }, { n: 2, label: 'later' }] }), acme, 'en', false);
    expect(upd.title).toBe('bise asks');
    expect(upd.release).toBe('7e187ba');
    expect(noteOf(card(), acme, 'en', false).release).toBeUndefined();
  });

  it("a question: its choices then 'open in bise', a reply field; the body is the question as written", () => {
    const n = noteOf(card(), acme, 'en', false);
    expect(n.actions).toEqual(['tonight at 2:00', 'now', 'open in bise']);
    expect(n.picks).toEqual([1, 2, null]);
    expect(n.reply).toBe(true);
    expect(n.placeholder).toBe('your answer');
    expect(n.body).toBe('reindex tonight at 2:00, or now?');
    expect(n.group).toBe('acme-1');
    expect(noteOf(card(), acme, 'fr', false).actions.at(-1)).toBe('ouvrir dans bise');
  });

  it('more than 4 choices, or one over 40 characters: only open in bise (nothing cut), still a reply', () => {
    const six = card({ options: [1, 2, 3, 4, 5, 6].map((n) => ({ n, label: `layer ${n}` })) });
    expect(noteOf(six, acme, 'en', false).actions).toEqual(['open in bise']);
    const long = card({ options: [{ n: 1, label: 'x'.repeat(41) }, { n: 2, label: 'no' }] });
    expect(noteOf(long, acme, 'en', false).actions).toEqual(['open in bise']);
    expect(noteOf(long, acme, 'en', false).reply).toBe(true);
  });

  it('an approval: its two words as buttons, no reply, no open in bise', () => {
    const n = noteOf(card({ approval: true, options: [{ n: 1, label: 'merge' }, { n: 2, label: 'not yet' }] }), acme, 'en', false);
    expect(n.actions).toEqual(['merge', 'not yet']);
    expect(n.reply).toBe(false);
  });

  it("a drop card (drop-card, designer m_35655): 'archive <agent>?', its two options as buttons, each answers its digit", () => {
    const drop = card({
      kind: 'drop',
      agent: 'sculpt-engine',
      question: 'main suggests it. its 4 changed files are kept; /restore brings it back.',
      options: [
        { n: 1, label: 'archive it' },
        { n: 2, label: 'keep it' },
      ],
    });
    expect(titleOf(drop, acme, 'en')).toBe('archive sculpt-engine? · acme');
    expect(titleOf(drop, acme, 'fr')).toBe('archiver sculpt-engine ? · acme');
    const n = noteOf(drop, acme, 'en', false);
    expect(n.actions).toEqual(['archive it', 'keep it', 'open in bise']);
    expect(effectOf(n, { action: 0 })).toEqual({ t: 'answer', cmd: { cmd: 'answer', project: 'acme-1', card: 7, reply: '1' } });
    expect(effectOf(n, { action: 1 })).toEqual({ t: 'answer', cmd: { cmd: 'answer', project: 'acme-1', card: 7, reply: '2' } });
    // typed yes/no still answer it
    expect(n.reply).toBe(true);
  });

  it('a quiet moment: silent', () => {
    expect(noteOf(card(), acme, 'en', true).silent).toBe(true);
    expect(noteOf(card(), acme, 'en', false).silent).toBe(false);
  });
});

describe('notify plan: what his gesture does (the same answer as the window)', () => {
  const n = noteOf(card(), acme, 'en', false);
  it('a choice answers with its option number', () => {
    expect(effectOf(n, { action: 1 })).toEqual({ t: 'answer', cmd: { cmd: 'answer', project: 'acme-1', card: 7, reply: '2' } });
  });
  it("'open in bise' and a click on the banner open that card in the inbox", () => {
    expect(effectOf(n, { action: 2 })).toEqual({ t: 'open', route: 'inbox?card=acme-1/7' });
    expect(effectOf(n, { click: true })).toEqual({ t: 'open', route: 'inbox?card=acme-1/7' });
  });
  it('a reply answers with his words; empty or on an approval, nothing', () => {
    expect(effectOf(n, { reply: '  now please ' })).toEqual({ t: 'answer', cmd: { cmd: 'answer', project: 'acme-1', card: 7, reply: 'now please' } });
    expect(effectOf(n, { reply: '  ' })).toEqual({ t: 'none' });
    const ap = noteOf(card({ approval: true }), acme, 'en', false);
    expect(effectOf(ap, { reply: 'merge it' })).toEqual({ t: 'none' });
    expect(effectOf(n, { action: 9 })).toEqual({ t: 'none' });
  });
});

describe('notify plan: arrivals and knocks', () => {
  it("a project's first list never knocks; a later card is fresh; a card that left is gone", () => {
    const a = new Arrivals();
    expect(a.apply('acme-1', [card()])).toEqual({ fresh: [], gone: [] });
    const c8 = card({ id: 8 });
    expect(a.apply('acme-1', [card(), c8])).toEqual({ fresh: [c8], gone: [] });
    expect(a.apply('acme-1', [c8])).toEqual({ fresh: [], gone: ['acme-1#7'] });
    expect(a.apply('docs-2', [card({ project: 'docs-2' })]).fresh).toEqual([]);
  });
  it('only when no bise window had the keys', () => {
    expect(knocks(false)).toBe(true);
    expect(knocks(true)).toBe(false);
  });
  it('fr when his first language is French', () => {
    expect(langOf(['fr-FR', 'en-US'])).toBe('fr');
    expect(langOf(['en-GB', 'fr'])).toBe('en');
    expect(langOf([])).toBe('en');
  });
});

describe('a0: the test notification and what macOS keeps (lead m_14515)', () => {
  it("is a real card's notification: 'perf asks · acme', cold / warm, a reply, key 'test'", () => {
    const n = testNote('en');
    expect(n.key).toBe('test');
    expect(n.title).toBe('perf asks · acme');
    expect(n.actions).toEqual(['cold', 'warm']);
    expect(n.reply).toBe(true);
    expect(n.placeholder).toBe('your answer');
  });

  const xml = (flags: number, auth?: number) => `<plist><dict><key>apps</key><array>
    <dict><key>bundle-id</key><string>com.apple.FaceTime</string><key>flags</key><integer>41951246</integer></dict>
    <dict><key>bundle-id</key><string>dev.bise.desktop.try</string><key>flags</key><integer>${flags}</integer>${auth === undefined ? '' : `<key>auth</key><integer>${auth}</integer>`}</dict>
  </array></dict></plist>`;

  it("reads the app's own entry: flags, auth, the style bits (1 banners, 2 alerts, 0 none)", () => {
    expect(ncPrefsOf(xml(8 | 6, 7), 'dev.bise.desktop.try')).toEqual({ flags: 14, auth: 7, style: 'banners' });
    expect(ncPrefsOf(xml(16 | 6), 'dev.bise.desktop.try')).toEqual({ flags: 22, auth: null, style: 'alerts' });
    expect(ncPrefsOf(xml(6), 'dev.bise.desktop.try')?.style).toBe('none');
  });

  it('no entry: macOS never registered the app', () => {
    expect(ncPrefsOf(xml(8), 'dev.bise.desktop')).toBeNull();
  });

  it("the bundle id from an app's Info.plist", () => {
    expect(bundleIdOf('<dict><key>CFBundleIdentifier</key>\n\t<string>dev.bise.desktop.try</string></dict>')).toBe('dev.bise.desktop.try');
    expect(bundleIdOf('<dict></dict>')).toBeNull();
  });
});
