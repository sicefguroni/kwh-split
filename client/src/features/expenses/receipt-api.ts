import { apiClient } from "@/lib/api-client";

export interface ReceiptItem {
  itemId: number;
  itemName: string;
  price: number;
  assignedUserIds: number[];
  rawText: string;
  ocrConfidence?: number;
}

export interface ReceiptUploadResponse {
  success: boolean;
  items: ReceiptItem[];
}

export interface ReceiptSplit {
  userId: number;
  amountOwed: number;
  percentage: number | null;
  share: number | null;
}

export interface ReceiptAssignmentResponse {
  success: boolean;
  splits: ReceiptSplit[];
}

export interface AssignmentData {
  itemId: number;
  assignedUserIds: number[];
}

interface RawReceiptItem {
  itemId?: number;
  itemName?: string;
  name?: string;
  price: number;
  assignedUserIds?: number[];
  rawText?: string;
  confidence?: number;
  ocrConfidence?: number;
}

function normalizeReceiptItem(item: RawReceiptItem, index: number): ReceiptItem {
  const normalizedConfidence = item.ocrConfidence ?? item.confidence;
  return {
    itemId: item.itemId ?? -(index + 1),
    itemName: item.itemName ?? item.name ?? "",
    price: item.price,
    assignedUserIds: item.assignedUserIds ?? [],
    rawText: item.rawText ?? "",
    ...(normalizedConfidence !== undefined ? { ocrConfidence: normalizedConfidence } : {}),
  };
}

export const receiptApi = {
  async uploadReceipt(expenseId: number, file: File): Promise<ReceiptUploadResponse> {
    const formData = new FormData();
    formData.append("receipt", file);

    return apiClient.post<ReceiptUploadResponse>(
      `/api/expenses/${expenseId}/receipt-items/upload`,
      formData,
    );
  },

  async getReceiptItems(expenseId: number): Promise<ReceiptItem[]> {
    const response = await apiClient.get<{ items: ReceiptItem[] }>(
      `/api/expenses/${expenseId}/receipt-items`,
    );
    return response.items;
  },

  async assignReceiptItems(
    expenseId: number,
    assignments: AssignmentData[],
  ): Promise<ReceiptAssignmentResponse> {
    return apiClient.put<ReceiptAssignmentResponse>(
      `/api/expenses/${expenseId}/receipt-items/assign`,
      {
        assignments,
      },
    );
  },

  async previewReceipt(file: File): Promise<ReceiptItem[]> {
    const formData = new FormData();
    formData.append("receipt", file);

    const response = await apiClient.post<{ success: boolean; items: RawReceiptItem[] }>(
      "/api/expenses/receipt/preview",
      formData,
    );
    return response.items.map((item, index) => normalizeReceiptItem(item, index));
  },

  async fileToDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
        } else {
          reject(new Error("Failed to read file"));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  },
};
