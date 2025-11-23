import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { Canvas, createCanvas } from 'canvas';
import { readFile } from 'fs/promises';
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
    scale?: number;
    format?: 'png' | 'jpeg';
    quality?: number;
  } = {}
): Promise<PDFPageImage[]> {
  const {
    maxPages = 10, // Default to first 10 pages to avoid excessive processing
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
    const numPages = Math.min(pdfDoc.numPages, maxPages);
    const images: PDFPageImage[] = [];

    // Process each page
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
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
 */
export async function extractPDFText(pdfBuffer: Buffer, maxPages = 10): Promise<string> {
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(pdfBuffer),
      useSystemFonts: true,
    });
    const pdfDoc = await loadingTask.promise;
    const numPages = Math.min(pdfDoc.numPages, maxPages);
    let fullText = '';

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
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
 */
export async function processPDFForExtraction(
  pdfPath: string | Buffer,
  options: {
    maxPages?: number;
    includeText?: boolean;
  } = {}
): Promise<{
  images: PDFPageImage[];
  text?: string;
  info: PDFInfo;
}> {
  const { maxPages = 10, includeText = true } = options;

  // Read PDF buffer if path is provided
  const pdfBuffer = typeof pdfPath === 'string'
    ? await readFile(pdfPath)
    : pdfPath;

  // Get PDF info
  const info = await getPDFInfo(pdfBuffer);

  // Convert pages to images
  const images = await convertPDFToImages(pdfBuffer, { maxPages });

  // Extract text if requested
  let text: string | undefined;
  if (includeText) {
    text = await extractPDFText(pdfBuffer, maxPages);
  }

  return {
    images,
    text,
    info
  };
}