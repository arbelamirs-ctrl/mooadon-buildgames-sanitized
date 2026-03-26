import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Phone, 
  QrCode, 
  Nfc, 
  Search, 
  X, 
  User,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function CustomerIdentifier({ companyId, onCustomerSelected, onCancel }) {
  const [method, setMethod] = useState('phone'); // phone, qr, nfc, search
  const [phone, setPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [recentCustomers, setRecentCustomers] = useState([]);

  useEffect(() => {
    loadRecentCustomers();
  }, [companyId]);

  const loadRecentCustomers = async () => {
    try {
      const clients = await base44.entities.Client.filter(
        { company_id: companyId },
        '-last_activity',
        5
      );
      setRecentCustomers(clients);
    } catch (error) {
      console.error('Failed to load recent customers:', error);
    }
  };

  const identifyByPhone = async () => {
    if (!phone.trim()) {
      toast.error('Please enter a phone number');
      return;
    }

    setLoading(true);
    try {
      const clients = await base44.entities.Client.filter({
        company_id: companyId,
        phone: phone.trim()
      });

      if (clients.length > 0) {
        // If we have a name, update the existing client
        if (customerName.trim() && !clients[0].full_name) {
          await base44.entities.Client.update(clients[0].id, { full_name: customerName.trim() });
          onCustomerSelected({ ...clients[0], full_name: customerName.trim() });
        } else {
          onCustomerSelected(clients[0]);
        }
      } else {
        // Create new customer with name if provided
        const newClient = await base44.entities.Client.create({
          company_id: companyId,
          phone: phone.trim(),
          full_name: customerName.trim() || '',
          current_balance: 0,
          total_earned: 0
        });
        toast.success('New customer created');
        onCustomerSelected(newClient);
      }
    } catch (error) {
      toast.error('Failed to identify customer');
    } finally {
      setLoading(false);
    }
  };

  const searchCustomers = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const clients = await base44.entities.Client.filter({ 
        company_id: companyId 
      });
      
      const filtered = clients.filter(c => 
        c.phone?.includes(searchQuery) || 
        c.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchQuery.toLowerCase())
      );

      if (filtered.length > 0) {
        setRecentCustomers(filtered.slice(0, 5));
      } else {
        toast.error('No customers found');
      }
    } catch (error) {
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const simulateQRScan = () => {
    toast.info('QR Scanner: Point camera at customer QR code');
    // Simulate scan after 2 seconds
    setTimeout(() => {
      setPhone('+1234567890');
      setMethod('phone');
      toast.success('QR Code scanned!');
    }, 2000);
  };

  const simulateNFCTap = () => {
    toast.info('NFC Reader: Waiting for tap...');
    // Simulate tap after 1.5 seconds
    setTimeout(() => {
      setPhone('+9876543210');
      setMethod('phone');
      toast.success('NFC card detected!');
    }, 1500);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl bg-[#1f2128] border-[#2d2d3a]">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">Identify Customer</h2>
            <Button
              onClick={onCancel}
              variant="ghost"
              size="icon"
              className="text-[#9ca3af] hover:text-white"
            >
              <X className="w-6 h-6" />
            </Button>
          </div>

          {/* Method Selector */}
          <div className="grid grid-cols-4 gap-2 mb-6">
            <button
              onClick={() => setMethod('phone')}
              className={`h-20 flex flex-col gap-2 items-center justify-center rounded-md transition-colors border ${
                method === 'phone' 
                  ? 'bg-teal-500 hover:bg-teal-600 text-white border-teal-500' 
                  : 'bg-[#2d2d3a] hover:bg-[#3d3d4a] border-[#3d3d4a] text-white'
              }`}
            >
              <Phone className="w-6 h-6" />
              <span className="text-xs font-medium">Phone</span>
            </button>

            <button
              onClick={() => { setMethod('qr'); simulateQRScan(); }}
              className={`h-20 flex flex-col gap-2 items-center justify-center rounded-md transition-colors border ${
                method === 'qr' 
                  ? 'bg-teal-500 hover:bg-teal-600 text-white border-teal-500' 
                  : 'bg-[#2d2d3a] hover:bg-[#3d3d4a] border-[#3d3d4a] text-white'
              }`}
            >
              <QrCode className="w-6 h-6" />
              <span className="text-xs font-medium">QR Code</span>
            </button>

            <button
              onClick={() => { setMethod('nfc'); simulateNFCTap(); }}
              className={`h-20 flex flex-col gap-2 items-center justify-center rounded-md transition-colors border ${
                method === 'nfc' 
                  ? 'bg-teal-500 hover:bg-teal-600 text-white border-teal-500' 
                  : 'bg-[#2d2d3a] hover:bg-[#3d3d4a] border-[#3d3d4a] text-white'
              }`}
            >
              <Nfc className="w-6 h-6" />
              <span className="text-xs font-medium">NFC Tap</span>
            </button>

            <button
              onClick={() => setMethod('search')}
              className={`h-20 flex flex-col gap-2 items-center justify-center rounded-md transition-colors border ${
                method === 'search' 
                  ? 'bg-teal-500 hover:bg-teal-600 text-white border-teal-500' 
                  : 'bg-[#2d2d3a] hover:bg-[#3d3d4a] border-[#3d3d4a] text-white'
              }`}
            >
              <Search className="w-6 h-6" />
              <span className="text-xs font-medium">Search</span>
            </button>
          </div>

          {/* Phone Input */}
          {method === 'phone' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && identifyByPhone()}
                  placeholder="+1 234 567 8900"
                  className="text-lg h-14 bg-[#17171f] border-[#2d2d3a] text-white"
                  dir="ltr"
                  autoFocus
                />
                <Button
                  onClick={identifyByPhone}
                  disabled={loading || !phone.trim()}
                  className="h-14 px-8 bg-teal-500 hover:bg-teal-600"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Continue'}
                </Button>
              </div>
              <Input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer name (optional)"
                className="h-11 bg-[#17171f] border-[#2d2d3a] text-white text-sm"
              />
            </div>
          )}

          {/* Search Input */}
          {method === 'search' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && searchCustomers()}
                  placeholder="Search by name, phone, or email..."
                  className="text-lg h-14 bg-[#17171f] border-[#2d2d3a] text-white"
                  autoFocus
                />
                <Button
                  onClick={searchCustomers}
                  disabled={loading}
                  className="h-14 px-8 bg-teal-500 hover:bg-teal-600"
                >
                  <Search className="w-5 h-5" />
                </Button>
              </div>
            </div>
          )}

          {/* Recent/Search Results */}
          {(method === 'phone' || method === 'search') && recentCustomers.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-[#9ca3af] mb-3">
                {method === 'search' ? 'Search Results' : 'Recent Customers'}
              </h3>
              <div className="space-y-2">
                {recentCustomers.map((customer) => (
                  <button
                    key={customer.id}
                    onClick={() => onCustomerSelected(customer)}
                    className="w-full flex items-center justify-between p-4 bg-[#17171f] border border-[#2d2d3a] rounded-lg hover:border-teal-500 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-teal-500/20 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-teal-400" />
                      </div>
                      <div className="text-left">
                        <div className="text-white font-medium">
                          {customer.full_name || customer.phone}
                        </div>
                        <div className="text-xs text-[#9ca3af]">
                          Balance: {customer.current_balance || 0} tokens
                        </div>
                      </div>
                    </div>
                    <Badge className="bg-teal-500/20 text-teal-400 border-teal-500/30">
                      {customer.level || 'Bronze'}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* QR/NFC Status */}
          {(method === 'qr' || method === 'nfc') && (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-teal-500/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                {method === 'qr' ? (
                  <QrCode className="w-10 h-10 text-teal-400" />
                ) : (
                  <Nfc className="w-10 h-10 text-teal-400" />
                )}
              </div>
              <p className="text-white text-lg font-medium">
                {method === 'qr' ? 'Point camera at QR code' : 'Tap NFC card'}
              </p>
              <p className="text-[#9ca3af] text-sm mt-2">
                {method === 'qr' ? 'Scanning...' : 'Waiting for tap...'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}