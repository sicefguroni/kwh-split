import { useState, useRef } from "react";
import { Upload, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export interface UploadedReceipt {
  file: File;
  preview: string;
}

export interface ReceiptUploadProps {
  onUpload: (file: File) => void;
  isLoading?: boolean | undefined;
  error?: string | undefined;
  preview?: UploadedReceipt | undefined;
  onClear?: () => void | undefined;
}

export function ReceiptUploadZone({
  onUpload,
  isLoading = false,
  error,
  preview,
  onClear,
}: ReceiptUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    const files = e.dataTransfer.files;
    const file = files.item(0);
    if (file && isValidImage(file)) {
        onUpload(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    const file = files?.item(0);
    if (file && isValidImage(file)) {
        onUpload(file);
    }
    // Reset input
    e.currentTarget.value = "";
  };

  const isValidImage = (file: File): boolean => {
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    const maxSize = 5 * 1024 * 1024; // 5MB
    return validTypes.includes(file.type) && file.size <= maxSize;
  };

  if (preview) {
    return (
      <div className="space-y-3">
        <div className="relative overflow-hidden rounded-lg bg-gray-100">
          <img
            src={preview.preview}
            alt="Receipt preview"
            className="h-48 w-full object-cover"
          />
          <button
            type="button"
            onClick={onClear}
            disabled={isLoading}
            className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 hover:bg-white disabled:opacity-50"
            aria-label="Remove image"
          >
            <X className="h-5 w-5 text-gray-900" />
          </button>
        </div>
        <p className="text-sm text-gray-600">{preview.file.name}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={cn(
          "relative rounded-lg border-2 border-dashed p-6 transition-colors",
          isDragActive
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 bg-gray-50 hover:border-gray-400",
          isLoading && "opacity-50",
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          disabled={isLoading}
          className="hidden"
          aria-label="Upload receipt image"
        />

        <div className="flex flex-col items-center justify-center gap-2 text-center">
          <Upload className="h-8 w-8 text-gray-400" />
          <div>
            <p className="text-sm font-medium text-gray-900">
              {isDragActive ? "Drop your receipt here" : "Drag your receipt here"}
            </p>
            <p className="text-xs text-gray-500">or</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
          >
            Choose file
          </Button>
          <p className="text-xs text-gray-500">PNG, JPG, or WebP up to 5MB</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
