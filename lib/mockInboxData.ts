import { InboxItem } from '@/types/inbox';
import { LineItem } from '@/components/BidFormTable';
import cokeExtractedData from './cokeExtractionData.json';

// Helper to generate timestamps (recent to older)
const daysAgo = (days: number) => Date.now() - days * 24 * 60 * 60 * 1000;

// Helper to generate unique IDs
const generateId = () => `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Convert extracted Coca-Cola data to LineItem format
const cokeHQLineItems: LineItem[] = cokeExtractedData.line_items.map((item, index) => ({
  id: `coke-${index}`,
  item_number: item.item_number,
  description: item.description,
  quantity: item.quantity,
  unit: item.unit,
  unit_price: item.unit_price,
  total_price: item.total_price,
  notes: item.notes,
  boundingBox: item.boundingBox,
}));

const buildingPlansLineItems: LineItem[] = [
  {
    id: 'mock-4',
    item_number: '1.1',
    description: 'Demolition of existing partition walls',
    quantity: 120,
    unit: 'SF',
    unit_price: 15,
    total_price: 1800,
    notes: 'Include debris removal',
  },
  {
    id: 'mock-5',
    item_number: '1.2',
    description: 'New gypsum board partition walls',
    quantity: 240,
    unit: 'SF',
    unit_price: 35,
    total_price: 8400,
    notes: 'Fire-rated 1-hour',
  },
];

const officeLayoutLineItems: LineItem[] = [
  {
    id: 'mock-6',
    item_number: '4.1',
    description: 'Carpet tile flooring - Interface product',
    quantity: 3500,
    unit: 'SF',
    unit_price: 8.5,
    total_price: 29750,
    notes: 'Color: Granite Grey',
  },
  {
    id: 'mock-7',
    item_number: '4.2',
    description: 'LVT flooring in break room and corridors',
    quantity: 850,
    unit: 'SF',
    unit_price: 12,
    total_price: 10200,
    notes: 'Waterproof vinyl plank',
  },
  {
    id: 'mock-8',
    item_number: '5.1',
    description: 'Suspended acoustic ceiling tiles',
    quantity: 3200,
    unit: 'SF',
    unit_price: 6.25,
    total_price: 20000,
    notes: 'Armstrong 2x2 tiles',
  },
];

const electricalLineItems: LineItem[] = [
  {
    id: 'mock-9',
    item_number: '8.1',
    description: 'Electrical panel upgrade - 400A service',
    quantity: 1,
    unit: 'EA',
    unit_price: 8500,
    total_price: 8500,
    notes: 'Include disconnect and conduit',
  },
  {
    id: 'mock-10',
    item_number: '8.2',
    description: 'LED lighting fixtures - recessed downlights',
    quantity: 48,
    unit: 'EA',
    unit_price: 125,
    total_price: 6000,
    notes: '4-inch aperture, dimmable',
  },
];

const hvacLineItems: LineItem[] = [
  {
    id: 'mock-11',
    item_number: '9.1',
    description: 'Variable refrigerant flow (VRF) system',
    quantity: 1,
    unit: 'LS',
    unit_price: 45000,
    total_price: 45000,
    notes: 'Includes outdoor and indoor units',
  },
  {
    id: 'mock-12',
    item_number: '9.2',
    description: 'Ductwork and diffusers',
    quantity: 24,
    unit: 'EA',
    unit_price: 450,
    total_price: 10800,
    notes: 'Linear slot diffusers',
  },
];

// Mock inbox data - 5 example diagrams
export const mockInboxItems: InboxItem[] = [
  {
    id: 'inbox-1',
    sender: 'John Smith',
    senderEmail: 'john.smith@contractor.com',
    subject: `${cokeExtractedData.project_name} - Building 2+3`,
    receivedAt: daysAgo(1),
    diagramUrl: '/uploads/coca-cola-level-01.png',
    status: 'pending',
  },
  {
    id: 'inbox-2',
    sender: 'Sarah Jones',
    senderEmail: 'sarah.jones@architecture.com',
    subject: 'Updated Floor Plans - Phase 2 Construction',
    receivedAt: daysAgo(2),
    diagramUrl: '/uploads/coca-cola-level-01.png',
    status: 'pending',
  },
  {
    id: 'inbox-3',
    sender: 'Mike Wilson',
    senderEmail: 'mike.wilson@design.com',
    subject: 'Office Layout Revisions - Final Draft',
    receivedAt: daysAgo(3),
    diagramUrl: '/uploads/coca-cola-level-01.png',
    status: 'in_progress',
  },
  {
    id: 'inbox-4',
    sender: 'Lisa Brown',
    senderEmail: 'lisa.brown@engineering.com',
    subject: 'Electrical Diagram v2 - Power Distribution',
    receivedAt: daysAgo(5),
    diagramUrl: '/uploads/coca-cola-level-01.png',
    status: 'in_progress',
  },
  {
    id: 'inbox-5',
    sender: 'David Chen',
    senderEmail: 'david.chen@mep.com',
    subject: 'HVAC System Plans - Mechanical Equipment',
    receivedAt: daysAgo(7),
    diagramUrl: '/uploads/coca-cola-level-01.png',
    status: 'completed',
  },
];

// Map of inbox items to their pre-extracted line items
export const mockInboxLineItems: Record<string, LineItem[]> = {
  'inbox-1': cokeHQLineItems,
  'inbox-2': buildingPlansLineItems,
  'inbox-3': officeLayoutLineItems,
  'inbox-4': electricalLineItems,
  'inbox-5': hvacLineItems,
};
