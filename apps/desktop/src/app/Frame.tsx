// The window's frame around the screens (designer's desktop-screens v6/v7,
// signed): the titlebar over the main column ('storefront › perf', the
// right panel's button '↗ artifacts · 5 ⌥⌘0'), the width classes (under
// 1000 px the sidebar is hidden and slides over the window with a 45%
// scrim, esc or a click outside closes it, and the titlebar shows the
// sidebar button (⌘\) and 'n waiting' in the accent), and which of the
// sidebar and the right panel show. Owner: amb-win.
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Chip, IconButton, Kbd, Pearl, PickerPop, Press } from "@/ds";
import { useModHeld } from "./held";
import { useProjects } from "@/store";
import { keep } from "./keep";
import { formatRoute, type Route } from "./route";
import { type Side, useRoute, useRouter } from "./router";
import { TitleStatus } from "./TitleStatus";
import {
  keptWidth,
  PANEL,
  panelWidthOf,
  SIDE,
  sideWidthOf,
  UNFOLD_PX,
} from "./resize";
import {
  crumbGoOf,
  crumbOf,
  NARROW_PX,
  PANEL_OPEN_PX,
  panelAt,
  panelProject,
} from "./side";
import { useWaitingTotal } from "./Sidebar";
import { usePanelColumn } from "@/bims/view";

export type Width = "narrow" | "mid" | "wide";

const widthOf = (w: number): Width =>
  w < NARROW_PX ? "narrow" : w < PANEL_OPEN_PX ? "mid" : "wide";

/** The window's width class: re-renders its reader only when it crosses 1000 or 1100 px. */
export function useWidth(): Width {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("resize", cb);
      return () => {
        window.removeEventListener("resize", cb);
      };
    },
    () => widthOf(window.innerWidth),
  );
}

const WIDE_PX: Record<Width, number> = {
  narrow: NARROW_PX - 1,
  mid: NARROW_PX,
  wide: PANEL_OPEN_PX,
};

/** A kept yes/no of the frame (no age: the sidebar hidden, the panel shown). */
function useKeptFlag(
  key: string,
): readonly [boolean | undefined, (v: boolean) => void] {
  const [v, set] = useState<boolean | undefined>(() => {
    const k = keep.view(key);
    return typeof k === "boolean" ? k : undefined;
  });
  return [
    v,
    (next: boolean) => {
      keep.setView(key, next);
      set(next);
    },
  ];
}

export interface FrameState {
  readonly width: Width;
  /** the sidebar in its column */
  readonly side: boolean;
  /** what slides over the window now (under 1000 px, or the sidebar hidden by ⌘\) */
  readonly over: "side" | "panel" | null;
  /** the panel's project and whether it shows docked */
  readonly panel:
    | {
        readonly project: string;
        readonly name: string;
        readonly docked: boolean;
      }
    | undefined;
  readonly toggle: (what: "sidebar" | "panel") => void;
  readonly close: () => void;
  /** the sidebar's and the panel's widths (kept), and what a drag on their border does */
  readonly sideW: number;
  readonly panelW: number;
  readonly resize: (what: "side" | "panel", want: number) => void;
  readonly reset: (what: "side" | "panel") => void;
}

/** A kept width of the frame, in its limits. */
function useKeptWidth(
  key: string,
  lo: number,
  hi: number,
  def: number,
): readonly [number, (v: number) => void] {
  const [v, set] = useState<number>(() =>
    keptWidth(keep.view(key), lo, hi, def),
  );
  return [
    v,
    (next: number) => {
      keep.setView(key, next);
      set(next);
    },
  ];
}

/** Which of the sidebar and the right panel show, from the width, his kept choices and the route. */
export function useFrame(): FrameState {
  const width = useWidth();
  const route = useRoute();
  const rows = useProjects();
  const home = rows.find((p) => p.home)?.project;
  const [hidden, setHidden] = useKeptFlag("frame.side.hidden");
  const [kept, setKept] = useKeptFlag("frame.panel");
  // what slid over, for the route and the width class it opened on: a move closes it (he picked a
  // row in it), and so does the window crossing 1000 or 1100 px (try-gate dc4770c1: slid over at
  // 800, then 1400, the docked bar came under it with the scrim still taking every click). Back
  // under 1000 it stays closed: the class it opened on is gone.
  const at_ = formatRoute(route);
  const [slid, setSlid] = useState<{
    what: "side" | "panel";
    at: string;
    width: Width;
  } | null>(null);
  const over =
    slid !== null && slid.at === at_ && slid.width === width ? slid.what : null;
  const setOver = (
    f: (o: "side" | "panel" | null) => "side" | "panel" | null,
  ) => {
    const next = f(over);
    setSlid(next === null ? null : { what: next, at: at_, width });
  };
  const side = width !== "narrow" && hidden !== true;
  const project = panelProject(route, home, rows.filter((p) => !p.home).length);
  const row = rows.find((p) => p.project === project);
  const at = panelAt(WIDE_PX[width], kept);
  const [sideW, setSideW] = useKeptWidth(
    "frame.side.w",
    SIDE.min,
    SIDE.max,
    SIDE.def,
  );
  const [panelW, setPanelW] = useKeptWidth(
    "frame.panel.w",
    PANEL.min,
    4000,
    PANEL.def,
  );
  // the office wide: the column is 640 when the window has room for it (bims/view.ts)
  const column = usePanelColumn(panelW, side ? sideW : 0, project);
  const panel =
    project === undefined
      ? undefined
      : {
          project,
          name: project === "" ? "all projects" : (row?.name ?? project),
          docked: at.docked && at.open,
        };
  return {
    width,
    side,
    over,
    panel,
    toggle: (what) => {
      if (what === "sidebar") {
        if (width === "narrow") setOver((o) => (o === "side" ? null : "side"));
        else setHidden(side);
        return;
      }
      if (project === undefined) return;
      if (at.docked) setKept(!at.open);
      else setOver((o) => (o === "panel" ? null : "panel"));
    },
    close: () => {
      setSlid(null);
    },
    sideW,
    panelW: column,
    resize: (what, want) => {
      const win = window.innerWidth;
      const shownPanel =
        at.docked && at.open && project !== undefined ? column : 0;
      if (what === "side") {
        // folded (⌘\ or a drag under 160): a drag out of the fold opens it at 200
        if (!side) {
          if (want >= UNFOLD_PX) {
            setSideW(Math.max(sideW, SIDE.reopen));
            setHidden(false);
          }
          return;
        }
        const w = sideWidthOf(want, win, shownPanel);
        if (w === "fold") setHidden(true);
        else if (w !== sideW) setSideW(w);
        return;
      }
      const w = panelWidthOf(want, win, side ? sideW : 0);
      if (w !== panelW) setPanelW(w);
    },
    reset: (what) => {
      if (what === "side") setSideW(SIDE.def);
      else setPanelW(PANEL.def);
    },
  };
}

/** What slides over the window: its content on one side, a 45% scrim over the rest; esc or a click outside closes it. */
export function Over({
  side,
  onClose,
  children,
  thread = false,
}: {
  side: "left" | "right";
  onClose: () => void;
  children: ReactNode;
  /** an artifact's maker thread sliding over the page under 1000 px (78% of the width) */
  thread?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);
  return (
    <>
      <div className={`app-scrim ${side}`} onClick={onClose} data-testid="app.scrim" />
      <div className={`app-over ${side}${thread ? " thread" : ""}`} data-testid={`app.over.${side}`}>
        {children}
      </div>
    </>
  );
}

/** How many places the ‹ › menu lists (designer's desktop-history: 10, the nearest at the top). */
const MENU_PLACES = 10;
/** A press this long on ‹ or › opens its menu, as a right-click (Safari's). */
const LONG_PRESS_MS = 500;

/**
 * ‹ › right after the lights (designer's desktop-history; amb-web, m_19808): 28 px, 4 px apart.
 * Nothing on a side: that arrow stays, faint at 45%, no hover, no tooltip, so the crumb never
 * moves. A right-click or a long press opens the last 10 places on that side (the ds menu).
 */
function HistoryArrows({ name }: { name: (p: string) => string }) {
  const router = useRouter();
  useRoute();
  const [menu, setMenu] = useState<Side | null>(null);
  // ⌘ held: ⌘[ ⌘] under the arrows that can go (held.ts, designer m_21510)
  const cmd = useModHeld("Meta");
  const press = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const long = useRef(false);
  const backAt = useRef<HTMLSpanElement>(null);
  const forwardAt = useRef<HTMLSpanElement>(null);
  const closeMenu = useCallback(() => {
    setMenu(null);
  }, []);
  const arrow = (side: Side) => {
    const can = side === "back" ? router.canBack() : router.canForward();
    const label = side === "back" ? "back" : "forward";
    const open = () => {
      if (can) setMenu(side);
    };
    return (
      <span
        ref={side === "back" ? backAt : forwardAt}
        className="app-hist-arrow"
        // a mouse press never takes focus (designer m_19953): the ring is for the keyboard, and a
        // later key (the menu's esc) would light it on the pressed arrow; Tab still reaches them
        onMouseDown={(e) => {
          e.preventDefault();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          open();
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          long.current = false;
          clearTimeout(press.current);
          press.current = setTimeout(() => {
            long.current = true;
            open();
          }, LONG_PRESS_MS);
        }}
        onPointerUp={() => {
          clearTimeout(press.current);
        }}
        onPointerLeave={() => {
          clearTimeout(press.current);
        }}
      >
        <IconButton
          label={label}
          keys={can ? (side === "back" ? "⌘[" : "⌘]") : ""}
          state={can ? undefined : "disabled"}
          onClick={() => {
            if (long.current) return;
            if (side === "back") router.back();
            else router.forward();
          }}
          testId={`app.title.${label}`}
        >
          {side === "back" ? "‹" : "›"}
        </IconButton>
        {cmd && can && (
          <span className="app-keyhint float" data-testid={`app.title.${label}.hint`}>
            <Kbd>{side === "back" ? "⌘[" : "⌘]"}</Kbd>
          </span>
        )}
        {menu === side && (
          <PickerPop
            anchor={side === "back" ? backAt : forwardAt}
            align="start"
            groups={[
              {
                id: "places",
                rows: router.places(side, MENU_PLACES).map((r, i) => ({
                  id: String(i + 1),
                  name: crumbOf(r, name).join(" › "),
                  testId: `app.title.${label}.place`,
                })),
              },
            ]}
            onPick={(id) => {
              setMenu(null);
              router.jump(side, Number(id));
            }}
            onClose={closeMenu}
            testId={`app.title.${label}.menu`}
          />
        )}
      </span>
    );
  };
  return (
    <span className="app-hist" data-testid="app.title.history">
      {arrow("back")}
      {arrow("forward")}
    </span>
  );
}

/** under this much room the status pill takes its short form (designer's desktop-notices v2) */
export const STATUS_NARROW_PX = 160;

/**
 * The title bar's status slot (designer's desktop-notices v2, ambient-lead m_21070): the free room
 * between the crumb's end (+16) and the right bar's toggle (8 before it), its content right-aligned;
 * the crumb never cuts for it. It marks data-narrow when that room is under 160 px, so the pill
 * (amb-home's TitleStatus) shows its short form. The slot drags like the bar; only what it holds is
 * a no-drag region (app.css).
 */
function StatusSlot({ children }: { children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (el === null) return;
    const read = () => {
      setNarrow(el.clientWidth < STATUS_NARROW_PX);
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, []);
  return (
    <div ref={ref} className="app-title-status" data-narrow={narrow} data-testid="app.title.status">
      {children}
    </div>
  );
}

/** The titlebar over the main column: the sidebar button and what waits when the sidebar is away, the crumb, the panel's button. */
export function Titlebar({ frame }: { frame: FrameState }) {
  const route = useRoute();
  const router = useRouter();
  const rows = useProjects();
  const waits = useWaitingTotal();
  // what waits on him in the right bar's place: one project's, or every project's on bise's thread
  const placeWaits =
    frame.panel === undefined ? 0 : frame.panel.project === "" ? waits : (rows.find((r) => r.project === frame.panel?.project)?.waits ?? 0);
  const name = (p: string) => rows.find((r) => r.project === p)?.name ?? p;
  const crumb = crumbOf(route, name);
  // an earlier crumb's route, by its place (the last: where he is, no route) — crumbGoOf, pure
  const go = crumbGoOf(route, name).map((s) => s.go);
  const panelOn =
    frame.panel !== undefined && (frame.panel.docked || frame.over === "panel");
  return (
    <div
      className={frame.side ? "app-title" : "app-title away"}
      data-testid="app.title"
    >
      {!frame.side && (
        <>
          <span className="app-title-lights" />
          <IconButton
            label="sidebar"
            keys="⌘\\"
            size="bar"
            pressed={frame.over === "side"}
            onClick={() => {
              frame.toggle("sidebar");
            }}
            testId="app.title.sidebar"
          >
            <span className="app-tg-glyph" aria-hidden="true">
              <span />
            </span>
          </IconButton>
          {waits > 0 && (
            <Chip
              tone="acc"
              onClick={() => {
                frame.toggle("sidebar");
              }}
              testId="app.title.waiting"
            >
              <Pearl size={14} mood="need" />
              {waits} waiting
            </Chip>
          )}
        </>
      )}
      <HistoryArrows name={name} />
      <span className="app-crumb" data-testid="app.title.crumb">
        {crumb.map((c, i) => (
          <span
            key={`${String(i)} ${c}`}
            className={i === crumb.length - 1 ? "last" : undefined}
          >
            {i > 0 && <span className="app-crumb-sep">›</span>}
            {go[i] === undefined ? (
              c
            ) : (
              // an earlier crumb goes where it names (his ask): the project's main, that agent,
              // that screen; the last one is where he is, plain
              <Press
                look="app-crumb-go"
                onClick={() => {
                  router.go(go[i] as Route);
                }}
                data-testid={`app.title.crumb.${String(i)}`}
              >
                {c}
              </Press>
            )}
          </span>
        ))}
      </span>
      <StatusSlot>
        <TitleStatus />
      </StatusSlot>
      {/* the right bar's toggle (designer m_20274/m_20275): the left toggle's panel icon mirrored,
          pressed while the bar is open; the accent count of what waits on him in its place, none at 0 */}
      {frame.panel !== undefined && (
        <span className="app-rtg">
          <IconButton
            label="right bar"
            keys="⌥⌘0"
            size="bar"
            pressed={panelOn}
            onClick={() => {
              frame.toggle("panel");
            }}
            testId="app.title.panel"
          >
            <span className="app-tg-glyph right" aria-hidden="true">
              <span />
            </span>
          </IconButton>
          {placeWaits > 0 && (
            <span className="app-rtg-n" data-testid="app.title.panel.waits">
              {placeWaits}
            </span>
          )}
        </span>
      )}
    </div>
  );
}
