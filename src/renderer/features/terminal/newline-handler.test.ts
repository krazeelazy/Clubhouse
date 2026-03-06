import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { attachNewlineHandler, BRACKETED_NEWLINE, QUOTED_NEWLINE, WIN32_SHIFT_ENTER } from './newline-handler';

function createMockTerminal(opts?: { bracketedPasteMode?: boolean }) {
  return {
    modes: { bracketedPasteMode: opts?.bracketedPasteMode ?? false },
  };
}

function createMockContainer() {
  const listeners: Map<string, { handler: EventListener; capture: boolean }[]> = new Map();
  return {
    addEventListener: vi.fn((type: string, handler: EventListener, capture?: boolean) => {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type)!.push({ handler, capture: !!capture });
    }),
    removeEventListener: vi.fn(),
    _dispatch(e: Partial<KeyboardEvent>) {
      const event = {
        type: 'keydown',
        key: '',
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        ...e,
      } as unknown as KeyboardEvent;
      for (const entry of listeners.get('keydown') ?? []) {
        entry.handler(event);
      }
      return event;
    },
  };
}

describe('newline-handler', () => {
  let writeToPty: ReturnType<typeof vi.fn>;
  let originalPlatform: string | undefined;

  beforeEach(() => {
    writeToPty = vi.fn();
    originalPlatform = (window as any).clubhouse?.platform;
  });

  afterEach(() => {
    if (originalPlatform !== undefined) {
      (window as any).clubhouse.platform = originalPlatform;
    }
  });

  function setPlatform(platform: string) {
    if (!(window as any).clubhouse) (window as any).clubhouse = {};
    (window as any).clubhouse.platform = platform;
  }

  describe('Windows (win32-input-mode)', () => {
    it('sends win32 Shift+Enter sequence on Windows', () => {
      setPlatform('win32');
      const term = createMockTerminal();
      const container = createMockContainer();
      attachNewlineHandler(term as any, container as any, writeToPty);

      container._dispatch({ key: 'Enter', shiftKey: true });

      expect(writeToPty).toHaveBeenCalledWith(WIN32_SHIFT_ENTER);
    });

    it('sends win32 Shift+Enter for Ctrl+Enter on Windows', () => {
      setPlatform('win32');
      const term = createMockTerminal();
      const container = createMockContainer();
      attachNewlineHandler(term as any, container as any, writeToPty);

      container._dispatch({ key: 'Enter', ctrlKey: true });

      expect(writeToPty).toHaveBeenCalledWith(WIN32_SHIFT_ENTER);
    });
  });

  describe('macOS/Linux with bracketed paste mode', () => {
    it('sends bracketed newline for Shift+Enter', () => {
      setPlatform('darwin');
      const term = createMockTerminal({ bracketedPasteMode: true });
      const container = createMockContainer();
      attachNewlineHandler(term as any, container as any, writeToPty);

      container._dispatch({ key: 'Enter', shiftKey: true });

      expect(writeToPty).toHaveBeenCalledWith(BRACKETED_NEWLINE);
    });
  });

  describe('macOS/Linux without bracketed paste mode (fallback)', () => {
    it('sends quoted-insert newline for Shift+Enter', () => {
      setPlatform('darwin');
      const term = createMockTerminal({ bracketedPasteMode: false });
      const container = createMockContainer();
      attachNewlineHandler(term as any, container as any, writeToPty);

      container._dispatch({ key: 'Enter', shiftKey: true });

      expect(writeToPty).toHaveBeenCalledWith(QUOTED_NEWLINE);
    });
  });

  describe('passthrough', () => {
    it('does not intercept plain Enter', () => {
      setPlatform('win32');
      const term = createMockTerminal();
      const container = createMockContainer();
      attachNewlineHandler(term as any, container as any, writeToPty);

      const event = container._dispatch({ key: 'Enter' });

      expect(writeToPty).not.toHaveBeenCalled();
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('does not intercept unrelated keys', () => {
      const term = createMockTerminal();
      const container = createMockContainer();
      attachNewlineHandler(term as any, container as any, writeToPty);

      container._dispatch({ key: 'a' });
      container._dispatch({ key: 'Escape' });

      expect(writeToPty).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('returns a cleanup function that removes the listener', () => {
      const term = createMockTerminal();
      const container = createMockContainer();
      const cleanup = attachNewlineHandler(term as any, container as any, writeToPty);

      expect(container.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function), true);

      cleanup();
      expect(container.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function), true);
    });
  });

  describe('constants', () => {
    it('BRACKETED_NEWLINE wraps newline in paste sequences', () => {
      expect(BRACKETED_NEWLINE).toBe('\x1b[200~\n\x1b[201~');
    });

    it('QUOTED_NEWLINE is Ctrl-V + LF', () => {
      expect(QUOTED_NEWLINE).toBe('\x16\n');
    });

    it('WIN32_SHIFT_ENTER is a valid win32-input-mode sequence', () => {
      expect(WIN32_SHIFT_ENTER).toBe('\x1b[13;28;13;1;16;1_');
    });
  });
});
