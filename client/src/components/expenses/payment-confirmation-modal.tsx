import { useState } from "react";
import { Button } from "@/components/ui/button";

interface PaymentConfirmationModalProps {
  memberName: string;
  payerName: string;
  initialAmount: string;
  maxAmount: string;
  currency: string;
  onConfirm: (amount: string) => void;
  onCancel: () => void;
}

function PaymentConfirmationModal({
  memberName,
  payerName,
  initialAmount,
  maxAmount,
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
    <>
      {/* Blurred backdrop overlay */}
      <div
        className="fixed inset-0 z-40 backdrop-blur-sm bg-black/30"
        onClick={onCancel}
      />

      {/* Centered card wrapper */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 flex-col">

        {/* Error message — same max-width as card */}
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

        {/* Modal card */}
        <div
          className="w-full max-w-[250px] sm:max-w-[340px]"
          style={{
            background: "white",
            borderRadius: "20px",
            padding: "24px 20px",
            boxShadow:
              "0 0 0 1.5px #c7dff7, 0 8px 32px rgba(80, 140, 220, 0.10), 0 2px 8px rgba(0,0,0,0.06)",
            display: "flex",
            flexDirection: "column",
            gap: "0",
          }}
        >
          {/* Header */}
          <p
            style={{
              fontSize: "15px",
              color: "#1a1a1a",
              marginBottom: "18px",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontWeight: 400,
              lineHeight: 1.4,
            }}
          >
            <span style={{ fontWeight: 700 }}>{memberName}</span>
            {" paid "}
            <span style={{ fontWeight: 700 }}>{payerName}</span>
          </p>

          {/* Amount input box */}
          <div
            style={{
              background: hasError ? "rgba(239, 68, 68, 0.06)" : "#f2f2f2",
              borderRadius: "14px",
              padding: "18px 16px",
              marginBottom: "18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              transition: "background 0.2s ease",
              border: hasError
                ? "1px solid rgba(220, 38, 38, 0.3)"
                : "1px solid transparent",
            }}
          >
            <span
              style={{
                fontSize: "26px",
                fontWeight: 700,
                color: hasError ? "#dc2626" : "#1a1a1a",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                letterSpacing: "-0.5px",
                paddingRight: "2px",
                transition: "color 0.2s ease",
              }}
            >
              {currency}
            </span>

            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={handleChange}
              style={{
                width: `${Math.max((amount?.length || 0) + 1, 5)}ch`,
                background: "transparent",
                border: "none",
                outline: "none",
                textAlign: "left",
                fontSize: "26px",
                fontWeight: 700,
                color: hasError ? "#dc2626" : "#1a1a1a",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                letterSpacing: "-0.5px",
                transition: "color 0.2s ease",
              }}
              placeholder="0.00"
            />
          </div>

          {/* Max amount hint */}
          <p
            style={{
              fontSize: "12px",
              color: "#999",
              textAlign: "center",
              marginBottom: "4px",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            Amount owed: {currency}{maxAmount}
          </p>

          {/* Description */}
          <p
            style={{
              fontSize: "14px",
              color: "#555",
              textAlign: "center",
              lineHeight: 1.55,
              marginBottom: "15px",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            You are recording a payment that occurred outside SPLIT.
          </p>

          {/* Buttons */}
          <div className="flex gap-3">
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
    </>
  );
}

export { PaymentConfirmationModal };