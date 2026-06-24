import Dexie, { type Table } from 'dexie';

export interface Chat {
  id: string;
  title: string;
  systemPrompt?: string;
  modelId: string;
  temperature: number;
  createdAt: number;
  updatedAt: number;
}

export interface Attachment {
  name: string;
  type: 'image' | 'pdf' | 'text';
  content: string; // base64 data URL for images, raw text for text/pdf
  size: number;
}

export interface Message {
  id: string;
  chatId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: Attachment[];
  modelUsed?: string;
  timestamp: number;
}

export interface Setting {
  key: string;
  value: any;
}

export interface ProviderConfig {
  id: string; // 'gemini' | 'openai' | 'claude' | 'deepseek' | 'ollama' | 'custom'
  name: string;
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  models: string[];
  corsProxy: string;
}

class MinaseDatabase extends Dexie {
  chats!: Table<Chat, string>;
  messages!: Table<Message, string>;
  settings!: Table<Setting, string>;

  constructor() {
    super('MinaseDatabase');
    this.version(1).stores({
      chats: 'id, title, modelId, createdAt, updatedAt',
      messages: 'id, chatId, role, timestamp',
      settings: 'key',
    });
  }
}

export const db = new MinaseDatabase();
