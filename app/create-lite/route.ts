import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SYSTEM_PROMPT = `You are a professional English content creator. Today's date is ${new Date().toISOString().slice(0, 10)}.

WORKFLOW:
1. Use web_search ONCE to research the topic
2. Write the COMPLETE article directly in your response

RULES:
- Call web_search exactly ONCE, then write the full article as text
- Output MUST be in English only — translate the topic if needed
- Output in markdown format. Use this heading hierarchy:
  - # (H1) for the article title (first line only)
  - ## (H2) for main sections (e.g. Introduction, Conclusion, major topic sections)
  - ### (H3) for subsections within a main section
  - #### (H4) for detailed points within a subsection (use sparingly)
  Never use only H2 or only H3 throughout — vary the depth to match content structure.
- Word count (English): count by words.
- STRICTLY follow the target length:
  - "short" ≈ 800 words, 4-5 sections
  - "medium" ≈ 2000 words, 6-8 sections
  - "long" ≈ 4000 words, 10-15 sections
- IMPORTANT: Do NOT write less than the target length.`;

function createLogger(name: string) {
    return {
        log: (...args: unknown[]) => console.log(`[${name}]`, ...args),
        error: (...args: unknown[]) => console.error(`[${name}]`, ...args),
    };
}

const logger = createLogger('create-lite');

async function* eventStream(modelInstance: any, userMessage: string, contextTools: any, signal?: AbortSignal): AsyncGenerator<string> {
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    try {
        logger.log(`Starting: "${userMessage.slice(0, 80)}"`);

        const response = await modelInstance.chat.completions.create({
            model: 'openai/gpt-4o-mini',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userMessage },
            ],
            max_tokens: 2800,
            stream: true,
        });

        let fullContent = '';
        let searchDone = false;

        for await (const chunk of response) {
            if (signal?.aborted) break;
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
                fullContent += content;
                yield `data: ${JSON.stringify({ type: 'ai_response', content })}\n\n`;
            }
            if (chunk.usage) {
                totalInputTokens += chunk.usage.prompt_tokens || 0;
                totalOutputTokens += chunk.usage.completion_tokens || 0;
            }
        }

        // Strip any leaked model internal markup
        fullContent = fullContent.replace(/<[｜|]*DSML[｜|]*[^>]*>[\s\S]*?<\/[｜|]*DSML[｜|]*[^>]*>/g, '').replace(/<[｜|]*DSML[\s\S]*/g, '').trim();

        yield `data: ${JSON.stringify({ type: 'usage', input_tokens: totalInputTokens, output_tokens: totalOutputTokens, total_tokens: totalInputTokens + totalOutputTokens })}\n\n`;
        yield "data: [DONE]\n\n";
    } catch (e: unknown) {
        const error = e as Error;
        if (error.name === 'AbortError' || signal?.aborted) {
            // Normal abort
        } else if (error.message?.includes('terminated')) {
            logger.log('Stream terminated by runtime');
        } else {
            logger.error('Error:', error.message);
            yield `data: ${JSON.stringify({ type: 'error_message', content: error.message })}\n\n`;
        }
    }
    yield "data: [DONE]\n\n";
}

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => ({}));
    const { message, topic, keywords, style, length, outline } = body ?? {};

    let userMessage = message || '';
    if (topic) {
        userMessage = `Create an article about: "${topic}"`;
        if (keywords) userMessage += `\nTarget keywords: ${keywords}`;
        if (style) userMessage += `\nWriting style: ${style}`;
        if (length) userMessage += `\nTarget length: ${length}`;
        if (outline?.sections) {
            userMessage += `\n\nFollow this outline:`;
            userMessage += `\nTitle: ${outline.title}`;
            for (const section of outline.sections) {
                userMessage += `\n- ${section.heading}: ${(section.keyPoints || []).join('; ')}`;
            }
        }
    }

    if (!userMessage) return NextResponse.json({ error: 'Missing message or topic' }, { status: 400 });

    const signal = req.signal as AbortSignal | undefined;

    try {
        const client = new OpenAI({
            apiKey: process.env.AI_GATEWAY_API_KEY || '',
            baseURL: process.env.AI_GATEWAY_BASE_URL || 'https://openrouter.ai/api/v1',
        });

        // Length-aware token budget
        const lengthTokens: Record<string, number> = { short: 1500, medium: 2800, long: 4000 };
        const maxTokens = lengthTokens[length] ?? 2800;

        const generator = (s?: AbortSignal) => eventStream({ chat: { completions: { create: async (opts: any) => client.chat.completions.create({ ...opts, max_tokens: maxTokens }) } } }, userMessage, undefined, s);
        
        const encoder = new TextEncoder();
        const readable = new ReadableStream({
            async start(controller) {
                const heartbeat = setInterval(() => {
                    try {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'ping', ts: Date.now() })}\n\n`));
                    } catch {}
                }, 5_000);
                try {
                    for await (const chunk of generator(signal)) {
                        if (signal?.aborted) break;
                        controller.enqueue(encoder.encode(chunk));
                    }
                } catch (e) {
                    const error = e as Error;
                    if (error.name !== 'AbortError' && !signal?.aborted) {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error_message', content: error.message })}\n\n`));
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
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}