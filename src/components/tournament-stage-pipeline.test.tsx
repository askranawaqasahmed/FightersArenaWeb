// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TournamentStagePipeline } from "./tournament-stage-pipeline";

afterEach(cleanup);

describe("TournamentStagePipeline", () => {
  it("starts with one stage and prevents removing the last stage", () => {
    render(<TournamentStagePipeline />);

    expect(screen.getByText("STAGE 1")).toBeInTheDocument();
    expect(screen.queryByText("STAGE 2")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove stage 1" })).toBeDisabled();
  });

  it("adds and removes stages while retaining at least one", () => {
    render(<TournamentStagePipeline />);

    fireEvent.click(screen.getByRole("button", { name: "Add stage" }));
    expect(screen.getByText("STAGE 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove stage 1" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Remove stage 2" }));
    expect(screen.queryByText("STAGE 2")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove stage 1" })).toBeDisabled();
  });

  it("allows every stage to use any supported format", () => {
    render(<TournamentStagePipeline />);

    fireEvent.change(screen.getByRole("combobox", { name: "Format for stage 1" }), {
      target: { value: "single-elimination" },
    });
    expect(screen.getByRole("heading", { name: "Single-elimination playoffs" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Bracket size" })).not.toBeInTheDocument();
    expect(screen.getByText("8 participants → 8 slots")).toBeInTheDocument();
    expect(screen.getByText("Series length")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add stage" }));
    const secondStageFormat = screen.getByRole("combobox", { name: "Format for stage 2" });
    expect(secondStageFormat).toHaveValue("groups");

    fireEvent.change(secondStageFormat, { target: { value: "double-elimination" } });
    const secondStage = screen.getByText("STAGE 2").closest(".card");
    expect(secondStage).not.toBeNull();
    expect(within(secondStage as HTMLElement).getByRole("heading", { name: "Double-elimination playoffs" })).toBeInTheDocument();
    expect(within(secondStage as HTMLElement).getByText("Grand final")).toBeInTheDocument();
  });

  it("derives elimination entrants from group qualifiers and adds byes", () => {
    render(<TournamentStagePipeline participantCount={14} />);

    fireEvent.click(screen.getByRole("button", { name: "Add stage" }));
    const firstStage = screen.getByText("STAGE 1").closest(".card");
    expect(firstStage).not.toBeNull();
    fireEvent.change(within(firstStage as HTMLElement).getByRole("spinbutton", { name: "Groups" }), { target: { value: "3" } });
    fireEvent.change(within(firstStage as HTMLElement).getByRole("spinbutton", { name: "Advance per group" }), { target: { value: "2" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Format for stage 2" }), { target: { value: "single-elimination" } });

    expect(screen.getByText("6 participants → 8 slots")).toBeInTheDocument();
    expect(screen.getByText(/with 2 byes/)).toBeInTheDocument();
  });
});
