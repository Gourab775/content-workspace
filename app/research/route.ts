import { NextRequest } from 'next/server';
import { onRequest as researchHandler } from '../agents/research';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const env = process.env as Record<string, string | undefined>;
  const context: any = {
    request: { body, signal: req.signal, headers: Object.fromEntries(req.headers.entries()) },
    env,
    tools: undefined,
  };
  try {
    return await researchHandler(context);
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Research failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    });
  }
}
