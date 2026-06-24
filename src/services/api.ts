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
  onChunk: (text: string) => void,
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
    
    // Gemini supports direct browser fetches (or via proxy if user configured)
    url = `${corsPrefix}https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?key=${providerConfig.apiKey}`;
    const formattedMessages = prepareContext(params, 'gemini');
    
    body = {
      contents: formattedMessages,
      systemInstruction: params.systemPrompt ? {
        parts: [{ text: params.systemPrompt }]
      } : undefined,
      generationConfig: {
        temperature: params.temperature,
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
      system: params.systemPrompt,
      temperature: params.temperature,
      max_tokens: 4096,
      stream: true,
    };
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
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep the incomplete line

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (providerConfig.id === 'gemini') {
          let cleanLine = trimmed;
          if (cleanLine.startsWith('[')) cleanLine = cleanLine.substring(1);
          if (cleanLine.endsWith(']')) cleanLine = cleanLine.slice(0, -1);
          if (cleanLine.startsWith(',')) cleanLine = cleanLine.substring(1);
          cleanLine = cleanLine.trim();
          
          if (!cleanLine) continue;

          try {
            const parsed = JSON.parse(cleanLine);
            const textChunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            if (textChunk) {
              onChunk(textChunk);
              fullResponseText += textChunk;
            }
          } catch (_) {}
        } 
        else if (providerConfig.id === 'ollama') {
          try {
            const parsed = JSON.parse(trimmed);
            const textChunk = parsed.message?.content;
            if (textChunk) {
              onChunk(textChunk);
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
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                const textChunk = parsed.delta.text;
                onChunk(textChunk);
                fullResponseText += textChunk;
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
              const textChunk = parsed.choices?.[0]?.delta?.content;
              if (textChunk) {
                onChunk(textChunk);
                fullResponseText += textChunk;
              }
            } catch (_) {}
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return fullResponseText;
}
