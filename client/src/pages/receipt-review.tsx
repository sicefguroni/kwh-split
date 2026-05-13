import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ReceiptItemAssignment, type ItemAssignment } from "@/components/expenses/receipt-item-assignment";
import { ReceiptUploadZone } from "@/components/expenses/receipt-upload-zone";
import { useReceiptAssignment, useReceiptUpload } from "@/features/expenses/use-receipt-upload";
import { useGroupQuery } from "@/features/groups/use-groups";

enum ReceiptStep {
  Upload = "upload",
  Review = "review",
  Assign = "assign",
}

export default function ReceiptReviewPage() {
  const navigate = useNavigate();
  const { groupId = "", expenseId = "" } = useParams<{ groupId: string; expenseId: string }>();
  const parsedExpenseId = Number.parseInt(expenseId, 10);
  const hasValidExpenseId = Number.isInteger(parsedExpenseId) && parsedExpenseId > 0;
  const { data: group, isLoading, isError } = useGroupQuery(groupId);
  const [step, setStep] = useState<ReceiptStep>(ReceiptStep.Upload);
  const [itemAssignments, setItemAssignments] = useState<ItemAssignment[]>([]);

  const expenseDetailsPath = groupId && hasValidExpenseId ? `/group/${groupId}/expense/${expenseId}` : "/dashboard";

  const members = useMemo(
    () =>
      (group?.members ?? [])
        .map((member) => ({ id: Number(member.id), name: member.name }))
        .filter((member) => Number.isFinite(member.id) && member.id > 0),
    [group],
  );

  const upload = useReceiptUpload({
    expenseId: hasValidExpenseId ? parsedExpenseId : undefined,
    onComplete: (items) => {
      setItemAssignments(
        items.map((item) => ({
          itemId: item.itemId,
          name: item.itemName,
          price: item.price,
          confidence: item.ocrConfidence ?? 0,
          rawText: item.rawText,
          assignedUserIds: [...item.assignedUserIds],
        })),
      );
      setStep(ReceiptStep.Review);
    },
  });

  const assignment = useReceiptAssignment({
    onComplete: () => {
      navigate(expenseDetailsPath, { replace: true });
    },
  });
  const currentReceipt = upload.receipt;

  const handleAssignmentSubmit = async (assignments: ItemAssignment[]) => {
    if (!hasValidExpenseId) {
      return;
    }

    try {
      await assignment.handleAssignItems(
        parsedExpenseId,
        assignments.map((assignmentItem) => ({
          itemId: assignmentItem.itemId ?? 0,
          assignedUserIds: assignmentItem.assignedUserIds,
        })),
      );
    } catch {
      // Error state is already set by the hook.
    }
  };

  const handleBack = () => {
    if (step === ReceiptStep.Review) {
      setStep(ReceiptStep.Upload);
      return;
    }

    if (step === ReceiptStep.Assign) {
      setStep(ReceiptStep.Review);
      return;
    }

    navigate(expenseDetailsPath, { replace: true });
  };

  const stepTitles: Record<ReceiptStep, string> = {
    [ReceiptStep.Upload]: "Upload Receipt",
    [ReceiptStep.Review]: "Review Extracted Items",
    [ReceiptStep.Assign]: "Assign Items to Members",
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Spinner />
      </div>
    );
  }

  if (!group || !hasValidExpenseId) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <Button variant="secondary" size="sm" onClick={() => navigate(expenseDetailsPath, { replace: true })}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="mt-10 rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">Receipt review unavailable</h1>
          <p className="mt-2 text-sm text-slate-600">
            {!hasValidExpenseId
              ? "The expense identifier is missing or invalid."
              : isError
                ? "This group could not be loaded."
                : "The receipt workflow could not be started."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50">
      <div className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-slate-100"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">{stepTitles[step]}</h1>
              <p className="text-sm text-slate-500">{group.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {Object.values(ReceiptStep).map((currentStep) => (
              <div
                key={currentStep}
                className={`h-2 w-8 rounded-full transition-colors ${
                  step === currentStep
                    ? "bg-sky-600"
                    : Object.values(ReceiptStep).indexOf(currentStep) < Object.values(ReceiptStep).indexOf(step)
                      ? "bg-sky-300"
                      : "bg-slate-200"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        {step === ReceiptStep.Upload && (
          <div className="space-y-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/60">
            <div>
              <h2 className="text-sm font-medium text-slate-900">Receipt image</h2>
              <p className="mt-1 text-sm text-slate-500">
                Upload a clear photo of your receipt. OCR will extract receipt items and keep the raw text.
              </p>
            </div>

            <ReceiptUploadZone
              onUpload={upload.handleFileUpload}
              isLoading={upload.isLoading}
              error={upload.error ?? undefined}
              preview={currentReceipt ? { file: currentReceipt.file, preview: currentReceipt.preview } as const : undefined}
              onClear={upload.handleClearReceipt}
            />
          </div>
        )}

        {step === ReceiptStep.Review && currentReceipt && (
          <div className="space-y-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/60">
            <div className="space-y-3">
              <div>
                <h2 className="text-sm font-medium text-slate-900">Extracted items</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {currentReceipt.items.length} items extracted with {currentReceipt.confidence}% average confidence.
                </p>
              </div>

              {currentReceipt.items.length === 0 ? (
                <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  No items were extracted from this receipt.
                </div>
              ) : (
                <div className="space-y-2">
                  {currentReceipt.items.map((item) => (
                    <div key={item.itemId} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">{item.itemName}</p>
                        <p className="truncate text-xs text-slate-500">{item.rawText}</p>
                      </div>
                      <div className="ml-4 text-right">
                        <p className="font-medium text-slate-900">
                          ${item.price.toFixed(2)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {Math.round(item.ocrConfidence ?? currentReceipt.confidence)}% confident
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3 border-t border-slate-200 pt-4">
              <Button
                variant="secondary"
                onClick={() => {
                  upload.handleClearReceipt();
                  setItemAssignments([]);
                  setStep(ReceiptStep.Upload);
                }}
                className="flex-1"
              >
                Re-upload
              </Button>
              <Button
                onClick={() => setStep(ReceiptStep.Assign)}
                disabled={currentReceipt.items.length === 0}
                className="flex-1"
              >
                Next: Assign items
              </Button>
            </div>
          </div>
        )}

        {step === ReceiptStep.Assign && currentReceipt && (
          <div className="space-y-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/60">
            <div>
              <h2 className="text-sm font-medium text-slate-900">Assign items to members</h2>
              <p className="mt-1 text-sm text-slate-500">
                Choose which group members are responsible for each OCR-extracted line item.
              </p>
            </div>

            <ReceiptItemAssignment
              items={itemAssignments}
              members={members}
              onAssignment={handleAssignmentSubmit}
              isLoading={assignment.isLoading}
              error={assignment.error ?? undefined}
            />

            <div className="flex gap-3 border-t border-slate-200 pt-4">
              <Button
                variant="secondary"
                onClick={() => setStep(ReceiptStep.Review)}
                disabled={assignment.isLoading}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                variant="secondary"
                onClick={() => navigate(expenseDetailsPath, { replace: true })}
                disabled={assignment.isLoading}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}