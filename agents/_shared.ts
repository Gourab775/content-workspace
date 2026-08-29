/**
 * Shared utilities for all agent endpoints.
 * Centralizes model initialization, environment config, and SSE helpers.
 */
import { initChatModel } from 'langchain';

type Model = Awaited<ReturnType<typeof initChatModel>>;

const DEFAULT_MODEL = 'openai/gpt-4o-mini';

export interface AgentEnv {
    AI_GATEWAY_API_KEY: string;
    AI_GATEWAY_BASE_URL: string;
    AI_GATEWAY_MODEL?: string;
}

/** Extract and validate required environment variables. Supports AI_GATEWAY_* and SERVICE_* aliases and OpenRouter defaults. */
export function getAgentEnv(contextEnv: Record<string, string | undefined> | undefined): AgentEnv {
    const source = contextEnv ?? {};
    // Support both AI_GATEWAY_* and SERVICE_* aliases (backward compatibility with EdgeOne)
    const apiKey = (source.AI_GATEWAY_API_KEY || source.SERVICE_API_KEY || '').trim();
    const baseUrl = (source.AI_GATEWAY_BASE_URL || source.SERVICE_BASE_URL || '').trim();
    const model = (source.AI_GATEWAY_MODEL || source.SERVICE_MODEL || '').trim();

    const missing: string[] = [];
    if (!apiKey) missing.push('AI_GATEWAY_API_KEY');
    if (!baseUrl) missing.push('AI_GATEWAY_BASE_URL');
    if (missing.length) throw new Error(`Missing environment variables: ${missing.join(', ')}`);
    return {
        AI_GATEWAY_API_KEY: apiKey,
        AI_GATEWAY_BASE_URL: baseUrl,
        AI_GATEWAY_MODEL: model || undefined,
    };
}

/** Initialize a chat model. Caches per base URL to avoid re-initialization. */
const modelCache = new Map<string, Model>();

export async function createModel(env: AgentEnv, options?: { timeout?: number }): Promise<Model> {
    const modelName = env.AI_GATEWAY_MODEL || DEFAULT_MODEL;
    const cacheKey = `${modelName}:${env.AI_GATEWAY_BASE_URL}`;

    if (modelCache.has(cacheKey)) {
        return modelCache.get(cacheKey)!;
    }

    const model = await initChatModel(modelName, {
        modelProvider: 'openai',
        apiKey: env.AI_GATEWAY_API_KEY,
        configuration: {
            baseURL: env.AI_GATEWAY_BASE_URL,
        },
        timeout: options?.timeout ?? 300_000,
    });

    modelCache.set(cacheKey, model);
    return model;
}

/** Create a logger with a consistent prefix. */
export function createLogger(name: string) {
    return {
        log(...args: unknown[]) { console.log(`[${name}]`, ...args); },
        error(...args: unknown[]) { console.error(`[${name}]`, ...args); },
    };
}

// ─── SSE Helpers ───
// SOP D: "Use the shared createSSEResponse helper instead of inlining a
// ReadableStream per file". All agent endpoints share this helper.

export function sseEvent(data: Record<string, unknown>): string {
    return `data: ${JSON.stringify(data)}\n\n`;
}

export function createSSEResponse(
    generator: AsyncGenerator<string> | ((signal?: AbortSignal) => AsyncGenerator<string>),
    signal?: AbortSignal
): Response {
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
        async start(controller) {
            const heartbeat = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(sseEvent({ type: 'ping', ts: Date.now() })));
                } catch {}
            }, 5_000);
            try {
                const it = typeof generator === 'function' ? generator(signal) : generator;
                for await (const chunk of it) {
                    if (signal?.aborted) break;
                    controller.enqueue(encoder.encode(chunk));
                }
            } catch (e) {
                const error = e as Error;
                if (error.name !== 'AbortError' && !signal?.aborted) {
                    controller.enqueue(encoder.encode(sseEvent({ type: 'error_message', content: error.message })));
                }
            } finally {
                clearInterval(heartbeat);
                controller.close();
            }
        },
        cancel() {},
    });

    return new Response(readable, {
        status: 200,
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    });
}
