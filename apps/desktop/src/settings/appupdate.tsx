// Settings › general's 'update' group for a distributed app (desktop-dist v7; designer m_25362's
// words): the app from the DMG updates itself (main's src/main/update/run.ts) at quit, at a quiet
// moment or on 'restart to update'. Its states: up to date, getting <new>, ready, updates off here
// (a disk image, not in Applications: no ▲, not a failure; the reason is the row's sub and
// 'move to Applications' its act when moving fixes it, main's update/move.ts; a move that didn't
// happen: ▲ and why, designer m_26934), update failed (grey: nothing broke, nothing waits on him), went_bad (▲ and 'go back'); then the 'beta builds' toggle (his pref
// desktop_channel) and, for 7 days after a quiet install, 'updated to <version> · <when>'. His try
// app keeps app-swap v2's group (update.tsx) instead. distRow is the pure part. Owner: dist-updater.
import type { ReactNode } from 'react';
import type { UpdateInfo, UpdateState } from '@/shared/api';
import { Act, Button, Group, Toggle, type GroupItem } from '@/ds';
import { tipAttrs } from '@/ds/tip';
import { whenWords } from '@/artifacts/model';
import { updatedTip } from '@/app/tipwords';
import { shortVersion } from '@/shared/version';
import { settings } from '@/proto/words.gen';

/** Where a test build gets its first Developer ID one (designer m_25699). */
export const DOWNLOAD_URL = 'https://bise.dev/download';

/** The row's words: its label, the grey word beside it, the line under the group, its one act. Pure. */
export interface DistRow {
  readonly kind: 'current' | 'getting' | 'ready' | 'off' | 'failed' | 'went_bad';
  readonly label: string;
  readonly sub?: string;
  /** the sub starts with a red ▲ (a move that didn't happen, designer m_26934) */
  readonly err?: true;
  readonly help?: string;
  /** the help's words that are a link to DOWNLOAD_URL */
  readonly link?: string;
  readonly act?: 'restart' | 'back' | 'move';
}

/** The row for `s` on this app (`version`: its own), or null (no updater in this app). Pure. */
export function distRow(s: UpdateState, version: string | null): DistRow | null {
  if (version === null) return null;
  const mine = shortVersion(version);
  const me = settings.dist_me({ version: mine });
  switch (s.state) {
    case 'none':
      if (s.cant === undefined) return { kind: 'current', label: me, sub: settings.dist_current };
      // the reason is the row's sub, beside its act (designer m_26934)
      if (s.move === 'failed') return { kind: 'off', label: settings.dist_off, sub: settings.dist_move_failed, err: true, act: 'move' };
      return {
        kind: 'off',
        label: settings.dist_off,
        sub: s.cant === 'disk_image' ? settings.dist_disk_image : settings.dist_not_applications,
        ...(s.move === 'can' ? { act: 'move' as const } : {}),
      };
    case 'downloading':
      return { kind: 'getting', label: me, sub: settings.dist_getting({ version: shortVersion(s.version) }) };
    case 'ready':
      return { kind: 'ready', label: settings.dist_ready({ version: shortVersion(s.version) }), help: settings.dist_ready_help, act: 'restart' };
    case 'failed': {
      const next = shortVersion(s.version);
      const failed = { kind: 'failed', label: me, sub: settings.dist_failed } as const;
      switch (s.reason) {
        case 'new_signer':
          return { ...failed, help: settings.dist_new_signer, link: settings.dist_download_link };
        case 'swap':
          return { ...failed, help: settings.dist_swap({ version: next }) };
        case 'signature':
          return { ...failed, help: settings.dist_signature({ version: next, mine }) };
        case 'download':
        case undefined:
          return { ...failed, help: settings.dist_download({ version: next }) };
      }
    }
    // falls through: every reason returned above
    case 'went_bad':
      return { kind: 'went_bad', label: settings.dist_went_bad, act: 'back' };
  }
}

/** The trace line after a quiet install (7 days, main's readTrace), else null. Pure. */
export function traceLine(info: UpdateInfo, now: number): string | null {
  return info.updated === null ? null : settings.dist_updated({ version: shortVersion(info.updated.version), when: whenWords(info.updated.at, now) });
}

export interface DistPorts {
  /** 'restart to update' (window.bise.update.install, back on this page) */
  readonly install: () => void;
  /** 'go back' (window.bise.update.revert) */
  readonly revert: () => void;
  /** 'move to Applications' (window.bise.update.move: the app moves there and opens again) */
  readonly move: () => void;
  /** a link in his browser (bise.dev/download) */
  readonly open: (url: string) => void;
}

/** The group, or nothing (an app with no updater: a dev run). */
export function DistUpdateGroup({
  state,
  info,
  beta,
  setBeta,
  ports,
  now,
}: {
  state: UpdateState;
  info: UpdateInfo;
  beta: boolean;
  setBeta: (on: boolean) => void;
  ports: DistPorts | undefined;
  /** when the info was read (the trace's time words) */
  now: number;
}) {
  const row = distRow(state, info.version);
  if (row === null) return null;
  const label: ReactNode =
    row.kind === 'went_bad' ? (
      <>
        <span className="settings-update-err">▲</span> {row.label}
      </>
    ) : (
      row.label
    );
  const control: ReactNode =
    row.act === 'restart' ? (
      <Button kind="pri" onClick={() => ports?.install()} testId="settings.dist.restart">
        {settings.update_restart}
      </Button>
    ) : row.act === 'back' ? (
      <Button onClick={() => ports?.revert()} testId="settings.dist.back">
        {settings.dist_back}
      </Button>
    ) : row.act === 'move' ? (
      <Button onClick={() => ports?.move()} testId="settings.dist.move">
        {settings.dist_move}
      </Button>
    ) : undefined;
  const trace = row.kind === 'current' ? traceLine(info, now) : null;
  const items: GroupItem[] = [
    {
      id: 'row',
      label: (
        <span className="settings-update-t" data-testid="settings.dist.label" data-kind={row.kind}>
          {label}
        </span>
      ),
      ...(row.sub !== undefined
        ? {
            sub:
              row.err === true ? (
                <span data-testid="settings.dist.sub">
                  <span className="settings-update-err">▲</span> {row.sub}
                </span>
              ) : (
                <span data-testid="settings.dist.sub">{row.sub}</span>
              ),
          }
        : {}),
      ...(control !== undefined ? { control } : {}),
    },
    {
      id: 'beta',
      label: settings.dist_beta,
      sub: settings.dist_beta_sub,
      control: <Toggle on={beta} label={settings.dist_beta} onChange={setBeta} testId="settings.pref.desktop_channel" />,
    },
  ];
  const help = row.help ?? trace;
  return (
    <div className="settings-update" data-state={row.kind}>
      <Group
        title={settings.update_title}
        testId="settings.dist"
        items={items}
        help={
          help !== null ? (
            <span className="settings-update-why" data-testid="settings.dist.why" {...(help === trace ? tipAttrs(updatedTip()) : {})}>
              {row.link !== undefined && help.includes(row.link) ? (
                <>
                  {help.slice(0, help.indexOf(row.link))}
                  <Act onClick={() => ports?.open(DOWNLOAD_URL)} testId="settings.dist.download">
                    {row.link}
                  </Act>
                  {help.slice(help.indexOf(row.link) + row.link.length)}
                </>
              ) : (
                help
              )}
            </span>
          ) : undefined
        }
      />
    </div>
  );
}
