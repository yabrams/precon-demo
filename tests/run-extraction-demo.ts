/**
 * Extraction Demo Script
 *
 * This script runs a full extraction on the sample Kenai project files
 * and outputs detailed results for inspection.
 *
 * Run with: npx ts-node tests/run-extraction-demo.ts
 * Or: npx tsx tests/run-extraction-demo.ts
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { GeminiClient } from '../lib/extraction/clients/gemini';
import { ExtractionDocument } from '../lib/extraction/types';

const SAMPLE_PROJECT_PATH = path.resolve(__dirname, '../sample_project');

const documents: ExtractionDocument[] = [
  {
    id: 'doc-design',
    name: '2032_kenai_rec_center_upgrades_100.pdf',
    url: path.join(SAMPLE_PROJECT_PATH, '2032_kenai_rec_center_upgrades_100.pdf'),
    type: 'design_drawings',
    mimeType: 'application/pdf',
  },
];

async function runDemo() {
  console.log('='.repeat(80));
  console.log('EXTRACTION DEMO - Kenai Rec Center Upgrades');
  console.log('='.repeat(80));
  console.log('\n📁 Documents being sent to Gemini:');
  documents.forEach((doc) => {
    console.log(`   - ${doc.name} (${doc.type})`);
    console.log(`     Path: ${doc.url}`);
  });

  const client = new GeminiClient();

  console.log('\n🤖 Model: gemini-2.5-pro');
  console.log('\n⏳ Running Pass 1: Initial Extraction...\n');

  try {
    const startTime = Date.now();
    const result = await client.extractWorkPackages(documents);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`✅ Extraction completed in ${duration}s`);
    console.log(`📊 Tokens used: ${result.tokensUsed.input} input, ${result.tokensUsed.output} output`);

    const response = result.response;

    // Project Name
    console.log('\n' + '='.repeat(80));
    console.log('PROJECT NAME');
    console.log('='.repeat(80));
    console.log(`   ${response.project_name || 'Not extracted'}`);

    // Work Packages Summary
    console.log('\n' + '='.repeat(80));
    console.log(`WORK PACKAGES (${response.work_packages?.length || 0} total)`);
    console.log('='.repeat(80));

    if (response.work_packages) {
      response.work_packages.forEach((pkg, i) => {
        console.log(`\n📦 [${i + 1}] ${pkg.name}`);
        console.log(`   Package ID: ${pkg.packageId}`);
        console.log(`   CSI Division: ${pkg.csi_division}`);
        console.log(`   Trade: ${pkg.trade}`);
        console.log(`   Description: ${pkg.description?.substring(0, 100)}${(pkg.description?.length || 0) > 100 ? '...' : ''}`);
        console.log(`   Line Items: ${pkg.line_items?.length || 0}`);

        // Show first 3 line items as sample
        if (pkg.line_items && pkg.line_items.length > 0) {
          console.log('\n   Sample Line Items:');
          pkg.line_items.slice(0, 3).forEach((item, j) => {
            console.log(`   ${j + 1}. ${item.description?.substring(0, 60)}${(item.description?.length || 0) > 60 ? '...' : ''}`);
            console.log(`      Action: ${item.action || 'N/A'}`);
            console.log(`      Quantity: ${item.quantity || 'N/A'} ${item.unit || ''}`);
            if (item.source_reference) {
              console.log(`      📄 Source: ${item.source_reference}`);
            }
            if (item.specifications) {
              console.log(`      📋 Specs: ${item.specifications?.substring(0, 50)}...`);
            }
          });
          if (pkg.line_items.length > 3) {
            console.log(`   ... and ${pkg.line_items.length - 3} more items`);
          }
        }
      });
    }

    // AI Observations
    console.log('\n' + '='.repeat(80));
    console.log('AI OBSERVATIONS & CONCERNS');
    console.log('='.repeat(80));

    if (response.ai_observations && response.ai_observations.length > 0) {
      response.ai_observations.forEach((obs, i) => {
        console.log(`\n🔍 [${i + 1}] ${obs.title || 'Observation'}`);
        console.log(`   Severity: ${obs.severity || 'N/A'}`);
        console.log(`   Category: ${obs.category || 'N/A'}`);
        console.log(`   Insight: ${obs.insight?.substring(0, 200)}${(obs.insight?.length || 0) > 200 ? '...' : ''}`);
        if (obs.suggested_actions && obs.suggested_actions.length > 0) {
          console.log(`   Suggested Actions:`);
          obs.suggested_actions.forEach((action) => {
            console.log(`   - ${action}`);
          });
        }
      });
    } else {
      console.log('\n   No AI observations in this extraction.');
      console.log('   (AI observations are typically generated in Pass 2 self-review)');
    }

    // Document References
    console.log('\n' + '='.repeat(80));
    console.log('DOCUMENT REFERENCES');
    console.log('='.repeat(80));

    let totalRefs = 0;
    let itemsWithRefs = 0;
    const allItems = response.work_packages?.flatMap((p) => p.line_items) || [];

    allItems.forEach((item) => {
      if (item.source_reference) {
        itemsWithRefs++;
      }
    });

    console.log(`\n   ${itemsWithRefs}/${allItems.length} line items have source references`);
    console.log('\n   Sample references:');

    const itemsWithSourceRef = allItems.filter((item) => item.source_reference).slice(0, 5);
    itemsWithSourceRef.forEach((item, i) => {
      console.log(`   ${i + 1}. "${item.description?.substring(0, 40)}..."`);
      console.log(`      → ${item.source_reference}`);
    });

    // Confidence Scores (if present)
    console.log('\n' + '='.repeat(80));
    console.log('CONFIDENCE & QUALITY');
    console.log('='.repeat(80));

    if (response.extraction_confidence) {
      console.log(`\n   Overall Confidence: ${(response.extraction_confidence * 100).toFixed(0)}%`);
    }

    // Calculate data completeness
    const withDescription = allItems.filter((i) => i.description).length;
    const withAction = allItems.filter((i) => i.action).length;
    const withQuantity = allItems.filter((i) => i.quantity !== null && i.quantity !== undefined).length;
    const withUnit = allItems.filter((i) => i.unit).length;
    const withRef = allItems.filter((i) => i.source_reference).length;

    console.log(`\n   Data Completeness:`);
    console.log(`   - Descriptions: ${withDescription}/${allItems.length} (${((withDescription/allItems.length)*100).toFixed(0)}%)`);
    console.log(`   - Actions: ${withAction}/${allItems.length} (${((withAction/allItems.length)*100).toFixed(0)}%)`);
    console.log(`   - Quantities: ${withQuantity}/${allItems.length} (${((withQuantity/allItems.length)*100).toFixed(0)}%)`);
    console.log(`   - Units: ${withUnit}/${allItems.length} (${((withUnit/allItems.length)*100).toFixed(0)}%)`);
    console.log(`   - Source Refs: ${withRef}/${allItems.length} (${((withRef/allItems.length)*100).toFixed(0)}%)`);

    // Incomplete Areas
    if (response.incomplete_areas && response.incomplete_areas.length > 0) {
      console.log(`\n   Incomplete Areas Flagged:`);
      response.incomplete_areas.forEach((area) => {
        console.log(`   ⚠️  ${area}`);
      });
    }

    // Extraction Notes
    if (response.extraction_notes) {
      console.log(`\n   Extraction Notes:`);
      console.log(`   ${response.extraction_notes}`);
    }

    // Save full JSON for inspection
    const outputPath = path.join(__dirname, 'extraction-results.json');
    const fs = await import('fs/promises');
    await fs.writeFile(outputPath, JSON.stringify(response, null, 2));
    console.log('\n' + '='.repeat(80));
    console.log(`📄 Full results saved to: ${outputPath}`);
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ Extraction failed:', error);
    process.exit(1);
  }
}

runDemo();
