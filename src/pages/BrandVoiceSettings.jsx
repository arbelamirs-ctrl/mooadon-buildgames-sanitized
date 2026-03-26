import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUserPermissions } from '@/components/auth/useUserPermissions';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Save, Languages, AlertCircle, CheckCircle, FlaskConical, ChevronDown, ChevronUp, Plus, Trash2, Star, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';

const TONES = ['warm', 'bold', 'elegant', 'playful', 'professional', 'urgent'];
const KEYWORD_SUGGESTIONS = ['freshness', 'artisan', 'crafted with love', 'premium', 'local', 'seasonal', 'handmade', 'authentic', 'exclusive', 'quality'];
const FORBIDDEN_SUGGESTIONS = ['cheap', 'discount', 'sale', 'free', 'guarantee', 'best price', 'cheapest', 'competitor'];
const CURRENCIES = [
  { code: 'ILS', label: '₪ Shekel' },
  { code: 'USD', label: '$ Dollar' },
  { code: 'EUR', label: '€ Euro' },
  { code: 'GBP', label: '£ Pound' },
];
const LANGUAGES = [
  { code: 'he', label: 'עברית' },
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
  { code: 'ru', label: 'Русский' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' }
];
const LENGTHS = ['short', 'medium', 'long'];

const EMPTY_VOICE = (companyId) => ({
  company_id: companyId,
  profile_name: '',
  is_default: false,
  tone: 'warm',
  language: 'en',
  currency: 'USD',
  use_emojis: true,
  copy_length: 'medium',
  forbidden_words: '',
  brand_keywords: '',
  compliance_rules: '',
  sample_approved_copy: ''
});

function TagInput({ value, onChange, suggestions, placeholder }) {
  const tags = value ? value.split(',').map(t => t.trim()).filter(Boolean) : [];
  const addTag = (tag) => { if (!tags.includes(tag)) onChange([...tags, tag].join(', ')); };
  const removeTag = (tag) => onChange(tags.filter(t => t !== tag).join(', '));
  const unusedSuggestions = suggestions.filter(s => !tags.includes(s));
  return (
    <div className="space-y-2">
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map(tag => (
            <span key={tag} className="flex items-center gap-1 bg-purple-500/20 text-purple-300 text-xs px-2 py-1 rounded-full">
              {tag}
              <button onClick={() => removeTag(tag)} className="text-purple-400 hover:text-white leading-none">×</button>
            </span>
          ))}
        </div>
      )}
      <input value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-[#17171f] border border-[#2d2d3a] rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600" />
      {unusedSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {unusedSuggestions.map(s => (
            <button key={s} onClick={() => addTag(s)}
              className="text-xs px-2 py-1 rounded-full bg-[#17171f] border border-[#2d2d3a] text-slate-400 hover:text-white hover:border-purple-500/50 transition-colors">
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function VoiceEditor({ form, setForm, onSave, onCancel, isSaving }) {
  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
  return (
    <div className="space-y-4">
      {/* Profile name */}
      <div>
        <label className="text-slate-400 text-xs mb-1 block">Profile name</label>
        <input value={form.profile_name || ''} onChange={e => set('profile_name', e.target.value)}
          placeholder="e.g. Summer Campaign, Formal Tone"
          className="w-full bg-[#17171f] border border-[#2d2d3a] rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600" />
      </div>

      {/* Language */}
      <Card className="bg-[#17171f] border-[#2d2d3a]">
        <CardHeader className="pb-2 pt-3 px-3"><CardTitle className="text-white text-xs flex items-center gap-2"><Languages className="w-3.5 h-3.5 text-blue-400" />Language & Output</CardTitle></CardHeader>
        <CardContent className="px-3 pb-3 space-y-3">
          <div>
            <label className="text-slate-400 text-xs mb-1 block">Language</label>
            <div className="flex flex-wrap gap-1.5">
              {LANGUAGES.map(l => (
                <button key={l.code} onClick={() => set('language', l.code)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${form.language === l.code ? 'bg-blue-500 text-white' : 'bg-[#1f2128] text-slate-300 hover:bg-[#2d2d3a]'}`}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-slate-400 text-xs mb-1 block">Copy length</label>
            <div className="flex gap-2">
              {LENGTHS.map(l => (
                <button key={l} onClick={() => set('copy_length', l)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${form.copy_length === l ? 'bg-teal-500 text-white' : 'bg-[#1f2128] text-slate-300 hover:bg-[#2d2d3a]'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-slate-400 text-xs mb-1 block">Currency</label>
            <div className="flex flex-wrap gap-1.5">
              {CURRENCIES.map(c => (
                <button key={c.code} onClick={() => set('currency', c.code)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${form.currency === c.code ? 'bg-green-500 text-white' : 'bg-[#1f2128] text-slate-300 hover:bg-[#2d2d3a]'}`}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => set('use_emojis', !form.use_emojis)}
              className={`w-9 h-5 rounded-full transition-colors relative ${form.use_emojis ? 'bg-teal-500' : 'bg-[#2d2d3a]'}`}>
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form.use_emojis ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-slate-300 text-xs">Use emojis in copy</span>
          </div>
        </CardContent>
      </Card>

      {/* Tone */}
      <Card className="bg-[#17171f] border-[#2d2d3a]">
        <CardHeader className="pb-2 pt-3 px-3"><CardTitle className="text-white text-xs">Brand Tone</CardTitle></CardHeader>
        <CardContent className="px-3 pb-3">
          <div className="grid grid-cols-3 gap-1.5">
            {TONES.map(t => (
              <button key={t} onClick={() => set('tone', t)}
                className={`py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${form.tone === t ? 'bg-purple-500 text-white' : 'bg-[#1f2128] text-slate-300 hover:bg-[#2d2d3a]'}`}>
                {t}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Keywords & Compliance */}
      <Card className="bg-[#17171f] border-[#2d2d3a]">
        <CardHeader className="pb-2 pt-3 px-3"><CardTitle className="text-white text-xs flex items-center gap-2"><AlertCircle className="w-3.5 h-3.5 text-amber-400" />Keywords & Compliance</CardTitle></CardHeader>
        <CardContent className="px-3 pb-3 space-y-3">
          <div>
            <label className="text-slate-400 text-xs mb-1 block">Brand keywords</label>
            <TagInput value={form.brand_keywords || ''} onChange={val => set('brand_keywords', val)} suggestions={KEYWORD_SUGGESTIONS} placeholder="e.g., freshness, artisan, crafted with love" />
          </div>
          <div>
            <label className="text-slate-400 text-xs mb-1 block">Forbidden words/phrases</label>
            <TagInput value={form.forbidden_words || ''} onChange={val => set('forbidden_words', val)} suggestions={FORBIDDEN_SUGGESTIONS} placeholder="e.g., cheap, discount, sale" />
          </div>
          <div>
            <label className="text-slate-400 text-xs mb-1 block">Custom compliance rules</label>
            <textarea value={form.compliance_rules || ''} onChange={e => set('compliance_rules', e.target.value)}
              placeholder="e.g., No health claims. Always include 'T&C apply'." rows={2}
              className="w-full bg-[#1f2128] border border-[#2d2d3a] rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 resize-none" />
          </div>
          <div>
            <label className="text-slate-400 text-xs mb-1 block">Sample approved copy (style reference)</label>
            <textarea value={form.sample_approved_copy || ''} onChange={e => set('sample_approved_copy', e.target.value)}
              placeholder="Paste an example of copy you love — AI will match this style." rows={3}
              className="w-full bg-[#1f2128] border border-[#2d2d3a] rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 resize-none" />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button className="flex-1 bg-purple-500 hover:bg-purple-600 gap-2 text-sm" onClick={onSave} disabled={isSaving}>
          <Save className="w-4 h-4" />
          {isSaving ? 'Saving...' : 'Save Voice'}
        </Button>
        <Button variant="outline" className="border-[#2d2d3a] text-slate-300 hover:bg-[#2d2d3a] text-sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export default function BrandVoiceSettings() {
  const { primaryCompanyId } = useUserPermissions();
  const queryClient = useQueryClient();

  const { data: voices = [], isLoading } = useQuery({
    queryKey: ['brand-voice', primaryCompanyId],
    queryFn: () => base44.entities.BrandVoice.filter({ company_id: primaryCompanyId }),
    enabled: !!primaryCompanyId
  });

  const [editingId, setEditingId] = useState(null); // null=none, 'new'=creating, id=editing
  const [form, setForm] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testExpandedVoiceId, setTestExpandedVoiceId] = useState(null);
  const [testVoiceId, setTestVoiceId] = useState(null);

  const defaultVoice = voices.find(v => v.is_default) || voices[0];

  const startNew = () => {
    setForm(EMPTY_VOICE(primaryCompanyId));
    setEditingId('new');
  };

  const startEdit = (voice) => {
    setForm({ ...voice });
    setEditingId(voice.id);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(null);
  };

  const handleSave = async () => {
    if (!form.profile_name?.trim()) { toast.error('Please enter a profile name.'); return; }
    try {
      if (editingId === 'new') {
        // If first voice, make it default
        const shouldBeDefault = voices.length === 0;
        await base44.entities.BrandVoice.create({ ...form, is_default: shouldBeDefault });
      } else {
        await base44.entities.BrandVoice.update(editingId, form);
      }
      queryClient.invalidateQueries({ queryKey: ['brand-voice'] });
      toast.success('Brand voice saved!');
      cancelEdit();
    } catch (e) {
      toast.error('Save failed: ' + e.message);
    }
  };

  const handleSetDefault = async (voice) => {
    try {
      // Unset all defaults first
      await Promise.all(voices.filter(v => v.is_default).map(v => base44.entities.BrandVoice.update(v.id, { is_default: false })));
      await base44.entities.BrandVoice.update(voice.id, { is_default: true });
      queryClient.invalidateQueries({ queryKey: ['brand-voice'] });
      toast.success(`"${voice.profile_name}" set as default.`);
    } catch (e) {
      toast.error('Failed to set default.');
    }
  };

  const handleDelete = async (voice) => {
    if (!confirm(`Delete "${voice.profile_name}"?`)) return;
    try {
      await base44.entities.BrandVoice.delete(voice.id);
      queryClient.invalidateQueries({ queryKey: ['brand-voice'] });
      toast.success('Deleted.');
    } catch (e) {
      toast.error('Delete failed.');
    }
  };

  const handleTestBrandVoice = async (voice) => {
    if (!primaryCompanyId) return;
    setTestVoiceId(voice.id);
    setTestLoading(true);
    setTestResult(null);
    setTestExpanded(true);
    try {
      const products = await base44.entities.Product.filter({ company_id: primaryCompanyId });
      if (!products.length) { toast.error('No products found — add a product first.'); return; }
      const res = await base44.functions.invoke('generateCampaignWithAI', {
        company_id: primaryCompanyId,
        product_id: products[0].id,
        brand_voice_id: voice.id
      });
      if (res.data?.campaign) {
        setTestResult({ campaign: res.data.campaign, meta: res.data.meta });
        toast.success('Test generation complete!');
      } else {
        toast.error('No result returned from AI generation.');
      }
    } catch (e) {
      toast.error('Test failed: ' + e.message);
    } finally {
      setTestLoading(false);
      setTestVoiceId(null);
    }
  };

  if (isLoading) return <div className="text-slate-500 text-center py-12">Loading...</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            Brand Voice Profiles
          </h1>
          <p className="text-sm text-slate-400 mt-1">Create multiple brand voices. Set one as Default — campaigns will use it unless you override.</p>
        </div>
        {editingId === null && (
          <Button className="bg-purple-500 hover:bg-purple-600 gap-2 text-sm" onClick={startNew}>
            <Plus className="w-4 h-4" /> New Voice
          </Button>
        )}
      </div>

      {/* Editor panel */}
      {editingId !== null && form && (
        <Card className="bg-[#1f2128] border-purple-500/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-sm">{editingId === 'new' ? 'New Brand Voice' : `Edit: ${form.profile_name}`}</CardTitle>
          </CardHeader>
          <CardContent>
            <VoiceEditor form={form} setForm={setForm} onSave={handleSave} onCancel={cancelEdit} isSaving={false} />
          </CardContent>
        </Card>
      )}

      {/* Voice list */}
      {voices.length === 0 && editingId === null && (
        <div className="text-center py-12 text-slate-500">
          <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p>No brand voices yet. Create one to get started.</p>
        </div>
      )}

      {voices.map(voice => (
        <Card key={voice.id} className={`bg-[#1f2128] border-[#2d2d3a] ${voice.is_default ? 'border-l-4 border-l-amber-500' : ''}`}>
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {voice.is_default && <Star className="w-4 h-4 text-amber-400 flex-shrink-0" fill="currentColor" />}
                <div>
                  <p className="text-white text-sm font-medium">{voice.profile_name}</p>
                  <p className="text-slate-500 text-xs capitalize">
                    {voice.tone} · {voice.language?.toUpperCase()} · {voice.copy_length} · {voice.currency}
                    {voice.is_default && <span className="ml-2 text-amber-400 font-medium">Default</span>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {!voice.is_default && (
                  <Button size="sm" variant="ghost" className="text-amber-400 hover:bg-amber-500/10 text-xs h-7 px-2"
                    onClick={() => handleSetDefault(voice)} title="Set as default">
                    <Star className="w-3.5 h-3.5" />
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white h-7 px-2"
                  onClick={() => startEdit(voice)} title="Edit">
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="text-red-400 hover:bg-red-500/10 h-7 px-2"
                  onClick={() => handleDelete(voice)} title="Delete">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Test section per voice */}
            <div className="mt-3 pt-3 border-t border-[#2d2d3a]">
              <button className="flex items-center gap-2 text-xs text-amber-400 hover:text-amber-300"
                onClick={() => setTestExpandedVoiceId(id => id === voice.id ? null : voice.id)}>
                <FlaskConical className="w-3.5 h-3.5" />
                Test this voice
                {testExpandedVoiceId === voice.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {testExpandedVoiceId === voice.id && (
                <div className="mt-2 space-y-2">
                  <Button variant="outline" size="sm"
                    className="gap-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-xs"
                    onClick={() => handleTestBrandVoice(voice)}
                    disabled={testLoading && testVoiceId === voice.id}>
                    <FlaskConical className="w-3.5 h-3.5" />
                    {testLoading && testVoiceId === voice.id ? 'Generating (~30s)…' : 'Run Test'}
                  </Button>
                  {testLoading && testVoiceId === voice.id && (
                    <p className="text-xs text-slate-400 animate-pulse">Generating test copy (~30s)…</p>
                  )}
                  {testResult && testVoiceId === null && testExpandedVoiceId === voice.id && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {['a', 'b'].map(v => {
                          const score = v === 'a' ? testResult.meta?.quality_score_a : testResult.meta?.quality_score_b;
                          const color = score >= 85 ? 'text-green-400' : score >= 70 ? 'text-yellow-400' : 'text-red-400';
                          return <span key={v} className={`text-xs ${color}`}>Variant {v.toUpperCase()}: {score}/100</span>;
                        })}
                      </div>
                      <div className="bg-[#17171f] rounded-lg p-3">
                        <p className="text-teal-400 text-xs font-medium mb-1">Sample IG copy (A):</p>
                        <p className="text-white text-xs leading-relaxed">{testResult.campaign.ig_copy_a}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}