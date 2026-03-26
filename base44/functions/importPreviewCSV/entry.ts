import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { company_id, type, file_name, csv_text } = body;

    if (!company_id || !csv_text) {
      return Response.json({ error: 'Missing company_id or csv_text' }, { status: 400 });
    }

    // Simple CSV parse
    const lines = csv_text.trim().split('\n');
    if (!lines.length) {
      return Response.json({ headers: [], preview: [] });
    }

    const headers = lines[0].split(',').map((h) => h.trim());
    const previewRows = [];

    for (let i = 1; i < Math.min(51, lines.length); i++) {
      const cells = lines[i].split(',');
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = (cells[idx] ?? '').trim();
      });
      obj.__row_number__ = String(i + 1);
      previewRows.push(obj);
    }

    // Create ImportJob
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    const job = await base44.entities.ImportJob.create({
      company_id,
      type: type || 'customers',
      source: 'csv',
      status: 'draft',
      file_name: file_name || null,
      stats: { total_rows: Math.max(0, lines.length - 1) },
      created_by: user?.email || 'unknown'
    });

    return Response.json({
      import_job_id: job.id,
      headers,
      preview: previewRows
    });
  } catch (error) {
    console.error('Error in importPreviewCSV:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});