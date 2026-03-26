import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const BACKOFF_MS = {
  1: 1  * 60 * 1000,
  2: 5  * 60 * 1000,
  3: 30 * 60 * 1000
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const _svcToken = Deno.env.get('INTERNAL_SERVICE_TOKEN');
    const _reqToken = req.headers.get('X-Service-Token');
    const _isSvcCall = !!(_svcToken && _reqToken === _svcToken);

    const user = await base44.auth.me().catch(() => null);
    if (!_isSvcCall && user && user.role !== 'admin' && user.role !== 'super_admin') {
      return Response.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date();
    console.log(`🔄 retryWebhookQueue started at ${now.toISOString()}`);

    const allPending = await base44.asServiceRole.entities.WebhookRetryQueue.filter({ status: 'pending' });

    const dueNow = allPending.filter(item => {
      if (!item.next_retry_at) return true;
      return new Date(item.next_retry_at) <= now;
    });

    console.log(`📋 Total pending: ${allPending.length} | Due now: ${dueNow.length}`);

    const results = {
      processed:     0,
      succeeded:     0,
      dead_lettered: 0,
      still_pending: allPending.length - dueNow.length,
      errors:        []
    };

    for (const item of dueNow) {
      results.processed++;

      await base44.asServiceRole.entities.WebhookRetryQueue.update(item.id, { status: 'processing' });

      try {
        console.log(`⚙️ Retrying [${item.id}] attempt ${item.retry_count + 1}/${item.max_retries} → ${item.endpoint}`);

        const payload = item.payload || {};
        const invokePayload = {
          company_id:  payload.company_id,
          branch_id:   payload.branch_id,
          phone:       payload.client_phone || payload.phone,
          amount:      payload.amount,
          order_id:    payload.order_id,
          reward_type: payload.reward_type || 'token'
        };

        const response = await base44.asServiceRole.functions.invoke(
          item.endpoint || 'createPOSTransaction',
          invokePayload
        );

        const success = response.data?.success === true || (response.data && !response.data.error);

        if (success) {
          await base44.asServiceRole.entities.WebhookRetryQueue.update(item.id, {
            status:      'succeeded',
            retry_count: item.retry_count + 1,
            resolved_at: new Date().toISOString(),
            last_error:  null
          });
          console.log(`✅ [${item.id}] succeeded on retry ${item.retry_count + 1}`);
          results.succeeded++;

          await base44.asServiceRole.entities.WebhookLog.create({
            company_id:    item.company_id,
            branch_id:     item.branch_id,
            endpoint:      `retry:${item.endpoint}`,
            method:        'POST',
            status_code:   200,
            request_body:  invokePayload,
            response_body: response.data,
            ip_address:    'retry_queue',
            duration_ms:   0
          }).catch(() => {});
        } else {
          throw new Error(response.data?.error || 'Invocation returned non-success');
        }

      } catch (retryError) {
        const newRetryCount = (item.retry_count || 0) + 1;
        const isDead = newRetryCount >= (item.max_retries || 3);

        if (isDead) {
          await base44.asServiceRole.entities.WebhookRetryQueue.update(item.id, {
            status:      'dead_letter',
            retry_count: newRetryCount,
            last_error:  retryError.message,
            resolved_at: new Date().toISOString()
          });
          console.error(`💀 [${item.id}] dead-lettered after ${newRetryCount} attempts: ${retryError.message}`);
          results.dead_lettered++;
          results.errors.push({ id: item.id, error: `dead_letter: ${retryError.message}` });

          await base44.asServiceRole.entities.AuditLog.create({
            company_id:   item.company_id,
            action:       'webhook_dead_letter',
            entity_type:  'WebhookRetryQueue',
            entity_id:    item.id,
            performed_by: 'system',
            details: { endpoint: item.endpoint, retry_count: newRetryCount, payload: item.payload, last_error: retryError.message }
          }).catch(() => {});
        } else {
          const backoffMs = BACKOFF_MS[newRetryCount] ?? 30 * 60 * 1000;
          const nextRetryAt = new Date(Date.now() + backoffMs);

          await base44.asServiceRole.entities.WebhookRetryQueue.update(item.id, {
            status:        'pending',
            retry_count:   newRetryCount,
            next_retry_at: nextRetryAt.toISOString(),
            last_error:    retryError.message
          });
          console.warn(`⏳ [${item.id}] retry ${newRetryCount} failed — next: ${nextRetryAt.toISOString()}: ${retryError.message}`);
          results.errors.push({ id: item.id, error: retryError.message });
        }
      }
    }

    console.log(`🏁 retryWebhookQueue done:`, results);
    return Response.json({ success: true, ran_at: now.toISOString(), results });

  } catch (error) {
    console.error('❌ retryWebhookQueue fatal error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});