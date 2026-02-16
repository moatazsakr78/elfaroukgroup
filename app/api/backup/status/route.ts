import { NextResponse } from 'next/server';
import { getProgress } from '@/app/lib/backup/progress';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(getProgress());
}
