/**
 * Cross-Model Analysis Tool
 *
 * Analyzes extraction results across multiple models to:
 * 1. Compare work package definitions
 * 2. Calculate consensus scores for line items
 * 3. Identify likely false positives/negatives
 * 4. Determine which passes add genuine value
 */

import { readFile, writeFile, readdir } from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ override: true });

import {
  GeminiExtractionResponse,
  GeminiReviewResponse,
  GeminiRawWorkPackage,
  GeminiRawLineItem,
  GeminiAIObservation,
  PermutationResult,
} from '../lib/extraction/types';

// ============================================================================
// TYPES
// ============================================================================

interface LineItemKey {
  packageId: string;
  description: string;
  normalizedDescription: string;
}

interface LineItemConsensus {
  key: string;
  packageId: string;
  description: string;
  normalizedDescription: string;
  foundByModels: {
    modelId: string;
    permutationId: string;
    quantity?: number;
    unit?: string;
    confidence?: number;
    passFound: number;
  }[];
  consensusScore: number; // 0-1, based on how many models agree
  consensusQuantity?: number;
  consensusUnit?: string;
  likelyTruePositive: boolean;
  analysis: string;
}

interface WorkPackageComparison {
  packageId: string;
  byModel: {
    [modelId: string]: {
      name: string;
      description?: string;
      csiDivision: string;
      trade: string;
      lineItemCount: number;
      confidence?: number;
    };
  };
  nameAgreement: number; // 0-1
  csiAgreement: number; // 0-1
  tradeAgreement: number; // 0-1
  analysis: string;
}

interface PassValueAnalysis {
  passNumber: number;
  purpose: string;
  model: string;
  permutationId: string;
  newItemsFound: number;
  itemsAlsoFoundByOthers: number;
  uniqueItemsOnlyThisPass: number;
  itemsLaterConfirmed: number;
  likelyValueAdded: number; // items that appear real
  likelyNoiseAdded: number; // items that seem like false positives
  costForPass: number;
  valuePerDollar: number;
  recommendation: 'high_value' | 'moderate_value' | 'low_value' | 'likely_noise';
}

interface CrossModelAnalysis {
  timestamp: string;
  permutationsAnalyzed: string[];
  modelsCompared: string[];

  // Work package comparison
  workPackageComparison: WorkPackageComparison[];
  workPackageAgreementScore: number;

  // Line item consensus
  lineItemConsensus: LineItemConsensus[];
  totalUniqueItems: number;
  highConfidenceItems: number; // Found by 3+ models
  mediumConfidenceItems: number; // Found by 2 models
  lowConfidenceItems: number; // Found by 1 model only

  // Pass value analysis
  passValueAnalysis: PassValueAnalysis[];

  // Recommendations
  recommendations: {
    optimalWorkflow: string;
    modelStrengths: { model: string; strength: string }[];
    passesToKeep: string[];
    passesToDrop: string[];
    estimatedAccuracy: number;
    confidenceInAnalysis: number;
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function normalizeDescription(desc: string | undefined | null): string {
  if (!desc) return '';
  return desc
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 100);
}

function extractModelFromPermutation(permId: string): string {
  if (permId.startsWith('G25')) return 'gemini-2.5-pro';
  if (permId.startsWith('CS')) return 'claude-sonnet-4.5';
  if (permId.startsWith('GPT4O')) return 'gpt-4o';
  if (permId.includes('HYBRID')) return 'hybrid';
  if (permId.includes('TRIPLE')) return 'triple';
  return 'unknown';
}

function levenshteinSimilarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 1.0;

  const costs: number[] = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }

  return (longer.length - costs[s2.length]) / longer.length;
}

function findSimilarDescriptions(desc: string, items: Map<string, LineItemConsensus>, threshold = 0.7): string[] {
  const normalized = normalizeDescription(desc);
  const similar: string[] = [];

  for (const [key, item] of items) {
    if (levenshteinSimilarity(normalized, item.normalizedDescription) >= threshold) {
      similar.push(key);
    }
  }

  return similar;
}

// ============================================================================
// ANALYSIS FUNCTIONS
// ============================================================================

function extractLineItemsFromResult(result: PermutationResult): Map<string, { item: GeminiRawLineItem; packageId: string; passFound: number }> {
  const items = new Map<string, { item: GeminiRawLineItem; packageId: string; passFound: number }>();

  for (const wp of result.finalResult.workPackages) {
    for (const item of wp.line_items || []) {
      const normalizedDesc = normalizeDescription(item.description);
      const key = `${wp.packageId}:${normalizedDesc}`;

      if (!items.has(key)) {
        items.set(key, {
          item,
          packageId: wp.packageId,
          passFound: 1, // Assume found in earliest pass
        });
      }
    }
  }

  return items;
}

function buildLineItemConsensus(results: PermutationResult[]): LineItemConsensus[] {
  const allItems = new Map<string, LineItemConsensus>();

  // First pass: collect all items from all permutations
  for (const result of results) {
    const modelId = extractModelFromPermutation(result.permutationId);
    const items = extractLineItemsFromResult(result);

    for (const [key, { item, packageId, passFound }] of items) {
      if (!allItems.has(key)) {
        allItems.set(key, {
          key,
          packageId,
          description: item.description,
          normalizedDescription: normalizeDescription(item.description),
          foundByModels: [],
          consensusScore: 0,
          likelyTruePositive: false,
          analysis: '',
        });
      }

      const consensus = allItems.get(key)!;

      // Check if this model already found this item (avoid duplicates from same permutation family)
      const existingFromModel = consensus.foundByModels.find(f =>
        f.modelId === modelId && f.permutationId.startsWith(result.permutationId.split('_')[0])
      );

      if (!existingFromModel) {
        consensus.foundByModels.push({
          modelId,
          permutationId: result.permutationId,
          quantity: item.quantity ?? undefined,
          unit: item.unit ?? undefined,
          passFound,
        });
      }
    }
  }

  // Second pass: calculate consensus scores and analyze
  const uniqueModelFamilies = new Set(results.map(r => r.permutationId.split('_')[0]));
  const maxModels = uniqueModelFamilies.size;

  for (const [key, consensus] of allItems) {
    // Count unique model families that found this item
    const modelFamilies = new Set(consensus.foundByModels.map(f => f.permutationId.split('_')[0]));
    const numModels = modelFamilies.size;

    consensus.consensusScore = numModels / maxModels;
    consensus.likelyTruePositive = consensus.consensusScore >= 0.5; // Found by at least half of models

    // Calculate consensus quantity/unit
    const quantities = consensus.foundByModels
      .filter(f => f.quantity !== undefined)
      .map(f => f.quantity!);

    if (quantities.length > 0) {
      // Use median for robustness
      quantities.sort((a, b) => a - b);
      consensus.consensusQuantity = quantities[Math.floor(quantities.length / 2)];
    }

    const units = consensus.foundByModels
      .filter(f => f.unit)
      .map(f => f.unit!);

    if (units.length > 0) {
      // Use most common unit
      const unitCounts = new Map<string, number>();
      for (const u of units) {
        unitCounts.set(u, (unitCounts.get(u) || 0) + 1);
      }
      consensus.consensusUnit = [...unitCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    }

    // Generate analysis
    if (consensus.consensusScore === 1) {
      consensus.analysis = `High confidence: Found by all ${numModels} model families`;
    } else if (consensus.consensusScore >= 0.66) {
      consensus.analysis = `Medium-high confidence: Found by ${numModels}/${maxModels} model families`;
    } else if (consensus.consensusScore >= 0.5) {
      consensus.analysis = `Medium confidence: Found by ${numModels}/${maxModels} model families`;
    } else if (consensus.consensusScore >= 0.33) {
      consensus.analysis = `Low confidence: Only found by ${numModels}/${maxModels} model families - verify manually`;
    } else {
      const foundBy = consensus.foundByModels.map(f => f.modelId).join(', ');
      consensus.analysis = `Possible false positive: Only found by ${foundBy} - may be hallucination`;
    }
  }

  return Array.from(allItems.values()).sort((a, b) => b.consensusScore - a.consensusScore);
}

function buildWorkPackageComparison(results: PermutationResult[]): WorkPackageComparison[] {
  const wpMap = new Map<string, WorkPackageComparison>();

  for (const result of results) {
    const modelId = extractModelFromPermutation(result.permutationId);

    for (const wp of result.finalResult.workPackages) {
      if (!wpMap.has(wp.packageId)) {
        wpMap.set(wp.packageId, {
          packageId: wp.packageId,
          byModel: {},
          nameAgreement: 0,
          csiAgreement: 0,
          tradeAgreement: 0,
          analysis: '',
        });
      }

      const comparison = wpMap.get(wp.packageId)!;

      // Only add if we don't have this model family yet
      if (!comparison.byModel[modelId]) {
        comparison.byModel[modelId] = {
          name: wp.name,
          description: wp.description,
          csiDivision: wp.csi_division || '',
          trade: wp.trade || '',
          lineItemCount: wp.line_items?.length || 0,
        };
      }
    }
  }

  // Calculate agreement scores
  for (const [, comparison] of wpMap) {
    const models = Object.keys(comparison.byModel);
    if (models.length < 2) {
      comparison.nameAgreement = 1;
      comparison.csiAgreement = 1;
      comparison.tradeAgreement = 1;
      comparison.analysis = 'Only found by one model family';
      continue;
    }

    // Name agreement
    const names = models.map(m => normalizeDescription(comparison.byModel[m].name));
    let nameMatches = 0;
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        if (levenshteinSimilarity(names[i], names[j]) >= 0.7) nameMatches++;
      }
    }
    comparison.nameAgreement = nameMatches / (models.length * (models.length - 1) / 2);

    // CSI agreement
    const csis = models.map(m => comparison.byModel[m].csiDivision.toLowerCase().replace(/[^0-9]/g, ''));
    let csiMatches = 0;
    for (let i = 0; i < csis.length; i++) {
      for (let j = i + 1; j < csis.length; j++) {
        if (csis[i] === csis[j]) csiMatches++;
      }
    }
    comparison.csiAgreement = csiMatches / (models.length * (models.length - 1) / 2);

    // Trade agreement
    const trades = models.map(m => normalizeDescription(comparison.byModel[m].trade));
    let tradeMatches = 0;
    for (let i = 0; i < trades.length; i++) {
      for (let j = i + 1; j < trades.length; j++) {
        if (levenshteinSimilarity(trades[i], trades[j]) >= 0.7) tradeMatches++;
      }
    }
    comparison.tradeAgreement = tradeMatches / (models.length * (models.length - 1) / 2);

    // Generate analysis
    const avgAgreement = (comparison.nameAgreement + comparison.csiAgreement + comparison.tradeAgreement) / 3;
    if (avgAgreement >= 0.9) {
      comparison.analysis = 'Strong agreement across models';
    } else if (avgAgreement >= 0.7) {
      comparison.analysis = 'Good agreement with minor differences';
    } else if (avgAgreement >= 0.5) {
      comparison.analysis = 'Moderate agreement - review classifications';
    } else {
      comparison.analysis = 'Low agreement - significant differences in how models classify this work';
    }
  }

  return Array.from(wpMap.values()).sort((a, b) => a.packageId.localeCompare(b.packageId));
}

function analyzePassValue(
  results: PermutationResult[],
  lineItemConsensus: LineItemConsensus[]
): PassValueAnalysis[] {
  const analyses: PassValueAnalysis[] = [];

  // Build lookup for consensus items
  const consensusLookup = new Map<string, LineItemConsensus>();
  for (const item of lineItemConsensus) {
    consensusLookup.set(item.key, item);
  }

  // Analyze each pass in each permutation
  for (const result of results) {
    // Track items found in previous passes
    const itemsFoundSoFar = new Set<string>();

    for (const pass of result.passes) {
      const passItems = new Set<string>();

      // Get items from this pass
      const passResponse = pass.response as GeminiExtractionResponse | GeminiReviewResponse;

      if ('work_packages' in passResponse) {
        // Initial extraction
        for (const wp of passResponse.work_packages) {
          for (const item of wp.line_items || []) {
            const key = `${wp.packageId}:${normalizeDescription(item.description)}`;
            passItems.add(key);
          }
        }
      } else if ('additions' in passResponse) {
        // Review pass
        for (const addition of passResponse.additions || []) {
          const lineItem = (addition as any).line_item || addition;
          const packageId = (addition as any).packageId || (addition as any).work_package;
          const key = `${packageId}:${normalizeDescription(lineItem.description)}`;
          passItems.add(key);
        }
      }

      // Calculate metrics
      let newItemsFound = 0;
      let itemsAlsoFoundByOthers = 0;
      let uniqueItemsOnlyThisPass = 0;
      let itemsLaterConfirmed = 0;
      let likelyValueAdded = 0;
      let likelyNoiseAdded = 0;

      for (const key of passItems) {
        if (!itemsFoundSoFar.has(key)) {
          newItemsFound++;

          const consensus = consensusLookup.get(key);
          if (consensus) {
            if (consensus.consensusScore >= 0.5) {
              likelyValueAdded++;
              itemsLaterConfirmed++;
            } else if (consensus.consensusScore >= 0.33) {
              // Medium confidence
              likelyValueAdded += 0.5;
            } else {
              likelyNoiseAdded++;
            }

            if (consensus.foundByModels.length > 1) {
              itemsAlsoFoundByOthers++;
            } else {
              uniqueItemsOnlyThisPass++;
            }
          } else {
            // Item not in consensus - likely only found here
            uniqueItemsOnlyThisPass++;
            likelyNoiseAdded++;
          }
        }
      }

      // Update items found so far
      for (const key of passItems) {
        itemsFoundSoFar.add(key);
      }

      const valuePerDollar = pass.cost > 0 ? likelyValueAdded / pass.cost : 0;

      let recommendation: 'high_value' | 'moderate_value' | 'low_value' | 'likely_noise';
      if (valuePerDollar > 50) recommendation = 'high_value';
      else if (valuePerDollar > 20) recommendation = 'moderate_value';
      else if (likelyValueAdded > likelyNoiseAdded) recommendation = 'low_value';
      else recommendation = 'likely_noise';

      analyses.push({
        passNumber: pass.passNumber,
        purpose: pass.purpose,
        model: pass.model,
        permutationId: result.permutationId,
        newItemsFound,
        itemsAlsoFoundByOthers,
        uniqueItemsOnlyThisPass,
        itemsLaterConfirmed,
        likelyValueAdded,
        likelyNoiseAdded,
        costForPass: pass.cost,
        valuePerDollar,
        recommendation,
      });
    }
  }

  return analyses;
}

function generateRecommendations(
  results: PermutationResult[],
  wpComparison: WorkPackageComparison[],
  lineItemConsensus: LineItemConsensus[],
  passValueAnalysis: PassValueAnalysis[]
): CrossModelAnalysis['recommendations'] {
  // Find best performing passes
  const passByPurpose = new Map<string, PassValueAnalysis[]>();
  for (const pva of passValueAnalysis) {
    if (!passByPurpose.has(pva.purpose)) {
      passByPurpose.set(pva.purpose, []);
    }
    passByPurpose.get(pva.purpose)!.push(pva);
  }

  const passesToKeep: string[] = [];
  const passesToDrop: string[] = [];

  for (const [purpose, analyses] of passByPurpose) {
    const avgValue = analyses.reduce((sum, a) => sum + a.valuePerDollar, 0) / analyses.length;
    const avgNoise = analyses.reduce((sum, a) => sum + a.likelyNoiseAdded, 0) / analyses.length;

    if (avgValue > 20 && avgNoise < 5) {
      passesToKeep.push(`${purpose} (avg ${avgValue.toFixed(1)} value/dollar)`);
    } else if (avgValue < 10 || avgNoise > avgValue) {
      passesToDrop.push(`${purpose} (low value or high noise)`);
    }
  }

  // Find model strengths
  const modelStrengths: { model: string; strength: string }[] = [];
  const modelStats = new Map<string, { items: number; confirmed: number }>();

  for (const item of lineItemConsensus) {
    for (const found of item.foundByModels) {
      if (!modelStats.has(found.modelId)) {
        modelStats.set(found.modelId, { items: 0, confirmed: 0 });
      }
      const stats = modelStats.get(found.modelId)!;
      stats.items++;
      if (item.likelyTruePositive) stats.confirmed++;
    }
  }

  for (const [model, stats] of modelStats) {
    const accuracy = stats.confirmed / stats.items;
    if (accuracy > 0.8) {
      modelStrengths.push({ model, strength: `High precision (${(accuracy * 100).toFixed(0)}% of items confirmed by others)` });
    } else if (stats.items > 100) {
      modelStrengths.push({ model, strength: `High recall (${stats.items} items found)` });
    }
  }

  // Calculate overall confidence
  const highConfidenceRatio = lineItemConsensus.filter(i => i.consensusScore >= 0.66).length / lineItemConsensus.length;
  const wpAgreementAvg = wpComparison.reduce((sum, wp) => sum + (wp.nameAgreement + wp.csiAgreement + wp.tradeAgreement) / 3, 0) / wpComparison.length;

  return {
    optimalWorkflow: `Pass 1 (Gemini) → Pass 2 (Self-review) → Cross-validation (Claude or GPT-4o)`,
    modelStrengths,
    passesToKeep,
    passesToDrop,
    estimatedAccuracy: highConfidenceRatio * 0.85 + wpAgreementAvg * 0.15,
    confidenceInAnalysis: Math.min(0.9, highConfidenceRatio + 0.1),
  };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('='.repeat(60));
  console.log('CROSS-MODEL ANALYSIS');
  console.log('='.repeat(60));

  // Load comparison results
  const comparisonPath = path.resolve(__dirname, 'comparison-results/comparison.json');

  let comparisonData: { permutations: PermutationResult[] };
  try {
    const data = await readFile(comparisonPath, 'utf-8');
    comparisonData = JSON.parse(data);
  } catch (e) {
    console.error('Could not load comparison.json. Run permutation-runner.ts first.');
    process.exit(1);
  }

  const results = comparisonData.permutations;
  console.log(`\nLoaded ${results.length} permutation results`);

  // Filter to get unique model families for comparison
  const modelFamilies = new Set(results.map(r => r.permutationId.split('_')[0]));
  console.log(`Model families: ${[...modelFamilies].join(', ')}`);

  // Build analysis
  console.log('\nBuilding line item consensus...');
  const lineItemConsensus = buildLineItemConsensus(results);

  console.log('Building work package comparison...');
  const wpComparison = buildWorkPackageComparison(results);

  console.log('Analyzing pass value...');
  const passValue = analyzePassValue(results, lineItemConsensus);

  console.log('Generating recommendations...');
  const recommendations = generateRecommendations(results, wpComparison, lineItemConsensus, passValue);

  // Count categories
  const highConf = lineItemConsensus.filter(i => i.consensusScore >= 0.66).length;
  const medConf = lineItemConsensus.filter(i => i.consensusScore >= 0.33 && i.consensusScore < 0.66).length;
  const lowConf = lineItemConsensus.filter(i => i.consensusScore < 0.33).length;

  const analysis: CrossModelAnalysis = {
    timestamp: new Date().toISOString(),
    permutationsAnalyzed: results.map(r => r.permutationId),
    modelsCompared: [...modelFamilies],
    workPackageComparison: wpComparison,
    workPackageAgreementScore: wpComparison.reduce((sum, wp) =>
      sum + (wp.nameAgreement + wp.csiAgreement + wp.tradeAgreement) / 3, 0) / wpComparison.length,
    lineItemConsensus,
    totalUniqueItems: lineItemConsensus.length,
    highConfidenceItems: highConf,
    mediumConfidenceItems: medConf,
    lowConfidenceItems: lowConf,
    passValueAnalysis: passValue,
    recommendations,
  };

  // Save analysis
  const outputPath = path.resolve(__dirname, 'comparison-results/cross-model-analysis.json');
  await writeFile(outputPath, JSON.stringify(analysis, null, 2));

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('ANALYSIS RESULTS');
  console.log('='.repeat(60));

  console.log(`\n📊 Line Item Consensus:`);
  console.log(`   Total unique items: ${analysis.totalUniqueItems}`);
  console.log(`   High confidence (66%+ agreement): ${highConf} items`);
  console.log(`   Medium confidence (33-66%): ${medConf} items`);
  console.log(`   Low confidence (<33%): ${lowConf} items - likely false positives`);

  console.log(`\n📦 Work Package Agreement:`);
  console.log(`   Overall agreement score: ${(analysis.workPackageAgreementScore * 100).toFixed(1)}%`);

  console.log(`\n🎯 Top Recommendations:`);
  console.log(`   Optimal workflow: ${recommendations.optimalWorkflow}`);
  console.log(`   Estimated accuracy: ${(recommendations.estimatedAccuracy * 100).toFixed(1)}%`);

  if (recommendations.passesToKeep.length > 0) {
    console.log(`\n   ✓ Keep these passes:`);
    for (const p of recommendations.passesToKeep) {
      console.log(`     - ${p}`);
    }
  }

  if (recommendations.passesToDrop.length > 0) {
    console.log(`\n   ✗ Consider dropping:`);
    for (const p of recommendations.passesToDrop) {
      console.log(`     - ${p}`);
    }
  }

  console.log(`\n   Model strengths:`);
  for (const ms of recommendations.modelStrengths) {
    console.log(`     - ${ms.model}: ${ms.strength}`);
  }

  // Show some example items at different confidence levels
  console.log(`\n📝 Example Items by Confidence:`);

  const highConfItems = lineItemConsensus.filter(i => i.consensusScore >= 0.66).slice(0, 3);
  if (highConfItems.length > 0) {
    console.log(`\n   HIGH CONFIDENCE (found by most models):`);
    for (const item of highConfItems) {
      console.log(`     [${item.packageId}] ${item.description.substring(0, 60)}...`);
      console.log(`       Score: ${(item.consensusScore * 100).toFixed(0)}% | ${item.analysis}`);
    }
  }

  const lowConfItems = lineItemConsensus.filter(i => i.consensusScore < 0.33).slice(0, 3);
  if (lowConfItems.length > 0) {
    console.log(`\n   LOW CONFIDENCE (possible false positives):`);
    for (const item of lowConfItems) {
      console.log(`     [${item.packageId}] ${item.description.substring(0, 60)}...`);
      const foundBy = item.foundByModels.map(f => f.modelId).join(', ');
      console.log(`       Score: ${(item.consensusScore * 100).toFixed(0)}% | Only found by: ${foundBy}`);
    }
  }

  console.log(`\n✅ Analysis saved to: ${outputPath}`);
}

main().catch(console.error);
