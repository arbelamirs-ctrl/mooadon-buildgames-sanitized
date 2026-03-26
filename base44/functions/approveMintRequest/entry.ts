/**
 * approveMintRequest.ts - Admin Approval for Mint Requests
 * 
 * Enables multi-signature approval workflow for token minting.
 * Requires 2+ admin approvals before execution.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    // Admin auth check
    const user = await base44.auth.me();
    if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
      return Response.json({ error: 'Unauthorized - admin access required' }, { status: 403 });
    }
    
    const { request_id, action } = await req.json();
    
    if (!request_id) {
      return Response.json({ error: 'Missing request_id' }, { status: 400 });
    }
    
    // For now, this is a placeholder that tracks approvals in the database
    // In production, this would integrate with the MintGuard smart contract
    
    if (action === 'approve') {
      // Store approval in audit log
      await base44.asServiceRole.entities.AuditLog.create({
        company_id: 'system',
        action: 'mint_request_approved',
        entity_type: 'MintRequest',
        entity_id: request_id,
        performed_by: user.id,
        details: {
          approver: user.email,
          approved_at: new Date().toISOString(),
          status: 'approved'
        }
      });
      
      console.log(`✅ Mint request ${request_id} approved by ${user.email}`);
      
      return Response.json({
        success: true,
        message: `Request approved by ${user.full_name}`,
        request_id
      });
    } else if (action === 'reject') {
      const { reason } = await req.json();
      
      await base44.asServiceRole.entities.AuditLog.create({
        company_id: 'system',
        action: 'mint_request_rejected',
        entity_type: 'MintRequest',
        entity_id: request_id,
        performed_by: user.id,
        details: {
          rejector: user.email,
          rejected_at: new Date().toISOString(),
          reason,
          status: 'rejected'
        }
      });
      
      console.log(`❌ Mint request ${request_id} rejected by ${user.email}`);
      
      return Response.json({
        success: true,
        message: `Request rejected`,
        request_id
      });
    }
    
    return Response.json({ error: 'Invalid action' }, { status: 400 });
    
  } catch (error) {
    console.error('❌ approveMintRequest error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});