import { NextRequest, NextResponse } from 'next/server'

// Simple ping endpoint for connection testing
export async function GET(request: NextRequest) {
  return NextResponse.json({ ok: true, timestamp: Date.now() })
}

export async function HEAD(request: NextRequest) {
  return new NextResponse(null, { status: 200 })
}
