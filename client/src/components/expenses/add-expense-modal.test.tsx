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

describe("AddExpenseModal exact split", () => {
  it("shows balance controls in exact mode", () => {
    renderModal();

    fireEvent.change(screen.getByLabelText("Expense name"), { target: { value: "Dinner" } });
    fireEvent.change(screen.getByLabelText("Expense amount"), { target: { value: "90" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    fireEvent.change(screen.getByLabelText("Split type"), { target: { value: "exact" } });

    expect(screen.getByRole("button", { name: "Balance Amounts" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Lock .*|Unlock .*/ }).length).toBeGreaterThan(0);
  });

  it("locks a member amount input when toggled", () => {
    renderModal();

    fireEvent.change(screen.getByLabelText("Expense name"), { target: { value: "Hotel" } });
    fireEvent.change(screen.getByLabelText("Expense amount"), { target: { value: "300" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.change(screen.getByLabelText("Split type"), { target: { value: "exact" } });

    const lockButton = screen.getByRole("button", { name: "Lock Alice" });
    fireEvent.click(lockButton);

    const amountInputs = screen.getAllByPlaceholderText("0.00") as HTMLInputElement[];
    expect(amountInputs[0]?.disabled).toBe(true);
  });

  it("shows and updates member discount selector", () => {
    renderModal();

    fireEvent.change(screen.getByLabelText("Expense name"), { target: { value: "Groceries" } });
    fireEvent.change(screen.getByLabelText("Expense amount"), { target: { value: "300" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    const discountSelect = screen.getByLabelText("Discount type for Alice");
    fireEvent.change(discountSelect, { target: { value: "pwd" } });
    expect((discountSelect as HTMLSelectElement).value).toBe("pwd");
  });
});
