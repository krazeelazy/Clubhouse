# Shift+Enter Terminal Limitations on Windows

## Summary

Shift+Enter (and Ctrl+Enter) newline insertion in the terminal works on
macOS/Linux but has a known limitation on Windows due to the VT terminal
protocol's inability to transmit modifier keys with Enter.

## How It Works (macOS/Linux)

When Shift+Enter or Ctrl+Enter is pressed, a DOM-level capture listener
intercepts the event before xterm.js processes it. It then writes a
**bracketed paste** sequence (`\x1b[200~\n\x1b[201~`) to the PTY when the
shell has enabled bracketed paste mode, or falls back to **quoted-insert**
(`\x16\n`) for older shells. Both approaches cause the shell (bash, zsh,
fish) to insert a literal newline without executing the current line.

## Windows Limitation

### Root Cause

The VT terminal protocol cannot transmit keyboard modifier information
(Shift, Ctrl) with the Enter key. When Enter is pressed in a VT terminal,
the terminal sends `\r` (0x0D) — there is no mechanism to attach "Shift was
held."

PSReadLine maps Shift+Enter → `AddLine` (insert newline), but this binding
only works when the terminal transmits the Shift modifier. In the
traditional Windows Console Host (conhost.exe), `INPUT_RECORD` structures
carry full modifier state. In a ConPTY/xterm.js setup, this information is
lost.

### Current Behavior

On Windows, the handler sends a **win32-input-mode** sequence
(`\x1b[13;28;13;1;16;1_`) which encodes a Shift+Enter key event. This
requires ConPTY to have win32-input-mode support on its input parser, which
depends on the Windows version and ConPTY configuration.

### How Windows Terminal Solves This

Windows Terminal implements full win32-input-mode:

1. PSReadLine sends `\x1b[?9001h` to enable win32-input-mode
2. Windows Terminal detects this and encodes **all** key events as
   `\x1b[Vk;Sc;Uc;Kd;Cs;Rc_`
3. ConPTY parses these into proper `INPUT_RECORD`s with modifier flags
4. PSReadLine sees Shift+Enter and invokes `AddLine`

### Recommended Fix

Implement win32-input-mode support in the terminal emulator:

1. Detect `\x1b[?9001h` in PTY output stream
2. Set a per-terminal `win32InputMode` flag
3. When the flag is set, convert keyboard events to win32-input-mode format
4. This enables full modifier support for all keys, not just Enter

### Additional Notes

- The default shell on Windows (`COMSPEC`) is usually `cmd.exe`, which has
  no multiline editing. Only PowerShell with PSReadLine supports `AddLine`.
- The agent chat input (ActionBar) uses a `<textarea>` where Shift+Enter
  and Ctrl+Enter work natively via browser behavior.
