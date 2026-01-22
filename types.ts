
export enum ViewType {
  CHAT = 'CHAT',
  ADMIN = 'ADMIN',
  ANALYTICS = 'ANALYTICS'
}

export type KbType = 'PARAMS' | 'MANUAL';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  hasSource?: boolean;
}

export interface InteractionLog {
  id: string;
  timestamp: string;
  user: string;
  query: string;
  response: string;
  confidence: number;
}

export interface Chunk {
  id: string;
  path: string;
  content: string;
  version: string;
  fileName: string;
  type: KbType;
  index: number; // 记录在原文档中的物理顺序
}

export interface KnowledgeBase {
  fileName: string;
  version: string;
  chunkCount: number;
  uploadDate: string;
  type: KbType;
}
