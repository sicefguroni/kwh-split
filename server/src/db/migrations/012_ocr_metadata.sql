-- Split: OCR receipt processing
-- Add OCR metadata columns to receipt_items table for tracking OCR extraction confidence and raw text

ALTER TABLE receipt_items 
  ADD COLUMN IF NOT EXISTS ocr_confidence DECIMAL(5, 2),
  ADD COLUMN IF NOT EXISTS raw_ocr_text TEXT,
  ADD COLUMN IF NOT EXISTS is_extracted_by_ocr BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_receipt_items_ocr_confidence
  ON receipt_items (ocr_confidence) 
  WHERE ocr_confidence IS NOT NULL;
