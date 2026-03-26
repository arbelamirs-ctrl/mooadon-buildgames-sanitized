import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Receipt, 
  Search,
  Filter,
  RefreshCcw,
  Loader2,
  DollarSign
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from "sonner";

export default function PaymentHistory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMethod, setFilterMethod] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['paymentTransactions'],
    queryFn: () => base44.entities.PaymentTransaction.list('-created_date', 100),
    initialData: []
  });

  const refundMutation = useMutation({
    mutationFn: async (transaction_id) => {
      const response = await base44.functions.invoke('refundPayment', { transaction_id });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paymentTransactions'] });
      toast.success('Refund processed successfully');
    },
    onError: (error) => {
      toast.error('Refund failed: ' + (error.message || 'Unknown error'));
    }
  });

  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch = !searchTerm || tx.transaction_id?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMethod = filterMethod === 'all' || tx.payment_method === filterMethod;
    const matchesStatus = filterStatus === 'all' || tx.payment_status === filterStatus;
    return matchesSearch && matchesMethod && matchesStatus;
  });

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      refunded: 'bg-slate-100 text-slate-800'
    };
    return colors[status] || 'bg-slate-100 text-slate-800';
  };

  const getMethodBadge = (method) => {
    const badges = {
      stripe: { label: 'Stripe', color: 'bg-indigo-100 text-indigo-800' },
      tranzila: { label: 'Tranzila', color: 'bg-purple-100 text-purple-800' },
      avalanche: { label: 'Avalanche', color: 'bg-orange-100 text-orange-800' }
    };
    return badges[method] || { label: method, color: 'bg-slate-100 text-slate-800' };
  };

  const isAdmin = user?.role === 'admin';

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Payment History</h1>
        <p className="text-slate-500 mt-1">View and manage payment transactions</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="space-y-2">
              <Label>Search Transaction ID</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="TXN-..."
                  className="pl-10"
                />
              </div>
            </div>

            {/* Payment Method Filter */}
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={filterMethod} onValueChange={setFilterMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="stripe">Stripe</SelectItem>
                  <SelectItem value="tranzila">Tranzila</SelectItem>
                  <SelectItem value="avalanche">Avalanche</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Transactions ({filteredTransactions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Receipt className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No transactions found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Transaction ID</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Amount</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Currency</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Method</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Date</th>
                    {isAdmin && <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredTransactions.map((tx) => {
                    const methodBadge = getMethodBadge(tx.payment_method);
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50">
                        <td className="px-4 py-4">
                          <code className="text-sm font-mono bg-slate-100 px-2 py-1 rounded">
                            {tx.transaction_id}
                          </code>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1 font-semibold">
                            <DollarSign className="w-4 h-4 text-slate-400" />
                            {tx.amount?.toLocaleString()}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-slate-700">{tx.currency}</span>
                        </td>
                        <td className="px-4 py-4">
                          <Badge className={methodBadge.color}>
                            {methodBadge.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-4">
                          <Badge className={getStatusColor(tx.payment_status)}>
                            {tx.payment_status}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600">
                          {tx.created_date ? format(new Date(tx.created_date), 'dd/MM/yyyy HH:mm') : '-'}
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-4">
                            {tx.payment_status === 'completed' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => refundMutation.mutate(tx.transaction_id)}
                                disabled={refundMutation.isPending}
                              >
                                {refundMutation.isPending ? (
                                  <>
                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                    Refunding...
                                  </>
                                ) : (
                                  <>
                                    <RefreshCcw className="w-3 h-3 mr-1" />
                                    Refund
                                  </>
                                )}
                              </Button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}