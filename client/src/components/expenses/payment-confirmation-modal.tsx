import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface PaymentConfirmationModalProps {
  memberName: string;
  payerName: string;
  initialAmount: string;
  maxAmount: string;
  amountPaid: string;
  totalShare: string;
  currency: string;
  onConfirm: (amount: string) => void;
  onCancel: () => void;
}

function PaymentConfirmationModal({
  memberName,
  payerName,
  initialAmount,
  maxAmount,
  amountPaid,
  totalShare,
  currency,
  onConfirm,
  onCancel,
}: PaymentConfirmationModalProps) {
  const [amount, setAmount] = useState(initialAmount);

  const maxAmountNum = parseFloat(maxAmount) || 0;
  const amountNum = parseFloat(amount) || 0;

  // Only validate when the user has typed something non-empty
  const isTouched = amount.trim() !== "" && amount.trim() !== ".";
  const hasError = isTouched && amountNum > maxAmountNum;

  // Only allow numeric input with a single decimal point
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (/^\d*\.?\d*$/.test(val)) {
      setAmount(val);
    }
  };

  const handleConfirm = () => {
    if (!hasError && amountNum > 0) {
      onConfirm(amount);
    }
  };

  const isConfirmDisabled = hasError || amountNum <= 0 || amount.trim() === "";

  return (
    <div
      className="fixed inset-0 z-40 backdrop-blur-sm bg-black/30"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 flex-col"
        onClick={onCancel}
      >
        {/* Error message — above card */}
        {hasError && (
          <div
            className="w-full max-w-[250px] sm:max-w-[340px] mb-3"
            style={{
              background: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(220, 38, 38, 0.25)",
              borderRadius: "14px",
              padding: "12px 16px",
            }}
          >
            <p
              style={{
                fontSize: "14px",
                color: "#dc2626",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontWeight: 500,
                textAlign: "center",
                margin: 0,
              }}
            >
              Input amount is greater than amount owed
            </p>
          </div>
        )}

        <div
  className="w-full max-w-[250px] sm:max-w-[340px] rounded-3xl p-6 shadow-[var(--shadow-elegant)] border border-border animate-in zoom-in-95 fade-in"
  style={{ background: "white" }}
  onClick={(e) => e.stopPropagation()}
>
  <div className="text-center">
    
    <p
      style={{
        fontSize: "16px",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontWeight: 400,
        lineHeight: 1.4,
      }}
      className="mt-1 text-center text-foreground"
    >
      <span style={{ fontWeight: 700, color: "var(--primary)" }}>{memberName}</span>
      {" paid "}
      <span style={{ fontWeight: 700, color: "var(--primary)" }}>{payerName}</span>
    </p>
  </div>

  <div className="mt-5">
    <Label htmlFor="amount" className="sr-only">
      Amount
    </Label>
    
    <div
      className={`flex items-center justify-center rounded-2xl px-4 py-5 transition-colors ring-1 w-full overflow-hidden ${
        hasError
          ? "bg-red-50 ring-red-500/50"
          : "bg-slate-100 ring-slate-300 focus-within:ring-slate-400"
      }`}
    >
      <span
        className={`text-3xl font-bold tracking-tight shrink-0 ${
          hasError ? "text-red-500" : "text-foreground"
        }`}
      >
        {currency}
      </span>
      <input
        id="amount"
        type="text"
        inputMode="decimal"
        value={amount}
        onChange={handleChange}
        placeholder="0.00"
        style={{
          /* Expands based on typing, but capped by max-w-full class */
          width: `${Math.max((amount?.length || 0) + 1, 4)}ch`
        }}
        className={`ml-1 bg-transparent outline-none text-3xl font-bold tracking-tight text-center max-w-full min-w-[2ch] ${
          hasError ? "text-red-500" : "text-foreground"
        }`}
        autoFocus
      />
    </div>

    <div className="mt-2 flex items-center">
      <span
        style={{
          fontSize: "12px",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontWeight: 400,
        }}
        className="text-muted-foreground"
      >
        Paid {currency}{amountPaid} of {currency}{totalShare}
      </span>
    </div>
  </div>

  <p
    style={{
      fontSize: "14px",
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      fontWeight: 400,
      lineHeight: 1.55,
    }}
    className="mt-4 text-center text-muted-foreground"
  >
    Ensure the money has been sent beforehand, as SPLIT does not handle transfers.
  </p>

  <div className="mt-5 flex gap-3">
    <Button
      variant="secondary"
      size="sm"
      fullWidth
      className="rounded-[50px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]"
      onClick={onCancel}
    >
      Cancel
    </Button>

    <Button
      variant="primary"
      size="sm"
      fullWidth
      disabled={isConfirmDisabled}
      className="rounded-[50px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]"
      onClick={handleConfirm}
    >
      Confirm
    </Button>
  </div>

        </div>
      </div>
    </div>
  );
}

export { PaymentConfirmationModal };