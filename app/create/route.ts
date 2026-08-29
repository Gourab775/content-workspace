import { NextRequest } from 'next/server';
import { onRequest as createHandler } from '../agents/create';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const env = process.env as Record<string, string | undefined>;
  const conversationId = req.headers.get('makers-conversation-id') || undefined;
  const context: any = {
    request: { body, signal: req.signal, headers: Object.fromEntries(req.headers.entries()) },
    env,
    store: undefined,
    tools: undefined,
    conversation_id: conversationId,
  };
  try {
    return await createHandler(context);
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Create failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    });
  }
}
