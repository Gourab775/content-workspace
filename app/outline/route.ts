import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SYSTEM_PROMPT = `You are an article outline planner. Given a topic and preferences, generate a structured outline.

OUTPUT FORMAT (strict JSON):
{
  "title": "Article title",
  "summary": "One-line summary of the article's angle",
  "sections": [
    {
      "heading": "Section heading",
      "keyPoints": ["point 1", "point 2"],
      "estimatedWords": 200
    }
  ],
  "estimatedTotalWords": 1000,
  "tone": "informative|persuasive|technical|casual"
}

RULES:
- Generate 4-15 sections based on requested length
- Each section should have 2-4 key points
- Headings should be specific and engaging
- The outline should tell a coherent story
- Match the tone to the requested style
- Target word counts: short=800 words, medium=2000 words, long=4000 words
- All content MUST be in English only
- Output ONLY valid JSON, no markdown fences or extra text`;

function createLogger(name: string) {
    return {
        log: (...args: unknown[]) => console.log(`[${name}]`, ...args),
        error: (...args: unknown[]) => console.error(`[${name}]`, ...args),
    };
}

const logger = createLogger('outline');

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => ({}));
    const { topic, keywords, style, length } = body ?? {};

    if (!topic) {
        return NextResponse.json({ error: 'Missing topic' }, { status: 400 });
    }

    try {
        const apiKey = process.env.AI_GATEWAY_API_KEY || '';
        const baseURL = process.env.AI_GATEWAY_BASE_URL || 'https://openrouter.ai/api/v1';
        const model = process.env.AI_GATEWAY_MODEL || 'openai/gpt-4o-mini';

        const userMessage = [
            `Topic: "${topic}"`,
            keywords ? `Keywords: ${keywords}` : '',
            `Style: ${style || 'informative'}`,
            `Target length: ${length || 'medium'} (short=800 words, medium=2000 words, long=4000 words)`,
            `Language: Write the outline in English only`,
        ].filter(Boolean).join('\n');

        logger.log(`Generating outline for: "${topic}"`);

        const response = await fetch(`${baseURL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://github.com/Gourab775/content-workspace',
                'X-Title': 'Content Workspace',
            },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: userMessage },
                ],
                max_tokens: 1500,
            }),
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`OpenRouter ${response.status}: ${err}`);
        }

        const data = await response.json();
        const text = data.choices[0]?.message?.content || '';
        logger.log('Raw outline response:', text.slice(0, 200));

        let outline: any;
        try {
            const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            outline = JSON.parse(jsonStr);
        } catch {
            try {
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    outline = JSON.parse(jsonMatch[0]);
                }
            } catch {}
        }

        if (!outline || !Array.isArray(outline.sections) || outline.sections.length === 0) {
            logger.error('Failed to parse outline JSON or invalid structure, returning raw');
            outline = {
                title: topic,
                summary: 'Auto-generated outline',
                sections: [{ heading: 'Introduction', keyPoints: ['Overview'], estimatedWords: 200 }],
                estimatedTotalWords: 500,
                tone: style || 'informative',
                raw: text,
            };
        }

        const usage = data.usage;
        const tokenUsage = {
            input_tokens: usage?.prompt_tokens || 0,
            output_tokens: usage?.completion_tokens || 0,
        };

        return NextResponse.json({ outline, usage: tokenUsage });
    } catch (e) {
        const msg = (e as Error).message;
        logger.error(msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}