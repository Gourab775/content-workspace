import { NextRequest } from 'next/server';
import { onRequest as optimizeHandler } from '../agents/optimize';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const env = process.env as Record<string, string | undefined>;
  const context: any = {
    request: { body, headers: Object.fromEntries(req.headers.entries()) },
    env,
  };
  try {
    return await optimizeHandler(context);
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Optimize failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    });
  }
}
