import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flashTitle, type TitleDocument } from "./titleFlash";

/** A tab: its title, whether it is hidden, and its visibilitychange listeners. */
function fakeTab(hidden: boolean) {
  const listeners = new Set<() => void>();
  const tab = {
    title: "CodeClash",
    hidden,
    addEventListener: (_event: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_event: string, fn: () => void) => listeners.delete(fn),
    show() {
      tab.hidden = false;
      listeners.forEach((fn) => fn());
    },
    listeners,
  };
  return tab;
}

const asDocument = (tab: ReturnType<typeof fakeTab>) => tab as unknown as TitleDocument;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("flashTitle", () => {
  it("leaves a visible tab alone", () => {
    const tab = fakeTab(false);
    const stop = flashTitle("Match found!", { doc: asDocument(tab) });

    vi.advanceTimersByTime(5_000);
    stop();

    expect(tab.title).toBe("CodeClash");
    expect(tab.listeners.size).toBe(0);
  });

  it("alternates the message with the page title every second", () => {
    const tab = fakeTab(true);
    flashTitle("Match found!", { doc: asDocument(tab) });

    expect(tab.title).toBe("Match found!");
    vi.advanceTimersByTime(1_000);
    expect(tab.title).toBe("CodeClash");
    vi.advanceTimersByTime(1_000);
    expect(tab.title).toBe("Match found!");
  });

  it("stops and restores the title when the player comes back", () => {
    const tab = fakeTab(true);
    flashTitle("Match found!", { doc: asDocument(tab) });

    tab.show();
    vi.advanceTimersByTime(5_000);

    expect(tab.title).toBe("CodeClash");
    expect(tab.listeners.size).toBe(0);
  });

  it("stops once the ready check is over", () => {
    const tab = fakeTab(true);
    flashTitle("Match found!", { doc: asDocument(tab), until: Date.now() + 2_500 });

    vi.advanceTimersByTime(3_000);
    const settled = tab.title;
    vi.advanceTimersByTime(5_000);

    expect(settled).toBe("CodeClash");
    expect(tab.title).toBe("CodeClash");
  });

  it("stops when told to, and only once", () => {
    const tab = fakeTab(true);
    const stop = flashTitle("Match found!", { doc: asDocument(tab) });

    stop();
    stop();
    vi.advanceTimersByTime(5_000);

    expect(tab.title).toBe("CodeClash");
    expect(tab.listeners.size).toBe(0);
  });

  it("restores the title a navigation set meanwhile", () => {
    const tab = fakeTab(true);
    const stop = flashTitle("Match found!", { doc: asDocument(tab) });

    // The page changed its title while the message was showing.
    tab.title = "Battle - CodeClash";
    vi.advanceTimersByTime(1_000);
    expect(tab.title).toBe("Match found!");
    stop();

    expect(tab.title).toBe("Battle - CodeClash");
  });
});
