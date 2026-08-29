/**
 * Content Creation Agent — Lite Mode
 * Low-token alternative using direct bindTools loop.
 * Uses direct fetch to OpenRouter (no OpenAI SDK / langchain model)
 */
import { tool } from 'langchain';
import { HumanMessage, AIMessage, ToolMessage as LCToolMessage } from '@langchain/core/messages';
import { getAgentEnv, createLogger, sseEvent, createSSEResponse } from './_shared';

const logger = createLogger('create-lite');

/**
 * Strip DSML/tool-call markup that sometimes leaks into model output.
 * Handles both the standard XML variant and the ｜｜DSML｜｜ full-width-pipe variant.
 */
function stripDSML(text: string): string {
    return text
        // Full-width pipe variant: <｜｜DSML｜｜invoke>, </｜｜DSML｜｜tool_calls>, …
        .replace(/<\/?｜｜DSML｜｜[^>]*>/g, '')
        // ASCII pipe variant: <||DSML||invoke>
        .replace(/<\/?[|][|]DSML[|][|][^>]*>/g, '')
        // Standard XML DSML tags
        .replace(/<\/?(tool_calls|invoke|parameter)[^>]*>/g, '');
}

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

// ============================================================
// Core Stream — Direct fetch to OpenRouter (no OpenAI SDK)
// ============================================================
async function* eventStream(
    apiKey: string,
    baseURL: string,
    userMessage: string,
    contextTools: any,
    signal?: AbortSignal
): AsyncGenerator<string> {
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // SOP: LangGraph/DeepAgents use toLangChainTools(toolFactory) to get LangChain StructuredTool[]
    // all() returns raw {name,schema,invoke} — needs LangChain tool() wrapper
    const tools: any[] = contextTools?.toLangChainTools?.(tool) ?? [];

    try {
        logger.log(`Starting: "${userMessage.slice(0, 80)}"`);

        const lengthTokens: Record<string, number> = { short: 1500, medium: 2800, long: 4000 };
        const maxTokens = 2800;

        const messages: any[] = [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userMessage },
        ];
        let searchDone = false;

        for (let i = 0; i < 4; i++) {
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
                        { role: 'system', content: SYSTEM_PROMPT },
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
                                const cleaned = stripDSML(delta.content).replace(/\n{3,}/g, '\n\n');
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

export async function onRequest(context: any) {
    const { request, env, tools: contextTools } = context;
    const { message, topic, keywords, style, length, outline } = request?.body ?? {};

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

    if (!userMessage) return new Response('Missing message or topic', { status: 400 });

    const signal = request?.signal as AbortSignal | undefined;

    try {
        const envVars = getAgentEnv(env);
        const apiKey = envVars.AI_GATEWAY_API_KEY;
        const baseURL = envVars.AI_GATEWAY_BASE_URL || 'https://openrouter.ai/api/v1';
        const maxTokens = 2800;

        const generator = (s?: AbortSignal) => eventStream(apiKey, baseURL, userMessage, contextTools, s);
        return createSSEResponse(generator, signal);
    } catch (e) {
        return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}