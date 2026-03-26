import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function QuickAddClient({ companyId, onSuccess }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.phone) {
      toast.error('Phone number is required');
      return;
    }

    setLoading(true);
    try {
      const res = await base44.functions.invoke('createClientQuick', {
        company_id: companyId,
        full_name: form.name,
        phone: form.phone,
        email: form.email
      });

      if (res.data.success) {
        toast.success('✅ Customer added successfully');
        setForm({ name: '', phone: '', email: '' });
        onSuccess?.();
      } else {
        toast.error(res.data.error || 'Failed to add customer');
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-[#1f2128] border-[#2d2d3a]">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Plus className="w-5 h-5" /> Quick Add Customer
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label className="text-slate-300 text-xs">Phone*</Label>
            <Input
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              placeholder="050-1234567"
              className="bg-[#17171f] border-[#2d2d3a] text-white text-sm"
              required
            />
          </div>
          <div className="space-y-1">
            <Label className="text-slate-300 text-xs">Name</Label>
            <Input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="John Doe"
              className="bg-[#17171f] border-[#2d2d3a] text-white text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-slate-300 text-xs">Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="email@example.com"
              className="bg-[#17171f] border-[#2d2d3a] text-white text-sm"
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Add Customer
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}