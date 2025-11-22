/**
 * Mock PlanHub Data
 * Simulates PlanHub API responses for development
 */

export interface PlanHubProject {
  phProjectId: string;
  name: string;
  projectNumber?: string;
  description?: string;
  status: string;
  location?: {
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  bidDueDate?: Date;
  projectStartDate?: Date;
  projectEndDate?: Date;
  projectValue?: number;
  marketSector?: string;
  projectType?: string;
  buildingType?: string;
  ownerName?: string;
  architectName?: string;
  engineerName?: string;
  generalContractorName?: string;
  estimatedSquareFootage?: number;
  numberOfFloors?: number;
  projectPhase?: string;
  fundingType?: string;
  deliveryMethod?: string;
  contractType?: string;
  bondingRequired?: boolean;
  prevailingWageRequired?: boolean;
  minorityBusinessGoal?: number;
  womenBusinessGoal?: number;
  bidPackages?: {
    name: string;
    description?: string;
    budgetAmount?: number;
  }[];
}

export const mockPlanHubProjects: PlanHubProject[] = [
  {
    phProjectId: 'ph-2024-healthcare-001',
    name: 'Medical Center Expansion - Phase 2',
    projectNumber: 'MC-2024-002',
    description: '150,000 SF addition to existing medical center including surgery suites, patient rooms, and medical offices',
    status: 'bidding',
    location: {
      address: '2500 Healthcare Boulevard',
      city: 'Phoenix',
      state: 'AZ',
      zipCode: '85001',
      country: 'USA'
    },
    bidDueDate: new Date('2025-03-10T14:00:00Z'),
    projectStartDate: new Date('2025-04-01'),
    projectEndDate: new Date('2026-12-31'),
    projectValue: 95000000,
    marketSector: 'Healthcare',
    projectType: 'Addition',
    buildingType: 'Hospital',
    ownerName: 'Phoenix Health Systems',
    architectName: 'HDR Architecture',
    engineerName: 'TLC Engineering',
    generalContractorName: 'McCarthy Building Companies',
    estimatedSquareFootage: 150000,
    numberOfFloors: 4,
    projectPhase: 'Pre-Construction',
    fundingType: 'Private',
    deliveryMethod: 'Design-Bid-Build',
    contractType: 'Lump Sum',
    bondingRequired: true,
    prevailingWageRequired: false,
    minorityBusinessGoal: 15,
    womenBusinessGoal: 10,
    bidPackages: [
      {
        name: 'Site Work & Utilities',
        description: 'Site preparation, grading, utilities extension',
        budgetAmount: 3500000
      },
      {
        name: 'Structural & Shell',
        description: 'Foundation, structural steel, exterior envelope',
        budgetAmount: 28000000
      },
      {
        name: 'MEP Systems',
        description: 'Medical gas, HVAC, electrical, plumbing, fire protection',
        budgetAmount: 35000000
      },
      {
        name: 'Interior Finishes',
        description: 'Drywall, flooring, ceilings, millwork, specialties',
        budgetAmount: 18500000
      },
      {
        name: 'Medical Equipment',
        description: 'Surgery equipment, imaging equipment, patient room equipment',
        budgetAmount: 10000000
      }
    ]
  },
  {
    phProjectId: 'ph-2024-education-001',
    name: 'University Science Building',
    projectNumber: 'USB-2024-001',
    description: 'New 85,000 SF science building with research labs, classrooms, and student collaboration spaces',
    status: 'active',
    location: {
      address: '1200 University Drive',
      city: 'Boulder',
      state: 'CO',
      zipCode: '80302',
      country: 'USA'
    },
    bidDueDate: new Date('2025-01-30T16:00:00Z'),
    projectStartDate: new Date('2025-03-01'),
    projectEndDate: new Date('2026-08-15'),
    projectValue: 52000000,
    marketSector: 'Education',
    projectType: 'New Construction',
    buildingType: 'Laboratory',
    ownerName: 'University of Colorado Boulder',
    architectName: 'Perkins&Will',
    engineerName: 'Martin/Martin Consulting Engineers',
    generalContractorName: 'Hensel Phelps',
    estimatedSquareFootage: 85000,
    numberOfFloors: 5,
    projectPhase: 'Construction',
    fundingType: 'Public',
    deliveryMethod: 'CM/GC',
    contractType: 'GMP',
    bondingRequired: true,
    prevailingWageRequired: true,
    minorityBusinessGoal: 20,
    womenBusinessGoal: 12,
    bidPackages: [
      {
        name: 'Lab Equipment & Casework',
        description: 'Laboratory benches, fume hoods, casework, utilities',
        budgetAmount: 8500000
      },
      {
        name: 'Building Systems',
        description: 'HVAC, electrical, plumbing, controls',
        budgetAmount: 15000000
      },
      {
        name: 'Architectural Package',
        description: 'Envelope, interior finishes, specialties',
        budgetAmount: 18500000
      }
    ]
  },
  {
    phProjectId: 'ph-2024-residential-001',
    name: 'Riverside Luxury Apartments',
    projectNumber: 'RLA-2024-003',
    description: '250-unit luxury apartment complex with amenities, parking structure, and riverfront plaza',
    status: 'bidding',
    location: {
      address: '800 Riverfront Parkway',
      city: 'Portland',
      state: 'OR',
      zipCode: '97201',
      country: 'USA'
    },
    bidDueDate: new Date('2025-02-28T17:00:00Z'),
    projectStartDate: new Date('2025-04-15'),
    projectEndDate: new Date('2027-03-31'),
    projectValue: 78000000,
    marketSector: 'Residential',
    projectType: 'New Construction',
    buildingType: 'Multi-Family',
    ownerName: 'Riverfront Development LLC',
    architectName: 'Zimmer Gunsul Frasca Architects',
    engineerName: 'KPFF Consulting Engineers',
    estimatedSquareFootage: 320000,
    numberOfFloors: 8,
    projectPhase: 'Bidding',
    fundingType: 'Private',
    deliveryMethod: 'Design-Build',
    contractType: 'Lump Sum',
    bondingRequired: true,
    prevailingWageRequired: false,
    minorityBusinessGoal: 10,
    womenBusinessGoal: 8,
    bidPackages: [
      {
        name: 'Parking Structure',
        description: '3-level underground parking, 400 spaces',
        budgetAmount: 12000000
      },
      {
        name: 'Core & Shell',
        description: 'Foundation, structure, exterior envelope',
        budgetAmount: 35000000
      },
      {
        name: 'Tenant Improvements',
        description: 'Unit finishes, common areas, amenities',
        budgetAmount: 22000000
      },
      {
        name: 'Site & Landscape',
        description: 'Site work, landscaping, riverfront plaza',
        budgetAmount: 9000000
      }
    ]
  }
];

export async function getMockPlanHubProjects(): Promise<PlanHubProject[]> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 400));
  return mockPlanHubProjects;
}

export async function getMockPlanHubProject(phProjectId: string): Promise<PlanHubProject | null> {
  await new Promise(resolve => setTimeout(resolve, 300));
  return mockPlanHubProjects.find(p => p.phProjectId === phProjectId) || null;
}
