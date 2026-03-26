import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUserPermissions } from '@/components/auth/useUserPermissions';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import DataTable from '@/components/ui/DataTable';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Search, 
  Users,
  Phone,
  Mail,
  Wallet,
  Coins,
  ArrowLeft,
  Loader2,
  Plus,
  Eye,
  History,
  Gift,
  Ticket,
  Receipt,
  TrendingUp,
  Pencil,
  CheckCircle2,
  AlertCircle,
  Send,
  Upload,
  FileSpreadsheet,
  X,
  Copy,
  Check
} from 'lucide-react';
import { format, startOfMonth } from 'date-fns';
import { useCurrency } from '@/components/utils/useCurrency';
import { toast } from "sonner";


// Wallet address display component with copy functionality
function WalletAddressCell({ address }) {
  const [copied, setCopied] = React.useState(false);

  if (!address) return <span className="text-slate-600 text-xs">—</span>;

  const truncated = `${address.slice(0, 6)}...${address.slice(-4)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success('Wallet address copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-xs text-blue-400">{truncated}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleCopy();
        }}
        className="p-0.5 hover:bg-blue-500/20 rounded transition-colors"
        title="Copy wallet address"
      >
        {copied ? (
          <Check className="w-3 h-3 text-green-400" />
        ) : (
          <Copy className="w-3 h-3 text-slate-400 hover:text-blue-400" />
        )}
      </button>
    </div>
  );
}

export default function Clients() {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('created_date');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [giftDialogOpen, setGiftDialogOpen] = useState(false);
  const [selectedClientForGift, setSelectedClientForGift] = useState(null);
  const [giftAmount, setGiftAmount] = useState('');
  const [giftReason, setGiftReason] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [editForm, setEditForm] = useState({ full_name: '', phone: '', email: '', birthday: '' });
  const [sendingWelcome, setSendingWelcome] = useState(null); // client id being re-sent
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [formData, setFormData] = useState({
    phone: '',
    email: '',
    full_name: ''
  });

  const queryClient = useQueryClient();
  const { user, primaryCompanyId, loading } = useUserPermissions();
  const companyId = primaryCompanyId;

  // Main data queries
  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ['clients', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      try {
        return await base44.entities.Client.filter({ company_id: companyId }, '-created_date');
      } catch (error) {
        console.error('Error loading clients:', error);
        return [];
      }
    },
    enabled: !!companyId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const { data: company } = useQuery({
    queryKey: ['company', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      try {
        const companies = await base44.entities.Company.filter({ id: companyId });
        return companies[0] || null;
      } catch (error) {
        console.error('Error loading company:', error);
        return null;
      }
    },
    enabled: !!companyId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      try {
        return await base44.entities.Transaction.filter({ company_id: companyId });
      } catch (error) {
        console.error('Error loading transactions:', error);
        return [];
      }
    },
    enabled: !!companyId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const { data: coupons = [] } = useQuery({
    queryKey: ['coupons', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      try {
        return await base44.entities.Coupon.filter({ company_id: companyId });
      } catch (error) {
        console.error('Error loading coupons:', error);
        return [];
      }
    },
    enabled: !!companyId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const editClientMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Client.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setEditDialogOpen(false);
      toast.success('Client details updated!');
    },
    onError: (e) => toast.error('Error: ' + e.message)
  });

  const giftPointsMutation = useMutation({
    mutationFn: async ({ client, amount, reason }) => {
      const newBalance = (client.current_balance || 0) + amount;

      // Generate unique hash_key like POS does
      const hashKey = `BONUS-${client.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const claimToken = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

      // 1. Create Transaction record (appears in TransactionsAndSettlement page)
      const tx = await base44.entities.Transaction.create({
        company_id: companyId,
        branch_id: null,
        client_id: client.id,
        client_phone: client.phone,
        order_id: hashKey,
        hash_key: hashKey,
        amount: 0,
        tokens_expected: amount,
        tokens_actual: amount,
        token_symbol: company?.points_name || 'pts',
        status: 'completed',
        claim_token: claimToken,
        claimed_at: new Date().toISOString(),
        metadata: {
          source: 'manual_grant',
          reason: reason || 'Manual reward gift',
          granted_by: user?.email || 'admin'
        }
      });

      // 2. Create LedgerEvent (audit trail)
      await base44.entities.LedgerEvent.create({
        company_id: companyId,
        client_id: client.id,
        type: 'grant',
        points: amount,
        balance_before: client.current_balance || 0,
        balance_after: newBalance,
        source: 'admin',
        description: reason || 'Manual reward gift',
        reference_id: tx.id
      });

      // 3. Update client balance + total_earned
      await base44.entities.Client.update(client.id, {
        current_balance: newBalance,
        total_earned: (client.total_earned || 0) + amount
      });

      return { tx, hashKey };
    },
    onSuccess: ({ hashKey }) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setGiftDialogOpen(false);
      setSelectedClientForGift(null);
      setGiftAmount('');
      setGiftReason('');
      toast.success(`Points granted! TX: ${hashKey}`);
    },
    onError: (e) => toast.error('Error: ' + e.message)
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // Step 1: Create client
      const newClient = await base44.entities.Client.create({
        ...data,
        company_id: companyId,
        current_balance: 0,
        total_earned: 0,
        total_redeemed: 0
      });

      // Step 2: Create blockchain wallet (non-blocking)
      try {
        console.log('🔐 Creating blockchain wallet for client:', newClient.id);
        const walletResult = await base44.functions.invoke('createCustodialWallet', {
          clientId: newClient.id
        });
        
        if (walletResult.data?.success) {
          console.log('✅ Wallet created:', walletResult.data.data?.walletAddress);
        }
      } catch (walletError) {
        // Don't fail client creation if wallet fails
        console.warn('⚠️ Wallet creation failed (non-critical):', walletError);
      }

      return newClient;
    },
    onSuccess: (newClient) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setDialogOpen(false);
      setFormData({ phone: '', email: '', full_name: '' });
      toast.success('Client added with blockchain wallet!');
      
      // Webhook trigger - wrapped in try/catch to prevent errors from breaking the UI
      try {
        // Fire and forget - don't await
        triggerWebhookSafely('client_created', {
          client_id: newClient.id,
          company_id: companyId,
          phone: newClient.phone,
          full_name: newClient.full_name,
          timestamp: new Date().toISOString()
        }, companyId);
      } catch (e) {
        console.warn('Webhook trigger failed (non-critical):', e);
      }
    },
    onError: (error) => {
      toast.error('Failed to add client: ' + error.message);
    }
  });

  // Safe webhook trigger function
  const triggerWebhookSafely = async (eventType, payload, companyId) => {
    try {
      const webhooks = await base44.entities.WebhookConfig.filter({ 
        company_id: companyId, 
        is_active: true 
      });
      
      const matchingWebhooks = webhooks.filter(wh => 
        wh.events && wh.events.includes(eventType)
      );
      
      for (const webhook of matchingWebhooks) {
        fetch(webhook.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: eventType, data: payload, timestamp: Date.now() })
        }).catch(e => console.warn('Webhook delivery failed:', e));
      }
    } catch (error) {
      // Silently fail - webhooks are not critical
      console.warn('Webhook service unavailable:', error);
    }
  };

  // Deduplicate clients by phone (keep the one with more data / latest)
  const deduplicatedClients = useMemo(() => {
    if (!clients || clients.length === 0) return [];
    const seen = new Map();
    for (const client of clients) {
      const key = client.phone || client.id;
      if (!seen.has(key)) {
        seen.set(key, client);
      } else {
        // Keep the one with a name, or the more recently updated
        const existing = seen.get(key);
        if (!existing.full_name && client.full_name) seen.set(key, client);
        else if (client.updated_date > existing.updated_date) seen.set(key, client);
      }
    }
    return Array.from(seen.values());
  }, [clients]);

  // Enrich clients with transaction and coupon data
  const enrichedClients = useMemo(() => {
    if (!deduplicatedClients || deduplicatedClients.length === 0) return [];
    
    return deduplicatedClients.map(client => {
      const clientTransactions = transactions.filter(t => t.client_id === client.id);
      const clientCoupons = coupons.filter(c => c.client_id === client.id && c.status === 'active');
      
      let lastPurchaseDate = null;
      if (clientTransactions.length > 0) {
        const dates = clientTransactions
          .map(t => t.created_date ? new Date(t.created_date).getTime() : 0)
          .filter(d => d > 0);
        if (dates.length > 0) {
          lastPurchaseDate = new Date(Math.max(...dates));
        }
      }
      
      return {
        ...client,
        transactionCount: clientTransactions.length,
        activeCouponsCount: clientCoupons.length,
        lastPurchaseDate
      };
    });
  }, [deduplicatedClients, transactions, coupons]);

  // Filter and sort clients
  const filteredClients = useMemo(() => {
    let filtered = enrichedClients.filter(c => {
      const searchLower = search.toLowerCase();
      const matchesSearch = 
        (c.phone && c.phone.includes(search)) ||
        (c.email && c.email.toLowerCase().includes(searchLower)) ||
        (c.full_name && c.full_name.toLowerCase().includes(searchLower));

      const matchesFilter = 
        filterType === 'all' ||
        (filterType === 'with_stars' && (c.current_balance || 0) > 0) ||
        (filterType === 'with_tokens' && (c.tokenBalance || 0) > 0) ||
        (filterType === 'with_coupons' && c.activeCouponsCount > 0);

      return matchesSearch && matchesFilter;
    });

    // Sort
    if (sortBy === 'balance_desc') {
      filtered.sort((a, b) => (b.current_balance || 0) - (a.current_balance || 0));
    } else if (sortBy === 'transactions_desc') {
      filtered.sort((a, b) => (b.transactionCount || 0) - (a.transactionCount || 0));
    } else if (sortBy === 'last_purchase') {
      filtered.sort((a, b) => {
        if (!a.lastPurchaseDate) return 1;
        if (!b.lastPurchaseDate) return -1;
        return b.lastPurchaseDate.getTime() - a.lastPurchaseDate.getTime();
      });
    } else {
      filtered.sort((a, b) => {
        const dateA = a.created_date ? new Date(a.created_date).getTime() : 0;
        const dateB = b.created_date ? new Date(b.created_date).getTime() : 0;
        return dateB - dateA;
      });
    }

    return filtered;
  }, [enrichedClients, search, filterType, sortBy]);

  // Calculate stats
  const stats = useMemo(() => {
    const monthStart = startOfMonth(new Date());
    const thisMonthTransactions = transactions.filter(t => 
      t.created_date && new Date(t.created_date) >= monthStart
    );

    return {
      totalTokens: deduplicatedClients.reduce((sum, c) => sum + (c.onchain_balance || c.tokenBalance || 0), 0),
      activeCoupons: coupons.filter(c => c.status === 'active').length,
      monthRevenue: thisMonthTransactions.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0)
    };
  }, [deduplicatedClients, transactions, coupons]);

  const pointsName = company?.points_name || 'Points';
  const { format: formatCurrency } = useCurrency(companyId);

  const profileComplete = (c) => !!(c.full_name && c.birthday);

  const resendWelcome = async (client) => {
    setSendingWelcome(client.id);
    try {
      await base44.functions.invoke('sendNewClientWelcome', {
        client_id: client.id,
        company_id: client.company_id,
        phone: client.phone,
        force: true,
      });
      toast.success('הודעת WhatsApp נשלחה שוב!');
    } catch (e) {
      toast.error('שליחה נכשלה: ' + e.message);
    } finally {
      setSendingWelcome(null);
    }
  };

  const handleImportFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportFile(file);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) return;
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase());
      const rows = lines.slice(1).map(line => {
        const vals = line.split(',').map(v => v.trim().replace(/"/g, ''));
        const obj = {};
        headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
        return obj;
      }).filter(r => r.phone || r['טלפון'] || r['phone']);
      setImportPreview(rows.slice(0, 5));
    };
    reader.readAsText(file);
  };

  const handleImportSubmit = async () => {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: importFile });
      const result = await base44.functions.invoke('importRunCustomers', {
        company_id: companyId,
        file_url,
        mapping: { phone: 'phone', full_name: 'full_name', email: 'email', birthday: 'birthday' }
      });
      const data = result.data;
      setImportResult({ success: true, created: data?.created || 0, updated: data?.updated || 0, errors: data?.errors || 0 });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    } catch (err) {
      setImportResult({ success: false, message: err.message });
    } finally {
      setImporting(false);
    }
  };

  const columns = [
    { 
      header: 'Client', 
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <span className="text-white font-medium">
              {row.full_name?.charAt(0) || row.phone?.charAt(0) || '?'}
            </span>
          </div>
          <div>
            <p className="font-medium text-white">{row.full_name || row.phone || 'Unknown'}</p>
            <div className="flex items-center gap-1 text-sm text-slate-400">
              <Phone className="w-3 h-3" />
              {row.phone || '-'}
            </div>
          </div>
        </div>
      )
    },
    { 
      header: `${pointsName} Balance`, 
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Coins className="w-4 h-4 text-yellow-500" />
          <span className="font-bold text-yellow-400">
            {(row.current_balance || 0).toLocaleString()}
          </span>
        </div>
      )
    },
    { 
      header: 'On-Chain Balance',
      className: 'hidden md:table-cell',
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Wallet className="w-4 h-4 text-blue-500" />
          <span className="font-semibold text-blue-400">
            {(row.onchain_balance || row.tokenBalance || 0).toLocaleString()}
          </span>
        </div>
      )
    },
    { 
      header: 'Wallet',
      className: 'hidden lg:table-cell',
      cell: (row) => <WalletAddressCell address={row.wallet_address} />
    },
    { 
      header: 'Active Coupons',
      className: 'hidden sm:table-cell',
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Ticket className="w-4 h-4 text-purple-500" />
          <span className="text-white">{row.activeCouponsCount || 0}</span>
        </div>
      )
    },
    { 
      header: 'Transactions',
      className: 'hidden sm:table-cell',
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Receipt className="w-4 h-4 text-slate-400" />
          <span className="text-white">{row.transactionCount || 0}</span>
        </div>
      )
    },
    { 
      header: 'Last Purchase',
      className: 'hidden lg:table-cell',
      cell: (row) => (
        <span className="text-slate-400 text-sm">
          {row.lastPurchaseDate ? format(row.lastPurchaseDate, 'dd/MM/yy') : 'None'}
        </span>
      )
    },
    { 
      header: 'Birthday',
      className: 'hidden lg:table-cell',
      cell: (row) => (
        <span className="text-slate-400 text-sm">
          {row.birthday ? format(new Date(row.birthday + 'T00:00:00'), 'dd/MM') : '—'}
        </span>
      )
    },
    {
      header: 'Profile',
      className: 'hidden lg:table-cell',
      cell: (row) => profileComplete(row) ? (
        <div className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
          <CheckCircle2 className="w-4 h-4" />
          <span>Complete</span>
        </div>
      ) : (
        <div className="flex items-center gap-1 text-amber-400 text-xs font-medium">
          <AlertCircle className="w-4 h-4" />
          <span>Missing</span>
        </div>
      )
    },
    { 
      header: 'Joined',
      className: 'hidden md:table-cell',
      cell: (row) => (
        <span className="text-slate-400 text-sm">
          {row.created_date ? format(new Date(row.created_date), 'dd/MM/yy') : '-'}
        </span>
      )
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex gap-1">
          <Link to={createPageUrl('ClientDetails') + `?id=${row.id}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="View Details">
              <Eye className="w-4 h-4" />
            </Button>
          </Link>
          <Link to={createPageUrl('Transactions') + `?client_id=${row.id}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Transaction History">
              <History className="w-4 h-4" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-yellow-400 hover:bg-yellow-400/10"
            title="Grant Points"
            onClick={() => { setSelectedClientForGift(row); setGiftAmount(''); setGiftReason(''); setGiftDialogOpen(true); }}
          >
            <Gift className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-blue-400 hover:bg-blue-400/10"
            title="Edit Details"
            onClick={() => { setEditingClient(row); setEditForm({ full_name: row.full_name || '', phone: row.phone || '', email: row.email || '', birthday: row.birthday || '' }); setEditDialogOpen(true); }}
          >
            <Pencil className="w-4 h-4" />
          </Button>
          {!profileComplete(row) && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-orange-400 hover:bg-orange-400/10"
              title="שלח WhatsApp למילוי פרטים"
              disabled={sendingWelcome === row.id}
              onClick={() => resendWelcome(row)}
            >
              {sendingWelcome === row.id
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />}
            </Button>
          )}
        </div>
      )
    }
  ];

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-yellow-400 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Loading company data...</p>
        </div>
      </div>
    );
  }

  // Show message if no company (only after loading is complete)
  if (!companyId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Users className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <p className="text-slate-400">No company found</p>
          <p className="text-slate-500 text-sm mt-2">
            {user?.role === 'admin' ? 'Please create a company first' : 'No company registered for your account'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 lg:space-y-6">
      {/* Edit Client Modal */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Pencil className="w-4 h-4 text-blue-400" />
              Edit Client Details
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div>
              <Label className="text-white">Full Name</Label>
              <Input value={editForm.full_name} onChange={e => setEditForm({...editForm, full_name: e.target.value})} className="bg-[#17171f] border-[#2d2d3a] text-white mt-1" />
            </div>
            <div>
              <Label className="text-white">Phone</Label>
              <Input value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} dir="ltr" className="bg-[#17171f] border-[#2d2d3a] text-white mt-1" />
            </div>
            <div>
              <Label className="text-white">Email</Label>
              <Input type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} dir="ltr" className="bg-[#17171f] border-[#2d2d3a] text-white mt-1" />
            </div>
            <div>
              <Label className="text-white">Birthday</Label>
              <Input type="date" value={editForm.birthday} onChange={e => setEditForm({...editForm, birthday: e.target.value})} className="bg-[#17171f] border-[#2d2d3a] text-white mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} className="border-[#2d2d3a] text-white">Cancel</Button>
            <Button
              disabled={editClientMutation.isPending}
              onClick={() => editClientMutation.mutate({ id: editingClient.id, data: editForm })}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {editClientMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Pencil className="w-4 h-4 mr-2" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Gift Points Modal */}
      <Dialog open={giftDialogOpen} onOpenChange={setGiftDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Gift className="w-5 h-5 text-yellow-400" />
              Grant Points to Client
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            {selectedClientForGift && (
              <div className="bg-[#17171f] rounded-lg p-3">
                <p className="text-[#9ca3af] text-xs mb-1">Client</p>
                <p className="text-white font-semibold">{selectedClientForGift.full_name || selectedClientForGift.phone}</p>
                <p className="text-teal-400 text-sm">Current balance: {(selectedClientForGift.current_balance || 0).toLocaleString()} pts</p>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-white">Points to Grant</Label>
              <Input
                type="number"
                min="1"
                value={giftAmount}
                onChange={(e) => setGiftAmount(e.target.value)}
                placeholder="e.g. 100"
                className="bg-[#17171f] border-[#2d2d3a] text-white"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label className="text-white">Reason (optional)</Label>
              <Input
                value={giftReason}
                onChange={(e) => setGiftReason(e.target.value)}
                placeholder="e.g. Birthday bonus, compensation..."
                className="bg-[#17171f] border-[#2d2d3a] text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGiftDialogOpen(false)} className="border-[#2d2d3a] text-white">
              Cancel
            </Button>
            <Button
              disabled={!giftAmount || Number(giftAmount) <= 0 || giftPointsMutation.isPending}
              onClick={() => giftPointsMutation.mutate({ client: selectedClientForGift, amount: Number(giftAmount), reason: giftReason })}
              className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
            >
              {giftPointsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Gift className="w-4 h-4 mr-2" />}
              Grant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 lg:gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white">Clients</h1>
          <p className="text-xs lg:text-sm text-slate-400 mt-1">
            {deduplicatedClients.length.toLocaleString()} registered clients
            {company && <span className="text-slate-500"> • {company.name}</span>}
          </p>
        </div>
        <div className="flex gap-1 lg:gap-2">
          {/* Import Excel Button */}
          <Button variant="outline" className="border-emerald-600 text-emerald-400 hover:bg-emerald-600/10" onClick={() => { setImportDialogOpen(true); setImportFile(null); setImportPreview([]); setImportResult(null); }}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Import Excel
          </Button>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Client
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-white">Add New Client</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-white">Phone Number *</Label>
                <Input 
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  placeholder="+972 50-123-4567"
                  dir="ltr"
                  className="bg-[#17171f] border-[#2d2d3a] text-white"
                  autoFocus
                />
                <p className="text-xs text-slate-500">Format: +972501234567 or 0501234567</p>
              </div>
              <div className="space-y-2">
                <Label className="text-white">Full Name</Label>
                <Input 
                  value={formData.full_name}
                  onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                  placeholder="John Doe"
                  className="bg-[#17171f] border-[#2d2d3a] text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white">Email (optional)</Label>
                <Input 
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="email@example.com"
                  dir="ltr"
                  className="bg-[#17171f] border-[#2d2d3a] text-white"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="border-[#2d2d3a] text-white">
                Cancel
              </Button>
              <Button 
                onClick={() => createMutation.mutate(formData)}
                disabled={!formData.phone || createMutation.isPending}
                className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700"
              >
                {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Add Client
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
        </div>

        {/* Import Excel Dialog */}
        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
              Import Clients from Excel / CSV
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Instructions */}
            <div className="bg-[#17171f] rounded-lg p-3 text-xs text-slate-400 space-y-1">
              <p className="text-white font-medium mb-1">📋 File format (CSV):</p>
              <p>Required column: <span className="text-emerald-400">phone</span></p>
              <p>Optional columns: <span className="text-slate-300">full_name, email, birthday (YYYY-MM-DD)</span></p>
              <p className="text-slate-500 mt-1">Export your Excel file as CSV (File → Save As → CSV)</p>
            </div>

            {/* File upload */}
            {!importFile ? (
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-[#2d2d3a] hover:border-emerald-500/50 rounded-lg p-8 cursor-pointer transition-colors">
                <Upload className="w-8 h-8 text-slate-500 mb-2" />
                <span className="text-slate-400 text-sm">Click to upload CSV file</span>
                <input type="file" accept=".csv,.xlsx" className="hidden" onChange={handleImportFile} />
              </label>
            ) : (
              <div className="flex items-center justify-between bg-[#17171f] rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                  <span className="text-white text-sm">{importFile.name}</span>
                </div>
                <button onClick={() => { setImportFile(null); setImportPreview([]); }} className="text-slate-500 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Preview */}
            {importPreview.length > 0 && (
              <div>
                <p className="text-xs text-slate-400 mb-2">Preview (first 5 rows):</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {importPreview.map((row, i) => (
                    <div key={i} className="bg-[#17171f] rounded px-3 py-1.5 text-xs text-slate-300 flex gap-4">
                      <span className="text-emerald-400">{row.phone || row['טלפון'] || '—'}</span>
                      <span>{row.full_name || row['שם'] || '—'}</span>
                      <span className="text-slate-500">{row.email || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Result */}
            {importResult && (
              <div className={`rounded-lg p-3 text-sm ${importResult.success ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                {importResult.success
                  ? `✅ Done! Created: ${importResult.created}, Updated: ${importResult.updated}, Errors: ${importResult.errors}`
                  : `❌ Error: ${importResult.message}`}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)} className="border-[#2d2d3a] text-white">Cancel</Button>
            <Button
              disabled={!importFile || importing || !!importResult?.success}
              onClick={handleImportSubmit}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              {importing ? 'Importing...' : 'Import'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 lg:gap-4">
         <Card className="border-slate-800 bg-slate-900 shadow-sm p-2 lg:p-4">
          <p className="text-xs lg:text-sm text-slate-400">Total Clients</p>
          <p className="text-lg lg:text-2xl font-bold text-white">{deduplicatedClients.length || 0}</p>
        </Card>
         <Card className="border-slate-800 bg-slate-900 shadow-sm p-2 lg:p-4">
          <p className="text-xs lg:text-sm text-slate-400">Total {pointsName}</p>
          <p className="text-lg lg:text-2xl font-bold text-yellow-400">
            {(deduplicatedClients.reduce((s, c) => s + (c.current_balance || 0), 0) || 0).toLocaleString()}
          </p>
        </Card>
        <Card className="border-slate-800 bg-slate-900 shadow-sm p-2 lg:p-4">
         <p className="text-xs lg:text-sm text-slate-400 flex items-center gap-1">
           <Wallet className="w-3 h-3" />
           <span className="hidden sm:inline">Total Tokens</span><span className="sm:hidden">Tokens</span>
         </p>
         <p className="text-lg lg:text-2xl font-bold text-blue-400">
            {(stats.totalTokens || 0).toLocaleString()}
          </p>
        </Card>
        <Card className="border-slate-800 bg-slate-900 shadow-sm p-2 lg:p-4">
         <p className="text-xs lg:text-sm text-slate-400 flex items-center gap-1">
           <Ticket className="w-3 h-3" />
           <span className="hidden sm:inline">Active Coupons</span><span className="sm:hidden">Coupons</span>
         </p>
         <p className="text-lg lg:text-2xl font-bold text-purple-400">
            {stats.activeCoupons || 0}
          </p>
        </Card>
        <Card className="border-slate-800 bg-slate-900 shadow-sm p-2 lg:p-4">
         <p className="text-xs lg:text-sm text-slate-400 flex items-center gap-1">
           <TrendingUp className="w-3 h-3" />
           <span className="hidden sm:inline">Month Revenue</span><span className="sm:hidden">Revenue</span>
         </p>
         <p className="text-lg lg:text-2xl font-bold text-green-400">
            {formatCurrency(stats.monthRevenue)}
          </p>
        </Card>
        <Card className="border-slate-800 bg-slate-900 shadow-sm p-2 lg:p-4">
         <p className="text-xs lg:text-sm text-slate-400"><span className="hidden sm:inline">With Wallet</span><span className="sm:hidden">Wallet</span></p>
         <p className="text-lg lg:text-2xl font-bold text-indigo-400">
            {deduplicatedClients.filter(c => c.wallet_address || c.blockchain_wallet_address).length}
          </p>
        </Card>
      </div>

      {/* Filters and Search */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 lg:gap-4">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input 
            placeholder="Search by phone, email or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-10 bg-slate-900 border-slate-800 text-white"
          />
        </div>

        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="bg-slate-900 border-slate-800 text-white">
            <SelectValue placeholder="Filter clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Customers</SelectItem>
            <SelectItem value="with_stars">With {pointsName}</SelectItem>
            <SelectItem value="with_tokens">With Tokens</SelectItem>
            <SelectItem value="with_coupons">With Active Coupons</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="bg-slate-900 border-slate-800 text-white">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_date">Recently Joined</SelectItem>
            <SelectItem value="balance_desc">Balance - High to Low</SelectItem>
            <SelectItem value="transactions_desc">Most Transactions</SelectItem>
            <SelectItem value="last_purchase">Last Purchase</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results Count */}
      <div className="text-sm text-slate-400">
        Showing {filteredClients.length} of {clients.length} clients
      </div>

      {/* Table */}
      <Card className="border-slate-800 bg-slate-900 shadow-sm">
        <CardContent className="p-0">
          <DataTable 
            columns={columns}
            data={filteredClients}
            isLoading={clientsLoading}
            emptyMessage="No clients found"
          />
        </CardContent>
      </Card>
    </div>
  );
}