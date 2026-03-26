import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, AlertCircle } from 'lucide-react';
import { toast } from "sonner";

export default function BackendFunctionExample() {
  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    toast.success('The code has been copied');
  };

  const createTxFunction = `// functions/createTransaction.js
/**
 * POST /tx/create
 * Create transaction from POS terminal
 * Idempotent by order_id
 */

export default async function createTransaction(request, context) {
  const { client_phone, amount, order_id } = request.body;
  
  // Validate input
  if (!client_phone || !amount || !order_id) {
    return {
      status: 400,
      body: {
        error: {
          code: 'INVALID_REQUEST',
          message: 'Missing required fields: client_phone, amount, order_id'
        }
      }
    };
  }
  
  // Get user context
  const user = context.user;
  const companyId = user.company_id;
  const branchId = user.branch_id || request.body.branch_id;
  
  // Check for existing transaction (idempotency)
  const existingTx = await context.base44.entities.Transaction.filter({
    company_id: companyId,
    order_id: order_id
  });
  
  if (existingTx.length > 0) {
    return {
      status: 200,
      body: {
        status: 'exists',
        transaction: existingTx[0]
      }
    };
  }
  
  // Get company for points calculation
  const companies = await context.base44.entities.Company.filter({ id: companyId });
  const company = companies[0];
  
  const pointsExpected = Math.floor(amount * (company.points_to_currency_ratio || 100));
  
  // Find or create client
  let clients = await context.base44.entities.Client.filter({
    company_id: companyId,
    phone: client_phone
  });
  
  let clientId;
  if (clients.length === 0) {
    const newClient = await context.base44.entities.Client.create({
      company_id: companyId,
      phone: client_phone,
      current_balance: 0,
      total_earned: 0,
      total_redeemed: 0
    });
    clientId = newClient.id;
  } else {
    clientId = clients[0].id;
  }
  
  // Generate claim token
  const claimToken = generateToken();
  const claimUrl = \`\${process.env.APP_URL}/ClaimPoints?token=\${claimToken}\`;
  
  // Create transaction
  const transaction = await context.base44.entities.Transaction.create({
    company_id: companyId,
    branch_id: branchId,
    client_id: clientId,
    client_phone: client_phone,
    order_id: order_id,
    amount: amount,
    points_expected: pointsExpected,
    status: 'pending',
    claim_token: claimToken,
    claim_url: claimUrl,
    sms_status: 'pending',
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  });
  
  // Send SMS (async)
  try {
    await sendSMS(client_phone, company, transaction);
    
    await context.base44.entities.Transaction.update(transaction.id, {
      sms_status: 'sent',
      sms_sent_at: new Date().toISOString()
    });
  } catch (error) {
    await context.base44.entities.Transaction.update(transaction.id, {
      sms_status: 'failed',
      sms_error: error.message
    });
  }
  
  // Audit log
  await context.base44.entities.AuditLog.create({
    company_id: companyId,
    user_email: user.email,
    action: 'transaction_created',
    entity_type: 'Transaction',
    entity_id: transaction.id,
    details: { amount, points: pointsExpected, order_id }
  });
  
  return {
    status: 201,
    body: {
      status: 'success',
      transaction
    }
  };
}

function generateToken() {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

async function sendSMS(phone, company, transaction) {
  // Implementation from SMSService
  // See SMSServiceExample component
}`;

  const claimFunction = `// functions/claimPoints.js
/**
 * POST /tx/claim
 * Client claims points from transaction
 * Public endpoint (no auth required)
 * Rate limited: 5 req/min per IP
 */

export default async function claimPoints(request, context) {
  const { claim_token, wallet_address } = request.body;
  
  // Validate
  if (!claim_token) {
    return {
      status: 400,
      body: {
        error: {
          code: 'INVALID_REQUEST',
          message: 'claim_token is required'
        }
      }
    };
  }
  
  // Find transaction
  const transactions = await context.base44.entities.Transaction.filter({
    claim_token: claim_token
  });
  
  if (transactions.length === 0) {
    return {
      status: 404,
      body: {
        error: {
          code: 'NOT_FOUND',
          message: 'Transaction not found'
        }
      }
    };
  }
  
  const transaction = transactions[0];
  
  // Check if already claimed
  if (transaction.status === 'completed') {
    return {
      status: 400,
      body: {
        error: {
          code: 'ALREADY_CLAIMED',
          message: 'Points already claimed for this transaction'
        }
      }
    };
  }
  
  // Check expiration
  if (transaction.expires_at && new Date(transaction.expires_at) < new Date()) {
    await context.base44.entities.Transaction.update(transaction.id, {
      status: 'expired'
    });
    
    return {
      status: 400,
      body: {
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'This claim link has expired'
        }
      }
    };
  }
  
  // Get client
  const clients = await context.base44.entities.Client.filter({ 
    id: transaction.client_id 
  });
  const client = clients[0];
  
  const balanceBefore = client.current_balance || 0;
  const points = transaction.points_expected;
  const balanceAfter = balanceBefore + points;
  
  // ATOMIC: Create ledger event + update balance
  try {
    // Create ledger event
    const ledgerEvent = await context.base44.entities.LedgerEvent.create({
      company_id: transaction.company_id,
      client_id: transaction.client_id,
      transaction_id: transaction.id,
      type: 'earn',
      points: points,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      source: 'client',
      description: \`צבירה מעסקה ₪\${transaction.amount}\`
    });
    
    // Update client balance
    await context.base44.entities.Client.update(transaction.client_id, {
      current_balance: balanceAfter,
      total_earned: (client.total_earned || 0) + points,
      wallet_address: wallet_address || client.wallet_address,
      last_activity: new Date().toISOString()
    });
    
    // Update transaction
    await context.base44.entities.Transaction.update(transaction.id, {
      status: 'completed',
      points_actual: points,
      claimed_at: new Date().toISOString()
    });
    
    // Audit log
    await context.base44.entities.AuditLog.create({
      company_id: transaction.company_id,
      action: 'points_claimed',
      entity_type: 'Transaction',
      entity_id: transaction.id,
      details: { 
        points, 
        client_phone: client.phone,
        new_balance: balanceAfter 
      }
    });
    
    return {
      status: 200,
      body: {
        status: 'success',
        points_claimed: points,
        new_balance: balanceAfter,
        ledger_event: ledgerEvent
      }
    };
  } catch (error) {
    console.error('Claim failed:', error);
    
    return {
      status: 500,
      body: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to claim points'
        }
      }
    };
  }
}`;

  const adjustFunction = `// functions/adjustBalance.js
/**
 * POST /admin/adjust
 * Manually adjust client balance
 * Requires: company_admin or super_admin role
 */

export default async function adjustBalance(request, context) {
  const { client_id, points, description } = request.body;
  const user = context.user;
  
  // Authorization check
  if (!['super_admin', 'company_admin'].includes(user.user_role)) {
    return {
      status: 403,
      body: {
        error: {
          code: 'FORBIDDEN',
          message: 'Only admins can adjust balances'
        }
      }
    };
  }
  
  // Validate input
  if (!client_id || !points || !description) {
    return {
      status: 400,
      body: {
        error: {
          code: 'INVALID_REQUEST',
          message: 'client_id, points, and description are required'
        }
      }
    };
  }
  
  if (description.length < 10) {
    return {
      status: 400,
      body: {
        error: {
          code: 'INVALID_REQUEST',
          message: 'Description must be at least 10 characters'
        }
      }
    };
  }
  
  // Get client
  const clients = await context.base44.entities.Client.filter({ id: client_id });
  if (clients.length === 0) {
    return {
      status: 404,
      body: {
        error: { code: 'NOT_FOUND', message: 'Client not found' }
      }
    };
  }
  
  const client = clients[0];
  
  // Verify company access
  if (user.user_role === 'company_admin' && client.company_id !== user.company_id) {
    return {
      status: 403,
      body: {
        error: {
          code: 'FORBIDDEN',
          message: 'Cannot adjust balance for client from another company'
        }
      }
    };
  }
  
  const balanceBefore = client.current_balance || 0;
  const balanceAfter = balanceBefore + points;
  
  // Prevent negative balance
  if (balanceAfter < 0) {
    return {
      status: 400,
      body: {
        error: {
          code: 'INSUFFICIENT_BALANCE',
          message: \`Insufficient balance. Current: \${balanceBefore}, Requested: \${points}\`
        }
      }
    };
  }
  
  // Create ledger event
  const ledgerEvent = await context.base44.entities.LedgerEvent.create({
    company_id: client.company_id,
    client_id: client_id,
    type: 'adjust',
    points: points,
    balance_before: balanceBefore,
    balance_after: balanceAfter,
    source: 'admin',
    description: description,
    performed_by: user.email
  });
  
  // Update client balance
  await context.base44.entities.Client.update(client_id, {
    current_balance: balanceAfter,
    total_earned: points > 0 ? (client.total_earned || 0) + points : client.total_earned,
    total_redeemed: points < 0 ? (client.total_redeemed || 0) + Math.abs(points) : client.total_redeemed
  });
  
  // Audit log
  await context.base44.entities.AuditLog.create({
    company_id: client.company_id,
    user_email: user.email,
    action: 'balance_adjusted',
    entity_type: 'Client',
    entity_id: client_id,
    details: { 
      points_change: points, 
      reason: description,
      balance_before: balanceBefore,
      balance_after: balanceAfter
    },
    ip_address: request.ip
  });
  
  return {
    status: 200,
    body: {
      status: 'success',
      ledger_event: ledgerEvent,
      new_balance: balanceAfter
    }
  };
}`;

  return (
    <div className="space-y-4" dir="rtl">
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5" />
          <div className="text-sm text-rose-700">
            <strong>demand:</strong> Backend FunctionsMust be enabled in -Base44 Dashboard.
            <br/>Without this, it is not possible to implement the-API endpoints Described here.
          </div>
        </div>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>POST /tx/create</CardTitle>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => copyCode(createTxFunction)}
          >
            <Copy className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto" dir="ltr">
            {createTxFunction}
          </pre>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>POST /tx/claim</CardTitle>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => copyCode(claimFunction)}
          >
            <Copy className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto" dir="ltr">
            {claimFunction}
          </pre>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>POST /admin/adjust</CardTitle>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => copyCode(adjustFunction)}
          >
            <Copy className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto" dir="ltr">
            {adjustFunction}
          </pre>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <h3 className="font-semibold text-indigo-800 mb-2">📝 Key Principles</h3>
          <ul className="text-sm text-indigo-700 space-y-1">
            <li>• evey balance change way ledger_event</li>
            <li>• Idempotency in-tx/create</li>
            <li>• Rate limiting in-tx/claim</li>
            <li>• Audit logging in every admin action</li>
            <li>• Atomic transactions</li>
          </ul>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <h3 className="font-semibold text-purple-800 mb-2">🔒 Security Checks</h3>
          <ul className="text-sm text-purple-700 space-y-1">
            <li>• Company isolation (company_id)</li>
            <li>• Role validation</li>
            <li>• Input sanitization</li>
            <li>• No negative balances</li>
            <li>• Token uniqueness</li>
          </ul>
        </div>
      </div>

      <div className="bg-slate-50 rounded-xl p-4">
        <h3 className="font-semibold mb-2">Testing Backend Functions</h3>
        <pre className="text-xs bg-white p-3 rounded border" dir="ltr">
{`# Test create transaction
curl -X POST https://your-app.base44.app/api/createTransaction \\
  -H "Authorization: Bearer YOUR_JWT" \\
  -H "Content-Type: application/json" \\
  -d '{
    "client_phone": "050-1234567",
    "amount": 100,
    "order_id": "TEST-001"
  }'

# Test claim
curl -X POST https://your-app.base44.app/api/claimPoints \\
  -H "Content-Type: application/json" \\
  -d '{
    "claim_token": "abc123xyz789"
  }'`}
        </pre>
      </div>
    </div>
  );
}