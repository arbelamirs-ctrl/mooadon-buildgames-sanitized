import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUserPermissions } from '@/components/auth/useUserPermissions';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Package, Plus, Edit, Trash2, Sparkles, Loader2, Upload, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import CampaignModal from '@/components/campaigns/CampaignModal';

export default function ProductsAdmin() {
  const { primaryCompanyId } = useUserPermissions();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [generatingFor, setGeneratingFor] = useState(null); // product id
  const [campaignModal, setCampaignModal] = useState(null); // campaign object

  const handleGenerateCampaign = async (product) => {
    setGeneratingFor(product.id);
    try {
      const res = await base44.functions.invoke('generateCampaignWithAI', {
        company_id: primaryCompanyId,
        product_id: product.id
      });
      if (!res.data?.success) throw new Error(res.data?.error || 'Generation failed');
      setCampaignModal(res.data.campaign);
      toast.success('Campaign generated!');
    } catch (e) {
      toast.error(e.message || 'Failed to generate campaign');
    } finally {
      setGeneratingFor(null);
    }
  };
  const [uploadingImage, setUploadingImage] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price_tokens: 0,
    image_url: '',
    product_image_url: '',
    is_active: true,
    stock_quantity: 0,
    category: 'physical',
    sku: ''
  });

  const handleImageUpload = async (file) => {
    setUploadingImage(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData(prev => ({ ...prev, product_image_url: file_url, image_url: file_url }));
      toast.success('Image uploaded!');
    } catch (e) {
      toast.error('Upload failed: ' + e.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', primaryCompanyId],
    queryFn: () => base44.entities.Product.filter({ company_id: primaryCompanyId }),
    enabled: !!primaryCompanyId
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Product.create({
      ...data,
      company_id: primaryCompanyId
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product created');
      resetForm();
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Product.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product updated');
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Product.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product deleted');
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price_tokens: 0,
      image_url: '',
      product_image_url: '',
      is_active: true,
      stock_quantity: 0,
      category: 'physical',
      sku: ''
    });
    setEditingProduct(null);
    setShowForm(false);
  };

  const handleEdit = (product) => {
    setFormData({
      name: product.name,
      description: product.description || '',
      price_tokens: product.price_tokens,
      image_url: product.image_url || '',
      product_image_url: product.product_image_url || product.image_url || '',
      is_active: product.is_active,
      stock_quantity: product.stock_quantity || 0,
      category: product.category || 'physical',
      sku: product.sku || ''
    });
    setEditingProduct(product);
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">📦 Products Admin</h1>
        <Button onClick={() => setShowForm(!showForm)} className="bg-teal-500 hover:bg-teal-600">
          <Plus className="w-4 h-4 mr-2" />
          {showForm ? 'Cancel' : 'New Product'}
        </Button>
      </div>

      {showForm && (
        <Card className="bg-[#1f2128] border-[#2d2d3a]">
          <CardContent className="p-6 space-y-4">
            <div>
              <Label className="text-white">Product Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-[#17171f] border-[#2d2d3a] text-white"
              />
            </div>
            <div>
              <Label className="text-white">Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="bg-[#17171f] border-[#2d2d3a] text-white"
              />
            </div>
            <div>
              <Label className="text-white">Price (Tokens)</Label>
              <Input
                type="number"
                value={formData.price_tokens}
                onChange={(e) => setFormData({ ...formData, price_tokens: parseInt(e.target.value) || 0 })}
                className="bg-[#17171f] border-[#2d2d3a] text-white"
              />
            </div>
            {/* Product Image Upload */}
            <div>
              <Label className="text-white mb-2 block">Product Image</Label>
              <div className="flex items-center gap-3">
                {formData.product_image_url ? (
                  <img src={formData.product_image_url} alt="preview" className="w-16 h-16 rounded-lg object-cover border border-[#2d2d3a]" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-[#17171f] border border-[#2d2d3a] flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-slate-600" />
                  </div>
                )}
                <div className="flex-1 space-y-1">
                  <input
                    type="file"
                    accept="image/*"
                    id="product-image-upload"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                  />
                  <label htmlFor="product-image-upload" className="cursor-pointer flex items-center justify-center gap-1.5 w-full px-3 py-1.5 rounded-md border border-[#2d2d3a] text-slate-300 text-sm hover:bg-[#2d2d3a] transition-colors">
                    {uploadingImage ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                    {uploadingImage ? 'Uploading...' : formData.product_image_url ? 'Replace Image' : 'Upload Image'}
                  </label>
                  <p className="text-[10px] text-slate-500">Used for AI ad creative generation. PNG/JPG recommended.</p>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-white">Stock Quantity</Label>
                <Input
                  type="number"
                  value={formData.stock_quantity}
                  onChange={(e) => setFormData({ ...formData, stock_quantity: parseInt(e.target.value) || 0 })}
                  className="bg-[#17171f] border-[#2d2d3a] text-white"
                />
              </div>
              <div>
                <Label className="text-white">Category</Label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-[#2d2d3a] bg-[#17171f] px-3 py-1 text-sm text-white"
                >
                  <option value="physical">Physical</option>
                  <option value="digital">Digital</option>
                  <option value="service">Service</option>
                  <option value="subscription">Subscription</option>
                </select>
              </div>
            </div>
            
            <div>
              <Label className="text-white">SKU (Optional)</Label>
              <Input
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                className="bg-[#17171f] border-[#2d2d3a] text-white"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label className="text-white">Active</Label>
            </div>
            <Button onClick={handleSubmit} className="bg-teal-500 hover:bg-teal-600">
              {editingProduct ? 'Update' : 'Create'} Product
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="bg-[#1f2128] border-[#2d2d3a]">
        <CardHeader>
          <CardTitle className="text-white">Products</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-slate-500">Loading...</div>
          ) : (
            <div className="space-y-2">
              {products.map((product) => (
                <div key={product.id} className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-4">
                  <div className="flex gap-4">
                    {product.image_url && (
                      <img src={product.image_url} alt={product.name} className="w-20 h-20 object-cover rounded-lg" />
                    )}
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-white font-semibold">{product.name}</h3>
                          <p className="text-slate-400 text-xs mb-1">{product.description}</p>
                          <div className="flex gap-3 text-xs">
                            <span className="text-teal-400 font-semibold">{product.price_tokens} Tokens</span>
                            <span className="text-slate-400">Stock: {product.stock_quantity || 0}</span>
                            <span className="text-slate-400">{product.category}</span>
                          </div>
                          <p className={`text-xs mt-1 ${product.is_active ? 'text-green-400' : 'text-red-400'}`}>
                            {product.is_active ? '● Active' : '● Inactive'}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 gap-1 text-xs"
                            onClick={() => handleGenerateCampaign(product)}
                            disabled={generatingFor === product.id}
                          >
                            {generatingFor === product.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                            Campaign
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleEdit(product)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate(product.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    {campaignModal && (
      <CampaignModal
        campaign={campaignModal}
        onClose={() => setCampaignModal(null)}
        onUpdate={() => setCampaignModal(null)}
      />
    )}
    </div>
  );
}