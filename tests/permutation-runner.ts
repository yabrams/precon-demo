/**
 * Comprehensive Permutation Test Runner
 *
 * Tests multiple model combinations and pass configurations to determine
 * the optimal extraction workflow. Includes intelligent caching and
 * detailed HTML reporting.
 */

import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

// Force reload environment variables
dotenv.config({ override: true });

import { GeminiClient } from '../lib/extraction/clients/gemini';
import { ClaudeClient } from '../lib/extraction/clients/claude';
import { OpenAIClient } from '../lib/extraction/clients/openai';
import {
  ExtractionDocument,
  GeminiExtractionResponse,
  GeminiReviewResponse,
  ClaudeValidationResponse,
  ModelIdentifier,
  MODEL_PRICING,
  PassConfig,
  PermutationConfig,
  PassResult,
  PermutationResult,
  PassCacheEntry,
  GeminiRawWorkPackage,
  GeminiAIObservation,
} from '../lib/extraction/types';

// ============================================================================
// CONFIGURATION
// ============================================================================

const PROMPT_VERSION = 'v1.1.0'; // Increment when prompts change
const CACHE_DIR = path.resolve(__dirname, 'comparison-results/cache');
const RUNS_DIR = path.resolve(__dirname, 'comparison-results/runs');
const SAMPLE_PROJECT_PATH = path.resolve(__dirname, '../sample_project');

// Focus trades for Pass 3
const DEFAULT_FOCUS_TRADES = ['Mechanical', 'Electrical', 'Plumbing'];

// ============================================================================
// PERMUTATION CONFIGURATIONS
// ============================================================================

// Filter documents for Claude (100 page limit)
// Only include main drawings PDF which has ~23 pages
const CLAUDE_MAX_PAGES = 100;
const DRAWINGS_ONLY_FILTER = (docs: ExtractionDocument[]): ExtractionDocument[] => {
  // Only include the main drawings PDF for Claude
  return docs.filter(d => d.name.includes('upgrades_100.pdf'));
};

const PERMUTATION_CONFIGS: PermutationConfig[] = [
  // === BASELINE TESTS (Single Model, Minimal Passes) ===
  {
    id: 'G25_P1',
    name: 'Gemini 2.5 Pro - Pass 1 Only',
    description: 'Baseline single pass with Gemini 2.5 Pro',
    passes: [
      { passNumber: 1, model: 'gemini-2.5-pro', purpose: 'initial_extraction', dependsOnPasses: [] },
    ],
    expectedCost: 0.20,
  },
  {
    id: 'CS_P1',
    name: 'Claude Sonnet 4.5 - Pass 1 Only (drawings only)',
    description: 'Baseline single pass with Claude Sonnet 4.5 - limited to main drawings due to 100 page limit',
    passes: [
      { passNumber: 1, model: 'claude-sonnet-4.5', purpose: 'initial_extraction', dependsOnPasses: [] },
    ],
    expectedCost: 0.80,
  },

  // === TWO-PASS TESTS (Same Model Self-Review) ===
  {
    id: 'G25_P1P2',
    name: 'Gemini 2.5 Pro - Pass 1+2',
    description: 'Gemini 2.5 with self-review',
    passes: [
      { passNumber: 1, model: 'gemini-2.5-pro', purpose: 'initial_extraction', dependsOnPasses: [] },
      { passNumber: 2, model: 'gemini-2.5-pro', purpose: 'self_review', dependsOnPasses: [1] },
    ],
    expectedCost: 0.35,
  },
  {
    id: 'CS_P1P2',
    name: 'Claude Sonnet 4.5 - Pass 1+2',
    description: 'Claude Sonnet with self-review',
    passes: [
      { passNumber: 1, model: 'claude-sonnet-4.5', purpose: 'initial_extraction', dependsOnPasses: [] },
      { passNumber: 2, model: 'claude-sonnet-4.5', purpose: 'self_review', dependsOnPasses: [1] },
    ],
    expectedCost: 1.50,
  },

  // === THREE-PASS TESTS (With Trade Deep-Dive) ===
  {
    id: 'G25_P1P2P3',
    name: 'Gemini 2.5 Pro - Full 3-Pass',
    description: 'Gemini 2.5 with self-review and trade deep-dive',
    passes: [
      { passNumber: 1, model: 'gemini-2.5-pro', purpose: 'initial_extraction', dependsOnPasses: [] },
      { passNumber: 2, model: 'gemini-2.5-pro', purpose: 'self_review', dependsOnPasses: [1] },
      { passNumber: 3, model: 'gemini-2.5-pro', purpose: 'trade_deep_dive', dependsOnPasses: [1, 2] },
    ],
    expectedCost: 0.50,
  },

  // === CROSS-MODEL VALIDATION ===
  {
    id: 'G25_CS_VAL',
    name: 'Gemini + Claude Validation',
    description: 'Gemini extracts (P1+P2), Claude validates (P4)',
    passes: [
      { passNumber: 1, model: 'gemini-2.5-pro', purpose: 'initial_extraction', dependsOnPasses: [] },
      { passNumber: 2, model: 'gemini-2.5-pro', purpose: 'self_review', dependsOnPasses: [1] },
      { passNumber: 4, model: 'claude-sonnet-4.5', purpose: 'cross_validation', dependsOnPasses: [1, 2] },
    ],
    expectedCost: 1.20,
  },
  {
    id: 'CS_G25_VAL',
    name: 'Claude + Gemini Validation',
    description: 'Claude extracts (P1+P2), Gemini validates (P4)',
    passes: [
      { passNumber: 1, model: 'claude-sonnet-4.5', purpose: 'initial_extraction', dependsOnPasses: [] },
      { passNumber: 2, model: 'claude-sonnet-4.5', purpose: 'self_review', dependsOnPasses: [1] },
      { passNumber: 4, model: 'gemini-2.5-pro', purpose: 'cross_validation', dependsOnPasses: [1, 2] },
    ],
    expectedCost: 1.80,
  },

  // === FULL 5-PASS WORKFLOW ===
  {
    id: 'G25_FULL5',
    name: 'Gemini 2.5 Full 5-Pass',
    description: 'Complete workflow: Extract→Review→DeepDive→CrossVal→Final',
    passes: [
      { passNumber: 1, model: 'gemini-2.5-pro', purpose: 'initial_extraction', dependsOnPasses: [] },
      { passNumber: 2, model: 'gemini-2.5-pro', purpose: 'self_review', dependsOnPasses: [1] },
      { passNumber: 3, model: 'gemini-2.5-pro', purpose: 'trade_deep_dive', dependsOnPasses: [1, 2] },
      { passNumber: 4, model: 'claude-sonnet-4.5', purpose: 'cross_validation', dependsOnPasses: [1, 2, 3] },
      { passNumber: 5, model: 'gemini-2.5-pro', purpose: 'final_validation', dependsOnPasses: [1, 2, 3, 4] },
    ],
    expectedCost: 2.50,
  },
  {
    id: 'HYBRID_FULL5',
    name: 'Hybrid Full 5-Pass',
    description: 'Alternating models for maximum coverage',
    passes: [
      { passNumber: 1, model: 'gemini-2.5-pro', purpose: 'initial_extraction', dependsOnPasses: [] },
      { passNumber: 2, model: 'claude-sonnet-4.5', purpose: 'self_review', dependsOnPasses: [1] },
      { passNumber: 3, model: 'gemini-2.5-pro', purpose: 'trade_deep_dive', dependsOnPasses: [1, 2] },
      { passNumber: 4, model: 'claude-sonnet-4.5', purpose: 'cross_validation', dependsOnPasses: [1, 2, 3] },
      { passNumber: 5, model: 'gemini-2.5-pro', purpose: 'final_validation', dependsOnPasses: [1, 2, 3, 4] },
    ],
    expectedCost: 3.50,
  },

  // === OPENAI GPT-4o TESTS ===
  {
    id: 'GPT4O_P1',
    name: 'GPT-4o - Pass 1 Only',
    description: 'Baseline single pass with GPT-4o',
    passes: [
      { passNumber: 1, model: 'gpt-4o', purpose: 'initial_extraction', dependsOnPasses: [] },
    ],
    expectedCost: 0.50,
  },
  {
    id: 'GPT4O_P1P2',
    name: 'GPT-4o - Pass 1+2',
    description: 'GPT-4o with self-review',
    passes: [
      { passNumber: 1, model: 'gpt-4o', purpose: 'initial_extraction', dependsOnPasses: [] },
      { passNumber: 2, model: 'gpt-4o', purpose: 'self_review', dependsOnPasses: [1] },
    ],
    expectedCost: 1.00,
  },

  // === TRI-MODEL COMPARISON (Same Pass 1 - Different Models) ===
  // This lets us compare how different models interpret the same document

  // === CROSS-MODEL VALIDATION WITH OPENAI ===
  {
    id: 'G25_GPT4O_VAL',
    name: 'Gemini + GPT-4o Validation',
    description: 'Gemini extracts (P1+P2), GPT-4o validates (P4)',
    passes: [
      { passNumber: 1, model: 'gemini-2.5-pro', purpose: 'initial_extraction', dependsOnPasses: [] },
      { passNumber: 2, model: 'gemini-2.5-pro', purpose: 'self_review', dependsOnPasses: [1] },
      { passNumber: 4, model: 'gpt-4o', purpose: 'cross_validation', dependsOnPasses: [1, 2] },
    ],
    expectedCost: 1.00,
  },
  {
    id: 'GPT4O_G25_VAL',
    name: 'GPT-4o + Gemini Validation',
    description: 'GPT-4o extracts (P1+P2), Gemini validates (P4)',
    passes: [
      { passNumber: 1, model: 'gpt-4o', purpose: 'initial_extraction', dependsOnPasses: [] },
      { passNumber: 2, model: 'gpt-4o', purpose: 'self_review', dependsOnPasses: [1] },
      { passNumber: 4, model: 'gemini-2.5-pro', purpose: 'cross_validation', dependsOnPasses: [1, 2] },
    ],
    expectedCost: 1.20,
  },

  // === TRIPLE-MODEL VALIDATION ===
  {
    id: 'TRIPLE_VAL',
    name: 'Triple Model Validation',
    description: 'Gemini extracts, Claude reviews, GPT-4o validates',
    passes: [
      { passNumber: 1, model: 'gemini-2.5-pro', purpose: 'initial_extraction', dependsOnPasses: [] },
      { passNumber: 2, model: 'claude-sonnet-4.5', purpose: 'self_review', dependsOnPasses: [1] },
      { passNumber: 4, model: 'gpt-4o', purpose: 'cross_validation', dependsOnPasses: [1, 2] },
    ],
    expectedCost: 1.50,
  },
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function generateHash(data: string): string {
  return crypto.createHash('md5').update(data).digest('hex').substring(0, 16);
}

function generateCacheKey(
  passNumber: number,
  model: ModelIdentifier,
  purpose: string,
  documentHash: string,
  previousPassHashes: string[]
): string {
  const keyData = JSON.stringify({
    passNumber,
    model,
    purpose,
    documentHash,
    previousPassHashes,
    promptVersion: PROMPT_VERSION,
  });
  return generateHash(keyData);
}

async function loadFromCache(cacheKey: string): Promise<PassCacheEntry | null> {
  try {
    const cachePath = path.join(CACHE_DIR, `${cacheKey}.json`);
    const data = await readFile(cachePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function saveToCache(entry: PassCacheEntry): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  const cachePath = path.join(CACHE_DIR, `${entry.cacheKey}.json`);
  await writeFile(cachePath, JSON.stringify(entry, null, 2));
}

function calculateCost(model: ModelIdentifier, tokens: { input: number; output: number }): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;
  return (tokens.input * pricing.input + tokens.output * pricing.output) / 1_000_000;
}

async function loadDocuments(): Promise<{ documents: ExtractionDocument[]; hash: string }> {
  const files = await readdir(SAMPLE_PROJECT_PATH);
  const pdfFiles = files.filter(f => f.endsWith('.pdf'));

  const documents: ExtractionDocument[] = [];
  const hashParts: string[] = [];

  for (const file of pdfFiles) {
    const filePath = path.join(SAMPLE_PROJECT_PATH, file);
    const buffer = await readFile(filePath);
    hashParts.push(generateHash(buffer.toString('base64').substring(0, 10000)));

    documents.push({
      id: file,
      name: file,
      url: filePath,
      type: 'design_drawings',
      mimeType: 'application/pdf',
    });
  }

  return {
    documents,
    hash: generateHash(hashParts.join('-')),
  };
}

// ============================================================================
// PASS EXECUTION
// ============================================================================

async function executePass(
  passConfig: PassConfig,
  documents: ExtractionDocument[],
  documentHash: string,
  previousResults: Map<number, PassResult>
): Promise<PassResult> {
  const { passNumber, model, purpose } = passConfig;

  // Build cache key from dependent passes
  const previousPassHashes = passConfig.dependsOnPasses.map(p => {
    const prev = previousResults.get(p);
    return prev ? generateHash(JSON.stringify(prev.response)) : '';
  });

  const cacheKey = generateCacheKey(passNumber, model, purpose, documentHash, previousPassHashes);

  // Check cache
  const cached = await loadFromCache(cacheKey);
  if (cached) {
    console.log(`  ✓ Cache hit for Pass ${passNumber} (${model})`);
    return { ...cached.result, cacheHit: true };
  }

  console.log(`  → Running Pass ${passNumber} (${model}) - ${purpose}...`);
  const startTime = Date.now();

  let response: GeminiExtractionResponse | GeminiReviewResponse | ClaudeValidationResponse;
  let tokensUsed: { input: number; output: number };

  const isGemini = model.startsWith('gemini');
  const isOpenAI = model.startsWith('gpt-') || model === 'o1';
  const isClaude = model.startsWith('claude');

  // Filter documents for Claude due to 100-page PDF limit
  // OpenAI also has context limits, so use filtered docs for non-Gemini
  const docsToUse = isGemini ? documents : DRAWINGS_ONLY_FILTER(documents);
  if (!isGemini && docsToUse.length < documents.length) {
    console.log(`    (filtered to ${docsToUse.length} docs for ${isOpenAI ? 'OpenAI' : 'Claude'} context limit)`);
  }

  if (isGemini) {
    const geminiClient = new GeminiClient({ model: model === 'gemini-2.5-pro' ? 'gemini-2.5-pro' : 'gemini-3-pro-preview' });

    if (purpose === 'initial_extraction') {
      const result = await geminiClient.extractWorkPackages(documents);
      response = result.response;
      tokensUsed = result.tokensUsed;
    } else if (purpose === 'self_review') {
      const prevResult = previousResults.get(passNumber - 1);
      if (!prevResult) throw new Error(`Missing previous result for pass ${passNumber}`);
      // Handle array-wrapped responses
      let prevResponse = prevResult.response as GeminiExtractionResponse;
      if (Array.isArray(prevResponse)) prevResponse = prevResponse[0] as GeminiExtractionResponse;
      const result = await geminiClient.reviewExtraction(documents, prevResponse);
      response = result.response;
      tokensUsed = result.tokensUsed;
    } else if (purpose === 'trade_deep_dive') {
      const merged = mergeExtractionResults(previousResults);
      const result = await geminiClient.tradeDeepDive(documents, merged, DEFAULT_FOCUS_TRADES);
      response = result.response;
      tokensUsed = result.tokensUsed;
    } else if (purpose === 'cross_validation') {
      const merged = mergeExtractionResults(previousResults);
      const result = await geminiClient.crossValidation(documents, merged);
      response = result.response;
      tokensUsed = result.tokensUsed;
    } else if (purpose === 'final_validation') {
      const merged = mergeExtractionResults(previousResults);
      const observationsStr = collectObservationsAsString(previousResults);
      const result = await geminiClient.finalValidation(documents, merged, observationsStr);
      response = result.response;
      tokensUsed = result.tokensUsed;
    } else {
      throw new Error(`Unknown purpose: ${purpose}`);
    }
  } else if (isOpenAI) {
    // OpenAI GPT-4o
    const openaiClient = new OpenAIClient({ model });

    if (purpose === 'initial_extraction') {
      const result = await openaiClient.extractWorkPackages(docsToUse);
      response = result.response;
      tokensUsed = result.tokensUsed;
    } else if (purpose === 'self_review') {
      const prevResult = previousResults.get(passNumber - 1);
      if (!prevResult) throw new Error(`Missing previous result for pass ${passNumber}`);
      let prevResponse = prevResult.response as GeminiExtractionResponse;
      if (Array.isArray(prevResponse)) prevResponse = prevResponse[0] as GeminiExtractionResponse;
      const result = await openaiClient.selfReview(docsToUse, prevResponse);
      response = result.response;
      tokensUsed = result.tokensUsed;
    } else if (purpose === 'trade_deep_dive') {
      const merged = mergeExtractionResults(previousResults);
      const result = await openaiClient.tradeDeepDive(docsToUse, merged, DEFAULT_FOCUS_TRADES);
      response = result.response;
      tokensUsed = result.tokensUsed;
    } else if (purpose === 'cross_validation') {
      const merged = mergeExtractionResults(previousResults);
      const result = await openaiClient.crossValidation(docsToUse, merged);
      response = result.response;
      tokensUsed = result.tokensUsed;
    } else if (purpose === 'final_validation') {
      const merged = mergeExtractionResults(previousResults);
      const observations = collectObservations(previousResults);
      const result = await openaiClient.finalValidation(docsToUse, merged, observations);
      response = result.response;
      tokensUsed = result.tokensUsed;
    } else {
      throw new Error(`Unknown purpose: ${purpose}`);
    }
  } else {
    // Claude - use filtered documents due to 100-page limit
    const claudeClient = new ClaudeClient();

    if (purpose === 'initial_extraction') {
      const result = await claudeClient.extractWorkPackages(docsToUse);
      response = result.response;
      tokensUsed = result.tokensUsed;
    } else if (purpose === 'self_review') {
      const prevResult = previousResults.get(passNumber - 1);
      if (!prevResult) throw new Error(`Missing previous result for pass ${passNumber}`);
      // Handle array-wrapped responses
      let prevResponse = prevResult.response as GeminiExtractionResponse;
      if (Array.isArray(prevResponse)) prevResponse = prevResponse[0] as GeminiExtractionResponse;
      const result = await claudeClient.reviewExtraction(docsToUse, prevResponse);
      response = result.response;
      tokensUsed = result.tokensUsed;
    } else if (purpose === 'trade_deep_dive') {
      const merged = mergeExtractionResults(previousResults);
      const result = await claudeClient.tradeDeepDive(docsToUse, merged, DEFAULT_FOCUS_TRADES);
      response = result.response;
      tokensUsed = result.tokensUsed;
    } else if (purpose === 'cross_validation') {
      const merged = mergeExtractionResults(previousResults);
      const result = await claudeClient.crossValidation(docsToUse, merged);
      response = result.response;
      tokensUsed = result.tokensUsed;
    } else if (purpose === 'final_validation') {
      const merged = mergeExtractionResults(previousResults);
      const observationsStr = collectObservationsAsString(previousResults);
      const result = await claudeClient.finalValidation(docsToUse, merged, observationsStr);
      response = result.response;
      tokensUsed = result.tokensUsed;
    } else {
      throw new Error(`Unknown purpose: ${purpose}`);
    }
  }

  const completedAt = new Date();
  const durationMs = Date.now() - startTime;
  const cost = calculateCost(model, tokensUsed);

  const passResult: PassResult = {
    passNumber,
    model,
    purpose,
    startedAt: new Date(startTime),
    completedAt,
    durationMs,
    tokensUsed,
    cost,
    response,
    cacheHit: false,
    cacheKey,
  };

  // Save to cache
  const cacheEntry: PassCacheEntry = {
    cacheKey,
    passNumber,
    model,
    purpose,
    documentHash,
    previousPassHashes,
    promptVersion: PROMPT_VERSION,
    result: passResult,
    createdAt: new Date(),
  };
  await saveToCache(cacheEntry);

  console.log(`  ✓ Pass ${passNumber} complete: ${tokensUsed.input}+${tokensUsed.output} tokens, $${cost.toFixed(4)}, ${(durationMs / 1000).toFixed(1)}s`);

  return passResult;
}

// ============================================================================
// RESULT MERGING
// ============================================================================

function mergeExtractionResults(results: Map<number, PassResult>): GeminiExtractionResponse {
  const pass1 = results.get(1);
  if (!pass1) {
    return { project_name: undefined, work_packages: [] };
  }

  // Handle array-wrapped responses
  let pass1Response = pass1.response as GeminiExtractionResponse;
  if (Array.isArray(pass1Response)) {
    pass1Response = pass1Response[0] as GeminiExtractionResponse;
  }

  const merged: GeminiExtractionResponse = { ...pass1Response };
  const workPackageMap = new Map<string, GeminiRawWorkPackage>();

  // Initialize from Pass 1
  for (const wp of merged.work_packages || []) {
    workPackageMap.set(wp.packageId, { ...wp });
  }

  // Apply additions/modifications from subsequent passes
  for (const [passNum, result] of results.entries()) {
    if (passNum === 1) continue;

    const reviewResponse = result.response as GeminiReviewResponse;

    // Apply additions
    if (reviewResponse.additions) {
      for (const addition of reviewResponse.additions) {
        const targetPackage = workPackageMap.get(addition.work_package);
        if (targetPackage) {
          targetPackage.line_items = targetPackage.line_items || [];
          targetPackage.line_items.push({
            item_number: addition.item_number || undefined,
            description: addition.description,
            action: addition.action,
            quantity: addition.quantity,
            unit: addition.unit,
            specifications: addition.specifications,
            notes: addition.notes,
            source_reference: addition.source_reference,
          });
        }
      }
    }

    // Add new packages
    if (reviewResponse.new_packages) {
      for (const newPkg of reviewResponse.new_packages) {
        if (!workPackageMap.has(newPkg.packageId)) {
          workPackageMap.set(newPkg.packageId, newPkg);
        }
      }
    }
  }

  merged.work_packages = Array.from(workPackageMap.values());
  return merged;
}

function collectObservations(results: Map<number, PassResult>): GeminiAIObservation[] {
  const observations: GeminiAIObservation[] = [];

  for (const [, result] of results.entries()) {
    const resp = result.response as GeminiExtractionResponse | GeminiReviewResponse;
    const obs = resp.ai_observations || (resp as GeminiReviewResponse).ai_observations;

    if (obs && Array.isArray(obs)) {
      observations.push(...obs);
    }
  }

  return observations;
}

function collectObservationsAsString(results: Map<number, PassResult>): string {
  const observations: string[] = [];

  for (const [passNum, result] of results.entries()) {
    const resp = result.response as GeminiExtractionResponse | GeminiReviewResponse;
    const obs = resp.ai_observations || (resp as GeminiReviewResponse).ai_observations;

    if (obs && Array.isArray(obs)) {
      for (const o of obs) {
        observations.push(`[Pass ${passNum}] ${o.severity?.toUpperCase() || 'INFO'}: ${o.title} - ${o.insight}`);
      }
    }
  }

  return observations.join('\n\n');
}

// ============================================================================
// PERMUTATION RUNNER
// ============================================================================

async function runPermutation(
  config: PermutationConfig,
  documents: ExtractionDocument[],
  documentHash: string
): Promise<PermutationResult> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Running: ${config.name}`);
  console.log(`${config.description}`);
  console.log(`${'='.repeat(60)}`);

  const startedAt = new Date();
  const passResults: PassResult[] = [];
  const resultMap = new Map<number, PassResult>();
  let totalCost = 0;
  let totalTokens = { input: 0, output: 0 };
  let cacheHits = 0;
  let apiCalls = 0;

  for (const passConfig of config.passes) {
    try {
      const result = await executePass(passConfig, documents, documentHash, resultMap);
      passResults.push(result);
      resultMap.set(passConfig.passNumber, result);

      totalCost += result.cost;
      totalTokens.input += result.tokensUsed.input;
      totalTokens.output += result.tokensUsed.output;
      if (result.cacheHit) cacheHits++;
      else apiCalls++;
    } catch (error) {
      console.error(`  ✗ Pass ${passConfig.passNumber} failed:`, error);
      throw error;
    }
  }

  const completedAt = new Date();
  const merged = mergeExtractionResults(resultMap);

  // Count results
  const totalLineItems = (merged.work_packages || []).reduce(
    (sum, wp) => sum + (wp.line_items?.length || 0), 0
  );
  const allObservations: GeminiAIObservation[] = [];
  for (const result of passResults) {
    const resp = result.response as GeminiExtractionResponse | GeminiReviewResponse;
    if (resp.ai_observations) {
      allObservations.push(...resp.ai_observations);
    }
  }

  const permResult: PermutationResult = {
    permutationId: config.id,
    permutationName: config.name,
    config,
    documentHash,
    passes: passResults,
    finalResult: {
      workPackages: merged.work_packages || [],
      observations: allObservations,
      totalLineItems,
      totalObservations: allObservations.length,
    },
    metrics: {
      totalDurationMs: completedAt.getTime() - startedAt.getTime(),
      totalTokens,
      totalCost,
      cacheHits,
      apiCalls,
    },
    startedAt,
    completedAt,
  };

  console.log(`\n✓ ${config.name} complete:`);
  console.log(`  - Line items: ${totalLineItems}`);
  console.log(`  - Observations: ${allObservations.length}`);
  console.log(`  - Total cost: $${totalCost.toFixed(4)}`);
  console.log(`  - Duration: ${((completedAt.getTime() - startedAt.getTime()) / 1000).toFixed(1)}s`);
  console.log(`  - Cache hits: ${cacheHits}/${passResults.length}`);

  return permResult;
}

// ============================================================================
// HTML REPORT GENERATION
// ============================================================================

function generateHTMLReport(results: PermutationResult[]): string {
  const timestamp = new Date().toISOString();
  const totalCost = results.reduce((sum, r) => sum + r.metrics.totalCost, 0);
  const totalCacheHits = results.reduce((sum, r) => sum + r.metrics.cacheHits, 0);
  const totalAPICalls = results.reduce((sum, r) => sum + r.metrics.apiCalls, 0);

  // Find unique line items across all permutations
  const allLineItems = new Map<string, { description: string; byPerm: Map<string, { found: boolean; qty?: number; unit?: string; pass?: number }> }>();
  const allObservations = new Map<string, { title: string; byPerm: Map<string, { found: boolean; severity?: string; pass?: number }> }>();

  for (const result of results) {
    for (const wp of result.finalResult.workPackages) {
      for (const item of wp.line_items || []) {
        const key = `${wp.packageId}.${item.item_number || item.description.substring(0, 30)}`;
        if (!allLineItems.has(key)) {
          allLineItems.set(key, { description: item.description, byPerm: new Map() });
        }
        allLineItems.get(key)!.byPerm.set(result.permutationId, {
          found: true,
          qty: item.quantity ?? undefined,
          unit: item.unit ?? undefined,
        });
      }
    }

    for (const obs of result.finalResult.observations || []) {
      if (!obs || !obs.title) continue;
      const key = obs.title.substring(0, 50);
      if (!allObservations.has(key)) {
        allObservations.set(key, { title: obs.title, byPerm: new Map() });
      }
      allObservations.get(key)!.byPerm.set(result.permutationId, {
        found: true,
        severity: obs.severity,
      });
    }
  }

  // Calculate incremental value
  const incrementalAnalysis = results.map(r => {
    const passCosts = r.passes.map((p, i) => ({
      passNumber: p.passNumber,
      purpose: p.purpose,
      model: p.model,
      cost: p.cost,
      newItems: i === 0 ? r.finalResult.totalLineItems :
        ((r.passes[i].response as GeminiReviewResponse).additions?.length || 0),
      cacheHit: p.cacheHit,
    }));
    return { permutationId: r.permutationId, passCosts };
  });

  // Generate recommendations
  const recommendations: string[] = [];

  // Best single-pass value
  const singlePass = results.filter(r => r.passes.length === 1);
  if (singlePass.length > 0) {
    const best = singlePass.reduce((a, b) =>
      (a.finalResult.totalLineItems / Math.max(a.metrics.totalCost, 0.01)) >
      (b.finalResult.totalLineItems / Math.max(b.metrics.totalCost, 0.01)) ? a : b
    );
    recommendations.push(`<strong>Best single-pass value:</strong> ${best.permutationName} - ${best.finalResult.totalLineItems} items at $${best.metrics.totalCost.toFixed(2)}`);
  }

  // Best multi-pass value
  const multiPass = results.filter(r => r.passes.length > 1);
  if (multiPass.length > 0) {
    const bestMulti = multiPass.reduce((a, b) =>
      a.finalResult.totalLineItems > b.finalResult.totalLineItems ? a : b
    );
    recommendations.push(`<strong>Most comprehensive:</strong> ${bestMulti.permutationName} - ${bestMulti.finalResult.totalLineItems} items`);
  }

  // Cross-model benefit
  const crossModel = results.filter(r => {
    const models = new Set(r.passes.map(p => p.model));
    return models.size > 1;
  });
  if (crossModel.length > 0) {
    const bestCross = crossModel.reduce((a, b) =>
      a.finalResult.totalLineItems > b.finalResult.totalLineItems ? a : b
    );
    recommendations.push(`<strong>Best cross-model:</strong> ${bestCross.permutationName} - leverages multiple models for ${bestCross.finalResult.totalLineItems} items`);
  }

  // Pass value analysis
  const pass2Value = results.filter(r => r.passes.length >= 2);
  if (pass2Value.length > 0) {
    const avgP1Items = pass2Value.reduce((sum, r) => {
      const p1Resp = r.passes[0].response as GeminiExtractionResponse;
      return sum + (p1Resp.work_packages?.reduce((s, wp) => s + (wp.line_items?.length || 0), 0) || 0);
    }, 0) / pass2Value.length;
    const avgP2Additions = pass2Value.reduce((sum, r) => {
      const p2Resp = r.passes[1]?.response as GeminiReviewResponse;
      return sum + (p2Resp?.additions?.length || 0);
    }, 0) / pass2Value.length;
    if (avgP2Additions > 0) {
      recommendations.push(`<strong>Pass 2 value:</strong> Self-review adds ~${avgP2Additions.toFixed(1)} items on average (${((avgP2Additions / avgP1Items) * 100).toFixed(1)}% improvement)`);
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Extraction Permutation Comparison Report</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 20px;
      background: #f5f5f5;
      color: #333;
    }
    .container { max-width: 1800px; margin: 0 auto; }
    h1 { color: #1a1a1a; border-bottom: 3px solid #2563eb; padding-bottom: 10px; }
    h2 { color: #374151; margin-top: 30px; }
    h3 { color: #4b5563; }
    .card {
      background: white;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 15px;
    }
    .metric {
      background: #f8fafc;
      padding: 15px;
      border-radius: 6px;
      text-align: center;
    }
    .metric-value { font-size: 28px; font-weight: bold; color: #2563eb; }
    .metric-label { color: #6b7280; font-size: 14px; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th, td {
      padding: 8px 12px;
      text-align: left;
      border: 1px solid #e5e7eb;
    }
    th {
      background: #f3f4f6;
      font-weight: 600;
      position: sticky;
      top: 0;
    }
    tr:nth-child(even) { background: #f9fafb; }
    tr:hover { background: #f0f9ff; }
    .found { color: #059669; font-weight: 500; }
    .missing { color: #dc2626; }
    .severity-critical { background: #fef2f2; color: #991b1b; }
    .severity-warning { background: #fffbeb; color: #92400e; }
    .severity-info { background: #eff6ff; color: #1e40af; }
    .recommendation {
      background: #ecfdf5;
      border-left: 4px solid #059669;
      padding: 12px 16px;
      margin: 10px 0;
      border-radius: 0 6px 6px 0;
    }
    .cost { color: #059669; font-weight: 500; }
    .comparison-scroll {
      overflow-x: auto;
      max-height: 600px;
      overflow-y: auto;
    }
    .description-col { max-width: 300px; word-wrap: break-word; }
    .timestamp { color: #9ca3af; font-size: 12px; }
    .pass-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      margin: 2px;
    }
    .pass-gemini { background: #dbeafe; color: #1e40af; }
    .pass-claude { background: #fce7f3; color: #9d174d; }
    .collapsible { cursor: pointer; }
    .collapsible:after { content: ' ▼'; font-size: 10px; }
    .collapsible.active:after { content: ' ▲'; }
    .content { display: none; padding: 10px 0; }
    .content.show { display: block; }
    .work-package {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      margin: 10px 0;
      padding: 15px;
    }
    .work-package h4 {
      margin: 0 0 10px 0;
      color: #1e40af;
    }
    .line-item {
      padding: 8px;
      margin: 5px 0;
      background: #f9fafb;
      border-radius: 4px;
      font-size: 13px;
    }
    .observation {
      padding: 10px;
      margin: 5px 0;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔬 Extraction Permutation Comparison Report</h1>
    <p class="timestamp">Generated: ${timestamp}</p>

    <div class="card">
      <h2>📊 Executive Summary</h2>
      <div class="metrics-grid">
        <div class="metric">
          <div class="metric-value">${results.length}</div>
          <div class="metric-label">Permutations Tested</div>
        </div>
        <div class="metric">
          <div class="metric-value">${allLineItems.size}</div>
          <div class="metric-label">Unique Line Items</div>
        </div>
        <div class="metric">
          <div class="metric-value">${allObservations.size}</div>
          <div class="metric-label">Unique Observations</div>
        </div>
        <div class="metric">
          <div class="metric-value">$${totalCost.toFixed(2)}</div>
          <div class="metric-label">Total Cost</div>
        </div>
        <div class="metric">
          <div class="metric-value">${totalCacheHits}</div>
          <div class="metric-label">Cache Hits</div>
        </div>
        <div class="metric">
          <div class="metric-value">${totalAPICalls}</div>
          <div class="metric-label">API Calls</div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>💡 Recommendations</h2>
      ${recommendations.map(r => `<div class="recommendation">${r}</div>`).join('')}
    </div>

    <div class="card">
      <h2>📈 Permutation Results Summary</h2>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Passes</th>
            <th>Line Items</th>
            <th>Observations</th>
            <th>Cost</th>
            <th>Duration</th>
            <th>Cache/API</th>
            <th>Items/$</th>
          </tr>
        </thead>
        <tbody>
          ${results.map(r => `
            <tr>
              <td><strong>${r.permutationId}</strong></td>
              <td>${r.permutationName}</td>
              <td>${r.passes.map(p =>
                `<span class="pass-badge ${p.model.startsWith('gemini') ? 'pass-gemini' : 'pass-claude'}">P${p.passNumber}:${p.model.split('-')[0]}</span>`
              ).join('')}</td>
              <td><strong>${r.finalResult.totalLineItems}</strong></td>
              <td>${r.finalResult.totalObservations}</td>
              <td class="cost">$${r.metrics.totalCost.toFixed(4)}</td>
              <td>${(r.metrics.totalDurationMs / 1000).toFixed(1)}s</td>
              <td>${r.metrics.cacheHits}/${r.metrics.apiCalls}</td>
              <td>${(r.finalResult.totalLineItems / Math.max(r.metrics.totalCost, 0.01)).toFixed(1)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="card">
      <h2>🔄 Incremental Value Analysis</h2>
      <p>Shows what each pass adds to the extraction</p>
      <table>
        <thead>
          <tr>
            <th>Permutation</th>
            <th>Pass</th>
            <th>Model</th>
            <th>Purpose</th>
            <th>Items Added</th>
            <th>Cost</th>
            <th>Cached</th>
          </tr>
        </thead>
        <tbody>
          ${incrementalAnalysis.flatMap(a =>
            a.passCosts.map((p, i) => `
              <tr>
                ${i === 0 ? `<td rowspan="${a.passCosts.length}"><strong>${a.permutationId}</strong></td>` : ''}
                <td>Pass ${p.passNumber}</td>
                <td><span class="pass-badge ${p.model.startsWith('gemini') ? 'pass-gemini' : 'pass-claude'}">${p.model}</span></td>
                <td>${p.purpose.replace(/_/g, ' ')}</td>
                <td>${i === 0 ? '(base)' : `+${p.newItems}`}</td>
                <td class="cost">$${p.cost.toFixed(4)}</td>
                <td>${p.cacheHit ? '✓' : '✗'}</td>
              </tr>
            `)
          ).join('')}
        </tbody>
      </table>
    </div>

    <div class="card">
      <h2>📋 Line Item Comparison</h2>
      <p>Shows which line items were found by each permutation</p>
      <div class="comparison-scroll">
        <table>
          <thead>
            <tr>
              <th>Item Key</th>
              <th class="description-col">Description</th>
              ${results.map(r => `<th>${r.permutationId}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${Array.from(allLineItems.entries()).slice(0, 100).map(([key, data]) => `
              <tr>
                <td><code>${key}</code></td>
                <td class="description-col">${data.description.substring(0, 80)}${data.description.length > 80 ? '...' : ''}</td>
                ${results.map(r => {
                  const found = data.byPerm.get(r.permutationId);
                  if (found?.found) {
                    const qtyStr = found.qty ? ` (${found.qty}${found.unit ? ' ' + found.unit : ''})` : '';
                    return `<td class="found">✓${qtyStr}</td>`;
                  }
                  return `<td class="missing">✗</td>`;
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <h2>⚠️ AI Observations Comparison</h2>
      <div class="comparison-scroll">
        <table>
          <thead>
            <tr>
              <th>Observation</th>
              ${results.map(r => `<th>${r.permutationId}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${Array.from(allObservations.entries()).map(([key, data]) => `
              <tr>
                <td>${data.title}</td>
                ${results.map(r => {
                  const found = data.byPerm.get(r.permutationId);
                  if (found?.found) {
                    const sevClass = found.severity ? `severity-${found.severity}` : '';
                    return `<td class="found ${sevClass}">${found.severity?.toUpperCase() || '✓'}</td>`;
                  }
                  return `<td class="missing">-</td>`;
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    ${results.map(r => `
    <div class="card">
      <h2 class="collapsible" onclick="this.classList.toggle('active'); this.nextElementSibling.classList.toggle('show');">
        📦 ${r.permutationName} - Detailed Results
      </h2>
      <div class="content">
        <h3>Work Packages (${r.finalResult.workPackages.length})</h3>
        ${r.finalResult.workPackages.map(wp => `
          <div class="work-package">
            <h4>${wp.packageId}: ${wp.name}</h4>
            <p><strong>Trade:</strong> ${wp.trade} | <strong>CSI:</strong> ${wp.csi_division}</p>
            ${wp.line_items?.slice(0, 10).map(item => `
              <div class="line-item">
                <strong>${item.item_number || '-'}</strong>: ${item.description}
                ${item.quantity ? `| Qty: ${item.quantity} ${item.unit || ''}` : ''}
                ${item.source_reference?.sheet ? `| Sheet: ${item.source_reference.sheet}` : ''}
              </div>
            `).join('') || '<p>No line items</p>'}
            ${(wp.line_items?.length || 0) > 10 ? `<p><em>... and ${(wp.line_items?.length || 0) - 10} more items</em></p>` : ''}
          </div>
        `).join('')}

        <h3>AI Observations (${r.finalResult.observations.length})</h3>
        ${r.finalResult.observations.slice(0, 10).map(obs => `
          <div class="observation severity-${obs.severity || 'info'}">
            <strong>${obs.severity?.toUpperCase() || 'INFO'}:</strong> ${obs.title}<br>
            <small>${obs.insight?.substring(0, 200) || ''}${(obs.insight?.length || 0) > 200 ? '...' : ''}</small>
          </div>
        `).join('')}
        ${r.finalResult.observations.length > 10 ? `<p><em>... and ${r.finalResult.observations.length - 10} more observations</em></p>` : ''}
      </div>
    </div>
    `).join('')}

    <div class="card">
      <h2>📝 Test Configuration</h2>
      <pre>${JSON.stringify({ PROMPT_VERSION, timestamp, permutationsRun: results.map(r => r.permutationId) }, null, 2)}</pre>
    </div>
  </div>

  <script>
    // Make all collapsibles work
    document.querySelectorAll('.collapsible').forEach(el => {
      el.addEventListener('click', function() {
        this.classList.toggle('active');
        const content = this.nextElementSibling;
        content.classList.toggle('show');
      });
    });
  </script>
</body>
</html>`;
}

// ============================================================================
// MAIN RUNNER
// ============================================================================

async function main() {
  console.log('='.repeat(60));
  console.log('COMPREHENSIVE PERMUTATION TEST RUNNER');
  console.log('='.repeat(60));

  // Load documents
  const { documents, hash: documentHash } = await loadDocuments();
  console.log(`\nDocument hash: ${documentHash}`);
  console.log(`Documents: ${documents.map(d => d.name).join(', ')}`);

  // Check existing cache
  await mkdir(CACHE_DIR, { recursive: true });
  const cacheFiles = await readdir(CACHE_DIR);
  console.log(`\nExisting cache entries: ${cacheFiles.length}`);

  // Calculate expected cost
  const expectedCost = PERMUTATION_CONFIGS.reduce((sum, c) => sum + (c.expectedCost || 0), 0);
  console.log(`\nPlanned permutations: ${PERMUTATION_CONFIGS.length}`);
  console.log(`Expected maximum cost: $${expectedCost.toFixed(0)}`);

  // Run permutations
  const results: PermutationResult[] = [];

  for (const config of PERMUTATION_CONFIGS) {
    try {
      const result = await runPermutation(config, documents, documentHash);
      results.push(result);
    } catch (error) {
      console.error(`\n❌ Error running ${config.name}:`, error);
    }
  }

  // Generate reports
  console.log(`\n${'='.repeat(60)}`);
  console.log('GENERATING COMPARISON REPORT');
  console.log('='.repeat(60));

  await mkdir(RUNS_DIR, { recursive: true });
  const runTimestamp = new Date().toISOString().replace(/[:.]/g, '-');

  // Save JSON results
  const jsonPath = path.join(__dirname, 'comparison-results/comparison.json');
  await writeFile(jsonPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    documentHash,
    promptVersion: PROMPT_VERSION,
    permutations: results
  }, null, 2));

  // Generate and save HTML report
  const htmlReport = generateHTMLReport(results);
  const htmlPath = path.join(__dirname, 'comparison-results/comparison-report.html');
  await writeFile(htmlPath, htmlReport);

  // Also save to runs directory with timestamp
  await writeFile(path.join(RUNS_DIR, `run-${runTimestamp}.json`), JSON.stringify({ permutations: results }, null, 2));
  await writeFile(path.join(RUNS_DIR, `run-${runTimestamp}.html`), htmlReport);

  // Print summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('FINAL SUMMARY');
  console.log('='.repeat(60));

  console.log('\nResults by permutation:');
  for (const r of results) {
    console.log(`  ${r.permutationId}: ${r.finalResult.totalLineItems} items, ${r.finalResult.totalObservations} obs, $${r.metrics.totalCost.toFixed(4)}`);
  }

  const totalCost = results.reduce((sum, r) => sum + r.metrics.totalCost, 0);
  const totalCacheHits = results.reduce((sum, r) => sum + r.metrics.cacheHits, 0);
  const totalAPICalls = results.reduce((sum, r) => sum + r.metrics.apiCalls, 0);
  const uniqueItems = new Set<string>();
  const uniqueObs = new Set<string>();

  for (const r of results) {
    for (const wp of r.finalResult.workPackages) {
      for (const item of wp.line_items || []) {
        uniqueItems.add(`${wp.packageId}.${item.description.substring(0, 50)}`);
      }
    }
    for (const obs of r.finalResult.observations) {
      uniqueObs.add(obs.title);
    }
  }

  console.log('\nOverall metrics:');
  console.log(`  Total cost: $${totalCost.toFixed(4)}`);
  console.log(`  Cache hits: ${totalCacheHits}`);
  console.log(`  API calls: ${totalAPICalls}`);
  console.log(`  Unique line items found: ${uniqueItems.size}`);
  console.log(`  Unique observations found: ${uniqueObs.size}`);

  console.log(`\n✅ Comparison report saved to:`);
  console.log(`   - ${jsonPath}`);
  console.log(`   - ${htmlPath}`);
  console.log(`   - ${path.join(RUNS_DIR, `run-${runTimestamp}.html`)}`);
}

main().catch(console.error);
