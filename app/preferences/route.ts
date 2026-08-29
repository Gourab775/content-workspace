import { NextRequest } from 'next/server';
import { onRequestPost as preferencesHandler } from '@/cloud-functions/preferences/index';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const context: any = {
    request: { body },
    agent: { store: null },
  };
  try {
    return await preferencesHandler(context);
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Preferences failed' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    });
  }
}
