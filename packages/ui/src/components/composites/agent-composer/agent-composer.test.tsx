import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { AgentComposer } from "./agent-composer.js";

const commands = [
  { id: "1", label: "/clear", description: "Reset session" },
  { id: "2", label: "/help", description: "Show help" },
];

const files = [
  { id: "1", label: "src/Foo.tsx", description: "modified" },
  { id: "2", label: "src/Bar.tsx", description: "new" },
];

const memories = [
  { id: "1", label: "#alignment-grid", description: "snap not stiffness" },
  { id: "2", label: "#auth", description: "OAuth PKCE" },
];

function Harness({ onSubmit }: { onSubmit?: (v: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <AgentComposer
      value={value}
      onValueChange={setValue}
      onSubmit={onSubmit}
      commands={commands}
      files={files}
      memories={memories}
    />
  );
}

describe("AgentComposer", () => {
  it("does not show a menu when no trigger is active", () => {
    render(<Harness />);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("opens the commands menu when the value ends with `/`", () => {
    render(<Harness />);
    const ta = screen.getByRole("textbox");
    fireEvent.change(ta, { target: { value: "/" } });
    expect(screen.getByRole("menu", { name: /commands/i })).toBeInTheDocument();
    expect(screen.getByText("/clear")).toBeInTheDocument();
  });

  it("filters commands as the user types", () => {
    render(<Harness />);
    const ta = screen.getByRole("textbox");
    fireEvent.change(ta, { target: { value: "/he" } });
    expect(screen.getByText("/help")).toBeInTheDocument();
    expect(screen.queryByText("/clear")).toBeNull();
  });

  it("opens the files menu for `@` after a space", () => {
    render(<Harness />);
    const ta = screen.getByRole("textbox");
    fireEvent.change(ta, { target: { value: "look at @" } });
    expect(screen.getByRole("menu", { name: /files/i })).toBeInTheDocument();
    expect(screen.getByText("src/Foo.tsx")).toBeInTheDocument();
  });

  it("opens the memories menu for `#`", () => {
    render(<Harness />);
    const ta = screen.getByRole("textbox");
    fireEvent.change(ta, { target: { value: "#" } });
    expect(screen.getByRole("menu", { name: /memories/i })).toBeInTheDocument();
    expect(screen.getByText("#alignment-grid")).toBeInTheDocument();
  });

  it("replaces the trigger token when an item is selected via click", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const ta = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: "/he" } });
    await user.click(screen.getByRole("menuitem", { name: /\/help/i }));
    expect(ta.value).toBe("/help ");
  });

  it("returns focus to the textarea after selecting an item via click", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const ta = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: "/he" } });
    await user.click(screen.getByRole("menuitem", { name: /\/help/i }));
    // Clicking the menu item moves focus to the button; the composer must hand
    // it back so the user keeps typing without reaching for the mouse again.
    expect(ta).toHaveFocus();
    // …and the caret sits after the inserted token, ready for the next keystroke.
    expect(ta.selectionStart).toBe(ta.value.length);
  });

  it("closes the menu on Escape and lets the user keep typing", () => {
    render(<Harness />);
    const ta = screen.getByRole("textbox");
    fireEvent.change(ta, { target: { value: "/" } });
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("submits on Enter when no trigger is active", () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    const ta = screen.getByRole("textbox");
    fireEvent.change(ta, { target: { value: "hello there" } });
    fireEvent.keyDown(ta, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledWith("hello there");
  });

  it("does not submit on Enter while menu is open — Enter picks the active item instead", () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    const ta = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: "/" } });
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(ta.value).toBe("/clear ");
  });

  it("submits on Enter for a mid-sentence path and leaves the value unchanged", () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    const ta = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: "copy it to /tmp/out" } });
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.keyDown(ta, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledWith("copy it to /tmp/out");
    expect(ta.value).toBe("copy it to /tmp/out");
  });

  it("does not replace a mid-sentence slash word with a command", () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    const ta = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: "run /c" } });
    fireEvent.keyDown(ta, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledWith("run /c");
    expect(ta.value).toBe("run /c");
  });

  it("opens the menu for a leading `/cl` and Enter inserts the command", () => {
    render(<Harness />);
    const ta = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: "/cl" } });
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByText("/clear")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Enter" });
    expect(ta.value).toBe("/clear ");
  });

  it("shows no menu once a command argument has started", () => {
    render(<Harness />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "/export /tmp/x" },
    });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("still opens the files menu for a mid-sentence `@`", () => {
    render(
      <AgentComposer
        value="see @rea"
        onValueChange={() => {}}
        files={[{ id: "r", label: "README.md", description: "docs" }]}
      />,
    );
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByText("README.md")).toBeInTheDocument();
  });
});
