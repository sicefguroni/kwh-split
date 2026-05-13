import type { Logger } from "pino";
import { createWorker } from "tesseract.js";
import sharp from "sharp";

export interface ExtractedItem {
  name: string;
  price: number;
  confidence: number;
  rawText: string;
}

export interface OCRResult {
  items: ExtractedItem[];
  rawText: string;
  confidence: number;
}

type OCRWorker = Awaited<ReturnType<typeof createWorker>>;

export class OCRService {
  private logger: Logger | undefined;
  private worker: OCRWorker | null = null;

  constructor(logger?: Logger) {
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    if (this.worker) {
      return;
    }

    try {
      this.worker = await createWorker("eng");
      this.logger?.info("OCR service initialized (Tesseract.js)");
    } catch (error) {
      this.logger?.error({ err: error }, "Failed to initialize Tesseract worker");
      throw error;
    }
  }

  async extractReceiptItems(imageBuffer: Buffer): Promise<OCRResult> {
    if (!this.worker) {
      // Auto-initialize if needed
      await this.initialize();
    }

    try {
      this.logger?.info("Processing receipt image for OCR extraction");

      const processedBuffer = await this.preprocessReceiptImage(imageBuffer);
      const ret = await this.worker!.recognize(processedBuffer);
      const rawText = ret.data.text;
      const confidence = ret.data.confidence;

      const items = this.parseReceiptText(rawText);

      return {
        items,
        rawText,
        confidence,
      };
    } catch (error) {
      this.logger?.error({ err: error }, "OCR extraction failed");
      throw new Error("Failed to extract text from receipt");
    }
  }

  private async preprocessReceiptImage(imageBuffer: Buffer): Promise<Buffer> {
    try {
      const image = sharp(imageBuffer, { failOn: "none" }).rotate();
      const metadata = await image.metadata();
      const targetWidth = metadata.width && metadata.width < 1600 ? Math.min(metadata.width * 2, 2400) : 2200;

      return await image
        .resize({ width: targetWidth, withoutEnlargement: false, fit: "inside" })
        .grayscale()
        .normalize()
        .sharpen({ sigma: 1.2 })
        .jpeg({ quality: 95 })
        .toBuffer();
    } catch (error) {
      this.logger?.warn({ err: error }, "Receipt image preprocessing failed, using original buffer");
      return imageBuffer;
    }
  }

  private parseReceiptText(text: string): ExtractedItem[] {
    const items: ExtractedItem[] = [];
    const lines = text.split("\n").filter((line) => line.trim());

    const trailingPriceRegex = /^(?<name>.+?)\s+(?:\$)?(?<price>\d{1,3}(?:,\d{3})*(?:\.\d{2}))\s*$/;
    const leadingPriceRegex = /^(?:\$)?(?<price>\d{1,3}(?:,\d{3})*(?:\.\d{2}))\s+(?<name>.+)$/;

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip common non-item lines
      if (this.isNonItemLine(trimmed)) continue;

      const match = trimmed.match(trailingPriceRegex) ?? trimmed.match(leadingPriceRegex);
      if (match?.groups?.price && match.groups.name) {
        const name = this.normalizeItemName(match.groups.name);
        const price = Number.parseFloat(match.groups.price.replace(/,/g, ""));

        if (name && !isNaN(price) && price > 0) {
          items.push({
            name,
            price,
            confidence: 85,
            rawText: trimmed,
          });
        }
      }
    }

    return items;
  }

  private normalizeItemName(name: string): string {
    return name
      .replace(/^\d+\s*[x×]\s+/i, "")
      .replace(/^[•*\-]+\s*/, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  private isNonItemLine(line: string): boolean {
    const excludePatterns = [
      /^(subtotal|grand total|total|tax|sales tax|tip|service|gratuity|amount|change|balance|payment|cash|discount|fee|vat|refund)/i,
      /^(thank you|thanks|please|welcome|date|time|receipt|store|location|cashier|register|number)/i,
      /^\d{4}-\d{2}-\d{2}/, // Dates
      /^[=\-\*]+$/, // Separator lines
      /^\s*$/, // Empty lines
    ];

    return excludePatterns.some((pattern) => pattern.test(line));
  }

  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
    this.logger?.info("OCR service terminated");
  }
}
