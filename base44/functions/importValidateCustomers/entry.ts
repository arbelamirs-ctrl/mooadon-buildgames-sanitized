import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function normalizePhone(raw) {
  const v = (raw ?? '').replace(/[^\d+]/g, '').trim();
  return v || null;
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { import_job_id, company_id, csv_text, mapping, dedup_key } = body;

    if (!import_job_id || !company_id || !csv_text || !mapping?.fields) {
      return Response.json({
        error: 'Missing import_job_id/company_id/csv_text/mapping'
      }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    // Clear existing errors for this job
    try {
      const errors = await base44.entities.ImportRowError.filter({
        import_job_id
      });
      for (const e of errors) {
        await base44.entities.ImportRowError.delete(e.id);
      }
    } catch (e) {
      // ignore
    }

    // Parse CSV
    const lines = csv_text.trim().split('\n');
    const headers = lines[0].split(',').map((h) => h.trim());
    const dataRows = lines.slice(1);

    let valid = 0, invalid = 0, will_create = 0, will_update = 0;

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

    const errorsToCreate = [];

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

      // Validate required
      const phone = normalizePhone(payload.phone);
      const email = (payload.email ?? '').toLowerCase().trim();

      if (payload.phone) payload.phone = phone;
      if (payload.email) payload.email = email;

      const problems = [];

      if (!phone && !email) {
        problems.push({
          field: 'phone/email',
          code: 'MISSING_ID',
          message: 'Either phone or email is required'
        });
      }
      if (phone && phone.length < 7) {
        problems.push({
          field: 'phone',
          code: 'BAD_PHONE',
          message: 'Phone looks invalid (too short)'
        });
      }

      if (problems.length) {
        invalid++;
        for (const p of problems) {
          errorsToCreate.push({
            import_job_id,
            row_number: rowNumber,
            field: p.field,
            error_code: p.code,
            message: p.message,
            raw_row: rowObj
          });
        }
        continue;
      }

      valid++;

      // Check if exists
      const match = dedup === 'phone'
        ? (phone ? byPhone.get(phone) : null)
        : (email ? byEmail.get(email) : null);

      if (match) {
        will_update++;
      } else {
        will_create++;
      }
    }

    // Bulk create errors
    for (const chunk of chunkArray(errorsToCreate, 50)) {
      try {
        for (const e of chunk) {
          await base44.entities.ImportRowError.create(e);
        }
      } catch (err) {
        console.warn('Error creating error records:', err);
      }
    }

    const stats = {
      total: dataRows.filter((l) => l.trim()).length,
      valid,
      invalid,
      will_create,
      will_update
    };

    // Update job
    await base44.entities.ImportJob.update(import_job_id, {
      status: invalid > 0 ? 'ready_with_errors' : 'ready',
      stats,
      mapping_json: mapping
    });

    return Response.json({
      import_job_id,
      stats
    });
  } catch (error) {
    console.error('Error in importValidateCustomers:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});