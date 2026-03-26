import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { ethers } from 'npm:ethers@6.9.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const privateKey = Deno.env.get('OWNER_PRIVATE_KEY');
    if (!privateKey) {
      return Response.json({ error: 'OWNER_PRIVATE_KEY not set' }, { status: 500 });
    }

    const pk = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    const wallet = new ethers.Wallet(pk);

    const expectedAddress = Deno.env.get('EXPECTED_OWNER_ADDRESS') || '';
    return Response.json({
      derived_address: wallet.address,
      match: expectedAddress ? wallet.address.toLowerCase() === expectedAddress.toLowerCase() : null
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});