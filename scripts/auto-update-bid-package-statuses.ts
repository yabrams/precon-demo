/**
 * Auto-update bid package statuses based on business rules
 * Run with: npx tsx scripts/auto-update-bid-package-statuses.ts
 *
 * Rules:
 * 1. No captain assigned → "to do"
 * 2. Captain assigned, no work started → "assigned"
 * 3. Captain assigned, work started → "in progress"
 * 4. Keep existing "in review", "bidding", "bidding leveling", "completed" statuses
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function calculateStatus(bidPackage: {
  captainName: string | null;
  progress: number;
  bidForms: any[];
  status: string;
}): string {
  // Don't override these advanced statuses - keep them as is
  const preservedStatuses = ['in review', 'bidding', 'bidding leveling', 'completed'];
  if (preservedStatuses.includes(bidPackage.status)) {
    return bidPackage.status;
  }

  // Rule 1: No captain assigned → "to do"
  if (!bidPackage.captainName) {
    return 'to do';
  }

  // Rule 2 & 3: Captain assigned
  // If work has started (progress > 0 OR has bid forms), it's "in progress"
  // Otherwise it's just "assigned"
  const hasStartedWork = bidPackage.progress > 0 || bidPackage.bidForms.length > 0;

  if (hasStartedWork) {
    return 'in progress';
  } else {
    return 'assigned';
  }
}

async function autoUpdateBidPackageStatuses() {
  console.log('Starting automatic bid package status update...\n');

  try {
    // Get all bid packages with related data
    const bidPackages = await prisma.bidPackage.findMany({
      include: {
        bidForms: {
          select: {
            id: true,
          },
        },
      },
    });

    console.log(`Found ${bidPackages.length} bid packages to process\n`);

    let updatedCount = 0;
    let unchangedCount = 0;

    for (const pkg of bidPackages) {
      const currentStatus = pkg.status;
      const calculatedStatus = calculateStatus({
        captainName: pkg.captainName,
        progress: pkg.progress,
        bidForms: pkg.bidForms,
        status: pkg.status,
      });

      if (calculatedStatus !== currentStatus) {
        console.log(`📦 "${pkg.name}"`);
        console.log(`   Captain: ${pkg.captainName || 'None'}`);
        console.log(`   Progress: ${pkg.progress}%`);
        console.log(`   Bid Forms: ${pkg.bidForms.length}`);
        console.log(`   Status: "${currentStatus}" → "${calculatedStatus}"`);
        console.log();

        await prisma.bidPackage.update({
          where: { id: pkg.id },
          data: { status: calculatedStatus },
        });

        updatedCount++;
      } else {
        console.log(`✓ "${pkg.name}" - status correct: "${currentStatus}"`);
        unchangedCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`Auto-update complete!`);
    console.log(`Updated: ${updatedCount} bid packages`);
    console.log(`Unchanged: ${unchangedCount} bid packages`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('Error during auto-update:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the auto-update
autoUpdateBidPackageStatuses()
  .then(() => {
    console.log('\n✅ Auto-update script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Auto-update script failed:', error);
    process.exit(1);
  });
