import { NextRequest } from 'next/server';
import { onRequestPost as articlesHandler } from '@/cloud-functions/articles/index';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  // In Next.js runtime there is no EdgeOne store — return JSON instead of HTML 404
  // Frontend will use localStorage cache as fallback (already implemented)
  const context: any = {
    request: { body },
    agent: { store: null },
  };
  try {
    return await articlesHandler(context);
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Articles failed', articles: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    });
  }
}
