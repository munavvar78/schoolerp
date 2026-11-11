import { buildBulkStudentTemplateBuffer } from '@/lib/bulk-student-sheet';
import { requireBulkImport } from '@/lib/bulk-import-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const denied = await requireBulkImport(request);
  if (denied) return denied;
  const buffer = await buildBulkStudentTemplateBuffer();
  const filename = 'school-erp-bulk-students-template.xlsx';

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
