/**
 * Mock BuildingConnected data for testing and development
 * Used until real BC API integration is implemented
 */

import { BuildingConnectedProject } from '@/types/buildingconnected';
import { BidPackage } from '@/types/bidPackage';

// Using type assertion for mock data which may contain additional fields not in the core type
export const mockBuildingConnectedProjects: Array<Omit<BuildingConnectedProject, 'id' | 'createdAt' | 'updatedAt'> & Record<string, unknown>> = [
  {
    bcProjectId: 'bc-proj-2024-downtown-001',
    name: 'Downtown Office Tower',
    projectNumber: 'DT-2024-001',
    description: 'New 45-story mixed-use office tower in downtown district with retail podium and underground parking.',
    status: 'bidding',
    location: {
      address: '123 Main Street',
      city: 'San Francisco',
      state: 'CA',
      zipCode: '94102',
      country: 'USA',
      coordinates: {
        latitude: 37.7749,
        longitude: -122.4194
      }
    },
    bidDueDate: new Date('2025-02-15T17:00:00Z'),
    projectStartDate: new Date('2025-04-01T00:00:00Z'),
    projectEndDate: new Date('2027-12-31T00:00:00Z'),
    projectValue: 185000000,
    currency: 'USD',
    marketSector: 'Commercial',
    projectType: 'New Construction',
    buildingType: 'Office',
    ownerName: 'Downtown Development Corp',
    architectName: 'Smith & Associates Architecture',
    engineerName: 'Structural Engineers Inc',
    generalContractorName: null,
    estimatedSquareFootage: 650000,
    numberOfFloors: 45,
    projectPhase: 'Bidding',
    fundingType: 'Private',
    deliveryMethod: 'Design-Bid-Build',
    contractType: 'Lump Sum',
    bondingRequired: true,
    minorityBusinessGoal: 15,
    womenBusinessGoal: 10,
    prevailingWageRequired: true,
    tags: ['high-rise', 'LEED Gold', 'seismic'],
    customFields: {
      leedCertification: 'Gold',
      seismicZone: 'Zone 4'
    }
  },
  {
    bcProjectId: 'bc-proj-2024-hospital-002',
    name: 'Regional Medical Center Expansion',
    projectNumber: 'RMC-2024-002',
    description: 'Three-story patient tower addition with 120 beds, surgical suites, and imaging center.',
    status: 'active',
    location: {
      address: '456 Healthcare Drive',
      city: 'Los Angeles',
      state: 'CA',
      zipCode: '90012',
      country: 'USA'
    },
    bidDueDate: new Date('2025-01-20T17:00:00Z'),
    projectStartDate: new Date('2025-03-01T00:00:00Z'),
    projectEndDate: new Date('2027-08-31T00:00:00Z'),
    projectValue: 95000000,
    currency: 'USD',
    marketSector: 'Healthcare',
    projectType: 'Addition',
    buildingType: 'Hospital',
    ownerName: 'Regional Health System',
    architectName: 'Healthcare Design Group',
    engineerName: 'MEP Engineering Partners',
    numberOfFloors: 3,
    estimatedSquareFootage: 180000,
    projectPhase: 'Construction',
    fundingType: 'Public',
    deliveryMethod: 'CM at Risk',
    contractType: 'GMP',
    bondingRequired: true,
    prevailingWageRequired: true,
    tags: ['healthcare', 'OSHPD', 'critical systems']
  },
  {
    bcProjectId: 'bc-proj-2024-school-003',
    name: 'Lincoln Elementary School Modernization',
    projectNumber: 'LES-2024-003',
    description: 'Complete modernization of 1960s elementary school including seismic upgrades, new HVAC, and classroom renovations.',
    status: 'bidding',
    location: {
      address: '789 Education Way',
      city: 'Oakland',
      state: 'CA',
      zipCode: '94601',
      country: 'USA'
    },
    bidDueDate: new Date('2025-03-10T14:00:00Z'),
    projectStartDate: new Date('2025-06-15T00:00:00Z'),
    projectEndDate: new Date('2026-08-15T00:00:00Z'),
    projectValue: 28000000,
    currency: 'USD',
    marketSector: 'Education',
    projectType: 'Renovation',
    buildingType: 'K-12 School',
    ownerName: 'Oakland Unified School District',
    architectName: 'Education Architects LLP',
    numberOfFloors: 2,
    estimatedSquareFootage: 85000,
    projectPhase: 'Bidding',
    fundingType: 'Public',
    deliveryMethod: 'Design-Bid-Build',
    contractType: 'Lump Sum',
    bondingRequired: true,
    minorityBusinessGoal: 20,
    womenBusinessGoal: 15,
    prevailingWageRequired: true,
    tags: ['DSA', 'seismic upgrade', 'summer construction']
  },
  {
    bcProjectId: 'bc-proj-2024-warehouse-004',
    name: 'Tech Campus Distribution Center',
    projectNumber: 'TC-DC-2024-004',
    description: 'High-bay distribution warehouse with automated material handling systems and office space.',
    status: 'bidding',
    location: {
      address: '2000 Industrial Parkway',
      city: 'Fremont',
      state: 'CA',
      zipCode: '94538',
      country: 'USA'
    },
    bidDueDate: new Date('2025-02-28T17:00:00Z'),
    projectStartDate: new Date('2025-05-01T00:00:00Z'),
    projectEndDate: new Date('2026-04-30T00:00:00Z'),
    projectValue: 42000000,
    currency: 'USD',
    marketSector: 'Industrial',
    projectType: 'New Construction',
    buildingType: 'Warehouse',
    ownerName: 'TechLogistics Inc',
    architectName: 'Industrial Design Co',
    engineerName: 'Structural & Civil Engineers',
    numberOfFloors: 1,
    estimatedSquareFootage: 350000,
    projectPhase: 'Bidding',
    fundingType: 'Private',
    deliveryMethod: 'Design-Build',
    contractType: 'Lump Sum',
    bondingRequired: false,
    tags: ['tilt-up', 'high-bay', 'automation']
  },
  {
    bcProjectId: 'bc-proj-2024-housing-005',
    name: 'Riverside Affordable Housing',
    projectNumber: 'RAH-2024-005',
    description: 'Four-story mixed-income residential development with 180 units, community center, and courtyards.',
    status: 'awarded',
    location: {
      address: '555 River Road',
      city: 'Sacramento',
      state: 'CA',
      zipCode: '95814',
      country: 'USA'
    },
    bidDueDate: new Date('2024-11-30T17:00:00Z'),
    projectStartDate: new Date('2025-02-01T00:00:00Z'),
    projectEndDate: new Date('2026-12-31T00:00:00Z'),
    projectValue: 68000000,
    currency: 'USD',
    marketSector: 'Residential',
    projectType: 'New Construction',
    buildingType: 'Multifamily',
    ownerName: 'Community Housing Partners',
    architectName: 'Residential Design Studio',
    generalContractorName: 'West Coast Builders',
    numberOfFloors: 4,
    estimatedSquareFootage: 220000,
    projectPhase: 'Construction',
    fundingType: 'Mixed',
    deliveryMethod: 'Design-Bid-Build',
    contractType: 'Lump Sum',
    bondingRequired: true,
    minorityBusinessGoal: 25,
    womenBusinessGoal: 15,
    prevailingWageRequired: true,
    tags: ['affordable housing', 'tax credits', 'Type V']
  }
];

// Using type assertion for mock data which may contain additional fields
export const mockBidPackagesByProject: Record<string, Array<Omit<BidPackage, 'id' | 'createdAt' | 'updatedAt'> & Record<string, unknown>>> = {
  'bc-proj-2024-downtown-001': [
    {
      bcBidPackageId: 'bp-dt001-concrete',
      bcProjectId: 'bc-proj-2024-downtown-001',
      name: 'CONCRETE',
      status: 'bidding',
      progress: 0
    },
    {
      bcBidPackageId: 'bp-dt001-steel',
      bcProjectId: 'bc-proj-2024-downtown-001',
      name: 'STRUCTURAL STEEL',
      status: 'bidding',
      progress: 0
    },
    {
      bcBidPackageId: 'bp-dt001-mep',
      bcProjectId: 'bc-proj-2024-downtown-001',
      name: 'MEP',
      status: 'bidding',
      progress: 0
    }
  ],
  'bc-proj-2024-hospital-002': [
    {
      bcBidPackageId: 'bp-rmc002-mep',
      bcProjectId: 'bc-proj-2024-hospital-002',
      name: 'MEP',
      status: 'active',
      progress: 35
    },
    {
      bcBidPackageId: 'bp-rmc002-finishes',
      bcProjectId: 'bc-proj-2024-hospital-002',
      name: 'ARCHITECTURAL FINISHES',
      status: 'active',
      progress: 15
    }
  ],
  'bc-proj-2024-school-003': [
    {
      bcBidPackageId: 'bp-les003-seismic',
      bcProjectId: 'bc-proj-2024-school-003',
      name: 'STRUCTURAL STEEL',
      status: 'bidding',
      progress: 0
    },
    {
      bcBidPackageId: 'bp-les003-hvac',
      bcProjectId: 'bc-proj-2024-school-003',
      name: 'MEP',
      status: 'bidding',
      progress: 0
    }
  ],
  'bc-proj-2024-warehouse-004': [
    {
      bcBidPackageId: 'bp-tcdc004-concrete',
      bcProjectId: 'bc-proj-2024-warehouse-004',
      name: 'CONCRETE',
      status: 'bidding',
      progress: 0
    },
    {
      bcBidPackageId: 'bp-tcdc004-steel',
      bcProjectId: 'bc-proj-2024-warehouse-004',
      name: 'STRUCTURAL STEEL',
      status: 'bidding',
      progress: 0
    }
  ],
  'bc-proj-2024-housing-005': [
    {
      bcBidPackageId: 'bp-rah005-concrete',
      bcProjectId: 'bc-proj-2024-housing-005',
      name: 'CONCRETE',
      status: 'active',
      progress: 60
    },
    {
      bcBidPackageId: 'bp-rah005-framing',
      bcProjectId: 'bc-proj-2024-housing-005',
      name: 'SITE WORK',
      status: 'active',
      progress: 40
    }
  ]
};

/**
 * Get mock BC projects (simulates API call)
 */
export async function getMockBCProjects(): Promise<Omit<BuildingConnectedProject, 'id' | 'createdAt' | 'updatedAt'>[]> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300));
  return mockBuildingConnectedProjects;
}

/**
 * Get mock bid packages for a specific BC project
 */
export async function getMockBidPackages(bcProjectId: string): Promise<Omit<BidPackage, 'id' | 'createdAt' | 'updatedAt'>[]> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 200));
  return mockBidPackagesByProject[bcProjectId] || [];
}

/**
 * Get a single mock BC project by ID
 */
export async function getMockBCProject(bcProjectId: string): Promise<Omit<BuildingConnectedProject, 'id' | 'createdAt' | 'updatedAt'> | null> {
  await new Promise(resolve => setTimeout(resolve, 200));
  return mockBuildingConnectedProjects.find(p => p.bcProjectId === bcProjectId) || null;
}
