import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Settings,
  Palette,
  MessageSquare,
  Loader2,
  Save
} from 'lucide-react';
import { toast } from "sonner";

export default function SettingsTab({ companyId, company }) {
  const [formData, setFormData] = useState({
    name: '',
    logo_url: '',
    primary_color: '#4F46E5',
    sms_template: '',
    points_name: 'Points',
    points_to_currency_ratio: 100
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    if (company) {
      setFormData({
        name: company.name || '',
        logo_url: company.logo_url || '',
        primary_color: company.primary_color || '#4F46E5',
        sms_template: company.sms_template || 'Hey {client_name}!  You won -{points} Points on your transaction. Earn points and win prizes!',
        points_name: company.points_name || 'Points',
        points_to_currency_ratio: company.points_to_currency_ratio || 100
      });
    }
  }, [company]);

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Company.update(companyId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company', companyId] });
      toast.success('Settings saved successfully.');
    },
  });

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Settings</h2>
        <p className="text-slate-400 mt-1">Manage company settings</p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="bg-slate-900 border border-slate-800">
          <TabsTrigger value="general">
            <Settings className="w-4 h-4 ml-2" />
            general
          </TabsTrigger>
          <TabsTrigger value="branding">
            <Palette className="w-4 h-4 ml-2" />
            Branding
          </TabsTrigger>
          <TabsTrigger value="sms">
            <MessageSquare className="w-4 h-4 ml-2" />
            SMS
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card className="border-slate-800 bg-slate-900">
            <CardHeader>
              <CardTitle className="text-white">General settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Company name</Label>
                <Input 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="bg-slate-950 border-slate-800 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label>Name of the points</Label>
                <Input 
                  value={formData.points_name}
                  onChange={(e) => setFormData({...formData, points_name: e.target.value})}
                  placeholder="For example: stars, points, credit"
                  className="bg-slate-950 border-slate-800 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label>Conversion ratio (how many points = 1$)</Label>
                <Input 
                  type="number"
                  value={formData.points_to_currency_ratio}
                  onChange={(e) => setFormData({...formData, points_to_currency_ratio: Number(e.target.value)})}
                  className="bg-slate-950 border-slate-800 text-white"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branding">
          <Card className="border-slate-800 bg-slate-900">
            <CardHeader>
              <CardTitle className="text-white">Branding and colors</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>URL For the logo</Label>
                <Input 
                  value={formData.logo_url}
                  onChange={(e) => setFormData({...formData, logo_url: e.target.value})}
                  placeholder="https://example.com/logo.png"
                  className="bg-slate-950 border-slate-800 text-white"
                />
                {formData.logo_url && (
                  <img 
                    src={formData.logo_url} 
                    alt="Logo preview" 
                    className="w-32 h-32 object-contain rounded-xl border border-slate-700 mt-2"
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label>Main color</Label>
                <div className="flex gap-2">
                  <Input 
                    type="color"
                    value={formData.primary_color}
                    onChange={(e) => setFormData({...formData, primary_color: e.target.value})}
                    className="w-20 h-10 bg-slate-950 border-slate-800"
                  />
                  <Input 
                    value={formData.primary_color}
                    onChange={(e) => setFormData({...formData, primary_color: e.target.value})}
                    className="flex-1 bg-slate-950 border-slate-800 text-white"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sms">
          <Card className="border-slate-800 bg-slate-900">
            <CardHeader>
              <CardTitle className="text-white">pattern SMS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Message content</Label>
                <textarea 
                  value={formData.sms_template}
                  onChange={(e) => setFormData({...formData, sms_template: e.target.value})}
                  className="w-full min-h-[120px] p-3 rounded-lg bg-slate-950 border border-slate-800 text-white"
                  placeholder="הי {client_name}!  You won the-{points} points..."
                />
                <p className="text-sm text-slate-400">
                 Available variables: {'{client_name}'}, {'{points}'}, {'{balance}'}, {'{link}'}
                </p>
              </div>
              <div className="bg-slate-950 rounded-lg p-4 border border-slate-800">
                <p className="text-sm text-slate-400 mb-2">Preview:</p>
                <p className="text-white">
                  {formData.sms_template
                    .replace('{client_name}', 'Doe')
                    .replace('{points}', '150')
                    .replace('{balance}', '850')
                    .replace('{link}', 'https://...')}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button 
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
        >
          {updateMutation.isPending ? (
            <Loader2 className="w-4 h-4 ml-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 ml-2" />
          )}
         Saving changes
        </Button>
      </div>
    </div>
  );
}