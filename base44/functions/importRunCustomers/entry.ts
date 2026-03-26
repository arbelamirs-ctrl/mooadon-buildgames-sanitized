import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function normalizePhone(raw) {
  const v = (raw ?? '').replace(/[^\d+]/g, '').trim();
  return v || null;
}

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { import_job_id, company_id, csv_text, mapping, dedup_key } = body;

    if (!import_job_id || !company_id || !csv_text || !mapping?.fields) {
      return Response.json({
        error: 'Missing required params'
      }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    // Load job
    const job = await base44.entities.ImportJob.filter({
      id: import_job_id
    });
    if (!job?.length) {
      return Response.json({ error: 'ImportJob not found' }, { status: 404 });
    }

    // Parse CSV
    const lines = csv_text.trim().split('\n');
    const headers = lines[0].split(',').map((h) => h.trim());
    const dataRows = lines.slice(1);

    // Load existing clients
    const dedup = dedup_key || 'phone';
    const existing = await base44.entities.Client.filter({
      company_id
    }, '-created_date', 5000);

    const byPhone = new Map();
    const byEmail = new Map();
    for (const c of existing ?? []) {
      if (c.phone) byPhone.set(String(c.phone), c);
      if (c.email) byEmail.set(String(c.email).toLowerCase(), c);
    }

    let created = 0, updated = 0, skipped = 0;

    // Mark as running
    await base44.entities.ImportJob.update(import_job_id, {
      status: 'running'
    });

    for (let i = 0; i < dataRows.length; i++) {
      const line = dataRows[i];
      if (!line.trim()) continue;

      const rowNumber = i + 2;
      const cells = line.split(',');
      const rowObj = {};

      headers.forEach((h, idx) => {
        rowObj[h] = (cells[idx] ?? '').trim();
      });

      // Build payload
      const payload = { company_id };

      for (const [csvHeader, targetField] of Object.entries(mapping.fields)) {
        const value = rowObj[csvHeader] ?? '';
        if (!targetField) continue;
        payload[targetField] = value.trim();
      }

      const phone = normalizePhone(payload.phone);
      const email = (payload.email ?? '').toLowerCase().trim();

      if (!phone && !email) {
        skipped++;
        continue;
      }

      if (payload.phone) payload.phone = phone;
      if (payload.email) payload.email = email;

      // Check if exists
      const match = dedup === 'phone'
        ? (phone ? byPhone.get(phone) : null)
        : (email ? byEmail.get(email) : null);

      try {
        if (match?.id) {
          // Update
          await base44.entities.Client.update(match.id, payload);
          updated++;
        } else {
          // Create
          const c = await base44.entities.Client.create(payload);
          created++;
          if (phone) byPhone.set(phone, c);
          if (email) byEmail.set(email, c);
        }
      } catch (e) {
        // Log error
        try {
          await base44.entities.ImportRowError.create({
            import_job_id,
            row_number: rowNumber,
            field: 'row',
            error_code: 'UPSERT_FAILED',
            message: String(e?.message ?? e),
            raw_row: rowObj
          });
        } catch (logErr) {
          console.warn('Failed to log error:', logErr);
        }
        skipped++;
      }
    }

    const stats = {
      created,
      updated,
      skipped,
      total: dataRows.filter((l) => l.trim()).length
    };

    // Mark as completed
    await base44.entities.ImportJob.update(import_job_id, {
      status: 'completed',
      stats,
      completed_at: new Date().toISOString()
    });

    return Response.json({
      import_job_id,
      stats
    });
  } catch (error) {
    console.error('Error in importRunCustomers:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});