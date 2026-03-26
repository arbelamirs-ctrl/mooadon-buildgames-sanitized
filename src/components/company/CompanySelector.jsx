import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2 } from 'lucide-react';
import { toast } from 'sonner';

export default function CompanySelector({ onCompanyChange }) {
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();
  
  const [selectedId, setSelectedId] = useState(() => {
    return localStorage.getItem('selected_company_id') || '';
  });

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  const { data: companies = [] } = useQuery({
    queryKey: ['companies-selector'],
    queryFn: () => base44.entities.Company.list('-created_date'),
    enabled: user?.role === 'admin' || user?.role === 'super_admin',
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  // Auto-select first company if none selected
  useEffect(() => {
    if (companies.length === 0) return;
    
    const stored = localStorage.getItem('selected_company_id');
    
    if (stored) {
      const exists = companies.some(c => c.id === stored);
      if (exists) {
        if (selectedId !== stored) setSelectedId(stored);
      } else {
        const firstId = companies[0].id;
        setSelectedId(firstId);
        localStorage.setItem('selected_company_id', firstId);
        onCompanyChange?.(firstId);
      }
    } else {
      const firstId = companies[0].id;
      setSelectedId(firstId);
      localStorage.setItem('selected_company_id', firstId);
      onCompanyChange?.(firstId);
    }
  }, [companies]);

  // Listen for external company changes
  useEffect(() => {
    const handleCompanyChanged = (event) => {
      const newCompanyId = event.detail?.companyId;
      if (newCompanyId && newCompanyId !== selectedId) {
        setSelectedId(newCompanyId);
      }
    };
    window.addEventListener('companyChanged', handleCompanyChanged);
    return () => window.removeEventListener('companyChanged', handleCompanyChanged);
  }, [selectedId]);

  const handleChange = (companyId) => {
    if (!companyId || companyId === selectedId) return;
    
    const selectedCompany = companies.find(c => c.id === companyId);
    
    setSelectedId(companyId);
    localStorage.setItem('selected_company_id', companyId);
    
    window.dispatchEvent(new CustomEvent('companyChanged', { detail: { companyId } }));
    onCompanyChange?.(companyId);
    
    queryClient.invalidateQueries({ queryKey: ['company'] });
    queryClient.invalidateQueries({ queryKey: ['companyToken'] });
    queryClient.invalidateQueries({ queryKey: ['clients'] });
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
    queryClient.invalidateQueries({ queryKey: ['branches'] });
    
    toast.success(`Switched to: ${selectedCompany?.name || 'Company'}`, { duration: 2000 });
  };

  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) return null;
  if (companies.length === 0) return null;

  const currentCompany = companies.find(c => c.id === selectedId);

  return (
    <div className="space-y-1">
      <p className="text-xs text-slate-500 px-1">Viewing Company</p>
      <Select value={selectedId} onValueChange={handleChange}>
        <SelectTrigger className="bg-[#17171f] border-[#2d2d3a] text-white text-sm">
          <Building2 className="w-4 h-4 mr-2 text-teal-400" />
          <SelectValue placeholder="Select company...">
            {currentCompany?.name || 'Select company...'}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="bg-[#1f2128] border-[#2d2d3a] max-h-80">
          {companies.map((company) => (
            <SelectItem 
              key={company.id} 
              value={company.id} 
              className="text-white hover:bg-[#17171f]"
            >
              <div className="flex items-center gap-2">
                <span>{company.name}</span>
                {company.client_number && (
                  <span className="text-xs text-slate-500">({company.client_number})</span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {currentCompany && (
        <p className="text-xs text-teal-400/70 px-1 truncate">
          ID: {currentCompany.id.slice(0, 8)}...
        </p>
      )}
    </div>
  );
}