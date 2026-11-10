import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IntroTour } from "./IntroTour";
import type { IntroStep } from "./schema";
import type { IntroCloseReason, IntroTourEvent } from "./types";

const steps = (...over: Partial<IntroStep>[]): IntroStep[] =>
  over.map((o, i) => ({ id: `s${i + 1}`, title: `Title ${i + 1}`, body: `Body ${i + 1}`, ...o }));

beforeEach(() => {
  // jsdom has no layout: every rect is zero, which the tour reads as "hidden".
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    x: 10,
    y: 10,
    top: 10,
    left: 10,
    right: 110,
    bottom: 50,
    width: 100,
    height: 40,
    toJSON: () => ({}),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  document.querySelectorAll("#ghost, #real, #gone").forEach((n) => n.remove());
});

const dialog = () => screen.getByRole("dialog");

describe("IntroTour", () => {
  it("renders an accessible dialog in document.body with title, body and progress", async () => {
    render(<IntroTour steps={steps({}, {})} onClose={() => {}} />);
    const d = dialog();
    expect(d).toHaveAttribute("aria-modal", "true");
    expect(d.getAttribute("aria-labelledby")).toBe(screen.getByRole("heading", { level: 2 }).id);
    expect(d.getAttribute("aria-describedby")).toBeTruthy();
    expect(d.closest(".ii-layer")?.parentElement).toBe(document.body);
    expect(screen.getByText("Title 1")).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 2")).toHaveAttribute("aria-live", "polite");
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Next" })));
  });

  it("walks forward and back with the buttons and ends with Done", () => {
    const onClose = vi.fn();
    render(<IntroTour steps={steps({}, {})} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Title 2")).toBeInTheDocument();
    expect(screen.getByText("Step 2 of 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText("Title 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onClose).toHaveBeenCalledWith("done");
  });

  it("Skip and the close button end the tour as a skip", () => {
    const onClose = vi.fn();
    render(<IntroTour steps={steps({})} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Skip intro" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose.mock.calls).toEqual([["skip"], ["skip"]]);
  });

  it("supports custom labels", () => {
    render(<IntroTour steps={steps({})} onClose={() => {}} labels={{ done: "Fertig", stepOf: "{n}/{total}" }} />);
    expect(screen.getByRole("button", { name: "Fertig" })).toBeInTheDocument();
    expect(screen.getByText("1/1")).toBeInTheDocument();
  });

  it("keyboard: ArrowRight / ArrowLeft move, Escape skips", () => {
    const onClose = vi.fn();
    render(<IntroTour steps={steps({}, {}, {})} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(screen.getByText("Title 2")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(screen.getByText("Title 3")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "ArrowLeft" });
    expect(screen.getByText("Title 2")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "ArrowLeft" });
    fireEvent.keyDown(document, { key: "ArrowLeft" }); // already first: stays
    expect(screen.getByText("Title 1")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledWith("skip");
  });

  it("ArrowRight on the last step finishes", () => {
    const onClose = vi.fn();
    render(<IntroTour steps={steps({})} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(onClose).toHaveBeenCalledWith("done");
  });

  it("traps Tab inside the popover in both directions", () => {
    render(<IntroTour steps={steps({}, {})} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    const buttons = screen.getAllByRole("button");
    const first = buttons[0]!;
    const last = buttons[buttons.length - 1]!;
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
    // Focus that escaped (e.g. to the page) is pulled back in.
    (document.activeElement as HTMLElement).blur();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(dialog().contains(document.activeElement)).toBe(true);
  });

  it("returns focus to where it was before the tour started", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>open</button>
          {open && <IntroTour steps={steps({})} onClose={() => setOpen(false)} />}
        </>
      );
    }
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "open" });
    trigger.focus();
    fireEvent.click(trigger);
    await waitFor(() => expect(dialog().contains(document.activeElement)).toBe(true));
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it("skips a missing non-optional target with a warning and a missing-target event", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const events: IntroTourEvent[] = [];
    render(
      <IntroTour steps={steps({}, { target: "#nope" }, {})} onClose={() => {}} onEvent={(e) => events.push(e)} />,
    );
    expect(screen.getByText("Step 1 of 2")).toBeInTheDocument();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(events).toEqual(
      expect.arrayContaining([
        { type: "missing-target", stepId: "s2", index: 1 },
        { type: "step", stepId: "s1", index: 0 },
      ]),
    );
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Title 3")).toBeInTheDocument();
    expect(screen.getByText("Step 2 of 2")).toBeInTheDocument();
  });

  it("skips a missing optional target silently", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const events: IntroTourEvent[] = [];
    render(
      <IntroTour steps={steps({}, { target: "#nope", optional: true })} onClose={() => {}} onEvent={(e) => events.push(e)} />,
    );
    expect(warn).not.toHaveBeenCalled();
    expect(events.some((e) => e.type === "missing-target")).toBe(false);
    expect(screen.getByText("Step 1 of 1")).toBeInTheDocument();
  });

  it("skips an invalid selector with a warning, even when optional", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<IntroTour steps={steps({}, { target: "[[nope", optional: true })} onClose={() => {}} />);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toMatch(/invalid selector/);
    expect(screen.getByText("Step 1 of 1")).toBeInTheDocument();
  });

  it("treats a visibility:hidden target as missing", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    document.body.insertAdjacentHTML("beforeend", '<div id="ghost" style="visibility:hidden"></div><div id="real"></div>');
    render(<IntroTour steps={steps({ target: "#ghost" }, { target: "#real" })} onClose={() => {}} />);
    expect(screen.getByText("Title 2")).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 1")).toBeInTheDocument();
  });

  it("targets a real element: spotlight rendered, scrim not", () => {
    document.body.insertAdjacentHTML("beforeend", '<div id="real"></div>');
    const { baseElement } = render(<IntroTour steps={steps({ target: "#real" })} onClose={() => {}} />);
    expect(baseElement.querySelector(".ii-spotlight")).not.toBeNull();
    expect(baseElement.querySelector(".ii-scrim")).toBeNull();
  });

  it("a target-less step shows a scrim, not a spotlight, and centres", () => {
    const { baseElement } = render(<IntroTour steps={steps({})} onClose={() => {}} />);
    expect(baseElement.querySelector(".ii-scrim")).not.toBeNull();
    expect(baseElement.querySelector(".ii-spotlight")).toBeNull();
    expect(dialog()).toHaveAttribute("data-placement", "center");
  });

  it("skips a step whose target disappears before it is shown, in the direction of travel", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    document.body.insertAdjacentHTML("beforeend", '<div id="gone"></div>');
    render(<IntroTour steps={steps({}, { target: "#gone" }, {})} onClose={() => {}} />);
    document.getElementById("gone")!.remove();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Title 3")).toBeInTheDocument();
  });

  it("closes as 'empty' when nothing can be displayed", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const onClose = vi.fn<(r: IntroCloseReason) => void>();
    render(<IntroTour steps={steps({ target: "#a" }, { target: "#b" })} onClose={onClose} />);
    expect(onClose).toHaveBeenCalledWith("empty");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders step text as text, never as HTML", () => {
    const { baseElement } = render(
      <IntroTour
        steps={steps({ title: "<i>t</i>", body: '<img src=x onerror="window.__pwned=1"><b>hi</b>' })}
        onClose={() => {}}
      />,
    );
    expect(baseElement.querySelector(".ii-popover img")).toBeNull();
    expect(baseElement.querySelector(".ii-popover b")).toBeNull();
    expect(baseElement.querySelector(".ii-title")!.textContent).toBe("<i>t</i>");
    expect(baseElement.querySelector(".ii-body")!.textContent).toContain("<b>hi</b>");
  });

  it("removes its listeners and DOM on unmount", () => {
    const remove = vi.spyOn(document, "removeEventListener");
    const { unmount } = render(<IntroTour steps={steps({})} onClose={() => {}} />);
    act(() => unmount());
    expect(remove).toHaveBeenCalledWith("keydown", expect.any(Function), true);
    expect(document.querySelector(".ii-layer")).toBeNull();
  });
});
