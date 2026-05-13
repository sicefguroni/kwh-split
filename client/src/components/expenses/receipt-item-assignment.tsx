import { useState } from "react";
import { ChevronDown, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export interface ExtractedItem {
  name: string;
  price: number;
  confidence: number;
  rawText: string;
}

export interface MemberOption {
  id: number;
  name: string;
}

export interface ItemAssignment {
  itemId?: number;
  name: string;
  price: number;
  confidence: number;
  rawText: string;
  assignedUserIds: number[];
}

interface ReceiptItemAssignmentProps {
  items: ItemAssignment[];
  members: MemberOption[];
  onAssignment: (assignments: ItemAssignment[]) => void;
  isLoading?: boolean;
  error?: string | undefined;
}

export function ReceiptItemAssignment({
  items,
  members,
  onAssignment,
  isLoading = false,
  error,
}: ReceiptItemAssignmentProps) {
  const [assignments, setAssignments] = useState<ItemAssignment[]>(items);
  const [expandedIndex, setExpandedIndex] = useState<number>(0);

  const handleToggleUser = (itemIndex: number, userId: number) => {
    const updated = [...assignments];
    const currentItem = updated[itemIndex];
    if (!currentItem) {
      return;
    }

    const userIds = [...currentItem.assignedUserIds];
    const index = userIds.indexOf(userId);

    if (index > -1) {
      userIds.splice(index, 1);
    } else {
      userIds.push(userId);
    }

    updated[itemIndex] = { ...currentItem, assignedUserIds: userIds };
    setAssignments(updated);
  };

  const handleSplitEqually = (itemIndex: number) => {
    const updated = [...assignments];
    const currentItem = updated[itemIndex];
    if (!currentItem) {
      return;
    }

    updated[itemIndex] = { ...currentItem, assignedUserIds: members.map((m) => m.id) };
    setAssignments(updated);
  };

  const handleClearAssignment = (itemIndex: number) => {
    const updated = [...assignments];
    const currentItem = updated[itemIndex];
    if (!currentItem) {
      return;
    }

    updated[itemIndex] = { ...currentItem, assignedUserIds: [] };
    setAssignments(updated);
  };

  const isValid = assignments.length > 0 && assignments.every((a) => a.assignedUserIds.length > 0);
  const totalPrice = assignments.reduce((sum, a) => sum + a.price, 0);
  const assignedPrice = assignments.reduce(
    (sum, a) => sum + (a.assignedUserIds.length > 0 ? a.price : 0),
    0,
  );

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-2">
        {assignments.map((item, itemIndex) => (
          <div key={itemIndex} className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Item Header */}
            <button
              type="button"
              onClick={() => setExpandedIndex(expandedIndex === itemIndex ? -1 : itemIndex)}
              className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition"
            >
              <div className="flex items-center gap-3 flex-1 text-left">
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-gray-500 transition-transform",
                    expandedIndex === itemIndex && "rotate-180",
                  )}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{item.name}</p>
                  <p className="text-sm text-gray-500">
                    ${item.price.toFixed(2)} • {item.assignedUserIds.length} people
                  </p>
                </div>
              </div>
              <div className="text-right">
                {item.confidence < 75 && (
                  <span className="inline-block px-2 py-1 rounded bg-yellow-100 text-xs font-medium text-yellow-800">
                    Low confidence
                  </span>
                )}
              </div>
            </button>

            {/* Item Detail - Expandable */}
            {expandedIndex === itemIndex && (
              <div className="px-4 py-3 space-y-3 border-t border-gray-200 bg-white">
                {/* Raw text from OCR */}
                <div className="text-xs text-gray-600 bg-gray-50 rounded p-2">
                  <span className="font-medium">Extracted from: </span>
                  <code className="text-gray-700">{item.rawText}</code>
                </div>

                {/* Member selection */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Assign to:</p>
                  <div className="space-y-2">
                    {members.map((member) => (
                      <label
                        key={member.id}
                        className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={item.assignedUserIds.includes(member.id)}
                          onChange={() => handleToggleUser(itemIndex, member.id)}
                          disabled={isLoading}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700">{member.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Quick actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => handleSplitEqually(itemIndex)}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    Split equally
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => handleClearAssignment(itemIndex)}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    Clear
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="rounded-lg bg-blue-50 p-3 text-sm">
        <div className="flex justify-between mb-1">
          <span className="text-blue-900">Total: ${totalPrice.toFixed(2)}</span>
          <span className="text-blue-900">Assigned: ${assignedPrice.toFixed(2)}</span>
        </div>
        <div className="w-full bg-blue-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{
              width: totalPrice > 0 ? `${(assignedPrice / totalPrice) * 100}%` : "0%",
            }}
          />
        </div>
      </div>

      {/* Submit button */}
      <Button
        type="button"
        onClick={() => onAssignment(assignments)}
        disabled={!isValid || isLoading}
        className="w-full"
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isLoading ? "Processing..." : "Confirm assignments"}
      </Button>

      {!isValid && (
        <p className="text-xs text-red-600">
          All items must be assigned to at least one person
        </p>
      )}
    </div>
  );
}
