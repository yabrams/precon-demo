/**
 * Migration script to update bid package statuses to new workflow states
 * Run with: npx tsx scripts/migrate-bid-package-statuses.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Status mapping from old to new
const statusMapping: Record<string, string> = {
  'draft': 'to do',
  'active': 'in progress',
  'bidding': 'bidding',
  'awarded': 'completed',
  'closed': 'completed',
};

async function migrateBidPackageStatuses() {
  console.log('Starting bid package status migration...\n');

  try {
    // Get all bid packages
    const bidPackages = await prisma.bidPackage.findMany({
      select: {
        id: true,
        name: true,
        status: true,
      },
    });

    console.log(`Found ${bidPackages.length} bid packages to process\n`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const pkg of bidPackages) {
      const newStatus = statusMapping[pkg.status];

      if (newStatus && newStatus !== pkg.status) {
        console.log(`Updating "${pkg.name}": "${pkg.status}" → "${newStatus}"`);

        await prisma.bidPackage.update({
          where: { id: pkg.id },
          data: { status: newStatus },
        });

        updatedCount++;
      } else if (!newStatus) {
        console.log(`⚠️  Unknown status "${pkg.status}" for "${pkg.name}" - skipping`);
        skippedCount++;
      } else {
        console.log(`✓ "${pkg.name}" already has new status: "${pkg.status}"`);
        skippedCount++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`Migration complete!`);
    console.log(`Updated: ${updatedCount} bid packages`);
    console.log(`Skipped: ${skippedCount} bid packages`);
    console.log('='.repeat(50));

  } catch (error) {
    console.error('Error during migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateBidPackageStatuses()
  .then(() => {
    console.log('\n✅ Migration script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration script failed:', error);
    process.exit(1);
  });
