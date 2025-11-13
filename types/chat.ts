import { LineItem } from '@/components/BidFormTable';

export type ChatMode = 'question' | 'update';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  proposedChanges?: ProposedChange[];
}

export interface ProposedChange {
  type: 'add' | 'update' | 'delete';
  itemId?: string; // for update/delete
  newItem?: LineItem; // for add/update
  changes?: FieldChange[];
}

export interface FieldChange {
  field: string;
  oldValue: any;
  newValue: any;
}

export interface ChatRequest {
  message: string;
  imageUrl: string;
  currentLineItems: LineItem[];
  projectName: string;
  conversationHistory?: ChatMessage[];
}

export interface ChatResponse {
  response: string;
  proposedChanges?: ProposedChange[];
}
