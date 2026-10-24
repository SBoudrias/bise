// The macOS About panel (bise › About bise): what it says, in one place. The
// stock { role: 'about' } (menu.ts) opens Electron's default panel, whose name
// and version come from package.json ('bise-desktop', '0.0.0') — neither his
// app's name (appname.ts: the bundle's, 'bise' or a try's) nor its build (the
// bundle's Contents/Resources VERSION, the same one the updater and the
// settings' update row say: update/run.ts info().version, never package.json,
// which a release pack does not touch). app.setAboutPanelOptions (index.ts
// installs it) overrides the name and the version; what it leaves out falls
// back to the default panel, so a dev run (no VERSION) shows only the name.
// Pure.
import type { AboutPanelOptionsOptions } from 'electron';
import { shortVersion } from '../shared/version';

/** The About panel's options: the name everywhere, the version on a packed app. */
export function aboutPanel(name: string, version: string | null): AboutPanelOptionsOptions {
  return { applicationName: name, ...(version !== null ? { applicationVersion: shortVersion(version) } : {}) };
}
