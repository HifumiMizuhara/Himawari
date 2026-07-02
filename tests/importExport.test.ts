import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isSafeHref, sanitizeHref } from '../src/utils/safeUrl.ts';
import { validateImportData } from '../src/utils/importExport.ts';

describe('safeUrl', () => {
  it('allows http, https, and mailto links', () => {
    assert.equal(isSafeHref('https://example.com'), true);
    assert.equal(isSafeHref('http://example.com/path'), true);
    assert.equal(isSafeHref('mailto:user@example.com'), true);
  });

  it('blocks javascript and data URLs', () => {
    assert.equal(isSafeHref('javascript:alert(1)'), false);
    assert.equal(isSafeHref('data:text/html,<script>alert(1)</script>'), false);
    assert.equal(sanitizeHref('javascript:alert(1)'), null);
  });
});

describe('validateImportData', () => {
  const baseChat = {
    id: 'chat-1',
    title: 'Test',
    modelId: 'gpt-4',
    temperature: 0.7,
    createdAt: 1,
    updatedAt: 2,
  };
  const baseMessage = {
    id: 'msg-1',
    chatId: 'chat-1',
    role: 'user' as const,
    content: 'hello',
    timestamp: 3,
  };
  const baseFolder = {
    id: 'folder-1',
    name: 'Work',
    color: '#ff0000',
    order: 0,
  };

  it('accepts valid export payloads with folders', () => {
    const result = validateImportData({
      chats: [baseChat],
      messages: [baseMessage],
      folders: [baseFolder],
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.folders.length, 1);
    }
  });

  it('accepts legacy exports without folders', () => {
    const result = validateImportData({
      chats: [baseChat],
      messages: [baseMessage],
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.folders.length, 0);
    }
  });

  it('rejects orphan messages', () => {
    const result = validateImportData({
      chats: [baseChat],
      messages: [{ ...baseMessage, chatId: 'missing-chat' }],
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, 'orphan_messages');
  });
});
