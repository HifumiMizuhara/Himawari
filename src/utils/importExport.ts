import type { Chat, Folder, Message } from '../services/db';

export const EXPORT_VERSION = '1.1.0';

export interface ExportData {
  version: string;
  exporter: string;
  chats: Chat[];
  messages: Message[];
  folders?: Folder[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isValidChat(value: unknown): value is Chat {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.modelId === 'string' &&
    typeof value.temperature === 'number' &&
    typeof value.createdAt === 'number' &&
    typeof value.updatedAt === 'number'
  );
}

function isValidMessage(value: unknown): value is Message {
  if (!isRecord(value)) return false;
  const role = value.role;
  return (
    typeof value.id === 'string' &&
    typeof value.chatId === 'string' &&
    typeof value.content === 'string' &&
    typeof value.timestamp === 'number' &&
    (role === 'user' || role === 'assistant' || role === 'system')
  );
}

function isValidFolder(value: unknown): value is Folder {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.color === 'string' &&
    typeof value.order === 'number'
  );
}

export type ImportValidationResult =
  | { ok: true; data: { chats: Chat[]; messages: Message[]; folders: Folder[] } }
  | { ok: false; reason: 'shape' | 'invalid_chats' | 'invalid_messages' | 'invalid_folders' | 'orphan_messages' };

export function validateImportData(raw: unknown): ImportValidationResult {
  if (!isRecord(raw)) return { ok: false, reason: 'shape' };
  if (!Array.isArray(raw.chats) || !Array.isArray(raw.messages)) {
    return { ok: false, reason: 'shape' };
  }

  if (!raw.chats.every(isValidChat)) return { ok: false, reason: 'invalid_chats' };
  if (!raw.messages.every(isValidMessage)) return { ok: false, reason: 'invalid_messages' };

  const folders: Folder[] = [];
  if (raw.folders !== undefined) {
    if (!Array.isArray(raw.folders) || !raw.folders.every(isValidFolder)) {
      return { ok: false, reason: 'invalid_folders' };
    }
    folders.push(...raw.folders);
  }

  const chatIds = new Set(raw.chats.map((chat) => chat.id));
  const hasOrphans = raw.messages.some((message) => !chatIds.has(message.chatId));
  if (hasOrphans) return { ok: false, reason: 'orphan_messages' };

  return {
    ok: true,
    data: {
      chats: raw.chats,
      messages: raw.messages,
      folders,
    },
  };
}
