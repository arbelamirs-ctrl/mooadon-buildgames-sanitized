import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Cloud, Loader2, ExternalLink, Database, Users, Receipt, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export default function GoogleDriveBackup({ company_id }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [selectedType, setSelectedType] = useState('campaigns');
  
  const backupTypes = [
    { value: 'campaigns', label: 'Campaigns & Benefits', icon: Sparkles, color: 'text-purple-400' },
    { value: 'clients', label: 'Clients (Anonymized)', icon: Users, color: 'text-blue-400' },
    { value: 'transactions', label: 'Transactions', icon: Receipt, color: 'text-green-400' },
    { value: 'all', label: 'Full Backup', icon: Database, color: 'text-orange-400' }
  ];
  
  const handleBackup = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      const response = await base44.functions.invoke('backupToGoogleDrive', {
        company_id: company_id || null,
        backup_type: selectedType
      });
      
      if (response.data.success) {
        setResult(response.data);
        toast.success('✅ Backup completed successfully!');
      } else {
        toast.error(response.data.error || 'Backup failed');
      }
    } catch (error) {
      console.error('Backup error:', error);
      toast.error(error.message || 'Failed to backup to Google Drive');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Cloud className="w-5 h-5 text-blue-400" />
          Google Drive Backup
        </CardTitle>
        <CardDescription className="text-slate-400">
          Backup campaign data securely to your Google Drive
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-slate-300 mb-3 block">Select backup type:</Label>
          <div className="grid grid-cols-2 gap-3">
            {backupTypes.map(type => {
              const Icon = type.icon;
              const isSelected = selectedType === type.value;
              return (
                <button
                  key={type.value}
                  onClick={() => setSelectedType(type.value)}
                  className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${
                    isSelected 
                      ? 'bg-blue-500/20 border-blue-500/50' 
                      : 'bg-slate-900/50 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isSelected ? 'text-blue-400' : type.color}`} />
                  <span className="text-sm text-white">{type.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        
        <Button
          onClick={handleBackup}
          disabled={loading}
          className="w-full bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating backup...
            </>
          ) : (
            <>
              <Cloud className="w-4 h-4 mr-2" />
              Backup to Google Drive
            </>
          )}
        </Button>
        
        {result && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-green-400 font-medium mb-2">
                  {result.message}
                </p>
                <div className="space-y-1 text-xs text-slate-400">
                  <div className="font-mono">{result.file_name}</div>
                  {result.records_backed_up && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {result.records_backed_up.benefits > 0 && (
                        <Badge variant="outline" className="text-purple-400 border-purple-400/30">
                          {result.records_backed_up.benefits} Benefits
                        </Badge>
                      )}
                      {result.records_backed_up.grants > 0 && (
                        <Badge variant="outline" className="text-blue-400 border-blue-400/30">
                          {result.records_backed_up.grants} Grants
                        </Badge>
                      )}
                      {result.records_backed_up.clients > 0 && (
                        <Badge variant="outline" className="text-green-400 border-green-400/30">
                          {result.records_backed_up.clients} Clients
                        </Badge>
                      )}
                      {result.records_backed_up.transactions > 0 && (
                        <Badge variant="outline" className="text-orange-400 border-orange-400/30">
                          {result.records_backed_up.transactions} TXs
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                {result.file_url && (
                  <a 
                    href={result.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-2"
                  >
                    Open in Google Drive
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
        
        <div className="bg-slate-900/30 rounded-lg p-3 border border-slate-800">
          <p className="text-xs text-slate-400 mb-1">🔒 Privacy & Security:</p>
          <ul className="text-xs text-slate-500 space-y-1">
            <li>• Client phone numbers are masked for privacy</li>
            <li>• Files are stored in your Google Drive account only</li>
            <li>• Only you can access the backup files</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}