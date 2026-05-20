import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  if (req.headers.get('x-dev-secret') !== process.env.DEV_SECRET) {
    return new NextResponse('forbidden', { status: 403 });
  }
  return NextResponse.json({
    note: 'Phase 2 POC stub. Real Sandbox + Agent SDK implementation deferred per spec.',
    phase: 1,
  });
}
