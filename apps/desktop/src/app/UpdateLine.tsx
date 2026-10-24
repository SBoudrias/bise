// The app's own update in one line at the top of the window (bar S.6, amb-mac's updater 7140f8e4,
// window.bise.update). 'ready': 'bise <version> is ready · restart', his click swaps the app and
// reopens it on the screen he is on (it also installs at quit or at a quiet moment, main's
// update/run.ts, after asking this window its screen and whether a send is on its way); 'went_bad': the new app
// didn't start right, 'go back' to the previous one. Downloading and failed say nothing to him
// (failed's why is for the log). HubUpdateLine: bise's own /update build (the hub's update event).
// Owner: amb-win.
import { useEffect, useRef, useState } from 'react';
import type { BiseApi, UpdateState } from '@/shared/api';
import type { UpdateEv } from '@/proto';
import { useHubUpdate, useProjects, useStore } from '@/store';
import { ShaWords } from './ReloadLine';
import { useRoute } from './router';
import { formatRoute } from './route';
import { RANK, type StatusPart } from './status';
import { shortVersion } from '@/shared/version';

/** The line's words and its one action, or none. Pure. */
export function updateLine(s: UpdateState): { text: string; act: 'restart' | 'go back' } | null {
  switch (s.state) {
    case 'ready':
      // it installs by itself now (desktop-dist v7, designer m_25362/m_25699): the click is
      // 'restart now'; when it installs is the popover's line (the pill never cuts inside a word)
      return { text: `bise ${shortVersion(s.version)} is ready`, act: 'restart' };
    case 'went_bad':
      return { text: "the new bise didn't start right", act: 'go back' };
    default:
      return null;
  }
}

const bise = (): BiseApi | undefined => (window as { bise?: BiseApi }).bise;

function useUpdate(): UpdateState {
  const [s, setS] = useState<UpdateState>({ state: 'none' });
  useEffect(() => {
    const u = bise()?.update;
    if (!u) return;
    let live = true;
    const off = u.onState((next) => {
      live = false;
      setS(next);
    });
    void u.now().then((now) => {
      if (live) setS(now);
    });
    return off;
  }, []);
  return s;
}

/** The app update's candidate for the one status line: 'ready' stays until his click, went_bad is a failure. */
export function useUpdateLine(): StatusPart | null {
  const s = useUpdate();
  const route = useRoute();
  const store = useStore();
  // a quiet moment's install asks first (main's update/run.ts): the screen to reopen, and whether
  // a message of his is on its way (it waits for it)
  const routeNow = useRef(route);
  useEffect(() => {
    routeNow.current = route;
  }, [route]);
  useEffect(() => bise()?.update.onAsk(() => ({ route: formatRoute(routeNow.current), sending: store.sending() })), [store]);
  const [busy, setBusy] = useState(false);
  const line = updateLine(s);
  if (line === null) return null;
  const go = () => {
    const u = bise()?.update;
    if (!u || busy) return;
    setBusy(true);
    const done = line.act === 'restart' ? u.install(formatRoute(route)) : u.revert();
    void done.then((ok) => {
      if (!ok) setBusy(false);
    });
  };
  // went_bad's words in the error tone with '▲', never pink; its one action in the pill (amb-home's
  // TitleStatus draws it, designer m_21067)
  const bad = s.state === 'went_bad';
  return {
    rank: bad ? RANK.failed : RANK.ready,
    testId: 'app.update',
    state: s.state,
    tone: bad ? 'err' : 'quiet',
    words: bad ? `▲ ${line.text}` : line.text,
    short: bad ? "▲ bise didn't start right" : 'update ready',
    ...(bad
      ? {}
      : {
          more: (
            <div className="app-core-last" data-testid="app.update.when">
              installs by itself when you quit or step away
            </div>
          ),
        }),
    acts: [
      {
        id: line.act === 'restart' ? 'restart' : 'back',
        text: busy ? (line.act === 'restart' ? 'restarting…' : 'going back…') : line.act === 'restart' ? 'restart now' : line.act,
        onClick: go,
        disabled: busy,
      },
    ],
  };
}

/**
 * /update's build in bise's source tree (the hub's update, amb-feed m_16785), on bise's home: while
 * it builds 'updating bise · 1152b33 · 2 min'; failed: the hub's words with the build's last lines
 * dim under them; built: nothing here (the switch says the rest in main's thread). Pure.
 */
export function hubUpdateLine(u: UpdateEv | null): { text: string; tail: readonly string[]; failed: boolean } | null {
  if (u === null) return null;
  if (u.state === 'building') {
    const s = u.elapsed ?? 0;
    const took = s >= 60 ? ` · ${String(Math.floor(s / 60))} min` : s > 0 ? ` · ${String(s)} s` : '';
    return { text: `updating bise · ${u.rev}${took}`, tail: [], failed: false };
  }
  if (u.state === 'failed') return { text: `▲ ${u.text ?? `couldn't build ${u.rev}`}`, tail: (u.tail ?? []).slice(-3), failed: true };
  return null;
}

/** The window's one status line draws this (StatusLine.tsx, amb-home). */
/** /update's build as a candidate for the one status pill: building runs, failed is a failure (the build's last lines in its popover). */
export function useHubUpdateLine(): StatusPart | null {
  const home = useProjects().find((p) => p.home)?.project ?? '';
  const u = useHubUpdate(home);
  const line = hubUpdateLine(u);
  if (line === null || u === null) return null;
  return {
    rank: line.failed ? RANK.failed : RANK.running,
    testId: 'app.hubupdate',
    state: line.failed ? 'failed' : 'building',
    tone: line.failed ? 'err' : 'running',
    words: <ShaWords text={line.text} shas={[u.rev]} />,
    short: line.failed ? "▲ couldn't update" : 'updating…',
    ...(line.tail.length > 0
      ? {
          more: (
            <div className="app-core-last" data-testid="app.hubupdate.tail">
              {line.tail.join('\n')}
            </div>
          ),
        }
      : {}),
  };
}
