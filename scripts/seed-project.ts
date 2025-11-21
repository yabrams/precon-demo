import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Creating mock project...');

  // Create a BuildingConnected project
  const project = await prisma.buildingConnectedProject.create({
    data: {
      bcProjectId: 'BC-2025-001',
      name: 'Downtown Office Tower',
      projectNumber: 'DOT-2025-001',
      description: 'New 15-story Class A office building with underground parking, featuring sustainable design and modern amenities.',
      status: 'active',
      bidDueDate: new Date('2025-02-28'),
      expectedStartDate: new Date('2025-03-01'),
      expectedEndDate: new Date('2026-12-31'),
      address: '123 Main Street',
      city: 'San Francisco',
      state: 'CA',
      zipCode: '94102',
      country: 'USA',
      projectSize: 185000,
      projectSizeUnit: 'SF',
      projectValue: 25000000,
      marketSector: 'Commercial Office',
      typeOfWork: 'New Construction',
      architect: 'Smith & Associates Architecture',
      client: 'Acme Construction Corp',
      accountManager: 'John Smith',
      owningOffice: 'San Francisco Office',
      feePercentage: 6.5
    }
  });

  console.log('✅ Created project:', project.name);
  console.log('   Project ID:', project.id);
  console.log('   BC Project ID:', project.bcProjectId);
  console.log('   Status:', project.status);
  console.log('   Project Value: $' + project.projectValue?.toLocaleString());
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('\n✅ Database seeding completed successfully!');
  })
  .catch(async (e) => {
    console.error('❌ Error seeding database:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
