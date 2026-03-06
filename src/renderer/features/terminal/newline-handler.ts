import type { Terminal } from '@xterm/xterm';

/**
 * Bracketed paste sequence containing a single newline.
 * Works in bash 4.4+, zsh 5.1+, fish, and PSReadLine 2.1+ when
 * the shell has enabled bracketed paste mode.
 */
export const BRACKETED_NEWLINE = '\x1b[200~\n\x1b[201~';

/**
 * Fallback for shells without bracketed paste mode.
 * \x16 = Ctrl-V (quoted-insert in readline / zle), \n = literal newline.
 * Does NOT work in PowerShell (PSReadLine binds Ctrl-V to paste).
 */
export const QUOTED_NEWLINE = '\x16\n';

/**
 * Win32-input-mode sequence for Shift+Enter.
 * Format: ESC [ Vk ; Sc ; Uc ; Kd ; Cs ; Rc _
 * VK_RETURN=13, ScanCode=28, Char=13, KeyDown=1, SHIFT_PRESSED=0x10, Repeat=1
 *
 * Modern PSReadLine (2.1+) enables win32-input-mode in ConPTY. When active,
 * ConPTY parses these sequences and creates INPUT_RECORDs with full modifier
 * information, so PSReadLine sees Shift+Enter and invokes AddLine.
 *
 * NOTE: This requires ConPTY win32-input-mode support, which may not be
 * available in all configurations (e.g. older Windows builds or when the
 * terminal emulator hasn't negotiated win32-input-mode). See
 * docs/shift-enter-terminal-limitations.md for details.
 */
export const WIN32_SHIFT_ENTER = '\x1b[13;28;13;1;16;1_';

/**
 * Attach a DOM-level key handler to the terminal container that converts
 * Shift+Enter (and Ctrl+Enter) into a literal newline insertion instead
 * of executing the current line.
 *
 * Uses a capture-phase listener to intercept the key event before xterm.js
 * processes it. On macOS/Linux, sends bracketed paste or quoted-insert
 * sequences. On Windows, sends a win32-input-mode Shift+Enter sequence.
 *
 * Returns a cleanup function that removes the listener.
 */
export function attachNewlineHandler(
  term: Terminal,
  container: HTMLElement,
  writeToPty: (data: string) => void
): () => void {
  const handler = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && (e.shiftKey || e.ctrlKey)) {
      e.preventDefault();
      e.stopPropagation();

      const isWindows = window.clubhouse.platform === 'win32';

      if (isWindows) {
        writeToPty(WIN32_SHIFT_ENTER);
      } else if (term.modes.bracketedPasteMode) {
        writeToPty(BRACKETED_NEWLINE);
      } else {
        writeToPty(QUOTED_NEWLINE);
      }
    }
  };

  container.addEventListener('keydown', handler, true);
  return () => container.removeEventListener('keydown', handler, true);
}
