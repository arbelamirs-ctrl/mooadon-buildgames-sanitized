import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';

export default function CompanyRegistration() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    companyName: '',
    contactPersonName: '',
    email: '',
    password: '',
    walletAddress: '',
    phoneNumber: '',
    physicalAddress: ''
  });
  const [errors, setErrors] = useState({});

  const registrationMutation = useMutation({
    mutationFn: async (data) => {
      const response = await base44.functions.invoke('registerCompany', data);
      return response.data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Registration successful! Please check your email to complete setup.');
        setTimeout(() => {
          window.location.href = createPageUrl('AgentDashboard');
        }, 2000);
      } else {
        toast.error(data.error || 'Registration failed');
        if (data.errors) {
          setErrors(data.errors);
        }
      }
    },
    onError: (error) => {
      toast.error('Registration failed: ' + error.message);
    }
  });

  const validateForm = () => {
    const newErrors = {};

    if (!formData.companyName.trim()) {
      newErrors.companyName = 'Company name is required';
    }

    if (!formData.contactPersonName.trim()) {
      newErrors.contactPersonName = 'Contact person name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (!formData.walletAddress.trim()) {
      newErrors.walletAddress = 'Wallet address is required';
    } else if (!/^0x[a-fA-F0-9]{40}$/.test(formData.walletAddress)) {
      newErrors.walletAddress = 'Invalid Avalanche address (must start with 0x and be 42 characters)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      registrationMutation.mutate(formData);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl bg-slate-900/80 backdrop-blur-xl border-slate-800 shadow-2xl">
        <CardHeader className="space-y-4 pb-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-yellow-400/20">
              <Building2 className="w-8 h-8 text-slate-900" />
            </div>
          </div>
          <div className="text-center">
            <CardTitle className="text-2xl font-bold text-white">Company Registration</CardTitle>
            <CardDescription className="text-slate-400 mt-2">
              Join LoyaltyWeb3 and start your loyalty program
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Company Name */}
            <div className="space-y-2">
              <Label htmlFor="companyName" className="text-slate-300">
                Company Name <span className="text-red-400">*</span>
              </Label>
              <Input
                id="companyName"
                placeholder="e.g. My Coffee Shop"
                value={formData.companyName}
                onChange={(e) => handleChange('companyName', e.target.value)}
                className={`bg-slate-800 border-slate-700 text-white ${errors.companyName ? 'border-red-500' : ''}`}
              />
              {errors.companyName && (
                <p className="text-sm text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.companyName}
                </p>
              )}
            </div>

            {/* Contact Person Name */}
            <div className="space-y-2">
              <Label htmlFor="contactPersonName" className="text-slate-300">
                Contact Person Name <span className="text-red-400">*</span>
              </Label>
              <Input
                id="contactPersonName"
                placeholder="John Doe"
                value={formData.contactPersonName}
                onChange={(e) => handleChange('contactPersonName', e.target.value)}
                className={`bg-slate-800 border-slate-700 text-white ${errors.contactPersonName ? 'border-red-500' : ''}`}
              />
              {errors.contactPersonName && (
                <p className="text-sm text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.contactPersonName}
                </p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300">
                Email <span className="text-red-400">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className={`bg-slate-800 border-slate-700 text-white ${errors.email ? 'border-red-500' : ''}`}
              />
              {errors.email && (
                <p className="text-sm text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.email}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">
                Password <span className="text-red-400">*</span>
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                className={`bg-slate-800 border-slate-700 text-white ${errors.password ? 'border-red-500' : ''}`}
              />
              {errors.password && (
                <p className="text-sm text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.password}
                </p>
              )}
              <p className="text-xs text-slate-500">Minimum 8 characters</p>
            </div>

            {/* Wallet Address */}
            <div className="space-y-2">
              <Label htmlFor="walletAddress" className="text-slate-300">
                Avalanche Wallet Address <span className="text-red-400">*</span>
              </Label>
              <Input
                id="walletAddress"
                placeholder="0x..."
                value={formData.walletAddress}
                onChange={(e) => handleChange('walletAddress', e.target.value)}
                className={`bg-slate-800 border-slate-700 text-white font-mono ${errors.walletAddress ? 'border-red-500' : ''}`}
              />
              {errors.walletAddress && (
                <p className="text-sm text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.walletAddress}
                </p>
              )}
              <p className="text-xs text-slate-500">Must start with 0x</p>
            </div>

            {/* Phone Number (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="phoneNumber" className="text-slate-300">
                Phone Number
              </Label>
              <Input
                id="phoneNumber"
                placeholder="+972-XX-XXX-XXXX"
                value={formData.phoneNumber}
                onChange={(e) => handleChange('phoneNumber', e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>

            {/* Physical Address (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="physicalAddress" className="text-slate-300">
                Physical Address
              </Label>
              <Textarea
                id="physicalAddress"
                placeholder="123 Main Street, City, Country"
                value={formData.physicalAddress}
                onChange={(e) => handleChange('physicalAddress', e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
                rows={3}
              />
            </div>

            <Button
              type="submit"
              disabled={registrationMutation.isPending}
              className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-slate-900 font-semibold py-6 text-base shadow-lg shadow-yellow-400/20"
            >
              {registrationMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Register Company
                </>
              )}
            </Button>

            <p className="text-center text-sm text-slate-400 pt-2">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => base44.auth.redirectToLogin()}
                className="text-yellow-400 hover:text-yellow-300 font-medium"
              >
                Sign In
              </button>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}