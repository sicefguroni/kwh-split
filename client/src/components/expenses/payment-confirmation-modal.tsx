import { useState } from "react";
import { Button } from "@/components/ui/button";

interface PaymentConfirmationModalProps {
  memberName: string;
  payerName: string;
  initialAmount: string;
  currency: string;
  onConfirm: (amount: string) => void;
  onCancel: () => void;
}

function PaymentConfirmationModal({
  memberName,
  payerName,
  initialAmount,
  currency,
  onConfirm,
  onCancel,
}: PaymentConfirmationModalProps) {
  const [amount, setAmount] = useState(initialAmount);

  return (
    <>
      {/* Blurred backdrop overlay */}
      <div
        className="fixed inset-0 z-40 backdrop-blur-sm bg-black/30"
        onClick={onCancel}
      />

      {/* Centered card */}
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div
          style={{
            background: "white",
            borderRadius: "20px",
            padding: "28px 24px 24px",
            width: "100%",
            maxWidth: "340px",
            boxShadow:
              "0 0 0 1.5px #c7dff7, 0 8px 32px rgba(80, 140, 220, 0.10), 0 2px 8px rgba(0,0,0,0.06)",
            display: "flex",
            flexDirection: "column",
            gap: "0",
          }}
        >
          {/* Header: Member Name paid Payer */}
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

         {/* Amount Paid input box */}
        <div
        style={{
        background: "#f2f2f2",
        borderRadius: "14px",
        padding: "18px 16px",
        marginBottom: "18px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center", 
        width: "100%",
        }}
        >
        <span
        style={{
        fontSize: "26px",
        fontWeight: 700,
        color: "#1a1a1a",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        letterSpacing: "-0.5px",
        paddingRight: "2px", // Tightened up slightly to match your image
        }}
        >
        {currency}
        </span>

        <input
        type="text"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        style={{
        width: `${Math.max(amount?.length || 0, 4)}ch`,
        background: "transparent",
        border: "none",
        outline: "none",
        textAlign: "left", 
        fontSize: "26px",
        fontWeight: 700,
        color: "#1a1a1a",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        letterSpacing: "-0.5px",
        }}
        placeholder="0.00"
        />
        </div>

          {/* Description text */}
          <p
            style={{
              fontSize: "14px",
              color: "#555",
              textAlign: "center",
              lineHeight: 1.55,
              marginBottom: "24px",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            You are recording a payment that occurred outside SPLIT.
          </p>

          {/* Buttons */}
          <div
            style={{
              display: "flex",
              gap: "12px",
              justifyContent: "center",
            }}
          >
            {/* Cancel button */}
            <Button
              style={{
                flex: 1,
                padding: "13px 0",
                borderRadius: "999px",
                border: "none",
                background: "#ebebeb",
                color: "#1a1a1a",
                fontSize: "15px",
                fontWeight: 600,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                cursor: "pointer",
                height: "auto",
                boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)",
              }}
              className="hover:bg-[#dcdcdc]"
              onClick={onCancel}
            >
              Cancel
            </Button>

            {/* Confirm button */}
            <Button
              style={{
                flex: 1,
                padding: "13px 0",
                borderRadius: "999px",
                border: "none",
                background: "#1a1a1a",
                color: "white",
                fontSize: "15px",
                fontWeight: 600,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                cursor: "pointer",
                height: "auto",
                boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)",
              }}
              className="hover:bg-[#333333]"
              onClick={() => onConfirm(amount)}
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