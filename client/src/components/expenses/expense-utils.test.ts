import { describe, expect, it } from "vitest";
import type { MemberSplitInput } from "./types";
import {
  rebalanceExactSplitInputs,
  rebalancePercentageSplitInputs,
  validateExactSplitState,
} from "./expense-utils";

type LockableMemberSplitInput = MemberSplitInput & { locked?: boolean };

function sumSelected(inputs: Record<string, LockableMemberSplitInput>, selectedIds: string[]): number {
  return selectedIds.reduce((sum, id) => sum + Number(inputs[id]?.amount ?? "0"), 0);
}

describe("rebalanceExactSplitInputs", () => {
  it("balances many members exactly to total", () => {
    const selectedIds = Array.from({ length: 20 }, (_, index) => String(index + 1));
    const inputs = selectedIds.reduce<Record<string, LockableMemberSplitInput>>((acc, id) => {
      acc[id] = { selected: true, amount: "0.00", locked: false };
      return acc;
    }, {});

    const rebalanced = rebalanceExactSplitInputs(inputs, selectedIds, 1000);
    expect(sumSelected(rebalanced, selectedIds)).toBeCloseTo(1000, 2);
  });

  it("preserves locked members while rebalancing unlocked", () => {
    const selectedIds = ["1", "2", "3"];
    const inputs: Record<string, LockableMemberSplitInput> = {
      "1": { selected: true, amount: "40.00", locked: true },
      "2": { selected: true, amount: "20.00", locked: false },
      "3": { selected: true, amount: "20.00", locked: false },
    };

    const rebalanced = rebalanceExactSplitInputs(inputs, selectedIds, 100);
    expect(rebalanced["1"]?.amount).toBe("40.00");
    expect(sumSelected(rebalanced, selectedIds)).toBeCloseTo(100, 2);
  });

  it("keeps changed member stable and adjusts others", () => {
    const selectedIds = ["1", "2", "3"];
    const inputs: Record<string, LockableMemberSplitInput> = {
      "1": { selected: true, amount: "20.00", locked: true },
      "2": { selected: true, amount: "60.00", locked: false },
      "3": { selected: true, amount: "20.00", locked: false },
    };

    const rebalanced = rebalanceExactSplitInputs(inputs, selectedIds, 100, "2");
    expect(rebalanced["2"]?.amount).toBe("60.00");
    expect(rebalanced["3"]?.amount).toBe("20.00");
    expect(sumSelected(rebalanced, selectedIds)).toBeCloseTo(100, 2);
  });

  it("prefers whole numbers when balancing without changedId", () => {
    const selectedIds = ["1", "2", "3"];
    const inputs: Record<string, LockableMemberSplitInput> = {
      "1": { selected: true, amount: "0.00", locked: false },
      "2": { selected: true, amount: "0.00", locked: false },
      "3": { selected: true, amount: "0.00", locked: false },
    };

    const rebalanced = rebalanceExactSplitInputs(inputs, selectedIds, 100);
    const amounts = selectedIds.map((id) => Number(rebalanced[id]?.amount ?? "0"));

    expect(sumSelected(rebalanced, selectedIds)).toBeCloseTo(100, 2);
    expect(amounts.every((value) => Number.isInteger(value))).toBe(true);
  });
});

describe("validateExactSplitState", () => {
  it("errors when locked values exceed total", () => {
    const selectedIds = ["1", "2"];
    const inputs: Record<string, LockableMemberSplitInput> = {
      "1": { selected: true, amount: "80.00", locked: true },
      "2": { selected: true, amount: "30.00", locked: true },
    };
    expect(validateExactSplitState(inputs, selectedIds, 100)).toContain("Locked amounts exceed");
  });

  it("errors when all selected are locked but mismatched total", () => {
    const selectedIds = ["1", "2"];
    const inputs: Record<string, LockableMemberSplitInput> = {
      "1": { selected: true, amount: "20.00", locked: true },
      "2": { selected: true, amount: "20.00", locked: true },
    };
    expect(validateExactSplitState(inputs, selectedIds, 100)).toContain("does not match");
  });
});

describe("rebalancePercentageSplitInputs", () => {
  it("normalizes selected percentages to 100%", () => {
    const selectedIds = ["1", "2", "3"];
    const inputs: Record<string, LockableMemberSplitInput> = {
      "1": { selected: true, amount: "20.00" },
      "2": { selected: true, amount: "20.00" },
      "3": { selected: true, amount: "20.00" },
    };
    const rebalanced = rebalancePercentageSplitInputs(inputs, selectedIds);
    const total = selectedIds.reduce((sum, id) => sum + Number(rebalanced[id]?.amount ?? "0"), 0);
    expect(total).toBeCloseTo(100, 2);
  });

  it("preserves locked percentages and rebalances only unlocked members", () => {
    const selectedIds = ["1", "2", "3"];
    const inputs: Record<string, LockableMemberSplitInput> = {
      "1": { selected: true, amount: "40.00", locked: true },
      "2": { selected: true, amount: "10.00", locked: false },
      "3": { selected: true, amount: "10.00", locked: false },
    };
    const rebalanced = rebalancePercentageSplitInputs(inputs, selectedIds);
    const total = selectedIds.reduce((sum, id) => sum + Number(rebalanced[id]?.amount ?? "0"), 0);

    expect(rebalanced["1"]?.amount).toBe("40.00");
    expect(total).toBeCloseTo(100, 2);
  });
});
