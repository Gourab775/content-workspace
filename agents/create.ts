/**
 * Content Creation Agent — DeepAgent Mode
 * Full agent framework with memory, structured prompts, and real web search.
 */
import { initChatModel, tool } from 'langchain';
import { HumanMessage, AIMessage, ToolMessage as LCToolMessage } from '@langchain/core/messages';
import { getAgentEnv, createModel, createLogger, sseEvent, createSSEResponse } from './_shared';

type Model = Awaited<ReturnType<typeof initChatModel>>;

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

/**
 * Read the latest preference record.
 * History is accumulated via `appendMessage` (multiple records); the latest
 * record is the current value. We no longer simulate a KV with
 * `clearMessages + appendMessage` (SOP H-163 forbids it).
 */
async function loadUserMemory(store: any, userId: string): Promise<UserMemory | null> {
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

/**
 * Persist preferences by appending a new record (keeps full history).
 * We no longer call clearMessages — appending preserves an audit-friendly
 * evolution trail.
 */
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
function buildSystemPrompt(memory: UserMemory | null, articleLength: string): string {
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
// Core Stream
// ============================================================
async function* generateStream(modelInstance: Model, userMessage: string, systemPrompt: string, contextTools: any, signal?: AbortSignal): AsyncGenerator<string> {
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // SOP: LangGraph/DeepAgents use toLangChainTools(tool) — returns LangChain StructuredTool[]
    // all() returns raw {name,schema,invoke} which is not StructuredTool
    const tools: any[] = contextTools?.toLangChainTools?.(tool) ?? [];

    try {
        logger.log(`Starting: "${userMessage.slice(0, 80)}"`);
        const modelWithTools = modelInstance.bindTools(tools);
        const messages: any[] = [
            { role: 'system', content: systemPrompt },
            new HumanMessage(userMessage),
        ];
        let searchDone = false;

        for (let i = 0; i < 3; i++) {
            if (signal?.aborted) break;

            const activeModel = searchDone ? modelInstance : modelWithTools;
            const stream = await activeModel.stream(messages);
            let fullContent = '';
            let toolCalls: any[] = [];

            for await (const chunk of stream) {
                if (signal?.aborted) break;
                const msg = chunk as any;

                if (msg?.usage_metadata) {
                    totalInputTokens += msg.usage_metadata.input_tokens || 0;
                    totalOutputTokens += msg.usage_metadata.output_tokens || 0;
                }
                if (msg?.response_metadata?.usage) {
                    totalInputTokens += msg.response_metadata.usage.prompt_tokens || 0;
                    totalOutputTokens += msg.response_metadata.usage.completion_tokens || 0;
                }

                if (msg?.tool_call_chunks?.length) {
                    for (const tc of msg.tool_call_chunks) {
                        if (tc.index !== undefined) {
                            while (toolCalls.length <= tc.index) toolCalls.push({ name: '', args: '' });
                            if (tc.name) toolCalls[tc.index].name = tc.name;
                            if (tc.args) toolCalls[tc.index].args += tc.args;
                            if (tc.id) toolCalls[tc.index].id = tc.id;
                        }
                    }
                }

                if (msg?.text) {
                    fullContent += msg.text;
                    // Filter DSML markup
                    if (msg.text.includes('DSML') || msg.text.includes('tool_calls>') || msg.text.includes('invoke>') || msg.text.includes('parameter>')) {
                        continue;
                    }
                    const cleaned = msg.text.replace(/\n{3,}/g, '\n\n');
                    if (cleaned) yield sseEvent({ type: 'ai_response', content: cleaned });
                }
            }

            if (fullContent && toolCalls.length === 0) {
                const hasDSML = fullContent.includes('DSML') || fullContent.includes('<tool_calls>') || fullContent.includes('<invoke');
                if (hasDSML && !searchDone) {
                    searchDone = true;
                    messages.push(new AIMessage({ content: '' }));
                    logger.log('Model output DSML as text, retrying without tools');
                    continue;
                }
                break;
            }

            if (toolCalls.length > 0) {
                const validCalls = toolCalls.filter(tc => tc.name);
                const aiMsg = new AIMessage({
                    content: fullContent || '',
                    tool_calls: validCalls.map(tc => ({
                        name: tc.name,
                        args: JSON.parse(tc.args || '{}'),
                        id: tc.id || `call_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                    })),
                });
                messages.push(aiMsg);

                for (let j = 0; j < aiMsg.tool_calls!.length; j++) {
                    const tc = aiMsg.tool_calls![j];
                    if (j === 0) {
                        yield sseEvent({ type: 'tool_call', name: tc.name });
                        const toolObj = tools.find((t: any) => t.name === tc.name);
                        if (toolObj) {
                            const result = await toolObj.invoke(tc.args);
                            const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
                            yield sseEvent({ type: 'tool_result', name: tc.name, content: resultStr });
                            messages.push(new LCToolMessage({ content: resultStr, tool_call_id: tc.id || '' }));
                        }
                    } else {
                        messages.push(new LCToolMessage({ content: 'Already searched — please write the article directly.', tool_call_id: tc.id || '' }));
                    }
                }

                searchDone = true;
                continue;
            }

            break;
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

    logger.log(`Tokens — input: ${totalInputTokens}, output: ${totalOutputTokens}`);
    yield sseEvent({ type: 'usage', input_tokens: totalInputTokens, output_tokens: totalOutputTokens, total_tokens: totalInputTokens + totalOutputTokens });
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

    let modelInstance: Model;
    try {
        modelInstance = await createModel(getAgentEnv(env));
    } catch (e) {
        return new Response(JSON.stringify({ error: (e as Error).message }), {
            status: 500, headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        });
    }

    const generator = (s?: AbortSignal) => {
        const g = generateStream(modelInstance, userMessage, systemPrompt, contextTools, s);
        // wrap: append [DONE] and fire-and-forget recordUsage
        return (async function* () {
            try {
                for await (const chunk of g) yield chunk;
            } finally {
                // recordUsage after stream completes (or aborts)
                recordUsage(store, userId, topic || message?.slice(0, 50), keywords, style, length).catch(() => {});
                yield "data: [DONE]\n\n";
            }
        })();
    };

    return createSSEResponse(generator, signal);
}
