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
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div className="w-80 h-64 relative overflow-hidden pointer-events-auto">
          {/* Card background */}
          <div className="w-80 h-64 left-0 top-0 absolute bg-white rounded-[10px] border-[0.50px] border-cyan-600" />

          {/* Header: Member Name paid Payer */}
          <div className="w-60 h-8 left-[22px] top-[23px] absolute">
            <span className="text-black text-xs font-bold font-['Plus_Jakarta_Sans']">
              {memberName}
            </span>
            <span className="text-black text-xs font-normal font-['Plus_Jakarta_Sans']">
              {" "}paid{" "}
            </span>
            <span className="text-black text-xs font-bold font-['Plus_Jakarta_Sans']">
              {payerName}
            </span>
          </div>

          {/* Amount Paid input box */}
          <div className="w-52 h-12 px-4 py-3 left-[62px] top-[78px] absolute bg-slate-50 rounded-xl outline outline-1 outline-offset-[-1px] outline-gray-200 inline-flex justify-start items-center gap-4 overflow-hidden">
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-48 h-2.5 text-center bg-transparent border-none outline-none text-black text-lg font-semibold font-['Plus_Jakarta_Sans'] focus:ring-0"
              placeholder={`${currency} 0.00`}
            />
          </div>

          {/* Description text */}
          <div className="w-60 h-20 left-[53px] top-[126px] absolute text-center justify-center text-black text-xs font-normal font-['Plus_Jakarta_Sans']">
            You are recording a payment that occurred outside SPLIT.
          </div>

          {/* Cancel button */}
          <div className="left-[114px] top-[201px] absolute">
            <Button
              className="w-24 h-9 rounded-[50px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] bg-slate-50 text-gray-900 text-base font-medium font-['Plus_Jakarta_Sans'] border-0 hover:bg-slate-100"
              onClick={onCancel}
            >
              Cancel
            </Button>
          </div>

          {/* Confirm button */}
          <div className="left-[222px] top-[201px] absolute">
            <Button
              className="w-24 h-9 rounded-[50px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] bg-black text-white text-base font-medium font-['Plus_Jakarta_Sans'] hover:bg-gray-800"
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
