#!/usr/bin/env npx tsx

/**
 * Test script for the enhanced extraction workflow
 * Run with: npx tsx scripts/test-extraction-workflow.ts
 */

import { PrismaClient } from '@prisma/client';
import {
  calculateFileHash,
  checkDuplicateFile,
  generateCopyName,
  processFilesForDuplicates
} from '../lib/file-utils';
import {
  categorizeLineItem,
  categorizeLineItems,
  createOrGetBidPackages,
  extractProjectName
} from '../lib/bid-package-utils';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();

async function testFileHashing() {
  console.log('\n🔍 Testing File Hashing...');

  // Create a test file
  const testContent = 'Test content for hashing';
  const testFile = path.join(process.cwd(), 'test-hash.tmp');
  fs.writeFileSync(testFile, testContent);

  try {
    const hash = await calculateFileHash(testFile);
    console.log('✅ File hash generated:', hash);

    // Clean up
    fs.unlinkSync(testFile);
  } catch (error) {
    console.error('❌ File hashing failed:', error);
  }
}

async function testDuplicateDetection() {
  console.log('\n🔍 Testing Duplicate Detection...');

  // Create a test diagram with a hash
  const testHash = 'test_hash_' + Date.now();
  const testProject = await prisma.buildingConnectedProject.create({
    data: {
      bcProjectId: 'test_bc_' + Date.now(),
      name: 'Test Project for Duplicate Detection',
      status: 'active'
    }
  });

  const testDiagram = await prisma.diagram.create({
    data: {
      bcProjectId: testProject.id,
      fileName: 'test.pdf',
      fileUrl: '/uploads/test.pdf',
      fileType: 'application/pdf',
      fileSize: 1024,
      fileHash: testHash
    }
  });

  // Test duplicate check
  const duplicate = await checkDuplicateFile(testHash);
  if (duplicate) {
    console.log('✅ Duplicate detection working:', duplicate.fileName);
  } else {
    console.log('❌ Duplicate not detected');
  }

  // Clean up
  await prisma.diagram.delete({ where: { id: testDiagram.id } });
  await prisma.buildingConnectedProject.delete({ where: { id: testProject.id } });
}

async function testCopyNumbering() {
  console.log('\n🔍 Testing Copy Numbering...');

  const existingNames = [
    'Project Alpha',
    'COPY 1 Project Alpha',
    'COPY 2 Project Alpha',
    'Project Beta'
  ];

  // Test various scenarios
  const tests = [
    { original: 'Project Alpha', expected: 'COPY 3 Project Alpha' },
    { original: 'Project Beta', expected: 'COPY 1 Project Beta' },
    { original: 'Project Gamma', expected: 'Project Gamma' },
    { original: 'COPY 1 Project Alpha', expected: 'COPY 3 Project Alpha' }
  ];

  for (const test of tests) {
    const result = generateCopyName(test.original, existingNames);
    if (result === test.expected) {
      console.log(`✅ "${test.original}" → "${result}"`);
    } else {
      console.log(`❌ "${test.original}" → Got "${result}", expected "${test.expected}"`);
    }
  }
}

async function testItemCategorization() {
  console.log('\n🔍 Testing Item Categorization...');

  const testItems = [
    { description: 'Install copper piping in bathroom' },
    { description: '200A electrical panel installation' },
    { description: 'HVAC ductwork in attic space' },
    { description: 'Wood framing for interior walls' },
    { description: 'Drywall installation and finishing' },
    { description: 'Ceramic tile flooring in kitchen' },
    { description: 'Asphalt shingle roofing replacement' },
    { description: 'Pour concrete foundation footings' },
    { description: 'Interior painting - all rooms' },
    { description: 'Landscaping and irrigation system' },
    { description: 'General supervision and cleanup' },
    { description: 'Miscellaneous hardware and fasteners' }
  ];

  console.log('Categorizing test items:');
  for (const item of testItems) {
    const category = categorizeLineItem(item.description);
    console.log(`  ${category.padEnd(20)} ← "${item.description}"`);
  }

  // Test batch categorization
  const categorized = categorizeLineItems(testItems);
  console.log('\nCategorized into', Object.keys(categorized).length, 'categories:');
  for (const [category, items] of Object.entries(categorized)) {
    console.log(`  ${category}: ${items.length} items`);
  }
}

async function testBidPackageCreation() {
  console.log('\n🔍 Testing Bid Package Creation...');

  // Create a test project
  const testProject = await prisma.buildingConnectedProject.create({
    data: {
      bcProjectId: 'test_bc_packages_' + Date.now(),
      name: 'Test Project for Bid Packages',
      status: 'active'
    }
  });

  try {
    // Create bid packages for different categories
    const categories = ['Plumbing', 'Electrical', 'HVAC'];
    const bidPackages = await createOrGetBidPackages(testProject.id, categories);

    console.log('Created bid packages:');
    for (const [category, pkg] of Object.entries(bidPackages)) {
      console.log(`  ✅ ${category}: ${(pkg as any).name} (${(pkg as any).id})`);
    }

    // Test that running again returns existing packages
    const existingPackages = await createOrGetBidPackages(testProject.id, categories);
    console.log('Verified reuse of existing packages:', Object.keys(existingPackages).length === categories.length);

    // Clean up bid packages
    for (const pkg of Object.values(bidPackages)) {
      await prisma.bidPackage.delete({ where: { id: (pkg as any).id } });
    }
  } catch (error) {
    console.error('❌ Bid package creation failed:', error);
  } finally {
    // Clean up project
    await prisma.buildingConnectedProject.delete({ where: { id: testProject.id } });
  }
}

async function testProjectNameExtraction() {
  console.log('\n🔍 Testing Project Name Extraction...');

  const tests = [
    {
      fileName: 'construction-plans-2024.pdf',
      extracted: null,
      expected: 'construction plans'
    },
    {
      fileName: '1234567890-project.pdf',
      extracted: 'Downtown Office Building',
      expected: 'Downtown Office Building'
    },
    {
      fileName: 'test_file_name_here.jpg',
      extracted: null,
      expected: 'test file name here'
    }
  ];

  for (const test of tests) {
    const result = extractProjectName(test.fileName, test.extracted);
    console.log(`  "${test.fileName}" → "${result}"`);
  }
}

async function main() {
  console.log('🚀 Starting Extraction Workflow Tests\n');

  try {
    await testFileHashing();
    await testDuplicateDetection();
    await testCopyNumbering();
    await testItemCategorization();
    await testBidPackageCreation();
    await testProjectNameExtraction();

    console.log('\n✅ All tests completed successfully!');
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run tests
main().catch(console.error);