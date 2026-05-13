import { useState } from "react";
import {
  receiptApi,
  type AssignmentData,
  type ReceiptItem,
  type ReceiptSplit,
} from "@/features/expenses/receipt-api";

export interface UploadedReceipt {
  file: File;
  preview: string;
  items: ReceiptItem[];
  confidence: number;
}

interface UseReceiptUploadProps {
  expenseId?: number | undefined;
  onComplete?: (items: ReceiptItem[]) => void;
}

export function useReceiptUpload({ expenseId, onComplete }: UseReceiptUploadProps = {}) {
  const [receipt, setReceipt] = useState<UploadedReceipt | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (file: File) => {
    setIsLoading(true);
    setError(null);

    try {
      // Create preview
      const preview = await receiptApi.fileToDataURL(file);

      if (!expenseId) {
        throw new Error("Expense ID is required before uploading a receipt");
      }

      const ocrResult = await receiptApi.uploadReceipt(expenseId, file);
      const items = ocrResult.items;
      const confidence = items.length > 0
        ? Math.round(
            items.reduce((sum, item) => sum + (item.ocrConfidence ?? 0), 0) / items.length,
          )
        : 0;

      setReceipt({
        file,
        preview,
        items,
        confidence,
      });

      onComplete?.(items);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to upload receipt";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearReceipt = () => {
    setReceipt(null);
    setError(null);
  };

  const resetState = () => {
    setReceipt(null);
    setError(null);
    setIsLoading(false);
  };

  return {
    receipt,
    isLoading,
    error,
    handleFileUpload,
    handleClearReceipt,
    resetState,
  };
}

interface UseReceiptAssignmentProps {
  onComplete?: (splits: ReceiptSplit[]) => void;
  onError?: (error: string) => void;
}

export function useReceiptAssignment({ onComplete, onError }: UseReceiptAssignmentProps = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAssignItems = async (expenseId: number, assignments: AssignmentData[]) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await receiptApi.assignReceiptItems(expenseId, assignments);
      onComplete?.(result.splits);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to assign items";
      setError(message);
      onError?.(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const resetState = () => {
    setError(null);
    setIsLoading(false);
  };

  return {
    isLoading,
    error,
    handleAssignItems,
    resetState,
  };
}
