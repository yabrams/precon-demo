#!/usr/bin/env npx tsx

/**
 * Direct test of extraction API for construction drawings
 */

async function testExtraction() {
  console.log('🔍 Testing extraction on construction drawing...\n');

  // Use a file that actually exists (coca-cola construction diagram)
  const imageUrl = '/uploads/coca-cola-level-01.png';

  try {
    // Test regular extraction API
    console.log('Testing regular extraction API...');
    const extractResponse = await fetch('http://localhost:3000/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl,
        instructions: `Extract all construction items from this drain field and sidewalk construction drawing. Include:
- Drain field components and specifications
- Concrete sidewalk details
- Roof drain materials
- Any pipes, aggregates, or structural elements
- Measurements and quantities where visible`
      })
    });

    const extractData = await extractResponse.json();

    if (!extractResponse.ok) {
      console.error('❌ Extraction failed:', extractData);
      return;
    }

    console.log('✅ Extraction successful!');
    console.log('Project Name:', extractData.project_name || 'Not found');
    console.log('Confidence:', extractData.extraction_confidence);
    console.log('Number of items extracted:', extractData.line_items?.length || 0);

    if (extractData.line_items && extractData.line_items.length > 0) {
      console.log('\n📋 Extracted Items:');
      extractData.line_items.forEach((item: any, index: number) => {
        console.log(`\n${index + 1}. ${item.description}`);
        if (item.quantity) console.log(`   Quantity: ${item.quantity} ${item.unit || ''}`);
        if (item.notes) console.log(`   Notes: ${item.notes}`);
      });
    }

    // Test batch extraction API
    console.log('\n\nTesting batch extraction API...');
    const batchResponse = await fetch('http://localhost:3000/api/extract/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        diagrams: [{
          diagramId: 'test_' + Date.now(),
          imageUrl,
          fileName: 'drain-field-drawing.png',
          fileHash: 'test_hash_' + Date.now()
        }],
        createNewProject: false,
        projectName: 'Drain Field Construction Test'
      })
    });

    const batchData = await batchResponse.json();

    if (!batchResponse.ok) {
      console.error('❌ Batch extraction failed:', batchData);
      return;
    }

    console.log('✅ Batch extraction successful!');
    console.log('Message:', batchData.message);
    if (batchData.bidPackages) {
      console.log('\n📦 Created Bid Packages:');
      batchData.bidPackages.forEach((pkg: any) => {
        console.log(`- ${pkg.name} (${pkg.category}): ${pkg.itemCount} items`);
      });
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testExtraction().catch(console.error);