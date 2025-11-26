/**
 * Vitest Test Setup
 *
 * Global setup for all tests including environment variables and mocks.
 */

import { beforeAll, afterAll, vi } from 'vitest';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Verify required environment variables
beforeAll(() => {
  if (!process.env.GOOGLE_AI_API_KEY) {
    throw new Error('GOOGLE_AI_API_KEY is required for tests');
  }
});

// Clean up after all tests
afterAll(() => {
  vi.restoreAllMocks();
});

// Global test utilities
export const TEST_PROJECT_PATH = path.resolve(__dirname, '../sample_project');

export const SAMPLE_DOCUMENTS = {
  designDrawings: path.join(TEST_PROJECT_PATH, '2032_kenai_rec_center_upgrades_100.pdf'),
  projectManual: path.join(TEST_PROJECT_PATH, 'kenai_rec_center_upgrades_project_manual.pdf'),
  addendum1: path.join(TEST_PROJECT_PATH, 'addendum_1.pdf'),
  addendum2: path.join(TEST_PROJECT_PATH, 'addendum_2.pdf'),
  itb: path.join(TEST_PROJECT_PATH, 'itb_-_2023_rec_center_upgrades.pdf'),
};

// Expected CSI divisions for the Kenai project
export const EXPECTED_CSI_DIVISIONS = [
  '01', // General Requirements
  '02', // Existing Conditions (demo)
  '03', // Concrete
  '07', // Thermal & Moisture Protection (roofing)
  '22', // Plumbing
  '23', // HVAC
  '26', // Electrical
  '31', // Earthwork (Civil)
  '32', // Exterior Improvements
];

// Expected trade names
export const EXPECTED_TRADES = [
  'Civil',
  'Architectural',
  'Mechanical',
  'Electrical',
  'Plumbing',
];

// Helper to check if file exists
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    const fs = await import('fs/promises');
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
