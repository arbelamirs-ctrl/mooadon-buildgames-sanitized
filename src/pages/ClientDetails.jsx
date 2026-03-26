import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  ArrowRight, 
  Save, 
  Loader2, 
  User, 
  Phone, 
  Mail, 
  Coins, 
  TrendingUp, 
  TrendingDown,
  Wallet,
  Calendar
} from 'lucide-react';
import { toast } from "sonner";
import { format } from 'date-fns';

export default function ClientDetails() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const clientId = urlParams.get('id');

  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    email: ''
  });

  const { data: client, isLoading, error: queryError } = useQuery({
    queryKey: ['client', clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const clients = await base44.entities.Client.filter({ id: clientId });
      return clients[0] || null;
    },
    enabled: !!clientId,
    retry: false
  });

  React.useEffect(() => {
    if (client) {
      setFormData({
        full_name: client.full_name || '',
        phone: client.phone || '',
        email: client.email || ''
      });
    }
  }, [client]);

  const updateClientMutation = useMutation({
    mutationFn: (data) => base44.entities.Client.update(clientId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', clientId] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client updated successfully');
    },
    onError: (error) => {
      toast.error('Error updating client');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    updateClientMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#17171f]">
        <Loader2 className="w-8 h-8 animate-spin text-[#10b981]" />
      </div>
    );
  }

  if (!clientId) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card className="bg-red-500/10 border-red-500/20">
          <CardContent className="p-6 text-center">
            <p className="text-red-400">No client ID provided</p>
            <Button 
              onClick={() => navigate('/Clients')}
              className="mt-4 bg-[#10b981] hover:bg-[#059669]"
            >
              Back to clients list
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!client && !isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card className="bg-red-500/10 border-red-500/20">
          <CardContent className="p-6 text-center">
            <p className="text-red-400">Client not found</p>
            <p className="text-xs text-[#9ca3af] mt-2">Client ID: {clientId}</p>
            <Button 
              onClick={() => navigate('/Clients')}
              className="mt-4 bg-[#10b981] hover:bg-[#059669]"
            >
              Back to clients list
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Client Details</h1>
          <p className="text-sm text-[#9ca3af] mt-1">View and edit client information</p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate('/Clients')}
          className="gap-2 bg-[#1f2128] border-[#2d2d3a] text-white hover:bg-[#2d2d3a]"
        >
          <ArrowRight className="w-4 h-4" />
          Back to list
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Editable Info */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-[#1f2128] border-[#2d2d3a]">
            <CardHeader className="border-b border-[#2d2d3a] p-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
                <User className="w-4 h-4" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-xs text-[#9ca3af]">
                    <User className="w-3.5 h-3.5" />
                    Full Name
                  </Label>
                  <Input
                    value={formData.full_name}
                    onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                    placeholder="Client name"
                    className="bg-[#17171f] border-[#2d2d3a] text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-xs text-[#9ca3af]">
                    <Phone className="w-3.5 h-3.5" />
                    Phone Number
                  </Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    placeholder="+1-555-0123"
                    dir="ltr"
                    className="bg-[#17171f] border-[#2d2d3a] text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-xs text-[#9ca3af]">
                    <Mail className="w-3.5 h-3.5" />
                    Email
                  </Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="email@example.com"
                    dir="ltr"
                    className="bg-[#17171f] border-[#2d2d3a] text-white"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={updateClientMutation.isPending}
                  className="w-full bg-[#10b981] hover:bg-[#059669]"
                >
                  {updateClientMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Wallet Info */}
          {client.wallet_address && (
            <Card className="bg-[#1f2128] border-[#2d2d3a]">
              <CardHeader className="border-b border-[#2d2d3a] p-4">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Wallet className="w-4 h-4" />
                  Digital Wallet Details
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-[#9ca3af] mb-2 block">Wallet Address</Label>
                    <div className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-3">
                      <p className="font-mono text-xs break-all text-[#10b981]" dir="ltr">
                        {client.wallet_address}
                      </p>
                    </div>
                  </div>
                  {client.wallet_chain && client.wallet_chain !== 'none' && (
                    <div>
                      <Label className="text-xs text-[#9ca3af] mb-2 block">Network</Label>
                      <div className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-3">
                        <p className="font-medium capitalize text-white text-sm">
                          {client.wallet_chain}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Stats Sidebar */}
        <div className="space-y-3">
          {/* Balance Card */}
          <Card className="bg-[#1f2128] border-[#2d2d3a]">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#10b981]/10 flex items-center justify-center">
                  <Coins className="w-5 h-5 text-[#10b981]" />
                </div>
                <div>
                  <p className="text-xs text-[#9ca3af]">Current Balance</p>
                  <p className="text-xl font-semibold text-white">
                    {client.current_balance?.toLocaleString() || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total Earned */}
          <Card className="bg-[#1f2128] border-[#2d2d3a]">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-[#9ca3af]">Total Earned</p>
                  <p className="text-xl font-semibold text-white">
                    {client.total_earned?.toLocaleString() || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total Redeemed */}
          <Card className="bg-[#1f2128] border-[#2d2d3a]">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-[#9ca3af]">Total Redeemed</p>
                  <p className="text-xl font-semibold text-white">
                    {client.total_redeemed?.toLocaleString() || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Join Date */}
          <Card className="bg-[#1f2128] border-[#2d2d3a]">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-xs text-[#9ca3af]">Join Date</p>
                  <p className="text-sm font-semibold text-white">
                    {client.created_date ? format(new Date(client.created_date), 'dd/MM/yyyy') : 'Not available'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Onchain Balance (if exists) */}
          {client.onchain_balance > 0 && (
            <Card className="bg-[#1f2128] border-[#2d2d3a]">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-xs text-[#9ca3af]">Blockchain Balance</p>
                    <p className="text-xl font-semibold text-white">
                      {client.onchain_balance?.toLocaleString() || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}