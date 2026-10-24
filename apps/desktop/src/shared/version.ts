// A release's name as he reads it: the version, not the tag ('desktop-v2026.10.2'
// → '2026.10.2', designer m_25699). Shared by the window's update line, the
// settings' update row and the About panel (main's about.ts), so the three
// can't drift. Pure.
/** 'desktop-v2026.10.2' → '2026.10.2'; a name with no v prefix stays itself. */
export function shortVersion(v: string): string {
  return v.replace(/^desktop-v/, '').replace(/^v(?=\d)/, '');
}
