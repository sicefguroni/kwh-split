import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AddExpenseModal } from "./add-expense-modal";

const members = [
  { id: "1", name: "Alice", isAdmin: true, isActive: true },
  { id: "2", name: "Bob", isAdmin: false, isActive: true },
  { id: "3", name: "Cara", isAdmin: false, isActive: true },
];

function renderModal() {
  return render(
    <AddExpenseModal
      isOpen
      onClose={vi.fn()}
      onSubmit={vi.fn()}
      initialData={undefined}
      members={members}
      currency="₱"
      groupName="Trip Fund"
    />,
  );
}

describe("AddExpenseModal", () => {
  it("renders step 1 with expense name and amount fields", () => {
    renderModal();
    expect(screen.getByLabelText("Expense name")).toBeInTheDocument();
    expect(screen.getByLabelText("Total amount")).toBeInTheDocument();
    expect(screen.getByText("Who paid?")).toBeInTheDocument();
  });

  it("adds payer rows and shows remove buttons", () => {
    renderModal();

    const addBtn = screen.getByRole("button", { name: /Add payer/i });
    fireEvent.click(addBtn);

    const removeButtons = screen.getAllByRole("button", { name: /Remove payer/i });
    expect(removeButtons.length).toBe(2);
  });

  it("transitions to step 2 after filling basic info", () => {
    renderModal();

    fireEvent.change(screen.getByLabelText("Expense name"), { target: { value: "Dinner" } });
    fireEvent.change(screen.getByLabelText("Total amount"), { target: { value: "90" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByLabelText("Split type")).toBeInTheDocument();
    expect(screen.getByText("Member allocations")).toBeInTheDocument();
  });

  it("opens split type menu on click and shows options", async () => {
    renderModal();

    fireEvent.change(screen.getByLabelText("Expense name"), { target: { value: "Dinner" } });
    fireEvent.change(screen.getByLabelText("Total amount"), { target: { value: "90" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    fireEvent.click(screen.getByLabelText("Split type"));

    const options = await screen.findAllByRole("option");
    expect(options.length).toBeGreaterThanOrEqual(2);
  });
});
