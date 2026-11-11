const BULK_ROLES = new Set(['ORG_OWNER', 'CAMPUS_ADMIN']);

export async function requireBulkImport(request: Request): Promise<Response | null> {
  const header = request.headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer ')) {
    return Response.json({ message: 'Missing access token' }, { status: 401 });
  }
  const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
  try {
    const res = await fetch(`${api.replace(/\/$/, '')}/auth/me`, {
      headers: { authorization: header },
      cache: 'no-store',
    });
    if (!res.ok) return Response.json({ message: 'Missing access token' }, { status: 401 });
    const body = (await res.json()) as { role?: string };
    if (!body.role || !BULK_ROLES.has(body.role)) {
      return Response.json({ message: 'You cannot import students' }, { status: 403 });
    }
    return null;
  } catch {
    return Response.json({ message: 'Could not verify this login' }, { status: 401 });
  }
}
