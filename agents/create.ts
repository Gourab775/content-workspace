/**
 * Content Creation Agent — DeepAgent Mode
 * Full agent framework with memory, structured prompts, and real web search.
 * Uses direct fetch to OpenRouter (no OpenAI SDK / langchain model)
 */
import { tool } from 'langchain';
import { HumanMessage, AIMessage, ToolMessage as LCToolMessage } from '@langchain/core/messages';
import { getAgentEnv, createLogger, sseEvent, createSSEResponse } from './_shared';

const logger = createLogger('create');

// ============================================================
// Memory Layer
// ============================================================
interface UserMemory {
    userId: string;
    defaultStyle: string;
    defaultLength: string;
    defaultLanguage: string;
    recentTopics: string[];
    recentKeywords: string[];
    customInstructions: string;
    totalArticles: number;
    preferredStructure: string;
    avoidPatterns: string[];
    toneNotes: string;
}

async function loadUserMemory(store: any, userId: string): Promise<any | null> {
    if (!store) return null;
    try {
        const conversationId = `user-prefs-${userId}`;
        const messages = await store.getMessages({ conversationId, limit: 1, order: 'desc' });
        if (messages.length > 0 && messages[0].content) {
            const content = messages[0].content;
            return typeof content === 'string' ? JSON.parse(content) : content;
        }
        return null;
    } catch (e) {
        logger.error('Failed to load memory:', (e as Error).message);
        return null;
    }
}

async function recordUsage(store: any, userId: string, topic: string, keywords?: string, style?: string, length?: string) {
    if (!store) return;
    try {
        const conversationId = `user-prefs-${userId}`;
        let prefs: any = { userId, totalArticles: 0, recentTopics: [], recentKeywords: [] };
        try {
            const messages = await store.getMessages({ conversationId, limit: 1, order: 'desc' });
            if (messages.length > 0 && messages[0].content) {
                const content = messages[0].content;
                prefs = typeof content === 'string' ? JSON.parse(content) : content;
            }
        } catch {}

        if (topic) prefs.recentTopics = [topic, ...(prefs.recentTopics || []).filter((t: string) => t !== topic)].slice(0, 10);
        if (keywords) {
            const newKws = keywords.split(/[,，]/).map((k: string) => k.trim()).filter(Boolean);
            prefs.recentKeywords = [...new Set([...newKws, ...(prefs.recentKeywords || [])])].slice(0, 20);
        }
        if (style) prefs.defaultStyle = style;
        if (length) prefs.defaultLength = length;
        prefs.totalArticles = (prefs.totalArticles || 0) + 1;
        prefs.lastActiveAt = new Date().toISOString();

        await store.appendMessage({
            conversationId, userId, role: 'system',
            content: JSON.stringify(prefs),
            metadata: { type: 'preferences', updatedAt: prefs.lastActiveAt },
        });
    } catch (e) {
        logger.error('Failed to record usage:', (e as Error).message);
    }
}

// ============================================================
// System Prompt — English Only
// ============================================================
function buildSystemPrompt(memory: any | null, articleLength: string): string {
    let prompt = `You are a professional English content creator. Today's date is ${new Date().toISOString().slice(0, 10)}.

## Workflow
1. Use the web_search tool ONCE to research the topic and gather current insights
2. Write the COMPLETE article directly based on search results

## Article Structure (strictly follow)

\`\`\`
# Title

Introduction (2-3 sentences: hook + value proposition)

## Section One
Intro sentence

### Subheading 1.1
Body paragraph (3-5 sentences with evidence / data / examples)

### Subheading 1.2
Body paragraph

## Section Two
... (same nested structure)

## Conclusion & Outlook
Closing paragraph
\`\`\`

Each ## must contain 2-3 ### subsections. Never flat-list only ##.

## Target Length (English word count)
:${articleLength === 'short' ? '~800 words, 4-5 H2 sections, each with 2 H3 subsections' : articleLength === 'long' ? '~4000 words, 10-12 H2 sections, each with 3-4 H3 subsections' : '~2000 words, 6-8 H2 sections, each with 2-3 H3 subsections'}

## Language & Style
- Output MUST be in English only, regardless of input topic language. Translate the topic if needed.
- Follow the requested style (informative / persuasive / technical / casual) consistently.
- Word count is strict: meet or slightly exceed the target.`;

    if (memory && memory.totalArticles > 0) {
        const parts: string[] = [];
        if (memory.defaultStyle && memory.defaultStyle !== 'informative') parts.push(`Style: ${memory.defaultStyle}`);
        if (memory.toneNotes) parts.push(`Tone: ${memory.toneNotes}`);
        if (memory.customInstructions) parts.push(memory.customInstructions);
        if (memory.avoidPatterns?.length) parts.push(`Avoid: ${memory.avoidPatterns.join(', ')}`);
        if (parts.length > 0) prompt += `\n\nUser preferences: ${parts.join('; ')}`;
    }

    return prompt;
}

// ============================================================
// Core Stream — Direct fetch to OpenRouter (no OpenAI SDK)
// ============================================================
async function* generateStream(
    apiKey: string,
    baseURL: string,
    model: string,
    maxTokens: number,
    userMessage: string,
    systemPrompt: string,
    contextTools: any,
    signal?: AbortSignal
): AsyncGenerator<string> {
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // SOP: LangGraph/DeepAgents use toLangChainTools(tool) — returns LangChain StructuredTool[]
    // all() returns raw {name,schema,invoke} which is not StructuredTool
    const tools: any[] = contextTools?.toLangChainTools?.(tool) ?? [];

    try {
        logger.log(`Starting: "${userMessage.slice(0, 80)}"`);

        const messages: any[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
        ];
        let searchDone = false;

        for (let i = 0; i < 3; i++) {
            if (signal?.aborted) break;

            const response = await fetch(`${baseURL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://github.com/Gourab775/content-workspace',
                    'X-Title': 'Content Workspace',
                },
                body: JSON.stringify({
                    model: 'openai/gpt-4o-mini',
                    messages: searchDone ? messages : [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userMessage },
                    ],
                    tools: tools.length > 0 && !searchDone ? tools.map(t => ({
                        type: 'function',
                        function: {
                            name: t.name,
                            description: t.description || '',
                            parameters: t.schema || { type: 'object', properties: {} },
                        },
                    })) : undefined,
                    tool_choice: tools.length > 0 && !searchDone ? 'auto' : 'none',
                    max_tokens: 2800,
                    stream: true,
                }),
                signal,
            });

            if (!response.ok) {
                const err = await response.text();
                throw new Error(`OpenRouter ${response.status}: ${err}`);
            }

            const reader = response.body?.getReader();
            if (!reader) throw new Error('No response body');

            const decoder = new TextDecoder();
            let fullContent = '';
            let toolCalls: any[] = [];

            try {
                while (true) {
                    if (signal?.aborted) break;
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n');

                    for (const line of lines) {
                        if (!line.startsWith('data: ')) continue;
                        const data = line.slice(6).trim();
                        if (data === '[DONE]') continue;

                        try {
                            const parsed = JSON.parse(data);
                            const choice = parsed.choices?.[0];
                            if (!choice) continue;

                            const delta = choice.delta || {};
                            
                            if (delta.tool_calls) {
                                for (const tc of delta.tool_calls) {
                                    if (tc.index !== undefined) {
                                        while (toolCalls.length <= tc.index) toolCalls.push({ name: '', args: '', id: '' });
                                        if (tc.name) toolCalls[tc.index].name = tc.function?.name || '';
                                        if (tc.function?.arguments) toolCalls[tc.index].args += tc.function.arguments;
                                        if (tc.id) toolCalls[tc.index].id = tc.id;
                                    }
                                }
                            }

                            if (delta.content) {
                                const cleaned = delta.content.replace(/\n{3,}/g, '\n\n');
                                if (cleaned) yield sseEvent({ type: 'ai_response', content: cleaned });
                            }
                        } catch {}
                    }
                }

                if (toolCalls.length > 0) {
                    const validCalls = toolCalls.filter(tc => tc.name);
                    if (validCalls.length > 0) {
                        // Execute tools
                        for (const tc of validCalls) {
                            yield sseEvent({ type: 'tool_call', name: tc.name });
                            const toolObj = tools.find((t: any) => t.name === tc.name);
                            if (toolObj) {
                                const result = await toolObj.invoke(JSON.parse(tc.args || '{}'));
                                const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
                                yield sseEvent({ type: 'tool_result', name: tc.name, content: resultStr.slice(0, 500) });
                            }
                        }
                        searchDone = true;
                        continue;
                    }
                }

                // If no tool calls, we're done
                break;
            } catch (e: unknown) {
                const error = e as Error;
                if (error.name === 'AbortError' || signal?.aborted) {
                    // Normal abort
                    break;
                } else if (error.message?.includes('terminated')) {
                    logger.log('Stream terminated by runtime');
                    break;
                } else {
                    logger.error('Error:', error.message);
                    yield sseEvent({ type: 'error_message', content: error.message });
                    break;
                }
            }
        }
    } catch (e: unknown) {
        const error = e as Error;
        if (error.name === 'AbortError' || signal?.aborted) {
            // Normal abort
        } else if (error.message?.includes('terminated')) {
            logger.log('Stream terminated by runtime');
        } else {
            logger.error('Error:', error.message);
            yield sseEvent({ type: 'error_message', content: error.message });
        }
    }

    yield sseEvent({ type: 'usage', input_tokens: 0, output_tokens: 0, total_tokens: 0 });
    yield "data: [DONE]\n\n";
}

// ============================================================
// Request Handler
// ============================================================
export async function onRequest(context: any) {
    const { request, env, store, tools: contextTools } = context;
    const { message, topic, keywords, style, length = 'medium', outline, userId = 'default' } = request?.body ?? {};

    let userMessage = message || '';
    if (topic) {
        userMessage = `Write an article about "${topic}" in English`;
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

    if (!userMessage) return new Response('Missing message or topic', { status: 400 });

    const signal = request?.signal as AbortSignal | undefined;

    const memory = await loadUserMemory(store, userId);
    if (memory) logger.log(`Memory loaded: ${userId}, ${memory.totalArticles} articles`);

    const systemPrompt = buildSystemPrompt(memory, length);

    try {
        const envVars = getAgentEnv(env);
        const apiKey = envVars.AI_GATEWAY_API_KEY;
        const baseURL = envVars.AI_GATEWAY_BASE_URL || 'https://openrouter.ai/api/v1';
        const lengthTokens: Record<string, number> = { short: 1500, medium: 2800, long: 4000 };
        const maxTokens = lengthTokens[length] ?? 2800;

        const generator = (s?: AbortSignal) => generateStream(
            envVars.AI_GATEWAY_API_KEY,
            envVars.AI_GATEWAY_BASE_URL || 'https://openrouter.ai/api/v1',
            'openai/gpt-4o-mini',
            maxTokens,
            userMessage,
            systemPrompt,
            contextTools,
            s
        );

        return createSSEResponse(generator, signal);
    } catch (e) {
        return new Response(JSON.stringify({ error: (e as Error).message }), {
            status: 500, headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        });
    }
}