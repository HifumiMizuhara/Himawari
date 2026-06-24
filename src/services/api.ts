import { type ProviderConfig } from './db';

export interface StreamParams {
  providerConfig: ProviderConfig;
  modelId: string;
  messages: Array<{
    role: string;
    content: string;
    attachments?: Array<{
      name: string;
      type: 'image' | 'pdf' | 'text';
      content: string;
      size: number;
    }>;
  }>;
  newMessage: {
    content: string;
    attachments?: Array<{
      name: string;
      type: 'image' | 'pdf' | 'text';
      content: string;
      size: number;
    }>;
  };
  systemPrompt: string;
  temperature: number;
  effort?: string;
}

/**
 * Normalizes messages and formats attachments (e.g. appends file text or returns image objects)
 */
function prepareContext(params: StreamParams, format: 'openai' | 'claude' | 'gemini') {
  const allMessages = [...params.messages];

  return allMessages.map((msg) => {
    const images = msg.attachments?.filter((a) => a.type === 'image') || [];
    const filesText = msg.attachments
      ?.filter((a) => a.type === 'pdf' || a.type === 'text')
      .map((f) => `[添付ファイル: ${f.name}]\n${f.content}\n---`)
      .join('\n') || '';

    const textContent = filesText
      ? `${filesText}\n\n${msg.content}`
      : msg.content;

    if (msg.role === 'system') {
      return { role: 'system', content: textContent };
    }

    if (format === 'gemini') {
      const parts: any[] = [];

      images.forEach((img) => {
        const matches = img.content.match(/^data:(image\/\w+);base64,(.+)$/);
        if (matches) {
          parts.push({
            inlineData: {
              mimeType: matches[1],
              data: matches[2],
            },
          });
        }
      });

      parts.push({ text: textContent || ' ' });

      return {
        role: msg.role === 'user' ? 'user' : 'model',
        parts,
      };
    }

    if (format === 'claude') {
      if (images.length === 0) {
        return { role: msg.role, content: textContent };
      }

      const contentArray: any[] = [];

      images.forEach((img) => {
        const matches = img.content.match(/^data:(image\/\w+);base64,(.+)$/);
        if (matches) {
          contentArray.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: matches[1],
              data: matches[2],
            },
          });
        }
      });

      contentArray.push({ type: 'text', text: textContent || ' ' });

      return {
        role: msg.role,
        content: contentArray,
      };
    }

    // Default: OpenAI format
    if (images.length === 0) {
      return { role: msg.role, content: textContent };
    }

    const contentArray: any[] = [
      { type: 'text', text: textContent },
      ...images.map((img) => ({
        type: 'image_url',
        image_url: { url: img.content },
      })),
    ];

    return {
      role: msg.role,
      content: contentArray,
    };
  });
}

/**
 * Entrypoint for streaming AI response.
 */
export async function streamChatCompletion(
  params: StreamParams,
  // Fix #4: callbacks may be async (DB writes inside); declare return type accordingly
  onChunk: (text: string) => void | Promise<void>,
  onThinkingChunk: (text: string) => void | Promise<void>,
  signal: AbortSignal
): Promise<string> {
  const { providerConfig, modelId } = params;

  if (!providerConfig.enabled) {
    throw new Error(`プロバイダー ${providerConfig.name} は有効化されていません。設定画面で有効にしてください。`);
  }

  // 1. Prepare Endpoint and Headers based on Provider
  let url = '';
  let headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  let body: any = {};

  const corsPrefix = providerConfig.corsProxy ? `${providerConfig.corsProxy.replace(/\/$/, '')}/` : '';

  if (providerConfig.id === 'gemini') {
    if (!providerConfig.apiKey) {
      throw new Error('Gemini APIキーが設定されていません。設定のConnections画面でキーを入力してください。');
    }

    // Fix #15: pass API key in header (not URL) so it is not exposed to CORS proxies
    url = `${corsPrefix}https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent`;
    headers['x-goog-api-key'] = providerConfig.apiKey;

    const formattedMessages = prepareContext(params, 'gemini');

    const thinkingConfig: any = {};
    if (params.effort && params.effort !== 'none') {
      const eff = params.effort.toUpperCase();
      if (['MINIMAL', 'LOW', 'MEDIUM', 'HIGH'].includes(eff)) {
        thinkingConfig.thinkingLevel = eff;
      } else {
        thinkingConfig.thinkingBudget = 2048; // Fallback budget if not matching level
      }
    }

    body = {
      contents: formattedMessages,
      systemInstruction: params.systemPrompt ? {
        parts: [{ text: params.systemPrompt }]
      } : undefined,
      generationConfig: {
        temperature: params.temperature,
        thinkingConfig: Object.keys(thinkingConfig).length > 0 ? thinkingConfig : undefined,
      },
    };
  }
  else if (providerConfig.id === 'claude') {
    if (!providerConfig.apiKey) {
      throw new Error('Claude APIキーが設定されていません。設定のConnections画面でキーを入力してください。');
    }

    const targetUrl = 'https://api.anthropic.com/v1/messages';
    url = corsPrefix ? `${corsPrefix}${targetUrl}` : targetUrl;

    headers['x-api-key'] = providerConfig.apiKey;
    headers['anthropic-version'] = '2023-06-01';

    const messagesWithoutSystem = prepareContext(params, 'claude').filter(m => m.role !== 'system');

    body = {
      model: modelId,
      messages: messagesWithoutSystem,
      system: params.systemPrompt || undefined,
      max_tokens: 4096,
      stream: true,
    };

    // Fix #3: use correct extended thinking API (type:'enabled', budget_tokens, anthropic-beta header)
    if (params.effort && params.effort !== 'none') {
      const budgetMap: Record<string, number> = { low: 2000, medium: 8000, high: 16000, xhigh: 32000, max: 60000 };
      const budgetTokens = budgetMap[params.effort.toLowerCase()] ?? 8000;
      body.thinking = { type: 'enabled', budget_tokens: budgetTokens };
      headers['anthropic-beta'] = 'interleaved-thinking-2025-05-14';
      body.temperature = 1.0;
    } else {
      body.temperature = params.temperature;
    }
  }
  else if (providerConfig.id === 'ollama') {
    const base = providerConfig.baseUrl || 'http://localhost:11434';
    url = `${corsPrefix}${base.replace(/\/$/, '')}/api/chat`;
    const formattedMessages = prepareContext(params, 'openai');

    if (params.systemPrompt && !formattedMessages.some(m => m.role === 'system')) {
      formattedMessages.unshift({ role: 'system', content: params.systemPrompt });
    }

    body = {
      model: modelId,
      messages: formattedMessages,
      options: {
        temperature: params.temperature,
      },
      stream: true,
    };
  }
  else {
    // OpenAI, DeepSeek, Custom OpenAI-compatible endpoints
    if (!providerConfig.baseUrl) {
      throw new Error(`${providerConfig.name} のベースURLが設定されていません。`);
    }

    const base = providerConfig.baseUrl.replace(/\/$/, '');
    const path = base.includes('/v1') ? '/chat/completions' : '/v1/chat/completions';
    url = `${corsPrefix}${base}${path}`;

    if (providerConfig.apiKey) {
      headers['Authorization'] = `Bearer ${providerConfig.apiKey}`;
    }

    const formattedMessages = prepareContext(params, 'openai');
    if (params.systemPrompt && !formattedMessages.some(m => m.role === 'system')) {
      formattedMessages.unshift({ role: 'system', content: params.systemPrompt });
    }

    body = {
      model: modelId,
      messages: formattedMessages,
      temperature: params.temperature,
      stream: true,
    };

    if (params.effort && params.effort !== 'none') {
      const effVal = params.effort.toLowerCase();
      body.reasoning_effort = effVal;
      body.reasoning = {
        effort: effVal
      };
    }
  }

  // 2. Perform fetch
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    let errText = '';
    try {
      errText = await response.text();
    } catch (_) {}
    throw new Error(`APIリクエストエラー (ステータス: ${response.status}): ${errText || response.statusText}`);
  }

  if (!response.body) {
    throw new Error('レスポンスボディが空です。');
  }

  // 3. Read stream and trigger onChunk
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullResponseText = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      // Fix #5: when done, flush the decoder so multi-byte sequences are not lost;
      // do NOT discard the remaining buffer — process it before breaking.
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = done ? '' : (lines.pop() || '');

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (providerConfig.id === 'gemini') {
          // Fix #9: only strip lines that are SOLELY '[', ']', or ','
          // Previously, startsWith/endsWith checks corrupted JSON content.
          let cleanLine = trimmed;
          if (cleanLine === '[' || cleanLine === ']') continue;
          if (cleanLine.startsWith(',')) cleanLine = cleanLine.substring(1).trim();

          if (!cleanLine) continue;

          try {
            const parsed = JSON.parse(cleanLine);
            const parts = parsed.candidates?.[0]?.content?.parts;
            if (parts && Array.isArray(parts)) {
              // Fix #4: use for...of (not forEach) so we can await the callbacks
              for (const part of parts) {
                if (part.text) {
                  if (part.thought) {
                    await onThinkingChunk(part.text);
                  } else {
                    await onChunk(part.text);
                    fullResponseText += part.text;
                  }
                }
              }
            } else {
              const textChunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
              if (textChunk) {
                await onChunk(textChunk);
                fullResponseText += textChunk;
              }
            }
          } catch (_) {}
        }
        else if (providerConfig.id === 'ollama') {
          try {
            const parsed = JSON.parse(trimmed);
            const textChunk = parsed.message?.content;
            if (textChunk) {
              await onChunk(textChunk);
              fullResponseText += textChunk;
            }
          } catch (_) {}
        }
        else if (providerConfig.id === 'claude') {
          if (trimmed.startsWith('data:')) {
            const dataStr = trimmed.substring(5).trim();
            if (dataStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.type === 'content_block_delta') {
                if (parsed.delta?.text) {
                  const textChunk = parsed.delta.text;
                  await onChunk(textChunk);
                  fullResponseText += textChunk;
                } else if (parsed.delta?.thinking) {
                  await onThinkingChunk(parsed.delta.thinking);
                }
              }
            } catch (_) {}
          }
        }
        else {
          // openai, deepseek, custom SSE
          if (trimmed.startsWith('data:')) {
            const dataStr = trimmed.substring(5).trim();
            if (dataStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(dataStr);
              const delta = parsed.choices?.[0]?.delta;
              if (delta) {
                if (delta.content) {
                  await onChunk(delta.content);
                  fullResponseText += delta.content;
                } else if (delta.reasoning_content) {
                  await onThinkingChunk(delta.reasoning_content);
                } else if (delta.reasoning) {
                  await onThinkingChunk(delta.reasoning);
                } else if (delta.thinking) {
                  await onThinkingChunk(delta.thinking);
                }
              }
            } catch (_) {}
          }
        }
      }

      // Fix #5: break AFTER processing the remaining lines (not before)
      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }

  return fullResponseText;
}
