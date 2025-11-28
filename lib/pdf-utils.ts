import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { Canvas, createCanvas } from 'canvas';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';

// Set up the worker for PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = path.join(
  process.cwd(),
  'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'
);

export interface PDFPageImage {
  pageNumber: number;
  imageBuffer: Buffer;
  contentType: string;
  width: number;
  height: number;
}

/**
 * Page type classification
 */
export type PageType =
  | 'cover'
  | 'index'
  | 'plan'
  | 'schedule'
  | 'detail'
  | 'section'
  | 'elevation'
  | 'specification'
  | 'diagram'
  | 'legend'
  | 'general_notes';

/**
 * Extended page metadata for large document support
 */
export interface PDFPageMetadata {
  pageNumber: number;
  sheetNumber?: string;
  textContent: string;
  textPreview: string;
  estimatedTokens: number;
  width: number;
  height: number;
  hasText: boolean;
  estimatedType: PageType;
}

/**
 * Processed page with image and metadata
 */
export interface ProcessedPage extends PDFPageMetadata {
  imageBuffer: Buffer;
  contentType: string;
  thumbnailBuffer?: Buffer;
}

export interface PDFInfo {
  pageCount: number;
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
}

/**
 * Get basic information about a PDF file
 */
export async function getPDFInfo(pdfBuffer: Buffer): Promise<PDFInfo> {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pageCount = pdfDoc.getPageCount();
    const title = pdfDoc.getTitle();
    const author = pdfDoc.getAuthor();
    const subject = pdfDoc.getSubject();
    const keywords = pdfDoc.getKeywords();

    return {
      pageCount,
      title,
      author,
      subject,
      keywords
    };
  } catch (error) {
    console.error('Error getting PDF info:', error);
    throw new Error('Failed to get PDF information');
  }
}

/**
 * Convert PDF pages to images for processing with Claude Vision API
 * @param pdfBuffer The PDF file buffer
 * @param options Conversion options
 * @returns Array of page images
 */
export async function convertPDFToImages(
  pdfBuffer: Buffer,
  options: {
    maxPages?: number;
    startPage?: number;
    scale?: number;
    format?: 'png' | 'jpeg';
    quality?: number;
  } = {}
): Promise<PDFPageImage[]> {
  const {
    maxPages, // No default limit - process all pages unless specified
    startPage = 1,
    scale = 2.0, // Higher scale for better quality
    format = 'png',
    quality = 90
  } = options;

  try {
    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(pdfBuffer),
      useSystemFonts: true,
    });
    const pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages;
    const endPage = maxPages ? Math.min(startPage + maxPages - 1, totalPages) : totalPages;
    const images: PDFPageImage[] = [];

    // Process each page
    for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      // Create a canvas for rendering
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');

      // Render PDF page to canvas
      await page.render({
        canvasContext: context as any,
        viewport: viewport,
        canvas: canvas as any
      }).promise;

      // Convert canvas to buffer
      let imageBuffer: Buffer;
      if (format === 'jpeg') {
        imageBuffer = await sharp(canvas.toBuffer())
          .jpeg({ quality })
          .toBuffer();
      } else {
        imageBuffer = await sharp(canvas.toBuffer())
          .png({ quality })
          .toBuffer();
      }

      images.push({
        pageNumber: pageNum,
        imageBuffer,
        contentType: `image/${format}`,
        width: viewport.width,
        height: viewport.height
      });

      // Clean up
      page.cleanup();
    }

    return images;
  } catch (error) {
    console.error('Error converting PDF to images:', error);
    throw new Error('Failed to convert PDF to images');
  }
}

/**
 * Extract text content from PDF for additional context
 * @param pdfBuffer The PDF file buffer
 * @param maxPages Maximum pages to extract (undefined = all pages)
 * @param startPage Starting page number (1-indexed)
 */
export async function extractPDFText(
  pdfBuffer: Buffer,
  maxPages?: number,
  startPage = 1
): Promise<string> {
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(pdfBuffer),
      useSystemFonts: true,
    });
    const pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages;
    const endPage = maxPages ? Math.min(startPage + maxPages - 1, totalPages) : totalPages;
    let fullText = '';

    for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');

      fullText += `\n--- Page ${pageNum} ---\n${pageText}`;

      // Clean up
      page.cleanup();
    }

    return fullText.trim();
  } catch (error) {
    console.error('Error extracting PDF text:', error);
    throw new Error('Failed to extract PDF text');
  }
}

/**
 * Determine if a file is a PDF based on its content or filename
 */
export function isPDFFile(filenameOrBuffer: string | Buffer): boolean {
  if (typeof filenameOrBuffer === 'string') {
    return filenameOrBuffer.toLowerCase().endsWith('.pdf');
  }

  // Check PDF magic bytes: %PDF
  if (Buffer.isBuffer(filenameOrBuffer) && filenameOrBuffer.length >= 4) {
    return filenameOrBuffer[0] === 0x25 && // %
           filenameOrBuffer[1] === 0x50 && // P
           filenameOrBuffer[2] === 0x44 && // D
           filenameOrBuffer[3] === 0x46;   // F
  }

  return false;
}

/**
 * Process a PDF file for extraction - converts to images and extracts text
 * @param pdfPath Path to PDF file or Buffer
 * @param options Processing options
 */
export async function processPDFForExtraction(
  pdfPath: string | Buffer,
  options: {
    maxPages?: number;
    startPage?: number;
    includeText?: boolean;
  } = {}
): Promise<{
  images: PDFPageImage[];
  text?: string;
  info: PDFInfo;
}> {
  const { maxPages, startPage = 1, includeText = true } = options;

  // Read PDF buffer if path is provided
  const pdfBuffer = typeof pdfPath === 'string'
    ? await readFile(pdfPath)
    : pdfPath;

  // Get PDF info
  const info = await getPDFInfo(pdfBuffer);

  // Convert pages to images
  const images = await convertPDFToImages(pdfBuffer, { maxPages, startPage });

  // Extract text if requested
  let text: string | undefined;
  if (includeText) {
    text = await extractPDFText(pdfBuffer, maxPages, startPage);
  }

  return {
    images,
    text,
    info
  };
}

// ============================================================================
// LARGE DOCUMENT SUPPORT
// ============================================================================

/**
 * Sheet number patterns commonly used in construction documents
 */
const SHEET_NUMBER_PATTERNS = [
  // Standard format: A1.0, M0.1, E1.01, etc.
  /\b([A-Z]{1,2}\d{1,2}[.-]\d{1,3}[A-Z]?)\b/i,
  // With prefix: SHEET A1.0, SHEET NO. M0.1
  /\bSHEET\s*(?:NO\.?\s*)?([A-Z]{1,2}\d{1,2}[.-]\d{1,3}[A-Z]?)\b/i,
  // Simple format: A-1, M-01, E-001
  /\b([A-Z]{1,2}-\d{1,3}[A-Z]?)\b/i,
  // Numbers only at start of text (e.g., "1 of 50")
  /^\s*(\d{1,3})\s+(?:of|\/)\s+\d{1,3}/i,
];

/**
 * Extract sheet number from page text content
 */
export function extractSheetNumber(textContent: string): string | undefined {
  // Look in first 500 chars (usually in title block area)
  const searchArea = textContent.slice(0, 500);

  for (const pattern of SHEET_NUMBER_PATTERNS) {
    const match = searchArea.match(pattern);
    if (match && match[1]) {
      return match[1].toUpperCase();
    }
  }

  return undefined;
}

/**
 * Estimate page type based on text content
 */
export function estimatePageType(textContent: string, sheetNumber?: string): PageType {
  const lowerText = textContent.toLowerCase();
  const upperText = textContent.toUpperCase();

  // Check sheet number prefix first (most reliable)
  if (sheetNumber) {
    const prefix = sheetNumber.charAt(0).toUpperCase();
    // Cover sheets often have special prefixes
    if (prefix === 'G' || sheetNumber.match(/^[GT]0/i)) {
      if (lowerText.includes('index') || lowerText.includes('list of drawings')) {
        return 'index';
      }
      if (lowerText.includes('cover') || lowerText.includes('title')) {
        return 'cover';
      }
      if (lowerText.includes('legend') || lowerText.includes('symbol')) {
        return 'legend';
      }
      if (lowerText.includes('general notes') || lowerText.includes('general requirements')) {
        return 'general_notes';
      }
    }
  }

  // Check for schedule indicators
  if (
    lowerText.includes('schedule') ||
    lowerText.includes('equipment list') ||
    lowerText.includes('fixture schedule') ||
    lowerText.includes('panel schedule')
  ) {
    return 'schedule';
  }

  // Check for detail indicators
  if (
    lowerText.includes('detail') ||
    lowerText.includes('typ.') ||
    lowerText.includes('typical')
  ) {
    return 'detail';
  }

  // Check for section indicators
  if (
    lowerText.includes('section') ||
    lowerText.includes('building section') ||
    upperText.includes('SECT')
  ) {
    return 'section';
  }

  // Check for elevation indicators
  if (
    lowerText.includes('elevation') ||
    upperText.includes('ELEV')
  ) {
    return 'elevation';
  }

  // Check for diagram indicators
  if (
    lowerText.includes('diagram') ||
    lowerText.includes('riser') ||
    lowerText.includes('single line') ||
    lowerText.includes('one-line')
  ) {
    return 'diagram';
  }

  // Check for specification/text-heavy pages
  const wordCount = textContent.split(/\s+/).length;
  if (wordCount > 500) {
    return 'specification';
  }

  // Default to plan
  return 'plan';
}

/**
 * Estimate token count for a page based on image and text content
 */
export function estimatePageTokens(
  imageWidth: number,
  imageHeight: number,
  textLength: number
): number {
  // Image tokens: roughly 85 tokens per 512x512 tile
  const tiles = Math.ceil(imageWidth / 512) * Math.ceil(imageHeight / 512);
  const imageTokens = tiles * 85;

  // Text tokens: roughly 1 token per 4 characters
  const textTokens = Math.ceil(textLength / 4);

  return imageTokens + textTokens;
}

/**
 * Extract text content for a single page
 */
export async function extractPageText(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageNumber: number
): Promise<string> {
  const page = await pdfDoc.getPage(pageNumber);
  const textContent = await page.getTextContent();
  const text = textContent.items
    .map((item: any) => item.str)
    .join(' ');
  page.cleanup();
  return text;
}

/**
 * Process a single page to image with metadata
 */
async function processPage(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  options: {
    scale: number;
    format: 'png' | 'jpeg';
    quality: number;
    generateThumbnail: boolean;
    thumbnailWidth: number;
  }
): Promise<ProcessedPage> {
  const { scale, format, quality, generateThumbnail, thumbnailWidth } = options;

  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  // Create canvas and render
  const canvas = createCanvas(viewport.width, viewport.height);
  const context = canvas.getContext('2d');

  await page.render({
    canvasContext: context as any,
    viewport: viewport,
    canvas: canvas as any,
  }).promise;

  // Get text content
  const textContent = await page.getTextContent();
  const text = textContent.items.map((item: any) => item.str).join(' ');

  // Convert canvas to image buffer
  let imageBuffer: Buffer;
  if (format === 'jpeg') {
    imageBuffer = await sharp(canvas.toBuffer())
      .jpeg({ quality })
      .toBuffer();
  } else {
    imageBuffer = await sharp(canvas.toBuffer())
      .png({ quality })
      .toBuffer();
  }

  // Generate thumbnail if requested
  let thumbnailBuffer: Buffer | undefined;
  if (generateThumbnail) {
    thumbnailBuffer = await sharp(canvas.toBuffer())
      .resize(thumbnailWidth)
      .jpeg({ quality: 60 })
      .toBuffer();
  }

  // Extract metadata
  const sheetNumber = extractSheetNumber(text);
  const estimatedType = estimatePageType(text, sheetNumber);
  const estimatedTokens = estimatePageTokens(viewport.width, viewport.height, text.length);

  page.cleanup();

  return {
    pageNumber,
    sheetNumber,
    textContent: text,
    textPreview: text.slice(0, 500),
    estimatedTokens,
    width: Math.round(viewport.width),
    height: Math.round(viewport.height),
    hasText: text.length > 50,
    estimatedType,
    imageBuffer,
    contentType: `image/${format}`,
    thumbnailBuffer,
  };
}

/**
 * Split a PDF into individual pages with full metadata extraction.
 * Supports parallel processing for large documents.
 *
 * @param pdfBuffer The PDF file buffer
 * @param options Processing options
 * @returns Array of processed pages with images and metadata
 */
export async function splitPDFToPages(
  pdfBuffer: Buffer,
  options: {
    maxPages?: number;
    startPage?: number;
    scale?: number;
    format?: 'png' | 'jpeg';
    quality?: number;
    generateThumbnails?: boolean;
    thumbnailWidth?: number;
    parallelism?: number;
    onProgress?: (current: number, total: number) => void;
  } = {}
): Promise<{
  pages: ProcessedPage[];
  info: PDFInfo;
  totalPages: number;
  processedPages: number;
}> {
  const {
    maxPages,
    startPage = 1,
    scale = 1.5, // Slightly lower default for large docs
    format = 'jpeg', // JPEG for smaller file sizes
    quality = 85,
    generateThumbnails = true,
    thumbnailWidth = 200,
    parallelism = 4, // Process 4 pages concurrently
    onProgress,
  } = options;

  // Load PDF
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(pdfBuffer),
    useSystemFonts: true,
  });
  const pdfDoc = await loadingTask.promise;
  const totalPages = pdfDoc.numPages;
  const endPage = maxPages ? Math.min(startPage + maxPages - 1, totalPages) : totalPages;

  // Get PDF info
  const pdfLibDoc = await PDFDocument.load(pdfBuffer);
  const info: PDFInfo = {
    pageCount: totalPages,
    title: pdfLibDoc.getTitle(),
    author: pdfLibDoc.getAuthor(),
    subject: pdfLibDoc.getSubject(),
    keywords: pdfLibDoc.getKeywords(),
  };

  const pages: ProcessedPage[] = [];
  const pageNumbers = Array.from(
    { length: endPage - startPage + 1 },
    (_, i) => startPage + i
  );

  // Process pages in parallel batches
  for (let i = 0; i < pageNumbers.length; i += parallelism) {
    const batch = pageNumbers.slice(i, i + parallelism);
    const batchResults = await Promise.all(
      batch.map((pageNum) =>
        processPage(pdfDoc, pageNum, {
          scale,
          format,
          quality,
          generateThumbnail: generateThumbnails,
          thumbnailWidth,
        })
      )
    );

    pages.push(...batchResults);

    // Report progress
    if (onProgress) {
      onProgress(pages.length, pageNumbers.length);
    }
  }

  return {
    pages,
    info,
    totalPages,
    processedPages: pages.length,
  };
}

/**
 * Save processed pages to disk (for caching/storage)
 */
export async function saveProcessedPages(
  pages: ProcessedPage[],
  outputDir: string,
  baseName: string
): Promise<{
  imageUrls: string[];
  thumbnailUrls: string[];
}> {
  await mkdir(outputDir, { recursive: true });

  const imageUrls: string[] = [];
  const thumbnailUrls: string[] = [];

  for (const page of pages) {
    // Save main image
    const imageName = `${baseName}_page_${page.pageNumber}.${page.contentType.split('/')[1]}`;
    const imagePath = path.join(outputDir, imageName);
    await writeFile(imagePath, page.imageBuffer);
    imageUrls.push(imagePath);

    // Save thumbnail if exists
    if (page.thumbnailBuffer) {
      const thumbName = `${baseName}_page_${page.pageNumber}_thumb.jpg`;
      const thumbPath = path.join(outputDir, thumbName);
      await writeFile(thumbPath, page.thumbnailBuffer);
      thumbnailUrls.push(thumbPath);
    }
  }

  return { imageUrls, thumbnailUrls };
}