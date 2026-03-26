import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { User, Search, QrCode, Loader2, Award } from 'lucide-react';
import { toast } from 'sonner';

export default function CustomerLookup({ companyId, onCustomerSelected }) {
  const [phone, setPhone] = useState('');
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Search customers as user types
  useEffect(() => {
    const searchCustomers = async () => {
      if (phone.length >= 3) {
        try {
          const clients = await base44.entities.Client.filter({
            company_id: companyId
          });
          
          const filtered = clients.filter(c => 
            c.phone.includes(phone)
          ).slice(0, 5);
          
          setSuggestions(filtered);
        } catch (error) {
          console.error('Search error:', error);
        }
      } else {
        setSuggestions([]);
      }
    };

    const debounce = setTimeout(searchCustomers, 300);
    return () => clearTimeout(debounce);
  }, [phone, companyId]);

  const handleSelectCustomer = async (customer) => {
    setSelectedCustomer(customer);
    setPhone(customer.phone);
    setSuggestions([]);
    onCustomerSelected(customer);
  };

  const handleLookup = async () => {
    if (!phone) {
      toast.error('Enter phone number');
      return;
    }

    setSearching(true);
    try {
      const clients = await base44.entities.Client.filter({
        company_id: companyId,
        phone: phone
      });

      if (clients.length > 0) {
        handleSelectCustomer(clients[0]);
        toast.success('Customer found!');
      } else {
        onCustomerSelected({ phone, isNew: true });
        toast.info('New customer');
      }
    } catch (error) {
      toast.error('Lookup failed');
    } finally {
      setSearching(false);
    }
  };

  const handleScanQR = async () => {
    try {
      // Check if browser supports camera
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error('Camera not supported');
        return;
      }

      toast.info('QR Scanner - Coming soon!');
      // In production, integrate a QR scanner library like html5-qrcode
    } catch (error) {
      toast.error('Camera access denied');
    }
  };

  return (
    <div className="space-y-4">
      {/* Phone Input */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleLookup()}
            placeholder="Enter phone number"
            className="h-16 text-xl pl-12 bg-[#1f2128] border-[#2d2d3a] text-white"
            dir="ltr"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9ca3af]" />
          
          {/* Autocomplete Suggestions */}
          {suggestions.length > 0 && (
            <div className="absolute top-full mt-1 w-full bg-[#1f2128] border border-[#2d2d3a] rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
              {suggestions.map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => handleSelectCustomer(customer)}
                  className="w-full p-3 text-left hover:bg-[#17171f] border-b border-[#2d2d3a] last:border-0"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">{customer.phone}</p>
                      {customer.full_name && (
                        <p className="text-[#9ca3af] text-sm">{customer.full_name}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-[#10b981] font-bold">{customer.current_balance || 0}</p>
                      <p className="text-[#9ca3af] text-xs">points</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        
        <Button
          onClick={handleLookup}
          disabled={!phone || searching}
          className="h-16 px-6 bg-[#10b981] hover:bg-[#059669] text-white"
        >
          {searching ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Search className="w-5 h-5 mr-2" />
              Lookup
            </>
          )}
        </Button>

        <Button
          onClick={handleScanQR}
          className="h-16 px-6 bg-[#17171f] hover:bg-[#2d2d3a] border-2 border-[#10b981] text-[#10b981]"
        >
          <QrCode className="w-6 h-6" />
        </Button>
      </div>

      {/* Selected Customer Info */}
      {selectedCustomer && !selectedCustomer.isNew && (
        <div className="bg-[#10b981]/10 border border-[#10b981]/30 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-[#10b981] rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-white font-bold">{selectedCustomer.phone}</p>
                {selectedCustomer.full_name && (
                  <p className="text-[#9ca3af] text-sm">{selectedCustomer.full_name}</p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2 bg-[#10b981] px-3 py-1 rounded-full">
              <Award className="w-4 h-4 text-white" />
              <span className="text-white font-bold">{selectedCustomer.level || 'Bronze'}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-[#17171f] rounded-lg p-2">
              <p className="text-2xl font-bold text-[#10b981]">{selectedCustomer.current_balance || 0}</p>
              <p className="text-[#9ca3af] text-xs">Current Points</p>
            </div>
            <div className="bg-[#17171f] rounded-lg p-2">
              <p className="text-2xl font-bold text-white">{selectedCustomer.total_earned || 0}</p>
              <p className="text-[#9ca3af] text-xs">Total Earned</p>
            </div>
            <div className="bg-[#17171f] rounded-lg p-2">
              <p className="text-2xl font-bold text-orange-400">{selectedCustomer.total_redeemed || 0}</p>
              <p className="text-[#9ca3af] text-xs">Redeemed</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}