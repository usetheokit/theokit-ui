import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContextWindowBar } from "./context-window-bar.js";

describe("ContextWindowBar", () => {
  it("renders used/total ratio with default label", () => {
    render(<ContextWindowBar used={50000} total={200000} />);
    expect(screen.getByText(/Context/i)).toBeInTheDocument();
    expect(screen.getByText(/50\.0k \/ 200\.0k/)).toBeInTheDocument();
    expect(screen.getByText(/\(25%\)/)).toBeInTheDocument();
  });

  it("uses the warning tone above warnAt threshold", () => {
    const { container } = render(
      <ContextWindowBar used={150000} total={200000} warnAt={0.7} dangerAt={0.9} />,
    );
    expect(container.querySelector(".bg-warning")).not.toBeNull();
  });

  it("uses the destructive tone above dangerAt threshold", () => {
    const { container } = render(
      <ContextWindowBar used={195000} total={200000} warnAt={0.7} dangerAt={0.9} />,
    );
    expect(container.querySelector(".bg-destructive")).not.toBeNull();
  });

  it("hides label and numbers in compact mode but keeps the bar", () => {
    render(<ContextWindowBar used={50} total={100} compact />);
    expect(screen.queryByText(/\(50%\)/)).not.toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
  });

  it("renders an unknown state when total is 0", () => {
    const { container } = render(<ContextWindowBar used={500} total={0} />);
    expect(container.textContent).not.toMatch(/%/);
    expect(container.querySelector(".bg-destructive")).toBeNull();
    expect(screen.getByText(/unknown/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
  });

  it("never renders NaN for 0/0", () => {
    const { container } = render(<ContextWindowBar used={0} total={0} />);
    expect(container.textContent).not.toMatch(/NaN/);
  });

  it("uses the primary tone at 72% with the default thresholds", () => {
    const { container } = render(<ContextWindowBar used={72} total={100} />);
    expect(container.querySelector(".bg-primary")).not.toBeNull();
    expect(container.querySelector(".bg-warning")).toBeNull();
  });

  it("lets pressure override the thresholds", () => {
    const { container } = render(<ContextWindowBar used={10} total={100} pressure="critical" />);
    expect(container.querySelector(".bg-destructive")).not.toBeNull();
  });

  it("prefixes the used count with ~ when estimated", () => {
    render(<ContextWindowBar used={50000} total={200000} estimated />);
    expect(screen.getByText(/~50\.0k \/ 200\.0k/)).toBeInTheDocument();
  });
});
