import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Zap, BarChart3, Gift, Users, Sparkles } from 'lucide-react';

const features = [
  {
    icon: Zap,
    title: 'Instant Rewards',
    description: 'Customers earn tokens automatically with every purchase',
    page: 'POSTerminal'
  },
  {
    icon: BarChart3,
    title: 'Smart Analytics',
    description: 'Track customer behavior and optimize your program',
    page: 'BusinessCustomersDashboard'
  },
  {
    icon: Gift,
    title: 'Custom Rewards',
    description: 'Create coupons, discounts, and special offers',
    page: 'Coupons'
  },
  {
    icon: Users,
    title: 'Build Community',
    description: 'Turn one-time buyers into lifetime fans',
    page: 'Clients'
  },
];

export default function SuperAdminDashboard() {
  return (
    <div className="min-h-screen p-6">
      {/* Hero Section */}
      <div className="max-w-3xl mx-auto mb-10">
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="w-6 h-6 text-[#10b981]" />
          <span className="text-[#9ca3af] text-sm font-medium">Welcome to Mooadon</span>
        </div>
        <h1 className="text-4xl font-bold text-white mb-3">
          What You Can Do with Mooadon
        </h1>
        <p className="text-lg text-[#9ca3af]">
          Everything you need to build customer loyalty and boost revenue
        </p>
      </div>

      {/* Features Grid - 2x2 */}
      <div className="w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6 px-3 sm:px-0 sm:max-w-3xl sm:mx-auto">
          {features.map((feature, index) => (
            <Link key={index} to={createPageUrl(feature.page)} className="group">
              <div className="relative h-full bg-[#1f2128] border border-[#2d2d3a] rounded-2xl p-6 hover:border-[#10b981] transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-[#10b981]/20">
                <div className="w-14 h-14 rounded-xl bg-[#10b981]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-7 h-7 text-[#10b981]" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2 group-hover:text-[#10b981] transition-colors">
                  {feature.title}
                </h3>
                <p className="text-sm text-[#9ca3af] leading-relaxed">
                  {feature.description}
                </p>
                <div className="mt-4 flex items-center gap-2 text-[#10b981] opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-xs font-medium">Explore</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}