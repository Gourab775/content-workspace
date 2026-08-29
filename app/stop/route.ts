import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  // In Next.js runtime there is no EdgeOne abortActiveRun — just acknowledge
  const conversationId = body.conversation_id || body.conversationId || req.headers.get('makers-conversation-id') || null;
  return new Response(JSON.stringify({ success: true, status: 'stopped', conversationId }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
  });
}
