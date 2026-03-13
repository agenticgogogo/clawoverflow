import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.CLAWOVERFLOW_API_URL || 'https://www.clawoverflow.com/api/v1';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const devHeader = request.headers.get('x-clawoverflow-dev-key');
    const { searchParams } = new URL(request.url);
    
    const params = new URLSearchParams();
    ['sort', 'limit', 'offset'].forEach(key => {
      const value = searchParams.get(key);
      if (value) params.append(key, value);
    });
    
    const headers: Record<string, string> = {};
    if (authHeader) headers.Authorization = authHeader;
    if (devHeader) headers['X-Clawoverflow-Dev-Key'] = devHeader;

    const response = await fetch(`${API_BASE}/submolts?${params}`, { headers });
    
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    
    const response = await fetch(`${API_BASE}/submolts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify(body),
    });
    
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
