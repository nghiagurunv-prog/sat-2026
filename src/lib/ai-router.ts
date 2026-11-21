import 'server-only';
import { OPENAI_CHAT_COMPLETIONS_URL } from '@/lib/openai';
import { modelForTier } from '@/lib/ai-cost';
import type { AiTier } from '@/lib/ai-quota';

/**
 * ============================================================================
 *  UNIFIED MULTI-LLM ROUTER + SSE STREAMING + SOCRATIC MICRO-CHECK (Mục #18 & #19)
 * ============================================================================
 *  Thống nhất lõi gọi AI cho cả `/api/chat` và `/api/ai-tutor`:
 *  1. Chọn model theo gói (`modelForTier`: Ultimate → gpt-4o / Gemini Flash; Free/Pro → Gemini 2.5 Flash → gpt-4o-mini).
 *  2. Hỗ trợ `stream: true` trả `ReadableStream` định dạng Server-Sent Events (SSE) giúp TTFT < 500ms.
 *  3. Hỗ trợ `interactionMode: 'micro_check'` (Socratic 2 lựa chọn A/B <= 120 tokens, buộc Active Recall).
 *  4. Tự động hướng dẫn xuất khối ```` ```desmos ```` cho bài toán đồ thị/hồi quy (Mục #11).
 * ============================================================================
 */

export type InteractionMode = 'full' | 'micro_check';

export interface UnifiedAiCallOptions {
  tier: AiTier;
  systemPrompt: string;
  userPrompt: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  interactionMode?: InteractionMode;
  maxTokens?: number;
  temperature?: number;
}

export interface UnifiedAiResult {
  text: string;
  provider: 'gemini' | 'openai';
  model: string;
  tokensIn: number;
  tokensOut: number;
}

export interface MicroCheckPayload {
  question: string;
  optionA: string;
  optionB: string;
  correctOption: 'A' | 'B';
  hintIfWrong: string;
}

/**
 * Chuẩn hóa System Prompt bổ sung cho Micro-Check (#19) & Desmos Code Block (#11)
 */
export function augmentSystemPrompt(
  basePrompt: string,
  interactionMode: InteractionMode = 'full',
  isMathHint = false
): string {
  const addons: string[] = [];

  if (interactionMode === 'micro_check') {
    addons.push(
      `CHẾ ĐỘ SOCRATIC MICRO-CHECK (BẮT BUỘC): TUYỆT ĐỐI KHÔNG đưa ngay lời giải đầy đủ. ` +
        `Hãy đặt ĐÚNG 1 câu hỏi dẫn dắt nhị phân ngắn gọn (<= 70 từ) có 2 lựa chọn A và B để kiểm tra tư duy học sinh. ` +
        `Trả về đúng JSON hợp lệ theo mẫu (không kèm giải thích thừa ngoài JSON): ` +
        `{"question":"...","optionA":"...","optionB":"...","correctOption":"A","hintIfWrong":"..."}`
    );
  } else if (isMathHint) {
    addons.push(
      `QUY TẮC DESMOS (BLUEBOOK MATH): Khi bài toán giải nhanh được bằng đồ thị/hệ PT/hồi quy Desmos, ` +
        `hãy xuất 1 khối code markdown riêng biệt với ngôn ngữ \`desmos\` chứa đúng công thức LaTeX cần nhập, ví dụ:\n` +
        '```desmos\ny = x^2 - 4x + 3\n```'
    );
  }

  return addons.length > 0 ? `${basePrompt}\n\n${addons.join('\n\n')}` : basePrompt;
}

export function parseMicroCheckJson(rawText: string): MicroCheckPayload | null {
  try {
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const obj = JSON.parse(match[0]) as Partial<MicroCheckPayload>;
    if (!obj.question || !obj.optionA || !obj.optionB) return null;
    const correctOption = String(obj.correctOption ?? '').trim().toUpperCase() === 'B' ? 'B' : 'A';
    return {
      question: String(obj.question).slice(0, 300),
      optionA: String(obj.optionA).slice(0, 160),
      optionB: String(obj.optionB).slice(0, 160),
      correctOption,
      hintIfWrong: String(obj.hintIfWrong || 'Hãy đọc kỹ lại từ khóa bản lề trong đề bài nhé!').slice(0, 260),
    };
  } catch {
    return null;
  }
}

export function buildLocalMicroCheckFallback(question: string): MicroCheckPayload {
  const isMath = /[\d=+\-*/^\\$]/.test(question);
  if (isMath) {
    return {
      question: 'Trước khi thầy mở lời giải chi tiết: Với bài toán này, bước đầu tiên nhanh nhất là gì?',
      optionA: 'Cô lập đại lượng đề bài thực sự hỏi (hoặc nhập thẳng vào Desmos tìm giao điểm)',
      optionB: 'Nhân bung toàn bộ biểu thức rồi thử từng đáp án bằng tay',
      correctOption: 'A',
      hintIfWrong: 'Mẹo Digital SAT: luôn xác định chính xác đại lượng đề hỏi trước khi tính để tránh bẫy 2x+1 và tận dụng Desmos!',
    };
  }
  return {
    question: 'Trước khi thầy bật mí đáp án: Khi loại trừ bẫy Reading & Writing của College Board, em nên làm gì trước?',
    optionA: 'Loại các phương án chứa từ tuyệt đối (always/never/solely) hoặc vượt phạm vi đoạn văn',
    optionB: 'Chọn ngay đáp án có nhiều từ trùng y hệt trong đoạn văn nhất',
    correctOption: 'A',
    hintIfWrong: 'Cẩn thận bẫy Word-Matching! College Board thường lặp lại từ vựng gốc trong đáp án nhiễu để đánh lừa.',
  };
}

/**
 * Gọi Multi-LLM đồng bộ (JSON) với ưu tiên Gemini 2.5 Flash → OpenAI `modelForTier(tier)`
 */
export async function callUnifiedLlm(opts: UnifiedAiCallOptions): Promise<UnifiedAiResult> {
  const geminiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
  const openaiKey = (process.env.OPENAI_API_KEY || '').trim();
  const maxTokens = opts.interactionMode === 'micro_check' ? 220 : (opts.maxTokens ?? 1000);
  const temperature = opts.temperature ?? 0.65;

  // Ultimate dùng OpenAI model xịn nếu có key và không ở chế độ micro_check; còn lại ưu tiên Gemini Flash trước (nhanh + rẻ)
  const preferOpenAiFirst = opts.tier === 'ultimate' && Boolean(openaiKey) && opts.interactionMode !== 'micro_check';

  const runGemini = async (): Promise<UnifiedAiResult> => {
    if (!geminiKey) throw new Error('GEMINI_API_KEY_MISSING');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.systemPrompt }] },
        contents: [
          ...(opts.history ?? []).map((h) => ({
            role: h.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: h.content }],
          })),
          { role: 'user', parts: [{ text: opts.userPrompt }] },
        ],
        generationConfig: { temperature, maxOutputTokens: maxTokens },
      }),
    });
    if (!res.ok) throw new Error(`Gemini error ${res.status}`);
    const data = await res.json();
    const text = String(data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
    if (!text) throw new Error('Gemini empty text');
    return {
      text,
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      tokensIn: Number(data?.usageMetadata?.promptTokenCount ?? 0) || Math.ceil((opts.systemPrompt.length + opts.userPrompt.length) / 4),
      tokensOut: Number(data?.usageMetadata?.candidatesTokenCount ?? 0) || Math.ceil(text.length / 4),
    };
  };

  const runOpenAi = async (): Promise<UnifiedAiResult> => {
    if (!openaiKey) throw new Error('OPENAI_API_KEY_MISSING');
    const model = modelForTier(opts.tier);
    const url = OPENAI_CHAT_COMPLETIONS_URL || 'https://api.openai.com/v1/chat/completions';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: opts.systemPrompt },
          ...(opts.history ?? []),
          { role: 'user', content: opts.userPrompt },
        ],
        max_tokens: maxTokens,
        temperature,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
    const data = await res.json();
    const text = String(data?.choices?.[0]?.message?.content ?? '').trim();
    if (!text) throw new Error('OpenAI empty text');
    return {
      text,
      provider: 'openai',
      model,
      tokensIn: Number(data?.usage?.prompt_tokens ?? 0) || Math.ceil((opts.systemPrompt.length + opts.userPrompt.length) / 4),
      tokensOut: Number(data?.usage?.completion_tokens ?? 0) || Math.ceil(text.length / 4),
    };
  };

  if (preferOpenAiFirst) {
    try {
      return await runOpenAi();
    } catch {
      return await runGemini();
    }
  }

  try {
    return await runGemini();
  } catch {
    return await runOpenAi();
  }
}

/**
 * Tạo ReadableStream SSE (Server-Sent Events) cho phản hồi AI (Mục #18).
 * Hỗ trợ stream trực tiếp từ Gemini `streamGenerateContent?alt=sse` hoặc chunked SSE
 * cho cache hit / fallback để client đọc thống nhất qua `text/event-stream`.
 */
export function createTextSseStream(
  fullText: string,
  meta: Record<string, unknown> = {}
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const chunks = fullText.match(/[\s\S]{1,36}/g) ?? [fullText];
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const delta of chunks) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
      }
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, ...meta })}\n\n`));
      controller.close();
    },
  });
}

export function sseResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

/**
 * Stream thực từ Gemini `streamGenerateContent?alt=sse` với callback `onComplete`
 * để finalize quota + lưu semantic cache + ghi cost ledger sau khi stream xong.
 */
export async function streamGeminiSse(
  opts: UnifiedAiCallOptions,
  hooks: {
    onComplete: (fullText: string, tokensIn: number, tokensOut: number) => Promise<void> | void;
    onError: (err: unknown) => Promise<void> | void;
  }
): Promise<ReadableStream<Uint8Array> | null> {
  const geminiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
  if (!geminiKey) return null;

  const maxTokens = opts.maxTokens ?? 1000;
  const temperature = opts.temperature ?? 0.65;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${geminiKey}`;

  const abortCtrl = new AbortController();
  const timeoutId = setTimeout(() => abortCtrl.abort(), 25_000);
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.systemPrompt }] },
        contents: [
          ...(opts.history ?? []).map((h) => ({
            role: h.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: h.content }],
          })),
          { role: 'user', parts: [{ text: opts.userPrompt }] },
        ],
        generationConfig: { temperature, maxOutputTokens: maxTokens },
      }),
      signal: abortCtrl.signal,
    });
  } catch {
    clearTimeout(timeoutId);
    return null;
  }

  if (!upstream.ok || !upstream.body) {
    clearTimeout(timeoutId);
    return null;
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = upstream.body.getReader();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = '';
      let fullText = '';
      let tokensIn = Math.ceil((opts.systemPrompt.length + opts.userPrompt.length) / 4);
      let tokensOut = 0;

      const processLine = (rawLine: string) => {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) return;
        const jsonStr = line.slice(5).trim();
        if (!jsonStr || jsonStr === '[DONE]') return;
        try {
          const parsed = JSON.parse(jsonStr);
          const delta = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (typeof delta === 'string' && delta.length > 0) {
            fullText += delta;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
          }
          if (parsed?.usageMetadata?.promptTokenCount) {
            tokensIn = Number(parsed.usageMetadata.promptTokenCount);
          }
          if (parsed?.usageMetadata?.candidatesTokenCount) {
            tokensOut = Number(parsed.usageMetadata.candidatesTokenCount);
          }
        } catch {
          // Bỏ qua chunk JSON chưa hoàn chỉnh
        }
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const rawLine of lines) processLine(rawLine);
        }
        // Xử lý nốt phần buffer cuối không kết thúc bằng '\n'
        buffer += decoder.decode();
        if (buffer.trim()) {
          for (const tailLine of buffer.split('\n')) processLine(tailLine);
        }

        clearTimeout(timeoutId);
        if (tokensOut === 0) tokensOut = Math.ceil(fullText.length / 4);
        await hooks.onComplete(fullText.trim(), tokensIn, tokensOut);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ done: true, provider: 'gemini', model: 'gemini-2.5-flash' })}\n\n`)
        );
        controller.close();
      } catch (err) {
        clearTimeout(timeoutId);
        await hooks.onError(err);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ done: true, error: 'stream_interrupted' })}\n\n`)
        );
        controller.close();
      }
    },
    async cancel() {
      clearTimeout(timeoutId);
      abortCtrl.abort();
      await reader.cancel().catch(() => {});
    },
  });
}
