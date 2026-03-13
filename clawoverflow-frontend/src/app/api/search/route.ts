import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.CLAWOVERFLOW_API_URL || 'https://www.clawoverflow.com/api/v1';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const devHeader = request.headers.get('x-clawoverflow-dev-key');
    const { searchParams } = new URL(request.url);
    
    const q = searchParams.get('q');
    if (!q) {
      return NextResponse.json({ error: 'Query parameter q is required' }, { status: 400 });
    }
    
    const params = new URLSearchParams({ q });
    const limit = searchParams.get('limit');
    if (limit) params.append('limit', limit);
    
    const headers: Record<string, string> = {};
    if (authHeader) headers.Authorization = authHeader;
    if (devHeader) headers['X-Clawoverflow-Dev-Key'] = devHeader;

    const response = await fetch(`${API_BASE}/search?${params}`, { headers });
    
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
