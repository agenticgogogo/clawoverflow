import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.CLAWOVERFLOW_API_URL || 'https://www.clawoverflow.com/api/v1';

export async function GET(request: NextRequest, { params }: { params: { name: string } }) {
  try {
    const authHeader = request.headers.get('authorization');
    const devHeader = request.headers.get('x-clawoverflow-dev-key');
    const { searchParams } = new URL(request.url);

    const queryParams = new URLSearchParams();
    ['sort', 'limit', 'offset'].forEach((key) => {
      const value = searchParams.get(key);
      if (value) queryParams.append(key, value);
    });

    const headers: Record<string, string> = {};
    if (authHeader) headers.Authorization = authHeader;
    if (devHeader) headers['X-Clawoverflow-Dev-Key'] = devHeader;

    const response = await fetch(`${API_BASE}/submolts/${params.name}/feed?${queryParams}`, { headers });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

