import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IntroAutoStartSwitch } from "./IntroAutoStartSwitch";
import { IntroHelpButton } from "./IntroHelpButton";
import { IntroProvider } from "./IntroProvider";
import type { IntroProviderProps } from "./IntroProvider";
import { readIntroState, writeIntroState } from "./storage";
import type { IntroEvent } from "./types";
import { useIntro } from "./useIntro";

const makeDoc = (over: Record<string, unknown> = {}) => ({
  schema: 1,
  route: "/",
  revision: 1,
  steps: [
    { id: "a", title: "First", body: "Body A" },
    { id: "b", title: "Second", body: "Body B" },
  ],
  ...over,
});

function Probe() {
  const intro = useIntro();
  return (
    <div>
      <span data-testid="has">{String(intro.hasIntro)}</span>
      <span data-testid="running">{String(intro.isRunning)}</span>
      <span data-testid="count">{intro.doc?.steps.length ?? 0}</span>
      <span data-testid="auto">{String(intro.autoStartEnabled)}</span>
      <button onClick={intro.start}>go</button>
      <button onClick={intro.stop}>halt</button>
    </div>
  );
}

const setup = (props: Partial<IntroProviderProps> = {}, extra: ReactNode = null) =>
  render(
    <IntroProvider pathname="/" baseUrl="/intro/" autoStart={false} {...props}>
      <Probe />
      {extra}
    </IntroProvider>,
  );

const has = () => screen.getByTestId("has").textContent;

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("IntroProvider loading", () => {
  it("requests <base>/<file> with a tolerated trailing slash and the abort signal", async () => {
    const fetchIntro = vi.fn().mockResolvedValue(makeDoc({ route: "/design/badge" }));
    setup({ pathname: "/design/badge/?x=1", fetchIntro });
    await waitFor(() => expect(has()).toBe("true"));
    expect(fetchIntro).toHaveBeenCalledWith("/intro/design/badge.json", expect.any(AbortSignal));
  });

  it("404 (null) means no intro, silently", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchIntro = vi.fn().mockResolvedValue(null);
    setup({ fetchIntro });
    await waitFor(() => expect(fetchIntro).toHaveBeenCalled());
    await act(async () => {});
    expect(has()).toBe("false");
    expect(warn).not.toHaveBeenCalled();
  });

  it("default fetch maps 404 to no intro and other failures to a warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 404 }));
    const { unmount } = setup();
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(spy.mock.calls[0]![1]).toMatchObject({ cache: "no-cache", credentials: "same-origin" });
    await act(async () => {});
    expect(warn).not.toHaveBeenCalled();
    unmount();

    spy.mockResolvedValue(new Response("", { status: 500 }));
    setup({ pathname: "/other" });
    await waitFor(() => expect(warn).toHaveBeenCalledTimes(1));
    expect(has()).toBe("false");
  });

  it("an invalid document warns once per url and yields no intro", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchIntro = vi.fn().mockResolvedValue(makeDoc({ revision: 0, steps: [{ id: "x", title: "", body: "b" }] }));
    const { rerender } = setup({ fetchIntro });
    await waitFor(() => expect(warn).toHaveBeenCalledTimes(1));
    expect(String(warn.mock.calls[0]![0])).toContain("revision");
    expect(String(warn.mock.calls[0]![0])).toContain("steps[0].title");
    expect(has()).toBe("false");

    for (const [i, pathname] of ["/other", "/"].entries()) {
      rerender(
        <IntroProvider pathname={pathname} baseUrl="/intro/" autoStart={false} fetchIntro={fetchIntro}>
          <Probe />
        </IntroProvider>,
      );
      await waitFor(() => expect(fetchIntro.mock.calls.length).toBe(i + 2));
    }
    await act(async () => {});
    // "/" again must not warn a second time; "/other" is a different url (and a route mismatch).
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("a fetch error warns once and never throws into the tree", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    setup({ fetchIntro: () => Promise.reject(new Error("boom")) });
    await waitFor(() => expect(warn).toHaveBeenCalledTimes(1));
    expect(String(warn.mock.calls[0]![0])).toContain("boom");
    expect(has()).toBe("false");
  });

  it("ignores a document whose route differs from the page", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    setup({ fetchIntro: () => Promise.resolve(makeDoc({ route: "/elsewhere" })) });
    await waitFor(() => expect(warn).toHaveBeenCalledTimes(1));
    expect(has()).toBe("false");
  });

  it("filters draft steps, and has no intro when only drafts remain", async () => {
    const withDraft = makeDoc({
      steps: [
        { id: "a", title: "A", body: "x" },
        { id: "d", title: "D", body: "", draft: true },
      ],
    });
    const first = setup({ fetchIntro: () => Promise.resolve(withDraft) });
    await waitFor(() => expect(has()).toBe("true"));
    expect(screen.getByTestId("count").textContent).toBe("1");
    first.unmount();

    const onlyDrafts = makeDoc({ steps: [{ id: "d", title: "D", body: "", draft: true }] });
    setup({ fetchIntro: () => Promise.resolve(onlyDrafts) });
    await act(async () => {});
    expect(has()).toBe("false");
  });

  it("a pathname that is not a legal route has no intro and no fetch", async () => {
    const fetchIntro = vi.fn();
    setup({ pathname: "/a/../b", fetchIntro });
    await act(async () => {});
    expect(fetchIntro).not.toHaveBeenCalled();
    expect(has()).toBe("false");
  });

  it("aborts the request when the route changes", async () => {
    const signals: AbortSignal[] = [];
    const fetchIntro = vi.fn((_url: string, signal: AbortSignal) => {
      signals.push(signal);
      return new Promise<unknown>(() => {});
    });
    const { rerender } = setup({ fetchIntro });
    await waitFor(() => expect(signals).toHaveLength(1));
    rerender(
      <IntroProvider pathname="/b" baseUrl="/intro/" autoStart={false} fetchIntro={fetchIntro}>
        <Probe />
      </IntroProvider>,
    );
    expect(signals[0]!.aborted).toBe(true);
  });

  it("an inline fetchIntro does not refetch on every render", async () => {
    let calls = 0;
    const Host = ({ n }: { n: number }) => (
      <IntroProvider
        pathname="/"
        baseUrl="/intro"
        autoStart={false}
        fetchIntro={async () => {
          calls++;
          return makeDoc();
        }}
      >
        <Probe />
        <span>{n}</span>
      </IntroProvider>
    );
    const { rerender } = render(<Host n={1} />);
    await waitFor(() => expect(has()).toBe("true"));
    rerender(<Host n={2} />);
    rerender(<Host n={3} />);
    expect(calls).toBe(1);
  });
});

describe("IntroProvider tour lifecycle", () => {
  const withDoc = (doc = makeDoc()) => ({ fetchIntro: () => Promise.resolve(doc) });

  it("start() opens the tour and Done records the revision as seen", async () => {
    const events: IntroEvent[] = [];
    setup({ ...withDoc(makeDoc({ revision: 3 })), onEvent: (e) => events.push(e) });
    await waitFor(() => expect(has()).toBe("true"));
    fireEvent.click(screen.getByText("go"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("running").textContent).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(readIntroState("starterkit-intro").seen).toEqual({ "/": 3 });
    expect(events.map((e) => e.type)).toEqual(["loaded", "start", "step", "step", "complete"]);
    expect(events.every((e) => e.route === "/")).toBe(true);
    expect(events.filter((e) => e.type === "step").map((e) => e.stepId)).toEqual(["a", "b"]);
  });

  it("Escape records seen and emits skip", async () => {
    const events: IntroEvent[] = [];
    setup({ ...withDoc(), onEvent: (e) => events.push(e) });
    await waitFor(() => expect(has()).toBe("true"));
    fireEvent.click(screen.getByText("go"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(readIntroState("starterkit-intro").seen["/"]).toBe(1);
    expect(events.at(-1)!.type).toBe("skip");
  });

  it("stop() closes without recording", async () => {
    setup(withDoc());
    await waitFor(() => expect(has()).toBe("true"));
    fireEvent.click(screen.getByText("go"));
    fireEvent.click(screen.getByText("halt"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(readIntroState("starterkit-intro").seen).toEqual({});
  });

  it("uses a custom storage key and labels", async () => {
    setup({ ...withDoc(), storageKey: "custom", labels: { skip: "Nope" } });
    await waitFor(() => expect(has()).toBe("true"));
    fireEvent.click(screen.getByText("go"));
    fireEvent.click(screen.getByRole("button", { name: "Nope" }));
    expect(readIntroState("custom").seen["/"]).toBe(1);
    expect(readIntroState("starterkit-intro").seen).toEqual({});
  });

  it("a tour with no displayable step is not recorded as seen", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    setup(withDoc(makeDoc({ steps: [{ id: "a", title: "A", body: "x", target: "#missing" }] })));
    await waitFor(() => expect(has()).toBe("true"));
    fireEvent.click(screen.getByText("go"));
    await waitFor(() => expect(screen.getByTestId("running").textContent).toBe("false"));
    expect(readIntroState("starterkit-intro").seen).toEqual({});
  });

  it("a route change stops a running tour", async () => {
    const { rerender } = setup(withDoc());
    await waitFor(() => expect(has()).toBe("true"));
    fireEvent.click(screen.getByText("go"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByText("go")); // a second start() while running is a no-op
    rerender(
      <IntroProvider pathname="/other" baseUrl="/intro/" autoStart={false} fetchIntro={() => Promise.resolve(null)}>
        <Probe />
      </IntroProvider>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByTestId("running").textContent).toBe("false");
    await waitFor(() => expect(has()).toBe("false"));
    expect(readIntroState("starterkit-intro").seen).toEqual({});
  });

  it("survives StrictMode without double events", async () => {
    const events: IntroEvent[] = [];
    render(
      <StrictMode>
        <IntroProvider
          pathname="/"
          baseUrl="/intro"
          autoStart={false}
          fetchIntro={() => Promise.resolve(makeDoc())}
          onEvent={(e) => events.push(e)}
        >
          <Probe />
        </IntroProvider>
      </StrictMode>,
    );
    await waitFor(() => expect(has()).toBe("true"));
    fireEvent.click(screen.getByText("go"));
    expect(events.filter((e) => e.type === "start")).toHaveLength(1);
    expect(events.filter((e) => e.type === "step")).toHaveLength(1);
  });
});

describe("IntroProvider auto-start", () => {
  const auto = (doc = makeDoc(), props: Partial<IntroProviderProps> = {}) =>
    setup({ autoStart: true, autoStartDelay: 10, fetchIntro: () => Promise.resolve(doc), ...props });
  const settle = (ms = 120) => act(() => new Promise<void>((r) => setTimeout(r, ms)));

  it("starts on a first visit", async () => {
    auto();
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
  });

  it("honours the autoStart prop", async () => {
    auto(makeDoc(), { autoStart: false });
    await waitFor(() => expect(has()).toBe("true"));
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("honours the stored switch", async () => {
    writeIntroState("starterkit-intro", { v: 1, autoStart: false, seen: {} });
    auto();
    await waitFor(() => expect(has()).toBe("true"));
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByTestId("auto").textContent).toBe("false");
  });

  it("does not start when this revision was already seen, but does when the revision is bumped", async () => {
    writeIntroState("starterkit-intro", { v: 1, autoStart: true, seen: { "/": 1 } });
    const first = auto(makeDoc({ revision: 1 }));
    await waitFor(() => expect(has()).toBe("true"));
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    first.unmount();

    auto(makeDoc({ revision: 2 }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
  });

  it("does not start again after it was finished", async () => {
    const first = auto();
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    fireEvent.keyDown(document, { key: "Escape" });
    first.unmount();
    auto();
    await waitFor(() => expect(has()).toBe("true"));
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("cancels the pending start on route change", async () => {
    const { rerender } = setup({ autoStart: true, autoStartDelay: 80, fetchIntro: () => Promise.resolve(makeDoc()) });
    await waitFor(() => expect(has()).toBe("true"));
    rerender(
      <IntroProvider pathname="/x" baseUrl="/intro" autoStart autoStartDelay={80} fetchIntro={() => Promise.resolve(null)}>
        <Probe />
      </IntroProvider>,
    );
    await settle(200);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("cancels the pending start on unmount", async () => {
    const onEvent = vi.fn();
    const { unmount } = setup({ autoStart: true, autoStartDelay: 80, fetchIntro: () => Promise.resolve(makeDoc()), onEvent });
    await waitFor(() => expect(has()).toBe("true"));
    unmount();
    await settle(200);
    expect(onEvent.mock.calls.some(([e]) => e.type === "start")).toBe(false);
  });

  it("the help button and switch work through the provider", async () => {
    setup({ fetchIntro: () => Promise.resolve(makeDoc()) }, (
      <>
        <IntroHelpButton />
        <IntroAutoStartSwitch />
      </>
    ));
    const help = screen.getByRole("button", { name: "Start page intro" });
    expect(help).toBeDisabled();
    await waitFor(() => expect(help).toBeEnabled());
    fireEvent.click(help);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });

    const sw = screen.getByRole("switch", { name: "Show intro on new pages" });
    expect(sw).toHaveAttribute("aria-checked", "true");
    fireEvent.click(sw);
    expect(sw).toHaveAttribute("aria-checked", "false");
    expect(readIntroState("starterkit-intro").autoStart).toBe(false);
  });
});

describe("useIntro", () => {
  it("throws a clear error outside a provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/IntroProvider/);
  });
});
