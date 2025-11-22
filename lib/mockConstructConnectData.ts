/**
 * Mock ConstructConnect Data
 * Simulates ConstructConnect API responses for development
 */

export interface ConstructConnectProject {
  ccProjectId: string;
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

export const mockConstructConnectProjects: ConstructConnectProject[] = [
  {
    ccProjectId: 'cc-2024-infrastructure-001',
    name: 'Highway 101 Bridge Replacement',
    projectNumber: 'HWY-101-BR-2024',
    description: 'Replacement of existing bridge with new 4-lane bridge including approach work and retaining walls',
    status: 'bidding',
    location: {
      address: 'Highway 101 Mile Marker 42',
      city: 'Santa Barbara',
      state: 'CA',
      zipCode: '93101',
      country: 'USA'
    },
    bidDueDate: new Date('2025-02-20T10:00:00Z'),
    projectStartDate: new Date('2025-04-01'),
    projectEndDate: new Date('2027-06-30'),
    projectValue: 145000000,
    marketSector: 'Infrastructure',
    projectType: 'Bridge Replacement',
    buildingType: 'Bridge',
    ownerName: 'California Department of Transportation',
    architectName: 'HNTB Corporation',
    engineerName: 'Moffatt & Nichol',
    estimatedSquareFootage: null,
    numberOfFloors: null,
    projectPhase: 'Bidding',
    fundingType: 'Public',
    deliveryMethod: 'Design-Bid-Build',
    contractType: 'Unit Price',
    bondingRequired: true,
    prevailingWageRequired: true,
    minorityBusinessGoal: 18,
    womenBusinessGoal: 10,
    bidPackages: [
      {
        name: 'Demolition & Earthwork',
        description: 'Existing bridge demo, excavation, grading',
        budgetAmount: 15000000
      },
      {
        name: 'Bridge Structure',
        description: 'Foundation, piers, abutments, superstructure',
        budgetAmount: 85000000
      },
      {
        name: 'Roadway & Approach',
        description: 'Paving, striping, signage, barriers',
        budgetAmount: 25000000
      },
      {
        name: 'Utilities & Drainage',
        description: 'Storm drainage, utility relocation',
        budgetAmount: 12000000
      },
      {
        name: 'Environmental & Landscaping',
        description: 'Erosion control, revegetation, mitigation',
        budgetAmount: 8000000
      }
    ]
  },
  {
    ccProjectId: 'cc-2024-industrial-001',
    name: 'Advanced Manufacturing Facility',
    projectNumber: 'AMF-2024-001',
    description: '500,000 SF state-of-the-art manufacturing facility with clean rooms, R&D labs, and office space',
    status: 'active',
    location: {
      address: '15000 Technology Parkway',
      city: 'Austin',
      state: 'TX',
      zipCode: '78721',
      country: 'USA'
    },
    bidDueDate: new Date('2024-12-15T15:00:00Z'),
    projectStartDate: new Date('2025-01-15'),
    projectEndDate: new Date('2026-09-30'),
    projectValue: 285000000,
    marketSector: 'Industrial',
    projectType: 'New Construction',
    buildingType: 'Manufacturing',
    ownerName: 'Applied Materials Inc.',
    architectName: 'Page Southerland Page',
    engineerName: 'ME Engineers',
    generalContractorName: 'Austin Commercial',
    estimatedSquareFootage: 500000,
    numberOfFloors: 2,
    projectPhase: 'Construction',
    fundingType: 'Private',
    deliveryMethod: 'Design-Build',
    contractType: 'GMP',
    bondingRequired: true,
    prevailingWageRequired: false,
    minorityBusinessGoal: 12,
    womenBusinessGoal: 8,
    bidPackages: [
      {
        name: 'Clean Room Systems',
        description: 'ISO Class 5-7 clean rooms, HEPA filtration, controls',
        budgetAmount: 65000000
      },
      {
        name: 'Process Utilities',
        description: 'DI water, nitrogen, compressed air, vacuum systems',
        budgetAmount: 42000000
      },
      {
        name: 'Building Shell',
        description: 'Foundation, structure, envelope, roofing',
        budgetAmount: 85000000
      },
      {
        name: 'Electrical & Controls',
        description: 'Power distribution, backup power, building automation',
        budgetAmount: 55000000
      },
      {
        name: 'Interior Build-Out',
        description: 'Offices, labs, support spaces, finishes',
        budgetAmount: 38000000
      }
    ]
  },
  {
    ccProjectId: 'cc-2024-commercial-001',
    name: 'Downtown Transit Center',
    projectNumber: 'DTC-2024-002',
    description: 'Multi-modal transit center with bus bays, light rail station, retail, and parking',
    status: 'bidding',
    location: {
      address: '500 Transit Way',
      city: 'Seattle',
      state: 'WA',
      zipCode: '98101',
      country: 'USA'
    },
    bidDueDate: new Date('2025-03-15T14:00:00Z'),
    projectStartDate: new Date('2025-05-01'),
    projectEndDate: new Date('2027-12-31'),
    projectValue: 175000000,
    marketSector: 'Transportation',
    projectType: 'New Construction',
    buildingType: 'Transit Facility',
    ownerName: 'King County Metro',
    architectName: 'LMN Architects',
    engineerName: 'Magnusson Klemencic Associates',
    generalContractorName: 'Skanska USA',
    estimatedSquareFootage: 285000,
    numberOfFloors: 4,
    projectPhase: 'Bidding',
    fundingType: 'Public',
    deliveryMethod: 'CM/GC',
    contractType: 'GMP',
    bondingRequired: true,
    prevailingWageRequired: true,
    minorityBusinessGoal: 25,
    womenBusinessGoal: 15,
    bidPackages: [
      {
        name: 'Transit Infrastructure',
        description: 'Bus bays, platform, canopies, rail integration',
        budgetAmount: 45000000
      },
      {
        name: 'Building Construction',
        description: 'Structure, envelope, interior spaces',
        budgetAmount: 65000000
      },
      {
        name: 'MEP & Technology',
        description: 'HVAC, electrical, plumbing, communications, security',
        budgetAmount: 38000000
      },
      {
        name: 'Site & Parking',
        description: 'Site work, utilities, parking structure',
        budgetAmount: 27000000
      }
    ]
  },
  {
    ccProjectId: 'cc-2024-government-001',
    name: 'Federal Courthouse Renovation',
    projectNumber: 'FCR-2024-001',
    description: 'Historic courthouse renovation and modernization including security upgrades and systems replacement',
    status: 'active',
    location: {
      address: '700 Federal Plaza',
      city: 'Denver',
      state: 'CO',
      zipCode: '80202',
      country: 'USA'
    },
    bidDueDate: new Date('2024-11-30T12:00:00Z'),
    projectStartDate: new Date('2025-01-15'),
    projectEndDate: new Date('2026-12-31'),
    projectValue: 68000000,
    marketSector: 'Government',
    projectType: 'Renovation',
    buildingType: 'Courthouse',
    ownerName: 'General Services Administration',
    architectName: 'Gensler',
    engineerName: 'ME Engineers',
    generalContractorName: 'JE Dunn Construction',
    estimatedSquareFootage: 185000,
    numberOfFloors: 6,
    projectPhase: 'Construction',
    fundingType: 'Federal',
    deliveryMethod: 'Design-Bid-Build',
    contractType: 'Lump Sum',
    bondingRequired: true,
    prevailingWageRequired: true,
    minorityBusinessGoal: 20,
    womenBusinessGoal: 12,
    bidPackages: [
      {
        name: 'Historic Restoration',
        description: 'Facade restoration, historic finishes, preservation',
        budgetAmount: 15000000
      },
      {
        name: 'Security Systems',
        description: 'Access control, cameras, screening equipment',
        budgetAmount: 12000000
      },
      {
        name: 'MEP Replacement',
        description: 'Complete HVAC, electrical, plumbing replacement',
        budgetAmount: 25000000
      },
      {
        name: 'Interior Renovation',
        description: 'Courtrooms, offices, public spaces modernization',
        budgetAmount: 16000000
      }
    ]
  }
];

export async function getMockConstructConnectProjects(): Promise<ConstructConnectProject[]> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  return mockConstructConnectProjects;
}

export async function getMockConstructConnectProject(ccProjectId: string): Promise<ConstructConnectProject | null> {
  await new Promise(resolve => setTimeout(resolve, 350));
  return mockConstructConnectProjects.find(p => p.ccProjectId === ccProjectId) || null;
}
