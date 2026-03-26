import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Search, Store, Phone, Mail, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PublicStorefront() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  
  // Get company ID from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const companyId = urlParams.get('company_id');

  const { data: company } = useQuery({
    queryKey: ['company', companyId],
    queryFn: () => base44.entities.Company.get(companyId),
    enabled: !!companyId
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['public-products', companyId],
    queryFn: () => base44.entities.Product.filter({ 
      company_id: companyId,
      is_active: true
    }),
    enabled: !!companyId
  });

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!companyId) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <Card className="bg-[#1f2128] border-[#2d2d3a] p-6">
          <p className="text-white">Missing company ID</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-900 to-purple-900 py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center gap-6">
            {company?.logo_url && (
              <img 
                src={company.logo_url} 
                alt={company.name} 
                className="h-24 w-24 rounded-2xl border-4 border-white/20"
              />
            )}
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-white mb-2">{company?.name}</h1>
              <div className="flex gap-4 text-white/80 text-sm">
                {company?.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {company.phone}
                  </div>
                )}
                {company?.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {company.email}
                  </div>
                )}
                {company?.physical_address && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {company.physical_address}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Search */}
        <div className="mb-6 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 bg-[#1f2128] border-[#2d2d3a] text-white h-12"
          />
        </div>

        {/* Products Grid */}
        {isLoading ? (
          <div className="text-slate-400 text-center py-12">Loading products...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingBag className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">No products available</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <Card key={product.id} className="bg-[#1f2128] border-[#2d2d3a] overflow-hidden hover:border-teal-500/50 transition-all">
                {product.image_url && (
                  <img 
                    src={product.image_url} 
                    alt={product.name} 
                    className="w-full h-48 object-cover" 
                  />
                )}
                <CardContent className="p-4 space-y-3">
                  <div>
                    <h3 className="text-white font-semibold">{product.name}</h3>
                    <p className="text-slate-400 text-sm mt-1 line-clamp-2">{product.description}</p>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                    <div>
                      <div className="text-teal-400 font-bold text-lg">
                        {product.price_tokens} Tokens
                      </div>
                      {product.stock_quantity > 0 ? (
                        <div className="text-xs text-green-400">In Stock</div>
                      ) : (
                        <div className="text-xs text-red-400">Out of Stock</div>
                      )}
                    </div>
                    <Badge className="bg-purple-500/20 text-purple-400">
                      {product.category}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="mt-12 text-center">
          <Card className="bg-gradient-to-r from-indigo-900/50 to-purple-900/50 border-indigo-500/30 p-8">
            <h2 className="text-2xl font-bold text-white mb-4">
              Join our loyalty program!
            </h2>
            <p className="text-white/70 mb-6">
              Earn tokens with every purchase and redeem them for exclusive products
            </p>
            <Button 
              onClick={() => navigate('/')}
              className="bg-teal-500 hover:bg-teal-600 text-white px-8 py-6 text-lg"
            >
              <Store className="w-5 h-5 mr-2" />
              Get Started
            </Button>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-[#1a1a2e] border-t border-[#2d2d3a] py-6 mt-12">
        <div className="max-w-6xl mx-auto px-6 text-center text-slate-400 text-sm">
          <p>Powered by Mooadon • Built on Avalanche</p>
        </div>
      </div>
    </div>
  );
}