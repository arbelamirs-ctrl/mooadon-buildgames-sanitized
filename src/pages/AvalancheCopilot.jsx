import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Sparkles, ExternalLink } from "lucide-react";
import { base44 } from '@/api/base44Client';

export default function AvalancheCopilot() {
  const [message, setMessage] = useState('');
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [usedMcp, setUsedMcp] = useState(false);

  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '', price_tokens: 0, is_active: true });
  const [saving, setSaving] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');

  useEffect(() => {
    if (view === 'walletStore' || view === 'productsAdmin') {
      loadProductsFunc();
    }
  }, [view]);

  const loadProductsFunc = async () => {
    setLoadingProducts(true);
    try {
      const filter = view === 'walletStore' ? { is_active: true } : {};
      const data = await base44.entities.Product.filter(filter);
      setProducts(data || []);
    } catch (e) {
      console.error('Error loading products:', e);
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleSaveProduct = async () => {
    setSaving(true);
    try {
      await base44.entities.Product.create(formData);
      setShowForm(false);
      setFormData({ name: '', description: '', price_tokens: 0, is_active: true });
      loadProductsFunc();
    } catch (e) {
      console.error('Error saving product:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!confirm('Delete this product?')) return;
    try {
      await base44.entities.Product.delete(id);
      loadProductsFunc();
    } catch (e) {
      console.error('Error deleting product:', e);
    }
  };

  if (view === 'walletStore') {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-semibold text-white">🛒 Wallet Store</h1>
        <p className="text-slate-400">Redeem your loyalty tokens for exclusive rewards</p>
        {loadingProducts ? (
          <div className="text-slate-500">Loading products...</div>
        ) : products.length === 0 ? (
          <div className="text-slate-500">No products available yet.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((product) => (
              <div key={product.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                {product.image_url && <img src={product.image_url} alt={product.name} className="w-full h-32 object-cover rounded-lg mb-3" />}
                <h2 className="text-lg text-white font-medium">{product.name}</h2>
                <p className="text-slate-400 text-sm mt-1">{product.description}</p>
                <p className="text-emerald-400 font-semibold mt-3">{product.price_tokens} Tokens</p>
                <button className="mt-3 w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg">Redeem</button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (view === 'productsAdmin') {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-white">📦 Products Admin</h1>
          <button onClick={() => setShowForm(!showForm)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg">
            {showForm ? 'Cancel' : '+ New Product'}
          </button>
        </div>
        {showForm && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <input placeholder="Product Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white" />
            <textarea placeholder="Description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white" />
            <input type="number" placeholder="Price (Tokens)" value={formData.price_tokens} onChange={(e) => setFormData({ ...formData, price_tokens: parseInt(e.target.value) || 0 })} className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white" />
            <label className="flex items-center gap-2 text-slate-300">
              <input type="checkbox" checked={formData.is_active} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} /> Active
            </label>
            <button onClick={handleSaveProduct} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Product'}
            </button>
          </div>
        )}
        {loadingProducts ? (
          <div className="text-slate-500">Loading...</div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-800 text-slate-300 text-sm">
                <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Price</th><th className="px-4 py-3">Active</th><th className="px-4 py-3">Actions</th></tr>
              </thead>
              <tbody className="text-slate-200">
                {products.map((p) => (
                  <tr key={p.id} className="border-t border-slate-800">
                    <td className="px-4 py-3">{p.name}</td>
                    <td className="px-4 py-3">{p.price_tokens} Tokens</td>
                    <td className="px-4 py-3">{p.is_active ? '✅' : '❌'}</td>
                    <td className="px-4 py-3"><button onClick={() => handleDeleteProduct(p.id)} className="text-red-400 hover:text-red-300">Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  const quickQuestions = [
    { label: "Explain Avalanche", question: "What is Avalanche?" },
    { label: "How Mooadon works", question: "How does Mooadon use Avalanche?" },
  ];

  const handleAsk = async (q) => {
    const query = q || message;
    if (!query.trim()) return;
    setLoading(true);
    setAnswer('');
    setSources([]);
    try {
      const result = await base44.functions.invoke('aiCopilotAsk', { message: query, locale: 'en' });
      setAnswer(result?.data?.answer || 'No answer.');
      setSources(result?.data?.sources || []);
      setUsedMcp(result?.data?.used_mcp || false);
    } catch (e) {
      setAnswer('Error: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="text-center">
        <img src="https://cryptologos.cc/logos/avalanche-avax-logo.png" alt="Avalanche" className="w-10 h-10 mx-auto" />
        <p className="text-slate-400 mt-2">Ask about Avalanche & Mooadon</p>
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        {quickQuestions.map((q, i) => (
          <Button key={i} variant="outline" size="sm" onClick={() => { setMessage(q.question); handleAsk(q.question); }} disabled={loading} className="bg-slate-800/50 border-slate-600 text-slate-200">{q.label}</Button>
        ))}
      </div>
      <Card className="bg-slate-900/80 border-slate-700">
        <CardContent className="p-4">
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ask me anything..." className="bg-slate-800 border-slate-600 text-slate-100 min-h-[100px]" onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAsk(); }}} />
          <div className="flex justify-end mt-3">
            <Button onClick={() => handleAsk()} disabled={loading || !message.trim()} className="bg-red-500 hover:bg-red-600">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />} Ask
            </Button>
          </div>
        </CardContent>
      </Card>
      {answer && (
        <Card className="bg-slate-900/80 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-red-400 text-lg flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> AI Answer
              {usedMcp && <span className="text-xs bg-red-900/50 text-red-300 px-2 py-0.5 rounded">MCP Enhanced</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-200 whitespace-pre-wrap">{answer}</p>
            </div>
            {sources.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-700">
                <p className="text-sm text-slate-400 mb-2">Sources:</p>
                <div className="flex flex-wrap gap-2">
                  {sources.map((source, i) => (
                    <a key={i} href={source.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" />
                      {source.title || source.url}
                    </a>
                  ))}
                </div>
              </div>
            )}
            {usedMcp && (
              <div className="mt-2 text-xs text-green-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Enhanced with Avalanche MCP
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}