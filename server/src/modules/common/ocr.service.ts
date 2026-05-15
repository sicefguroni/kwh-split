import type { Logger } from "pino";
import sharp from "sharp";
import { env } from "../../config/env.js";

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

const TABSCANNER_BASE = "https://api.tabscanner.com";
const MAX_POLL_ATTEMPTS = 15;
const INITIAL_POLL_DELAY_MS = 3500;
const MAX_IMAGE_DIMENSION = 2400;
const MIN_IMAGE_DIMENSION = 720;
const TARGET_FILE_SIZE_KB = 800;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class OCRService {
  private logger: Logger | undefined;
  private apiKey: string;

  constructor(logger?: Logger) {
    this.logger = logger;
    this.apiKey = env.OCR_API_KEY ?? "";
  }

  async initialize(): Promise<void> {
    if (!this.apiKey) {
      throw new Error("OCR_API_KEY environment variable is not set");
    }
    this.logger?.info("OCR service initialized (TabScanner)");
  }

  async extractReceiptItems(imageBuffer: Buffer): Promise<OCRResult> {
    if (!this.apiKey) {
      await this.initialize();
    }

    try {
      this.logger?.info({ size: imageBuffer.length }, "Processing receipt image");

      const preprocessed = await this.preprocessImage(imageBuffer);
      this.logger?.info(
        { originalSize: imageBuffer.length, processedSize: preprocessed.length },
        "Image preprocessed",
      );

      const token = await this.submitImage(preprocessed);
      const result = await this.pollForResult(token);

      const items = this.extractLineItems(result);
      const validated = this.validateAndCleanItems(items, result);

      return {
        items: validated,
        rawText: JSON.stringify(result.lineItems ?? []),
        confidence: result.totalConfidence ?? 0,
      };
    } catch (error) {
      this.logger?.error({ err: error }, "TabScanner OCR extraction failed");
      throw new Error("Failed to extract text from receipt");
    }
  }

  /**
   * Preprocess the image to maximize TabScanner accuracy:
   * - Auto-rotate based on EXIF orientation
   * - Resize to optimal dimensions (720-2400px, per TabScanner's recommendation)
   * - Convert to high-contrast grayscale for cleaner text extraction
   * - Normalize exposure and sharpen edges
   * - Output as high-quality JPEG to keep file size reasonable
   */
  private async preprocessImage(imageBuffer: Buffer): Promise<Buffer> {
    try {
      const image = sharp(imageBuffer, { failOn: "none" }).rotate();
      const metadata = await image.metadata();

      const width = metadata.width ?? 0;
      const height = metadata.height ?? 0;
      this.logger?.debug({ width, height, format: metadata.format }, "Original image metadata");

      let pipeline = image;

      // Resize if image is too small or too large
      if (width > 0 && height > 0) {
        const maxDim = Math.max(width, height);
        const minDim = Math.min(width, height);

        if (maxDim > MAX_IMAGE_DIMENSION) {
          // Downscale oversized images to reduce noise and processing time
          pipeline = pipeline.resize({
            width: width > height ? MAX_IMAGE_DIMENSION : undefined,
            height: height >= width ? MAX_IMAGE_DIMENSION : undefined,
            fit: "inside",
            withoutEnlargement: true,
          });
        } else if (minDim < MIN_IMAGE_DIMENSION) {
          // Upscale small images so text is readable
          const scale = Math.min(MIN_IMAGE_DIMENSION / minDim, 2.5);
          pipeline = pipeline.resize({
            width: Math.round(width * scale),
            height: Math.round(height * scale),
            fit: "inside",
            kernel: "lanczos3",
          });
        }
      }

      // Convert to grayscale for better text contrast
      pipeline = pipeline.grayscale();

      // Normalize the histogram to maximize contrast (helps faded/poor-lighting receipts)
      pipeline = pipeline.normalize();

      // Sharpen to make text edges crisper
      pipeline = pipeline.sharpen({ sigma: 1.5, m1: 0.8, m2: 0.4 });

      // Apply slight gamma correction to brighten midtones (thermal receipts tend to be dark)
      pipeline = pipeline.gamma(1.2);

      // Output as JPEG with good quality; TabScanner accepts JPG/PNG
      const result = await pipeline.jpeg({ quality: 92, mozjpeg: true }).toBuffer();

      // If the result is still very large, re-encode at lower quality
      if (result.length > TARGET_FILE_SIZE_KB * 1024) {
        const quality = Math.max(60, Math.round(92 * (TARGET_FILE_SIZE_KB * 1024) / result.length));
        return await sharp(result).jpeg({ quality, mozjpeg: true }).toBuffer();
      }

      return result;
    } catch (error) {
      this.logger?.warn({ err: error }, "Image preprocessing failed, using original buffer");
      return imageBuffer;
    }
  }

  private async submitImage(imageBuffer: Buffer): Promise<string> {
    const formData = new FormData();
    const blob = new Blob([imageBuffer], { type: "image/jpeg" });
    formData.append("file", blob, "receipt.jpg");
    formData.append("documentType", "receipt");
    formData.append("decimalPlaces", "2");
    formData.append("region", "ph");

    const response = await fetch(`${TABSCANNER_BASE}/api/2/process`, {
      method: "POST",
      headers: { apikey: this.apiKey },
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`TabScanner process failed (${response.status}): ${text}`);
    }

    const data = (await response.json()) as {
      token?: string;
      success?: boolean;
      message?: string;
      status_code?: number;
    };

    if (data.status_code === 300) {
      this.logger?.warn("Image did not meet recommended dimensions (720x1280)");
    }

    if (!data.token) {
      throw new Error(`TabScanner returned no token: ${data.message ?? "unknown error"}`);
    }

    return data.token;
  }

  /**
   * Poll for results with exponential backoff.
   * TabScanner typically takes 3-8s; we start at 3.5s and increase delay on retries.
   */
  private async pollForResult(token: string): Promise<TabScannerResult> {
    await sleep(INITIAL_POLL_DELAY_MS);

    let delay = 1200;

    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      const response = await fetch(`${TABSCANNER_BASE}/api/result/${token}`, {
        method: "GET",
        headers: { apikey: this.apiKey },
      });

      if (!response.ok) {
        if (response.status >= 500) {
          this.logger?.warn({ status: response.status, attempt }, "TabScanner server error, retrying");
          await sleep(delay);
          delay = Math.min(delay * 1.5, 5000);
          continue;
        }
        throw new Error(`TabScanner result poll failed (${response.status})`);
      }

      const data = (await response.json()) as {
        status: string;
        result?: TabScannerResult;
        message?: string;
      };

      if (data.status === "done" && data.result) {
        this.logger?.info({ attempt, lineItems: data.result.lineItems?.length ?? 0 }, "TabScanner result received");
        return data.result;
      }

      if (data.status === "failed") {
        throw new Error(`TabScanner processing failed: ${data.message ?? "unknown"}`);
      }

      // Exponential backoff: 1.2s → 1.8s → 2.7s → ...
      await sleep(delay);
      delay = Math.min(delay * 1.5, 5000);
    }

    throw new Error("TabScanner processing timed out");
  }

  private extractLineItems(result: TabScannerResult): ExtractedItem[] {
    const lineItems = result.lineItems ?? [];
    return lineItems
      .filter((item) => item.lineTotal > 0 && (item.descClean || item.desc))
      .map((item) => ({
        name: this.cleanItemName(item.descClean || item.desc || ""),
        price: item.lineTotal,
        confidence: this.calculateItemConfidence(item, result),
        rawText: item.desc || "",
      }));
  }

  /**
   * Post-process extracted items:
   * - Remove duplicates (same name + price)
   * - Filter low-confidence items
   * - Cross-validate total against sum of line items
   * - Remove non-product lines that slipped through (subtotals, tax, etc.)
   */
  private validateAndCleanItems(items: ExtractedItem[], result: TabScannerResult): ExtractedItem[] {
    // Deduplicate items with same name and price
    const seen = new Set<string>();
    const deduped = items.filter((item) => {
      const key = `${item.name.toLowerCase()}|${item.price.toFixed(2)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Filter out items that look like summary lines
    const filtered = deduped.filter((item) => !this.isSummaryLine(item.name));

    // Cross-validate: if TabScanner reported a total, check if our items are reasonable
    if (result.total && result.total > 0 && filtered.length > 0) {
      const itemsSum = filtered.reduce((sum, item) => sum + item.price, 0);
      const ratio = itemsSum / result.total;

      // If items sum vastly exceeds the total, some summary lines leaked in
      if (ratio > 1.5) {
        this.logger?.warn(
          { itemsSum, total: result.total, ratio },
          "Line items sum exceeds total significantly, filtering high-value outliers",
        );
        // Remove items that individually exceed the total (likely misclassified summary lines)
        return filtered.filter((item) => item.price <= result.total! * 1.1);
      }
    }

    return filtered;
  }

  private cleanItemName(name: string): string {
    return (
      name
        // Remove leading quantities like "2x", "3 x "
        .replace(/^\d+\s*[x×]\s*/i, "")
        // Remove leading bullet/dash markers
        .replace(/^[•*\-]+\s*/, "")
        // Remove trailing price fragments that leaked into the name
        .replace(/\s+\d+[.,]\d{2}\s*$/, "")
        // Collapse multiple spaces
        .replace(/\s{2,}/g, " ")
        .trim()
    );
  }

  private isSummaryLine(name: string): boolean {
    const lower = name.toLowerCase().trim();

    // Fuzzy-match patterns that catch OCR misreadings (e.g. VAABILE → VATABLE, VT → VAT)
    const containsPatterns = [
      /v[ao]t/,               // vat, vot — also catches OCR garbled "vatable"
      /v[.,]?a[.,]?t/,        // v.a.t, v,a,t
      /\bvt\b/,               // VT (shorthand for VAT)
      /\bsales\b/,            // "XXX SALES" lines are always tax summaries on receipts
      /tax/,
      /service\s*charge/,
      /svc\s*charge/,
      /s\.?c\.?\s*charge/,
      /gratuity/,
      /surcharge/,
      /sub\s*-?\s*total/,
      /grand\s*total/,
      /net\s*(total|amount)/,
      /gross\s*(total|amount)/,
      /total\s*(amount|due|sale)/,
      /amount\s*(due|paid|tendered)/,
      /balance\s*due/,
      /withholding/,
      /excise/,
    ];

    if (containsPatterns.some((p) => p.test(lower))) {
      return true;
    }

    const exactPatterns = [
      /^total$/,
      /^change$/,
      /^cash$/,
      /^payment$/,
      /^rounding$/,
      /^tip$/,
      /^discount$/,
      /^balance$/,
    ];

    if (exactPatterns.some((p) => p.test(lower))) {
      return true;
    }

    // Percentage-prefixed lines like "12% VT", "10% SC" are always fees, not products
    if (/^\d+%\s/.test(lower)) {
      return true;
    }

    const prefixPatterns = [
      /^less\s/,
      /^sc[\s/]/,
      /^pwd[\s/]/,
      /^senior/,
      /^disc[\s.]/,
      /^total\s/,
      /^net\s/,
      /^gross\s/,
      /^exempt\s/,
      /^zero[\s-]?rated/,
      /^non[\s-]?v/,
    ];

    return prefixPatterns.some((p) => p.test(lower));
  }

  /**
   * Per-item confidence score based on multiple signals:
   * - Does the item have a clean description?
   * - Is the quantity reasonable?
   * - Is the price within a reasonable range for the receipt total?
   * - Overall document confidence weighting
   */
  private calculateItemConfidence(item: TabScannerLineItem, result: TabScannerResult): number {
    let confidence = 80;

    // Boost if descClean is present (TabScanner's cleaned version)
    if (item.descClean && item.descClean.length > 1) {
      confidence += 8;
    }

    // Boost if qty is reasonable
    if (item.qty > 0 && item.qty <= 50) {
      confidence += 4;
    }

    // Slight penalty if price seems unreasonably high relative to total
    if (result.total && result.total > 0 && item.lineTotal > result.total * 0.8) {
      confidence -= 15;
    }

    // Factor in overall document confidence
    if (result.totalConfidence && result.totalConfidence > 0.8) {
      confidence += 5;
    } else if (result.totalConfidence && result.totalConfidence < 0.4) {
      confidence -= 10;
    }

    return Math.max(10, Math.min(99, confidence));
  }

  async terminate(): Promise<void> {
    this.logger?.info("OCR service terminated");
  }
}

interface TabScannerLineItem {
  lineTotal: number;
  descClean: string;
  desc: string;
  qty: number;
  price: number;
  unit: number;
  productCode: string;
  lineType?: string;
}

interface TabScannerResult {
  lineItems?: TabScannerLineItem[];
  summaryItems?: TabScannerLineItem[];
  total?: number;
  subTotal?: number;
  tax?: number;
  tip?: number;
  date?: string;
  establishment?: string;
  totalConfidence?: number;
  subTotalConfidence?: number;
}
