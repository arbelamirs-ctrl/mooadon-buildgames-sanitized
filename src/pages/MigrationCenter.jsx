import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useUserPermissions } from '@/components/auth/useUserPermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, CheckCircle, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

const TARGET_FIELDS = [
  { key: 'full_name', label: 'Full Name' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'address', label: 'Address' },
  { key: 'city', label: 'City' },
  { key: 'birthday', label: 'Birthday' }
];

export default function MigrationCenter() {
  const { primaryCompanyId } = useUserPermissions();
  const [csvText, setCsvText] = useState('');
  const [headers, setHeaders] = useState([]);
  const [preview, setPreview] = useState([]);
  const [jobId, setJobId] = useState(null);
  const [stats, setStats] = useState(null);
  const [step, setStep] = useState('upload'); // upload, map, validate, import
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [dedupKey, setDedupKey] = useState('phone');

  const [mapping, setMapping] = useState({
    fields: {},
    custom_fields: {}
  });

  const onFileUpload = async (file) => {
    if (!file) return;
    setLoading(true);
    try {
      const text = await file.text();
      setCsvText(text);

      const response = await base44.functions.invoke('importPreviewCSV', {
        company_id: primaryCompanyId,
        type: 'customers',
        file_name: file.name,
        csv_text: text
      });

      if (response.data?.import_job_id) {
        setJobId(response.data.import_job_id);
        setHeaders(response.data.headers || []);
        setPreview(response.data.preview || []);
        setStep('map');

        // Auto-suggest mapping
        const auto = {};
        (response.data.headers || []).forEach((h) => {
          const k = h.toLowerCase();
          if (k.includes('phone')) auto[h] = 'phone';
          else if (k.includes('name')) auto[h] = 'full_name';
          else if (k.includes('email')) auto[h] = 'email';
          else if (k.includes('address')) auto[h] = 'address';
          else if (k.includes('city')) auto[h] = 'city';
          else if (k.includes('birthday')) auto[h] = 'birthday';
        });
        setMapping((m) => ({ ...m, fields: auto }));
        toast.success('CSV preview loaded!');
      }
    } catch (error) {
      toast.error('Error loading CSV: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const setMap = (csvHeader, targetKey) => {
    setMapping((m) => ({
      ...m,
      fields: { ...m.fields, [csvHeader]: targetKey }
    }));
  };

  const validate = async () => {
    setLoading(true);
    try {
      const response = await base44.functions.invoke('importValidateCustomers', {
        import_job_id: jobId,
        company_id: primaryCompanyId,
        csv_text: csvText,
        mapping,
        dedup_key: dedupKey
      });

      setStats(response.data?.stats || {});
      setStep('validate');

      // Fetch errors
      const errorRecords = await base44.entities.ImportRowError.filter({
        import_job_id: jobId
      }, '-created_date', 100);
      setErrors(errorRecords || []);

      toast.success('Validation complete!');
    } catch (error) {
      toast.error('Validation failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const runImport = async () => {
    setLoading(true);
    try {
      const response = await base44.functions.invoke('importRunCustomers', {
        import_job_id: jobId,
        company_id: primaryCompanyId,
        csv_text: csvText,
        mapping,
        dedup_key: dedupKey
      });

      setStats(response.data?.stats || {});
      setStep('import');
      toast.success('Import completed!');
    } catch (error) {
      toast.error('Import failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetFlow = () => {
    setCsvText('');
    setHeaders([]);
    setPreview([]);
    setJobId(null);
    setStats(null);
    setStep('upload');
    setErrors([]);
    setMapping({ fields: {}, custom_fields: {} });
  };

  if (!primaryCompanyId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-slate-400">No company selected</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-2">
          <Upload className="w-6 h-6 text-teal-400" />
          Migration Center
        </h1>
        <p className="text-slate-400 mt-1">Import customers from CSV</p>
      </div>

      {/* Progress steps */}
      <div className="flex gap-4 items-center">
        {['upload', 'map', 'validate', 'import'].map((s, idx) => (
          <div key={s} className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                step === s
                  ? 'bg-teal-500 text-white'
                  : ['map', 'validate', 'import'].indexOf(s) <= ['upload', 'map', 'validate', 'import'].indexOf(step)
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-700 text-slate-400'
              }`}
            >
              {['upload', 'map', 'validate', 'import'].indexOf(s) < ['upload', 'map', 'validate', 'import'].indexOf(step) ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                idx + 1
              )}
            </div>
            <span className="text-sm text-slate-400 capitalize">{s}</span>
            {idx < 3 && <ArrowRight className="w-4 h-4 text-slate-600 mx-1" />}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <Card className="bg-[#1f2128] border-[#2d2d3a]">
          <CardHeader>
            <CardTitle className="text-white">1. Upload CSV File</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-[#2d2d3a] rounded-lg p-8 text-center">
              <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <p className="text-white font-semibold mb-2">Upload your CSV file</p>
              <p className="text-sm text-slate-400 mb-4">
                Format: phone, name, email, address, city, birthday
              </p>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => e.target.files?.[0] && onFileUpload(e.target.files[0])}
                disabled={loading}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload">
                <Button
                  as="span"
                  disabled={loading}
                  className="bg-teal-500 hover:bg-teal-600 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Choose File
                    </>
                  )}
                </Button>
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Map */}
      {step === 'map' && (
        <>
          <Card className="bg-[#1f2128] border-[#2d2d3a]">
            <CardHeader>
              <CardTitle className="text-white">2. Map Fields</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-sm text-slate-400">
                Select how each CSV column maps to customer fields
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {headers.map((h) => (
                  <div key={h} className="bg-[#17171f] rounded-lg p-4 border border-[#2d2d3a]">
                    <p className="text-sm text-slate-400 mb-2">CSV Column</p>
                    <p className="font-semibold text-white mb-3">{h}</p>
                    <Select value={mapping.fields[h] || ''} onValueChange={(v) => setMap(h, v)}>
                      <SelectTrigger className="bg-slate-900 border-[#2d2d3a]">
                        <SelectValue placeholder="(ignore)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={null}>(ignore)</SelectItem>
                        {TARGET_FIELDS.map((f) => (
                          <SelectItem key={f.key} value={f.key}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              {/* Dedup key */}
              <div className="bg-[#17171f] rounded-lg p-4 border border-[#2d2d3a]">
                <p className="text-sm text-slate-400 mb-2">Deduplication Key</p>
                <Select value={dedupKey} onValueChange={setDedupKey}>
                  <SelectTrigger className="bg-slate-900 border-[#2d2d3a]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phone">Phone (default)</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 mt-2">
                  Duplicates are updated instead of created
                </p>
              </div>

              {/* Preview */}
              <div>
                <p className="text-sm text-slate-400 mb-2">Preview (first 5 rows)</p>
                <div className="overflow-x-auto bg-[#17171f] rounded-lg border border-[#2d2d3a]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#2d2d3a]">
                        {headers.slice(0, 6).map((h) => (
                          <th
                            key={h}
                            className="text-left px-3 py-2 text-slate-400 text-xs font-medium"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.slice(0, 5).map((row, idx) => (
                        <tr key={idx} className="border-b border-[#2d2d3a]/50">
                          {headers.slice(0, 6).map((h) => (
                            <td key={h} className="px-3 py-2 text-white text-xs">
                              {row[h]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <Button
                  variant="outline"
                  onClick={resetFlow}
                  className="border-[#2d2d3a] text-white"
                >
                  Reset
                </Button>
                <Button
                  disabled={loading}
                  onClick={validate}
                  className="bg-teal-500 hover:bg-teal-600"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Validating...
                    </>
                  ) : (
                    'Validate & Preview'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Step 3: Validate */}
      {step === 'validate' && (
        <Card className="bg-[#1f2128] border-[#2d2d3a]">
          <CardHeader>
            <CardTitle className="text-white">3. Validation Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[#17171f] rounded-lg p-4 border border-[#2d2d3a]">
                  <p className="text-xs text-slate-400 mb-1">Total Rows</p>
                  <p className="text-2xl font-bold text-white">{stats.total}</p>
                </div>
                <div className="bg-[#17171f] rounded-lg p-4 border border-[#2d2d3a]">
                  <p className="text-xs text-slate-400 mb-1">Valid</p>
                  <p className="text-2xl font-bold text-emerald-400">{stats.valid}</p>
                </div>
                <div className="bg-[#17171f] rounded-lg p-4 border border-[#2d2d3a]">
                  <p className="text-xs text-slate-400 mb-1">To Create</p>
                  <p className="text-2xl font-bold text-blue-400">{stats.will_create}</p>
                </div>
                <div className="bg-[#17171f] rounded-lg p-4 border border-[#2d2d3a]">
                  <p className="text-xs text-slate-400 mb-1">To Update</p>
                  <p className="text-2xl font-bold text-amber-400">{stats.will_update}</p>
                </div>
              </div>
            )}

            {stats?.invalid > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <div className="flex gap-2 items-start">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-400">
                      {stats.invalid} rows with errors
                    </p>
                    <p className="text-sm text-red-300 mt-1">
                      Review errors below. Valid rows will still be imported.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {errors.length > 0 && (
              <div className="bg-[#17171f] rounded-lg border border-[#2d2d3a] p-4 max-h-64 overflow-y-auto">
                <p className="text-sm text-slate-400 mb-3 font-semibold">
                  Error Details (showing {Math.min(errors.length, 20)}):
                </p>
                <div className="space-y-2 text-sm">
                  {errors.slice(0, 20).map((e, idx) => (
                    <div
                      key={idx}
                      className="bg-[#2d2d3a]/50 p-2 rounded flex justify-between items-start"
                    >
                      <div className="flex-1">
                        <p className="text-slate-400">
                          Row {e.row_number}: <span className="text-red-400">{e.message}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-4">
              <Button
                variant="outline"
                onClick={() => setStep('map')}
                className="border-[#2d2d3a] text-white"
              >
                Back
              </Button>
              <Button
                disabled={loading || !stats?.valid || stats.valid === 0}
                onClick={runImport}
                className="bg-emerald-500 hover:bg-emerald-600"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  'Run Import'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Import complete */}
      {step === 'import' && stats && (
        <Card className="bg-[#1f2128] border-[#2d2d3a]">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              Import Complete!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[#17171f] rounded-lg p-4 border border-[#2d2d3a]">
                <p className="text-xs text-slate-400 mb-1">Created</p>
                <p className="text-2xl font-bold text-emerald-400">{stats.created || 0}</p>
              </div>
              <div className="bg-[#17171f] rounded-lg p-4 border border-[#2d2d3a]">
                <p className="text-xs text-slate-400 mb-1">Updated</p>
                <p className="text-2xl font-bold text-amber-400">{stats.updated || 0}</p>
              </div>
              <div className="bg-[#17171f] rounded-lg p-4 border border-[#2d2d3a]">
                <p className="text-xs text-slate-400 mb-1">Skipped</p>
                <p className="text-2xl font-bold text-slate-400">{stats.skipped || 0}</p>
              </div>
              <div className="bg-[#17171f] rounded-lg p-4 border border-[#2d2d3a]">
                <p className="text-xs text-slate-400 mb-1">Total</p>
                <p className="text-2xl font-bold text-white">{stats.total || 0}</p>
              </div>
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
              <p className="text-emerald-400">
                ✓ {(stats.created || 0) + (stats.updated || 0)} customers processed successfully!
              </p>
            </div>

            <Button onClick={resetFlow} className="w-full bg-teal-500 hover:bg-teal-600">
              Import Another File
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}