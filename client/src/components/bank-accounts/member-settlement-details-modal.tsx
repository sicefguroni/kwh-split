import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Copy, Download, QrCode, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { useMemberSettlementProfile } from "@/features/auth/use-auth";
import { cn } from "@/lib/cn";

interface MemberSettlementDetailsModalProps {
  isOpen: boolean;
  groupId: string;
  memberId: string;
  memberName: string;
  onClose: () => void;
}

interface MemberSettlementDetailsSectionsProps {
  groupId: string;
  memberId: string;
  memberName: string;
  className?: string;
}

export function MemberSettlementDetailsSections({
  groupId,
  memberId,
  memberName,
  className,
}: MemberSettlementDetailsSectionsProps) {
  const { addToast } = useToast();
  const { data: profile, isLoading, isError } = useMemberSettlementProfile(groupId, memberId, true);
  const [currentQrIndex, setCurrentQrIndex] = useState(0);

  useEffect(() => {
    setCurrentQrIndex(0);
  }, [memberId]);

  const qrImages = profile?.qrImages ?? [];
  const activeQr = qrImages[currentQrIndex] ?? null;

  const handleCopy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      addToast(`${label} copied`, "success");
    } catch {
      addToast(`Failed to copy ${label.toLowerCase()}`, "error");
    }
  };

  const handleSaveQr = () => {
    if (!activeQr) {
      return;
    }

    const link = document.createElement("a");
    link.href = activeQr;
    link.download = `${memberName.toLowerCase().replace(/[^a-z0-9]+/gi, "-") || "member"}-qr-${currentQrIndex + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const showCarouselControls = qrImages.length > 1;

  if (isLoading) {
    return (
      <div className={cn("flex min-h-64 items-center justify-center", className)}>
        <Spinner />
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className={cn("rounded-3xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-700", className)}>
        Unable to load this member&apos;s payment details right now.
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      <section className="space-y-4 rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">QR codes</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={handleSaveQr}
            disabled={!activeQr}
            className="gap-2 rounded-full"
          >
            <Download className="h-4 w-4" /> Save image
          </Button>
        </div>

        {activeQr ? (
          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="aspect-square overflow-hidden rounded-[1.25rem] bg-slate-100">
                <img
                  src={activeQr}
                  alt={`${profile.name} QR ${currentQrIndex + 1}`}
                  className="h-full w-full object-contain"
                />
              </div>

              {showCarouselControls ? (
                <>
                  <button
                    type="button"
                    onClick={() => setCurrentQrIndex((index) => (index === 0 ? qrImages.length - 1 : index - 1))}
                    className="absolute left-6 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-md transition hover:bg-white"
                    aria-label="Previous QR image"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentQrIndex((index) => (index + 1) % qrImages.length)}
                    className="absolute right-6 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-md transition hover:bg-white"
                    aria-label="Next QR image"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              ) : null}
            </div>

            <div className="flex items-center justify-center gap-2">
              {qrImages.map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  onClick={() => setCurrentQrIndex(index)}
                  className={index === currentQrIndex ? "h-2.5 w-7 rounded-full bg-slate-900" : "h-2.5 w-2.5 rounded-full bg-slate-300"}
                  aria-label={`View QR image ${index + 1}`}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex min-h-56 flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-slate-200 bg-white px-6 text-center text-slate-500">
            <QrCode className="h-10 w-10 text-slate-300" />
            <p className="mt-4 text-sm font-medium text-slate-700">No QR uploaded yet</p>
            <p className="mt-1 text-sm text-slate-500">This member has not added a settlement QR in their profile.</p>
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Bank details</p>
        </div>

        {profile.bankAccounts.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-5 py-6 text-sm text-slate-500">
            No bank details added yet.
          </div>
        ) : (
          <div className="space-y-4">
            {profile.bankAccounts.map((account) => (
              <div key={account.id} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-700">
                  {account.bankName}
                </h4>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                          Account name
                        </p>
                        <p className="mt-2 break-words text-sm font-semibold text-slate-900">
                          {account.accountName}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleCopy(account.accountName, "Account name")}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        aria-label={`Copy account name for ${account.bankName}`}
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                          Account number
                        </p>
                        <p className="mt-2 break-all font-mono text-sm font-semibold text-slate-900">
                          {account.accountNumber}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleCopy(account.accountNumber, "Account number")}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        aria-label={`Copy account number for ${account.bankName}`}
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function MemberSettlementDetailsModal({
  isOpen,
  groupId,
  memberId,
  memberName,
  onClose,
}: MemberSettlementDetailsModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-2xl overflow-hidden rounded-[2rem] bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={`${memberName} payment details`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Payment details</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">{memberName}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close member payment details"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[calc(100vh-10rem)] overflow-y-auto px-6 py-6">
          <MemberSettlementDetailsSections
            groupId={groupId}
            memberId={memberId}
            memberName={memberName}
          />
        </div>
      </div>
    </div>
  );
}