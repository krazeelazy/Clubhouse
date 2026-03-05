import { describe, it, expect, beforeEach, vi } from 'vitest';
import { attachNewlineHandler, BRACKETED_NEWLINE, QUOTED_NEWLINE } from './newline-handler';

/** Minimal mock Terminal that captures the key handler. */
function createMockTerminal(opts?: { bracketedPasteMode?: boolean }) {
  let keyHandler: ((e: KeyboardEvent) => boolean) | null = null;

  return {
    modes: { bracketedPasteMode: opts?.bracketedPasteMode ?? false },
    attachCustomKeyEventHandler: vi.fn((handler: (e: KeyboardEvent) => boolean) => {
      keyHandler = handler;
    }),
    _fireKey(e: Partial<KeyboardEvent>): boolean {
      if (!keyHandler) throw new Error('No key handler attached');
      return keyHandler({
        type: 'keydown',
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        altKey: false,
        key: '',
        ...e,
      } as KeyboardEvent);
    },
  };
}

describe('newline-handler', () => {
  let writeToPty: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeToPty = vi.fn();
  });

  describe('with bracketed paste mode (modern shells)', () => {
    it('sends bracketed newline for Shift+Enter', () => {
      const term = createMockTerminal({ bracketedPasteMode: true });
      attachNewlineHandler(term as any, writeToPty);

      const consumed = term._fireKey({ key: 'Enter', shiftKey: true });

      expect(consumed).toBe(false);
      expect(writeToPty).toHaveBeenCalledWith(BRACKETED_NEWLINE);
    });

    it('sends bracketed newline for Ctrl+Enter', () => {
      const term = createMockTerminal({ bracketedPasteMode: true });
      attachNewlineHandler(term as any, writeToPty);

      const consumed = term._fireKey({ key: 'Enter', ctrlKey: true });

      expect(consumed).toBe(false);
      expect(writeToPty).toHaveBeenCalledWith(BRACKETED_NEWLINE);
    });
  });

  describe('without bracketed paste mode (fallback)', () => {
    it('sends quoted-insert newline for Shift+Enter', () => {
      const term = createMockTerminal({ bracketedPasteMode: false });
      attachNewlineHandler(term as any, writeToPty);

      const consumed = term._fireKey({ key: 'Enter', shiftKey: true });

      expect(consumed).toBe(false);
      expect(writeToPty).toHaveBeenCalledWith(QUOTED_NEWLINE);
    });
  });

  describe('passthrough', () => {
    it('lets plain Enter pass through', () => {
      const term = createMockTerminal({ bracketedPasteMode: true });
      attachNewlineHandler(term as any, writeToPty);

      const consumed = term._fireKey({ key: 'Enter' });

      expect(consumed).toBe(true);
      expect(writeToPty).not.toHaveBeenCalled();
    });

    it('lets unrelated keys pass through', () => {
      const term = createMockTerminal({ bracketedPasteMode: true });
      attachNewlineHandler(term as any, writeToPty);

      expect(term._fireKey({ key: 'a' })).toBe(true);
      expect(term._fireKey({ key: 'Escape' })).toBe(true);
      expect(term._fireKey({ ctrlKey: true, key: 'c' })).toBe(true);
      expect(writeToPty).not.toHaveBeenCalled();
    });

    it('ignores keyup events', () => {
      const term = createMockTerminal({ bracketedPasteMode: true });
      attachNewlineHandler(term as any, writeToPty);

      const consumed = term._fireKey({ type: 'keyup' as any, key: 'Enter', shiftKey: true });

      expect(consumed).toBe(true);
      expect(writeToPty).not.toHaveBeenCalled();
    });
  });

  describe('constants', () => {
    it('BRACKETED_NEWLINE wraps newline in paste sequences', () => {
      expect(BRACKETED_NEWLINE).toBe('\x1b[200~\n\x1b[201~');
    });

    it('QUOTED_NEWLINE is Ctrl-V + LF', () => {
      expect(QUOTED_NEWLINE).toBe('\x16\n');
    });
  });
});
