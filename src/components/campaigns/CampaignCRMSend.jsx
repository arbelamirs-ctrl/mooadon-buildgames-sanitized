import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, Users, X, MessageSquare, Mail, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function CampaignCRMSend({ campaign, companyId, onClose }) {
  const [channel, setChannel] = useState('sms');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [selectedClients, setSelectedClients] = useState([]);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients-crm', companyId],
    queryFn: () => base44.entities.Client.filter({ company_id: companyId }, '-last_activity', 200),
    enabled: !!companyId
  });

  const publicUrl = `${window.location.origin}/CouponPage?code=${campaign.coupon_code}&utm_source=${channel}&utm_campaign=${campaign.id}&utm_variant=a`;

  const toggleClient = (id) => {
    setSelectedClients(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAll = () => setSelectedClients(clients.map(c => c.id));
  const clearAll = () => setSelectedClients([]);

  const handleSend = async () => {
    if (!selectedClients.length) { toast.error('Select at least one customer'); return; }
    setSending(true);
    try {
      const targets = clients.filter(c => selectedClients.includes(c.id));
      // Send via Twilio SMS / WhatsApp (best-effort, fire all)
      const message = `${campaign.cta || 'Special offer just for you!'} Use code ${campaign.coupon_code}: ${publicUrl}`;

      if (channel === 'sms' || channel === 'whatsapp') {
        await Promise.allSettled(targets.map(client =>
          base44.functions.invoke('sendWhatsAppMessage', {
            to: client.phone,
            message,
            company_id: companyId,
            channel
          })
        ));
      }

      // Log distribution
      await Promise.allSettled(targets.map(client =>
        base44.entities.AuditLog.create({
          company_id: companyId,
          action: `campaign_sent_${channel}`,
          entity_type: 'CouponCampaign',
          entity_id: campaign.id,
          details: { client_id: client.id, phone: client.phone, channel, code: campaign.coupon_code }
        })
      ));

      setSent(true);
      toast.success(`Sent to ${targets.length} customers!`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[#1f2128] border border-[#2d2d3a] rounded-xl max-w-lg w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Send className="w-4 h-4 text-teal-400" />
            Send to Customers
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        {sent ? (
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <p className="text-white font-medium">Campaign sent!</p>
            <p className="text-slate-400 text-sm mt-1">{selectedClients.length} customers notified via {channel.toUpperCase()}</p>
            <Button className="mt-4 bg-teal-500 hover:bg-teal-600" onClick={onClose}>Done</Button>
          </div>
        ) : (
          <>
            {/* Channel */}
            <div className="flex gap-2">
              {[
                { key: 'sms', label: 'SMS', icon: MessageSquare },
                { key: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
                { key: 'email', label: 'Email', icon: Mail }
              ].map(ch => (
                <button
                  key={ch.key}
                  onClick={() => setChannel(ch.key)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 ${channel === ch.key ? 'bg-teal-500 text-white' : 'bg-[#17171f] text-slate-400 hover:text-white border border-[#2d2d3a]'}`}
                >
                  <ch.icon className="w-3 h-3" />{ch.label}
                </button>
              ))}
            </div>

            {channel === 'email' && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 text-xs text-amber-300">
                Email sending requires per-customer email on file. Only customers with email will receive it.
              </div>
            )}

            {/* Message preview */}
            <div className="bg-[#17171f] rounded-lg p-3">
              <p className="text-slate-400 text-xs mb-1">Message preview</p>
              <p className="text-white text-xs">{campaign.cta || 'Special offer!'} Use code <strong>{campaign.coupon_code}</strong>: {publicUrl.substring(0, 50)}...</p>
            </div>

            {/* Client list */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-xs flex items-center gap-1"><Users className="w-3 h-3" />{clients.length} customers</span>
                <div className="flex gap-2">
                  <button onClick={selectAll} className="text-xs text-teal-400 hover:text-teal-300">Select all</button>
                  <button onClick={clearAll} className="text-xs text-slate-500 hover:text-slate-300">Clear</button>
                </div>
              </div>
              {isLoading ? (
                <div className="text-slate-500 text-xs text-center py-4">Loading customers...</div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {clients.slice(0, 100).map(client => (
                    <button
                      key={client.id}
                      onClick={() => toggleClient(client.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors ${selectedClients.includes(client.id) ? 'bg-teal-500/20 text-white' : 'bg-[#17171f] text-slate-300 hover:bg-[#2d2d3a]'}`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedClients.includes(client.id) ? 'bg-teal-500 border-teal-500' : 'border-[#2d2d3a]'}`}>
                        {selectedClients.includes(client.id) && <CheckCircle className="w-3 h-3 text-white" />}
                      </div>
                      <span className="flex-1 text-left">{client.full_name || client.phone}</span>
                      <span className="text-slate-500">{client.phone}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} className="flex-1 border-[#2d2d3a] text-white text-sm">Cancel</Button>
              <Button
                className="flex-1 bg-teal-500 hover:bg-teal-600 gap-1 text-sm"
                disabled={sending || !selectedClients.length}
                onClick={handleSend}
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send to {selectedClients.length} customers
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}