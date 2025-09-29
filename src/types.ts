export interface Message {
  id: number;
  timestamp: string;
  sender: string;
  content: string;
  type: 'text' | 'media' | 'deleted';
  media?: string | null;
  mediaPath?: string;
  mediaType?: string;
}

export interface Chat {
  id: string;
  name: string;
  participants?: string[];
  participantCount: number;
  messageCount: number;
  messages?: Message[];
  lastMessage?: Message;
  createdAt: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}