import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Home, Search, ArrowLeft } from 'lucide-react';
import { createPageUrl } from '../utils';

export default function PageNotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="space-y-2">
          <h1 className="text-8xl font-bold text-slate-300">404</h1>
          <h2 className="text-2xl font-semibold text-white">Page Not Found</h2>
          <p className="text-slate-400">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={() => navigate(-1)}
            variant="outline"
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </Button>
          <Button
            onClick={() => window.location.href = createPageUrl('AgentDashboard')}
            className="gap-2 bg-teal-500 hover:bg-teal-600"
          >
            <Home className="w-4 h-4" />
            Home
          </Button>
        </div>

        <div className="pt-8 border-t border-slate-800">
          <div className="flex items-center justify-center gap-2 text-slate-500 text-sm">
            <Search className="w-4 h-4" />
            <span>Lost? Contact support for assistance</span>
          </div>
        </div>
      </div>
    </div>
  );
}