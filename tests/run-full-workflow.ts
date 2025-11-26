/**
 * Full Extraction Workflow Test Runner
 *
 * This script runs the complete extraction workflow on the Kenai project
 * and outputs detailed, structured results for analysis.
 *
 * Run with: npx tsx tests/run-full-workflow.ts
 *
 * Features:
 * - Pass 1: Initial extraction with bounding boxes
 * - Pass 2: Self-review with AI observations
 * - Pass 3: Multi-document correlation (specs + addenda)
 * - Detailed summary with all data structures
 * - HTML visualization output
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { GeminiClient } from '../lib/extraction/clients/gemini';
import { ExtractionDocument, GeminiExtractionResponse, GeminiReviewResponse } from '../lib/extraction/types';

const SAMPLE_PROJECT_PATH = path.resolve(__dirname, '../sample_project');
const OUTPUT_DIR = path.resolve(__dirname, '../tests/output');

// Document definitions
const documents = {
  designDrawings: {
    id: 'doc-design',
    name: '2032_kenai_rec_center_upgrades_100.pdf',
    url: path.join(SAMPLE_PROJECT_PATH, '2032_kenai_rec_center_upgrades_100.pdf'),
    type: 'design_drawings' as const,
    mimeType: 'application/pdf' as const,
  },
  projectManual: {
    id: 'doc-specs',
    name: 'kenai_rec_center_upgrades_project_manual.pdf',
    url: path.join(SAMPLE_PROJECT_PATH, 'kenai_rec_center_upgrades_project_manual.pdf'),
    type: 'specifications' as const,
    mimeType: 'application/pdf' as const,
  },
  addendum1: {
    id: 'doc-add1',
    name: 'addendum_1.pdf',
    url: path.join(SAMPLE_PROJECT_PATH, 'addendum_1.pdf'),
    type: 'addendum' as const,
    mimeType: 'application/pdf' as const,
  },
  addendum2: {
    id: 'doc-add2',
    name: 'addendum_2.pdf',
    url: path.join(SAMPLE_PROJECT_PATH, 'addendum_2.pdf'),
    type: 'addendum' as const,
    mimeType: 'application/pdf' as const,
  },
};

interface WorkflowResults {
  pass1: {
    response: GeminiExtractionResponse;
    tokensUsed: { input: number; output: number };
    duration: number;
  } | null;
  pass2: {
    response: GeminiReviewResponse;
    tokensUsed: { input: number; output: number };
    duration: number;
  } | null;
  pass3: {
    response: any;
    tokensUsed: { input: number; output: number };
    duration: number;
  } | null;
  summary: {
    totalWorkPackages: number;
    totalLineItems: number;
    totalObservations: number;
    dataQuality: {
      withBoundingBox: number;
      withConfidence: number;
      withQuantity: number;
      withSourceRef: number;
    };
    csiDivisions: string[];
    trades: string[];
    observationsBySeverity: { critical: number; warning: number; info: number };
    totalTokens: { input: number; output: number };
    totalDuration: number;
  };
}

const results: WorkflowResults = {
  pass1: null,
  pass2: null,
  pass3: null,
  summary: {
    totalWorkPackages: 0,
    totalLineItems: 0,
    totalObservations: 0,
    dataQuality: { withBoundingBox: 0, withConfidence: 0, withQuantity: 0, withSourceRef: 0 },
    csiDivisions: [],
    trades: [],
    observationsBySeverity: { critical: 0, warning: 0, info: 0 },
    totalTokens: { input: 0, output: 0 },
    totalDuration: 0,
  },
};

function printHeader(text: string) {
  console.log('\n' + '═'.repeat(80));
  console.log(`  ${text}`);
  console.log('═'.repeat(80));
}

function printSubHeader(text: string) {
  console.log('\n' + '─'.repeat(60));
  console.log(`  ${text}`);
  console.log('─'.repeat(60));
}

async function ensureOutputDir() {
  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
  } catch (e) {
    // Directory may already exist
  }
}

async function runPass1(client: GeminiClient): Promise<typeof results.pass1> {
  printHeader('PASS 1: INITIAL EXTRACTION');
  console.log('\n📄 Documents: Design Drawings Only');
  console.log(`   File: ${documents.designDrawings.name}`);

  const startTime = Date.now();

  try {
    const result = await client.extractWorkPackages([documents.designDrawings]);
    const duration = (Date.now() - startTime) / 1000;

    console.log(`\n✅ Pass 1 completed in ${duration.toFixed(1)}s`);
    console.log(`📊 Tokens: ${result.tokensUsed.input} input, ${result.tokensUsed.output} output`);

    return {
      response: result.response,
      tokensUsed: result.tokensUsed,
      duration,
    };
  } catch (error) {
    console.error('\n❌ Pass 1 failed:', error);
    return null;
  }
}

async function runPass2(client: GeminiClient, pass1Response: GeminiExtractionResponse): Promise<typeof results.pass2> {
  printHeader('PASS 2: SELF-REVIEW & AI OBSERVATIONS');
  console.log('\n🔍 Reviewing extraction and generating expert observations...');

  const startTime = Date.now();

  try {
    const result = await client.reviewExtraction([documents.designDrawings], pass1Response);
    const duration = (Date.now() - startTime) / 1000;

    console.log(`\n✅ Pass 2 completed in ${duration.toFixed(1)}s`);
    console.log(`📊 Tokens: ${result.tokensUsed.input} input, ${result.tokensUsed.output} output`);

    return {
      response: result.response,
      tokensUsed: result.tokensUsed,
      duration,
    };
  } catch (error) {
    console.error('\n❌ Pass 2 failed:', error);
    return null;
  }
}

async function runPass3(client: GeminiClient, pass1Response: GeminiExtractionResponse): Promise<typeof results.pass3> {
  printHeader('PASS 3: MULTI-DOCUMENT CORRELATION');
  console.log('\n📚 Correlating with specs and addenda...');
  console.log('   Documents:');
  console.log(`   - ${documents.designDrawings.name} (drawings)`);
  console.log(`   - ${documents.projectManual.name} (specs)`);
  console.log(`   - ${documents.addendum1.name}`);
  console.log(`   - ${documents.addendum2.name}`);

  const startTime = Date.now();

  try {
    const allDocs = [
      documents.designDrawings,
      documents.projectManual,
      documents.addendum1,
      documents.addendum2,
    ];

    const result = await client.correlateDocuments(allDocs, pass1Response);
    const duration = (Date.now() - startTime) / 1000;

    console.log(`\n✅ Pass 3 completed in ${duration.toFixed(1)}s`);
    console.log(`📊 Tokens: ${result.tokensUsed.input} input, ${result.tokensUsed.output} output`);

    return {
      response: result.response,
      tokensUsed: result.tokensUsed,
      duration,
    };
  } catch (error) {
    console.error('\n❌ Pass 3 failed:', error);
    return null;
  }
}

function analyzeResults() {
  printHeader('RESULTS ANALYSIS');

  if (!results.pass1) {
    console.log('\n❌ No results to analyze (Pass 1 failed)');
    return;
  }

  const pass1 = results.pass1.response;
  const pass2 = results.pass2?.response;

  // Calculate summary statistics
  const allItems = pass1.work_packages?.flatMap((p) => p.line_items) || [];

  results.summary.totalWorkPackages = pass1.work_packages?.length || 0;
  results.summary.totalLineItems = allItems.length;
  results.summary.csiDivisions = [...new Set(pass1.work_packages?.map((p) => p.csi_division) || [])].sort();
  results.summary.trades = [...new Set(pass1.work_packages?.map((p) => p.trade) || [])];

  // Data quality metrics
  results.summary.dataQuality.withSourceRef = allItems.filter((i: any) => i.source_reference).length;
  results.summary.dataQuality.withBoundingBox = allItems.filter(
    (i: any) => i.source_reference?.bounding_box && i.source_reference.bounding_box.length === 4
  ).length;
  results.summary.dataQuality.withConfidence = allItems.filter((i: any) => typeof i.confidence === 'number').length;
  results.summary.dataQuality.withQuantity = allItems.filter(
    (i: any) => i.quantity !== null && i.quantity !== undefined
  ).length;

  // Count observations
  const pass1Observations = (pass1 as any).ai_observations || [];
  const pass2Observations = (pass2 as any)?.ai_observations || [];
  const allObservations = [...pass1Observations, ...pass2Observations];

  results.summary.totalObservations = allObservations.length;
  results.summary.observationsBySeverity = {
    critical: allObservations.filter((o: any) => o.severity === 'critical').length,
    warning: allObservations.filter((o: any) => o.severity === 'warning').length,
    info: allObservations.filter((o: any) => o.severity === 'info').length,
  };

  // Token totals
  results.summary.totalTokens = {
    input:
      (results.pass1?.tokensUsed.input || 0) +
      (results.pass2?.tokensUsed.input || 0) +
      (results.pass3?.tokensUsed.input || 0),
    output:
      (results.pass1?.tokensUsed.output || 0) +
      (results.pass2?.tokensUsed.output || 0) +
      (results.pass3?.tokensUsed.output || 0),
  };

  results.summary.totalDuration =
    (results.pass1?.duration || 0) + (results.pass2?.duration || 0) + (results.pass3?.duration || 0);

  // Print summary
  printSubHeader('SUMMARY STATISTICS');
  console.log(`
  📦 Work Packages: ${results.summary.totalWorkPackages}
  📋 Line Items: ${results.summary.totalLineItems}
  🔍 AI Observations: ${results.summary.totalObservations}
     - Critical: ${results.summary.observationsBySeverity.critical}
     - Warning: ${results.summary.observationsBySeverity.warning}
     - Info: ${results.summary.observationsBySeverity.info}
  `);

  printSubHeader('CSI DIVISIONS');
  console.log(`  ${results.summary.csiDivisions.join(', ')}`);

  printSubHeader('TRADES');
  results.summary.trades.forEach((trade) => console.log(`  - ${trade}`));

  printSubHeader('DATA QUALITY');
  const totalItems = results.summary.totalLineItems;
  console.log(`
  Source References: ${results.summary.dataQuality.withSourceRef}/${totalItems} (${((results.summary.dataQuality.withSourceRef / totalItems) * 100).toFixed(0)}%)
  Bounding Boxes:    ${results.summary.dataQuality.withBoundingBox}/${totalItems} (${((results.summary.dataQuality.withBoundingBox / totalItems) * 100).toFixed(0)}%)
  Confidence Scores: ${results.summary.dataQuality.withConfidence}/${totalItems} (${((results.summary.dataQuality.withConfidence / totalItems) * 100).toFixed(0)}%)
  Quantities:        ${results.summary.dataQuality.withQuantity}/${totalItems} (${((results.summary.dataQuality.withQuantity / totalItems) * 100).toFixed(0)}%)
  `);

  printSubHeader('RESOURCE USAGE');
  console.log(`
  Total Duration: ${results.summary.totalDuration.toFixed(1)}s
  Total Tokens:   ${results.summary.totalTokens.input + results.summary.totalTokens.output}
    - Input:  ${results.summary.totalTokens.input}
    - Output: ${results.summary.totalTokens.output}
  `);
}

function printWorkPackages() {
  if (!results.pass1) return;

  printHeader('WORK PACKAGES DETAIL');

  const packages = results.pass1.response.work_packages || [];

  packages.forEach((pkg, i) => {
    console.log(`\n📦 [${i + 1}] ${pkg.name}`);
    console.log(`   ID: ${pkg.packageId} | CSI: ${pkg.csi_division} | Trade: ${pkg.trade}`);

    const pkgConf = (pkg as any).confidence;
    if (pkgConf) {
      console.log(`   Confidence: ${(pkgConf.overall * 100).toFixed(0)}% - ${pkgConf.reasoning || ''}`);
    }

    console.log(`   Line Items: ${pkg.line_items?.length || 0}`);

    // Show sample items with bounding boxes
    const itemsWithBbox = pkg.line_items?.filter(
      (item: any) => item.source_reference?.bounding_box && item.source_reference.bounding_box.length === 4
    );

    if (itemsWithBbox && itemsWithBbox.length > 0) {
      console.log(`   📍 Items with bounding boxes: ${itemsWithBbox.length}`);
      itemsWithBbox.slice(0, 2).forEach((item: any) => {
        const bbox = item.source_reference.bounding_box;
        console.log(
          `      - "${item.description?.substring(0, 40)}..." → [${bbox.join(', ')}]`
        );
      });
    }
  });
}

function printAIObservations() {
  printHeader('AI OBSERVATIONS');

  const pass1Obs = (results.pass1?.response as any)?.ai_observations || [];
  const pass2Obs = (results.pass2?.response as any)?.ai_observations || [];

  if (pass1Obs.length === 0 && pass2Obs.length === 0) {
    console.log('\n   No AI observations generated.');
    return;
  }

  console.log(`\n📊 Pass 1 Observations: ${pass1Obs.length}`);
  pass1Obs.forEach((obs: any, i: number) => {
    printObservation(obs, i + 1);
  });

  console.log(`\n📊 Pass 2 Observations: ${pass2Obs.length}`);
  pass2Obs.forEach((obs: any, i: number) => {
    printObservation(obs, i + 1);
  });
}

function printObservation(obs: any, index: number) {
  const severityIcon = obs.severity === 'critical' ? '🔴' : obs.severity === 'warning' ? '🟡' : '🔵';

  console.log(`\n   ${severityIcon} [${index}] ${obs.title || 'Untitled'}`);
  console.log(`      Severity: ${obs.severity} | Category: ${obs.category}`);
  console.log(`      ${obs.insight?.substring(0, 150)}${(obs.insight?.length || 0) > 150 ? '...' : ''}`);

  if (obs.affected_packages?.length) {
    console.log(`      Affects: ${obs.affected_packages.join(', ')}`);
  }

  if (obs.suggested_actions?.length) {
    console.log(`      Actions: ${obs.suggested_actions.slice(0, 2).join('; ')}`);
  }

  if (obs.source_reference?.sheet) {
    console.log(`      Source: Sheet ${obs.source_reference.sheet}, Page ${obs.source_reference.page || 'N/A'}`);
    if (obs.source_reference.bounding_box) {
      console.log(`      BBox: [${obs.source_reference.bounding_box.join(', ')}]`);
    }
  }
}

function printDocumentReferences() {
  if (!results.pass1) return;

  printHeader('DOCUMENT REFERENCES (Sample)');

  const allItems = results.pass1.response.work_packages?.flatMap((p) => p.line_items) || [];
  const itemsWithRefs = allItems.filter((i: any) => i.source_reference);
  const itemsWithBbox = allItems.filter(
    (i: any) => i.source_reference?.bounding_box && i.source_reference.bounding_box.length === 4
  );

  console.log(`\n📄 Items with source references: ${itemsWithRefs.length}/${allItems.length}`);
  console.log(`📍 Items with bounding boxes: ${itemsWithBbox.length}/${allItems.length}`);

  printSubHeader('Sample References with Bounding Boxes');

  itemsWithBbox.slice(0, 10).forEach((item: any, i) => {
    const ref = item.source_reference;
    console.log(`\n   [${i + 1}] "${item.description?.substring(0, 50)}..."`);
    console.log(`       Sheet: ${ref.sheet} | Page: ${ref.page || 'N/A'}`);
    console.log(`       Location: ${ref.location || 'N/A'}`);
    console.log(`       BBox: [${ref.bounding_box.join(', ')}]`);
    if (ref.text_excerpt) {
      console.log(`       Text: "${ref.text_excerpt.substring(0, 60)}..."`);
    }
  });
}

async function generateHTMLReport() {
  printHeader('GENERATING HTML REPORT');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Extraction Results - Kenai Rec Center</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; }
    .container { max-width: 1400px; margin: 0 auto; }
    h1 { color: #1a1a2e; margin-bottom: 20px; }
    h2 { color: #16213e; margin: 30px 0 15px; border-bottom: 2px solid #0f3460; padding-bottom: 5px; }
    h3 { color: #0f3460; margin: 20px 0 10px; }
    .card { background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
    .stat-box { background: #e8f4f8; padding: 15px; border-radius: 6px; text-align: center; }
    .stat-value { font-size: 2em; font-weight: bold; color: #0f3460; }
    .stat-label { color: #666; font-size: 0.9em; }
    .package { border-left: 4px solid #0f3460; padding-left: 15px; margin: 15px 0; }
    .package-header { font-weight: bold; color: #1a1a2e; }
    .package-meta { color: #666; font-size: 0.9em; }
    .observation { padding: 15px; border-radius: 6px; margin: 10px 0; }
    .observation.critical { background: #fee; border-left: 4px solid #e53935; }
    .observation.warning { background: #fff8e1; border-left: 4px solid #ffc107; }
    .observation.info { background: #e3f2fd; border-left: 4px solid #2196f3; }
    .obs-title { font-weight: bold; margin-bottom: 5px; }
    .obs-insight { color: #444; }
    .line-item { background: #fafafa; padding: 10px; margin: 5px 0; border-radius: 4px; font-size: 0.9em; }
    .bbox { font-family: monospace; background: #e8e8e8; padding: 2px 6px; border-radius: 3px; }
    .confidence { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 0.8em; }
    .confidence.high { background: #c8e6c9; color: #2e7d32; }
    .confidence.medium { background: #fff3e0; color: #ef6c00; }
    .confidence.low { background: #ffcdd2; color: #c62828; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f5f5f5; font-weight: 600; }
    .progress-bar { height: 20px; background: #e0e0e0; border-radius: 10px; overflow: hidden; }
    .progress-fill { height: 100%; background: #4caf50; transition: width 0.3s; }
    pre { background: #1a1a2e; color: #e0e0e0; padding: 15px; border-radius: 6px; overflow-x: auto; font-size: 0.85em; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🏗️ Extraction Results: ${results.pass1?.response.project_name || 'Kenai Rec Center Upgrades'}</h1>
    <p style="color:#666;margin-bottom:20px">Generated: ${new Date().toLocaleString()}</p>

    <div class="card">
      <h2>📊 Summary Statistics</h2>
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-value">${results.summary.totalWorkPackages}</div>
          <div class="stat-label">Work Packages</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${results.summary.totalLineItems}</div>
          <div class="stat-label">Line Items</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${results.summary.totalObservations}</div>
          <div class="stat-label">AI Observations</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${results.summary.totalDuration.toFixed(0)}s</div>
          <div class="stat-label">Total Duration</div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>📈 Data Quality</h2>
      <table>
        <tr>
          <th>Metric</th>
          <th>Count</th>
          <th>Percentage</th>
          <th>Progress</th>
        </tr>
        <tr>
          <td>Source References</td>
          <td>${results.summary.dataQuality.withSourceRef}/${results.summary.totalLineItems}</td>
          <td>${((results.summary.dataQuality.withSourceRef / results.summary.totalLineItems) * 100).toFixed(0)}%</td>
          <td><div class="progress-bar"><div class="progress-fill" style="width:${(results.summary.dataQuality.withSourceRef / results.summary.totalLineItems) * 100}%"></div></div></td>
        </tr>
        <tr>
          <td>Bounding Boxes</td>
          <td>${results.summary.dataQuality.withBoundingBox}/${results.summary.totalLineItems}</td>
          <td>${((results.summary.dataQuality.withBoundingBox / results.summary.totalLineItems) * 100).toFixed(0)}%</td>
          <td><div class="progress-bar"><div class="progress-fill" style="width:${(results.summary.dataQuality.withBoundingBox / results.summary.totalLineItems) * 100}%"></div></div></td>
        </tr>
        <tr>
          <td>Confidence Scores</td>
          <td>${results.summary.dataQuality.withConfidence}/${results.summary.totalLineItems}</td>
          <td>${((results.summary.dataQuality.withConfidence / results.summary.totalLineItems) * 100).toFixed(0)}%</td>
          <td><div class="progress-bar"><div class="progress-fill" style="width:${(results.summary.dataQuality.withConfidence / results.summary.totalLineItems) * 100}%"></div></div></td>
        </tr>
        <tr>
          <td>Quantities</td>
          <td>${results.summary.dataQuality.withQuantity}/${results.summary.totalLineItems}</td>
          <td>${((results.summary.dataQuality.withQuantity / results.summary.totalLineItems) * 100).toFixed(0)}%</td>
          <td><div class="progress-bar"><div class="progress-fill" style="width:${(results.summary.dataQuality.withQuantity / results.summary.totalLineItems) * 100}%"></div></div></td>
        </tr>
      </table>
    </div>

    <div class="card">
      <h2>🔍 AI Observations</h2>
      <div class="stats-grid" style="margin-bottom:20px">
        <div class="stat-box" style="background:#ffebee">
          <div class="stat-value" style="color:#c62828">${results.summary.observationsBySeverity.critical}</div>
          <div class="stat-label">Critical</div>
        </div>
        <div class="stat-box" style="background:#fff8e1">
          <div class="stat-value" style="color:#f57f17">${results.summary.observationsBySeverity.warning}</div>
          <div class="stat-label">Warning</div>
        </div>
        <div class="stat-box" style="background:#e3f2fd">
          <div class="stat-value" style="color:#1565c0">${results.summary.observationsBySeverity.info}</div>
          <div class="stat-label">Info</div>
        </div>
      </div>
      ${generateObservationsHTML()}
    </div>

    <div class="card">
      <h2>📦 Work Packages</h2>
      ${generateWorkPackagesHTML()}
    </div>

    <div class="card">
      <h2>🔗 Document References (Sample)</h2>
      ${generateReferencesHTML()}
    </div>

    <div class="card">
      <h2>📝 Raw JSON Data</h2>
      <h3>Pass 1 Response</h3>
      <pre>${JSON.stringify(results.pass1?.response, null, 2).substring(0, 5000)}${JSON.stringify(results.pass1?.response, null, 2).length > 5000 ? '\n... (truncated)' : ''}</pre>
    </div>
  </div>
</body>
</html>`;

  const outputPath = path.join(OUTPUT_DIR, 'extraction-results.html');
  await fs.writeFile(outputPath, html);
  console.log(`\n✅ HTML report saved to: ${outputPath}`);

  // Also save JSON files
  await fs.writeFile(
    path.join(OUTPUT_DIR, 'pass1-results.json'),
    JSON.stringify(results.pass1?.response, null, 2)
  );
  await fs.writeFile(
    path.join(OUTPUT_DIR, 'pass2-results.json'),
    JSON.stringify(results.pass2?.response, null, 2)
  );
  await fs.writeFile(path.join(OUTPUT_DIR, 'summary.json'), JSON.stringify(results.summary, null, 2));

  console.log(`📄 JSON files saved to: ${OUTPUT_DIR}/`);
}

function generateObservationsHTML(): string {
  const pass1Obs = (results.pass1?.response as any)?.ai_observations || [];
  const pass2Obs = (results.pass2?.response as any)?.ai_observations || [];
  const allObs = [...pass1Obs, ...pass2Obs];

  if (allObs.length === 0) {
    return '<p style="color:#666">No AI observations generated.</p>';
  }

  return allObs
    .map(
      (obs: any) => `
    <div class="observation ${obs.severity}">
      <div class="obs-title">${obs.severity === 'critical' ? '🔴' : obs.severity === 'warning' ? '🟡' : '🔵'} ${obs.title || 'Untitled'}</div>
      <div style="color:#888;font-size:0.85em;margin-bottom:5px">${obs.category}</div>
      <div class="obs-insight">${obs.insight || ''}</div>
      ${obs.affected_packages?.length ? `<div style="margin-top:8px;font-size:0.9em"><strong>Affects:</strong> ${obs.affected_packages.join(', ')}</div>` : ''}
      ${obs.suggested_actions?.length ? `<div style="margin-top:5px;font-size:0.9em"><strong>Actions:</strong> ${obs.suggested_actions.join('; ')}</div>` : ''}
      ${obs.source_reference?.sheet ? `<div style="margin-top:5px;font-size:0.85em;color:#666"><strong>Source:</strong> Sheet ${obs.source_reference.sheet}${obs.source_reference.bounding_box ? ` <span class="bbox">[${obs.source_reference.bounding_box.join(', ')}]</span>` : ''}</div>` : ''}
    </div>
  `
    )
    .join('');
}

function generateWorkPackagesHTML(): string {
  const packages = results.pass1?.response.work_packages || [];

  return packages
    .map(
      (pkg) => `
    <div class="package">
      <div class="package-header">${pkg.name}</div>
      <div class="package-meta">
        ID: ${pkg.packageId} | CSI: ${pkg.csi_division} | Trade: ${pkg.trade} | Items: ${pkg.line_items?.length || 0}
        ${(pkg as any).confidence ? `<span class="confidence ${(pkg as any).confidence.overall >= 0.8 ? 'high' : (pkg as any).confidence.overall >= 0.6 ? 'medium' : 'low'}">${((pkg as any).confidence.overall * 100).toFixed(0)}% confidence</span>` : ''}
      </div>
      <div style="margin-top:10px;font-size:0.9em;color:#666">${pkg.description || ''}</div>
    </div>
  `
    )
    .join('');
}

function generateReferencesHTML(): string {
  const allItems = results.pass1?.response.work_packages?.flatMap((p) => p.line_items) || [];
  const itemsWithBbox = allItems
    .filter((i: any) => i.source_reference?.bounding_box && i.source_reference.bounding_box.length === 4)
    .slice(0, 10);

  if (itemsWithBbox.length === 0) {
    return '<p style="color:#666">No items with bounding boxes found.</p>';
  }

  return `
    <table>
      <tr>
        <th>Description</th>
        <th>Sheet</th>
        <th>Page</th>
        <th>Bounding Box</th>
      </tr>
      ${itemsWithBbox
        .map(
          (item: any) => `
        <tr>
          <td>${item.description?.substring(0, 50)}${(item.description?.length || 0) > 50 ? '...' : ''}</td>
          <td>${item.source_reference?.sheet || 'N/A'}</td>
          <td>${item.source_reference?.page || 'N/A'}</td>
          <td><span class="bbox">[${item.source_reference?.bounding_box?.join(', ') || 'N/A'}]</span></td>
        </tr>
      `
        )
        .join('')}
    </table>
  `;
}

async function main() {
  console.log('\n');
  printHeader('FULL EXTRACTION WORKFLOW TEST');
  console.log(`
  📁 Project: Kenai Rec Center Upgrades
  🤖 Model: gemini-2.5-pro
  📄 Documents: Design Drawings, Specs, Addenda
  `);

  await ensureOutputDir();

  const client = new GeminiClient();

  // Run Pass 1
  results.pass1 = await runPass1(client);
  if (!results.pass1) {
    console.error('\n❌ Workflow aborted: Pass 1 failed');
    return;
  }

  // Run Pass 2
  results.pass2 = await runPass2(client, results.pass1.response);

  // Run Pass 3 (multi-document)
  results.pass3 = await runPass3(client, results.pass1.response);

  // Analyze and print results
  analyzeResults();
  printWorkPackages();
  printAIObservations();
  printDocumentReferences();

  // Generate HTML report
  await generateHTMLReport();

  printHeader('WORKFLOW COMPLETE');
  console.log(`
  ✅ All passes completed
  📄 Results saved to: ${OUTPUT_DIR}/
  🌐 Open extraction-results.html to view the visual report
  `);
}

main().catch(console.error);
