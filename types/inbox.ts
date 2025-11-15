export type InboxStatus = 'pending' | 'in_progress' | 'completed';

export interface InboxItem {
  id: string;
  sender: string;
  senderEmail: string;
  subject: string;
  receivedAt: number;
  diagramUrl: string;
  thumbnailUrl?: string;
  status: InboxStatus;
  projectId?: string; // Links to created project if already processed
}
