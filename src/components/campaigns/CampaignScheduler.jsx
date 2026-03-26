import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, X, Check } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const QUICK_SLOTS = [
  { label: 'Tomorrow 9am', getValue: () => { const d = addDays(new Date(), 1); d.setHours(9,0,0,0); return d.toISOString(); } },
  { label: 'Tomorrow 5pm', getValue: () => { const d = addDays(new Date(), 1); d.setHours(17,0,0,0); return d.toISOString(); } },
  { label: 'Next Monday 9am', getValue: () => {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? 1 : 8 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(9,0,0,0);
    return d.toISOString();
  }},
  { label: 'In 3 days', getValue: () => { const d = addDays(new Date(), 3); d.setHours(10,0,0,0); return d.toISOString(); } },
  { label: 'In a week', getValue: () => { const d = addDays(new Date(), 7); d.setHours(9,0,0,0); return d.toISOString(); } }
];

export default function CampaignScheduler({ campaign, onClose }) {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState('');
  const [note, setNote] = useState('');

  const scheduleMutation = useMutation({
    mutationFn: (scheduledFor) => base44.entities.CouponCampaign.update(campaign.id, {
      scheduled_for: scheduledFor,
      schedule_note: note,
      status: 'draft'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaign scheduled!');
      onClose();
    }
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[#1f2128] border border-[#2d2d3a] rounded-xl max-w-sm w-full p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Calendar className="w-4 h-4 text-teal-400" />
            Schedule Campaign
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <p className="text-slate-400 text-xs">{campaign.product_name}</p>

        {/* Quick slots */}
        <div className="space-y-2">
          <p className="text-slate-400 text-xs uppercase tracking-wide">Quick Select</p>
          <div className="grid grid-cols-1 gap-1.5">
            {QUICK_SLOTS.map(slot => {
              const val = slot.getValue();
              const isSelected = selectedDate === val;
              return (
                <button
                  key={slot.label}
                  onClick={() => setSelectedDate(val)}
                  className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${isSelected ? 'bg-teal-500 text-white' : 'bg-[#17171f] text-slate-300 hover:bg-[#2d2d3a]'}`}
                >
                  <span className="font-medium">{slot.label}</span>
                  <span className="text-xs ml-2 opacity-60">{format(new Date(val), 'MMM d, HH:mm')}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom date */}
        <div>
          <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">Or pick a date/time</p>
          <input
            type="datetime-local"
            className="w-full bg-[#17171f] border border-[#2d2d3a] rounded-lg px-3 py-2 text-white text-sm"
            onChange={(e) => setSelectedDate(e.target.value ? new Date(e.target.value).toISOString() : '')}
          />
        </div>

        {/* Note */}
        <div>
          <input
            placeholder="Add a note (optional)..."
            className="w-full bg-[#17171f] border border-[#2d2d3a] rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500"
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        </div>

        {selectedDate && (
          <div className="flex items-center gap-2 text-xs text-teal-400 bg-teal-500/10 rounded-lg p-2">
            <Clock className="w-3 h-3" />
            Scheduled for {format(new Date(selectedDate), 'EEEE, MMM d yyyy at HH:mm')}
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1 border-[#2d2d3a] text-white text-sm">Cancel</Button>
          <Button
            className="flex-1 bg-teal-500 hover:bg-teal-600 gap-1 text-sm"
            disabled={!selectedDate || scheduleMutation.isPending}
            onClick={() => scheduleMutation.mutate(selectedDate)}
          >
            <Check className="w-4 h-4" />Schedule
          </Button>
        </div>
      </div>
    </div>
  );
}