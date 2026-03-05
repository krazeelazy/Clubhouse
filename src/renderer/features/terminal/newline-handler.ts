import type { Terminal } from '@xterm/xterm';

/**
 * Bracketed paste sequence containing a single newline.
 * When the shell has bracketed paste mode enabled (the default in modern
 * bash 4.4+, zsh 5.1+, fish, and PowerShell PSReadLine 2.1+), the shell
 * inserts the newline literally instead of executing the current line.
 */
export const BRACKETED_NEWLINE = '\x1b[200~\n\x1b[201~';

/**
 * Fallback for shells without bracketed paste mode.
 * \x16 = Ctrl-V (quoted-insert in readline / zle), \n = literal newline.
 * Does NOT work in PowerShell (PSReadLine binds Ctrl-V to paste).
 */
export const QUOTED_NEWLINE = '\x16\n';

/**
 * Attach a custom key handler that converts Shift+Enter (and Ctrl+Enter)
 * into a literal newline insertion instead of executing the current line.
 *
 * Uses bracketed paste when the shell supports it (works cross-platform
 * including PowerShell). Falls back to quoted-insert for older shells.
 */
export function attachNewlineHandler(
  term: Terminal,
  writeToPty: (data: string) => void
): void {
  term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
    if (e.type !== 'keydown') return true;

    if (e.key === 'Enter' && (e.shiftKey || e.ctrlKey)) {
      const seq = term.modes.bracketedPasteMode
        ? BRACKETED_NEWLINE
        : QUOTED_NEWLINE;
      writeToPty(seq);
      return false;
    }

    return true;
  });
}
