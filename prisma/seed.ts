/**
 * Database Seed Script
 * Creates test users for each role: Admin, Precon Lead, Scope Captain, Precon Analyst
 * Run with: npx tsx prisma/seed.ts
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Delete existing users (careful in production!)
  console.log('🗑️  Clearing existing users...');
  await prisma.session.deleteMany();
  await prisma.userAssignment.deleteMany();
  await prisma.user.deleteMany();

  // Hash password for all test users
  const password = 'TestPassword123!';
  const passwordHash = await bcrypt.hash(password, 10);

  console.log('\n👤 Creating test users...');
  console.log(`📝 All users will have password: ${password}\n`);

  // 1. Admin User
  const admin = await prisma.user.create({
    data: {
      email: 'admin@cosmo.com',
      userName: 'admin',
      firstName: 'Admin',
      lastName: 'User',
      passwordHash,
      role: 'ADMIN',
      isActive: true,
      passwordResetRequired: false,
    },
  });
  console.log(`✅ Created ADMIN: ${admin.email} (${admin.userName})`);

  // 2. Precon Lead User
  const preconLead = await prisma.user.create({
    data: {
      email: 'precon.lead@cosmo.com',
      userName: 'preconlead',
      firstName: 'Sarah',
      lastName: 'Johnson',
      passwordHash,
      role: 'PRECON_LEAD',
      isActive: true,
      passwordResetRequired: false,
    },
  });
  console.log(`✅ Created PRECON_LEAD: ${preconLead.email} (${preconLead.userName})`);

  // 3. Scope Captain User
  const scopeCaptain = await prisma.user.create({
    data: {
      email: 'scope.captain@cosmo.com',
      userName: 'scopecaptain',
      firstName: 'Mike',
      lastName: 'Chen',
      passwordHash,
      role: 'SCOPE_CAPTAIN',
      isActive: true,
      passwordResetRequired: false,
    },
  });
  console.log(`✅ Created SCOPE_CAPTAIN: ${scopeCaptain.email} (${scopeCaptain.userName})`);

  // 4. Precon Analyst User 1
  const analyst1 = await prisma.user.create({
    data: {
      email: 'analyst1@cosmo.com',
      userName: 'analyst1',
      firstName: 'Emily',
      lastName: 'Rodriguez',
      passwordHash,
      role: 'PRECON_ANALYST',
      isActive: true,
      passwordResetRequired: false,
    },
  });
  console.log(`✅ Created PRECON_ANALYST: ${analyst1.email} (${analyst1.userName})`);

  // 5. Precon Analyst User 2
  const analyst2 = await prisma.user.create({
    data: {
      email: 'analyst2@cosmo.com',
      userName: 'analyst2',
      firstName: 'David',
      lastName: 'Kim',
      passwordHash,
      role: 'PRECON_ANALYST',
      isActive: true,
      passwordResetRequired: false,
    },
  });
  console.log(`✅ Created PRECON_ANALYST: ${analyst2.email} (${analyst2.userName})`);

  // 6. Inactive User (for testing deactivation)
  const inactiveUser = await prisma.user.create({
    data: {
      email: 'inactive@cosmo.com',
      userName: 'inactive',
      firstName: 'Inactive',
      lastName: 'User',
      passwordHash,
      role: 'PRECON_ANALYST',
      isActive: false,
      passwordResetRequired: false,
    },
  });
  console.log(`✅ Created INACTIVE user: ${inactiveUser.email} (${inactiveUser.userName})`);

  console.log('\n✨ Seed completed successfully!');
  console.log('\n📋 Summary:');
  console.log('  • 1 Admin');
  console.log('  • 1 Precon Lead');
  console.log('  • 1 Scope Captain');
  console.log('  • 2 Precon Analysts (active)');
  console.log('  • 1 Inactive user');
  console.log(`\n🔑 Login credentials for all users:`);
  console.log(`  Password: ${password}`);
  console.log('\n🔗 Test logins:');
  console.log(`  Admin:          admin@cosmo.com / ${password}`);
  console.log(`  Precon Lead:    precon.lead@cosmo.com / ${password}`);
  console.log(`  Scope Captain:  scope.captain@cosmo.com / ${password}`);
  console.log(`  Analyst 1:      analyst1@cosmo.com / ${password}`);
  console.log(`  Analyst 2:      analyst2@cosmo.com / ${password}`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
