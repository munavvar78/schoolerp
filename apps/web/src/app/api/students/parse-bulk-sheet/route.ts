import { workbookFileToBulkCsv } from '@/lib/bulk-student-sheet';
import { requireBulkImport } from '@/lib/bulk-import-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const denied = await requireBulkImport(request);
  if (denied) return denied;
  const form = await request.formData();
  const file = form.get('file');

  if (!(file instanceof File)) {
    return Response.json({ message: 'Upload an Excel (.xlsx) file' }, { status: 400 });
  }

  if (file.size > 2_000_000) {
    return Response.json({ message: 'Sheet is too large' }, { status: 400 });
  }

  const name = file.name.toLowerCase();
  if (!name.endsWith('.xlsx') && !name.endsWith('.xlsm')) {
    return Response.json(
      { message: 'Use the School ERP .xlsx sample sheet (Excel workbook)' },
      { status: 400 },
    );
  }

  try {
    const buffer = await file.arrayBuffer();
    const csv = await workbookFileToBulkCsv(buffer);
    return Response.json({ csv });
  } catch (err) {
    return Response.json(
      { message: err instanceof Error ? err.message : 'Could not read Excel sheet' },
      { status: 400 },
    );
  }
}
