import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FollowUpBubbles } from "../FollowUpBubbles.tsx";

describe("FollowUpBubbles", () => {
  it("renders one button per follow-up prompt", () => {
    render(
      <FollowUpBubbles
        followUps={[
          "What should I test next?",
          "How can I refactor this?",
          "What is a harder variant?",
        ]}
        onSelect={() => {}}
      />,
    );

    expect(screen.getByText("Follow-up ideas")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "What should I test next?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "How can I refactor this?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "What is a harder variant?" }),
    ).toBeInTheDocument();
  });

  it("renders nothing when there are no follow-ups", () => {
    const { container } = render(
      <FollowUpBubbles followUps={[]} onSelect={() => {}} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("calls onSelect with the clicked prompt", () => {
    const onSelect = vi.fn();

    render(
      <FollowUpBubbles
        followUps={["How would this work with objects?"]}
        onSelect={onSelect}
      />,
    );

    const button = screen.getByRole("button", {
      name: "How would this work with objects?",
    });

    expect(button).toHaveAttribute("type", "button");
    fireEvent.click(button);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("How would this work with objects?");
  });
});
