import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ClipboardList,
  Download,
  Upload,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronLeft,
  FileText,
  AlertTriangle,
  Trash2,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useToast } from './Toast';

const BASE_URL = import.meta.env.VITE_API_MEANDPAY;

// ─── Types ────────────────────────────────────────────────────────────────────
interface JadwalRow {
  nama_karyawan: string;
  tanggal: string;      // YYYY-MM-DD
  shift_id: string;
  _error?: string;      // validasi lokal
}

// ─── CSV parser sederhana ─────────────────────────────────────────────────────
function parseCSV(text: string): JadwalRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  // Ambil header (baris pertama) untuk mapping kolom case-insensitive
  const rawHeaders = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));

  const nameIdx  = rawHeaders.findIndex((h) => h.includes('nama'));
  const tglIdx   = rawHeaders.findIndex((h) => h.includes('tanggal') || h.includes('date'));
  const shiftIdx = rawHeaders.findIndex((h) => h.includes('shift'));

  const rows: JadwalRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
    if (cols.every((c) => !c)) continue; // skip baris kosong

    const nama_karyawan = nameIdx  >= 0 ? cols[nameIdx]  ?? '' : '';
    const tanggal       = tglIdx   >= 0 ? cols[tglIdx]   ?? '' : '';
    const shift_id      = shiftIdx >= 0 ? cols[shiftIdx] ?? '' : '';

    // Validasi dasar
    let _error = '';
    if (!nama_karyawan) _error += 'Nama kosong. ';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) _error += 'Format tanggal harus YYYY-MM-DD. ';
    if (!shift_id)      _error += 'shift_id kosong. ';

    rows.push({ nama_karyawan, tanggal, shift_id, _error: _error.trim() });
  }

  return rows;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function MobileSupervisorJadwalPage() {
  const { addToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [rows, setRows]           = useState<JadwalRow[]>([]);
  const [fileName, setFileName]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);

  const errorCount  = rows.filter((r) => r._error).length;
  const validCount  = rows.filter((r) => !r._error).length;
  const hasRows     = rows.length > 0;

  // ── Download template ──────────────────────────────────────────────────────
  const handleDownloadTemplate = () => {
    const csv = 'nama_karyawan,tanggal,shift_id\nBudi Santoso,2026-01-01,1\nSiti Rahayu,2026-01-01,2';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'template_jadwal.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // ── Parse file CSV ─────────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setSubmitted(false);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length === 0) {
        addToast({ type: 'error', title: 'File Kosong', message: 'Tidak ada data ditemukan dalam file.' });
        return;
      }
      setRows(parsed);
    };
    reader.readAsText(file);
    // reset input agar bisa upload file yang sama lagi
    e.target.value = '';
  };

  // ── Hapus baris ───────────────────────────────────────────────────────────
  const handleRemoveRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (validCount === 0) {
      addToast({ type: 'error', title: 'Tidak Ada Data Valid', message: 'Perbaiki error sebelum submit.' });
      return;
    }

    setSubmitting(true);
    try {
      // Kirim hanya baris valid
      const payload = rows
        .filter((r) => !r._error)
        .map(({ nama_karyawan, tanggal, shift_id }) => ({ nama_karyawan, tanggal, shift_id }));

      const res = await fetch(`${BASE_URL}/supervisor/jadwal/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (json.success) {
        addToast({
          type: 'success',
          title: 'Jadwal Berhasil Dikirim',
          message: `${validCount} jadwal berhasil diimport.`,
        });
        setRows([]);
        setFileName('');
        setSubmitted(true);
      } else {
        addToast({ type: 'error', title: 'Gagal', message: json.message || 'Terjadi kesalahan.' });
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message || 'Terjadi kesalahan sistem.' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F0F0F0] pb-28">
      {/* ─── HEADER ─── */}
      <div className="relative bg-gradient-to-br from-[#185B5A] via-[#103552] to-[#0a2438] pt-14 pb-24 px-6 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-[#96D1C6]/20 rounded-full blur-3xl" />

        <div className="relative z-10 flex items-center gap-4 mb-6">
          <button
            onClick={() => window.history.back()}
            className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 active:scale-90 transition-all"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <p className="text-white/60 text-[10px] font-black uppercase tracking-widest">Supervisor</p>
            <h1 className="text-white text-xl font-black tracking-tight">Input Jadwal</h1>
          </div>
        </div>

        <div className="relative z-10 text-center">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-[1.5rem] flex items-center justify-center mx-auto border border-white/30 shadow-2xl">
            <ClipboardList className="w-8 h-8 text-white" />
          </div>
          <p className="text-white/50 text-[11px] font-bold mt-3 uppercase tracking-widest">Import jadwal via CSV</p>
        </div>
      </div>

      <div className="px-5 -mt-12 relative z-20 space-y-4">

        {/* ─── Download Template ─── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[2rem] shadow-xl shadow-[#103552]/10 p-6 border border-white"
        >
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Langkah 1 — Unduh Template</p>
          <p className="text-xs font-bold text-slate-500 mb-4 leading-relaxed">
            Unduh template CSV, isi sesuai format berikut, lalu upload kembali.
          </p>

          {/* Format info */}
          <div className="bg-slate-50 rounded-2xl p-4 mb-5 border border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Kolom yang Diperlukan</p>
            <div className="space-y-1.5">
              {[
                { col: 'nama_karyawan', desc: 'Nama lengkap karyawan' },
                { col: 'tanggal',       desc: 'Format YYYY-MM-DD' },
                { col: 'shift_id',      desc: 'ID shift dari sistem' },
              ].map(({ col, desc }) => (
                <div key={col} className="flex items-center gap-3">
                  <code className="text-[10px] font-black text-[#185B5A] bg-[#96D1C6]/20 px-2 py-0.5 rounded-lg">{col}</code>
                  <span className="text-[10px] font-bold text-slate-400">{desc}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleDownloadTemplate}
            className="w-full flex items-center justify-center gap-2 py-4 bg-[#103552] text-white rounded-2xl font-black text-sm shadow-lg shadow-[#103552]/20 active:scale-95 transition-all"
          >
            <Download className="w-4 h-4" />
            Unduh Template CSV
          </button>
        </motion.div>

        {/* ─── Upload CSV ─── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="bg-white rounded-[2rem] shadow-xl shadow-[#103552]/10 p-6 border border-white"
        >
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Langkah 2 — Upload File</p>

          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFileChange}
          />

          <button
            onClick={() => fileRef.current?.click()}
            className="w-full flex flex-col items-center justify-center gap-3 py-8 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 hover:bg-[#96D1C6]/10 hover:border-[#185B5A]/40 transition-all active:scale-95"
          >
            <div className="w-12 h-12 bg-[#96D1C6]/20 rounded-2xl flex items-center justify-center">
              <Upload className="w-6 h-6 text-[#185B5A]" />
            </div>
            {fileName ? (
              <div className="text-center">
                <p className="text-sm font-black text-[#103552]">{fileName}</p>
                <p className="text-[10px] font-bold text-slate-400 mt-1">Klik untuk ganti file</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-sm font-black text-slate-600">Pilih File CSV</p>
                <p className="text-[10px] font-bold text-slate-400 mt-1">Hanya .csv</p>
              </div>
            )}
          </button>

          {/* Stats setelah upload */}
          {hasRows && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                <div>
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Valid</p>
                  <p className="text-xl font-black text-emerald-700">{validCount}</p>
                </div>
              </div>
              <div className={cn('flex items-center gap-3 p-3 rounded-2xl border', errorCount > 0 ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100')}>
                <XCircle className={cn('w-5 h-5 shrink-0', errorCount > 0 ? 'text-rose-500' : 'text-slate-300')} />
                <div>
                  <p className={cn('text-[10px] font-black uppercase tracking-widest', errorCount > 0 ? 'text-rose-600' : 'text-slate-400')}>Error</p>
                  <p className={cn('text-xl font-black', errorCount > 0 ? 'text-rose-700' : 'text-slate-300')}>{errorCount}</p>
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {/* ─── Preview Tabel ─── */}
        <AnimatePresence>
          {hasRows && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="bg-white rounded-[2rem] shadow-xl shadow-[#103552]/10 border border-white overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Preview — {rows.length} Baris</p>
                <button
                  onClick={() => { setRows([]); setFileName(''); }}
                  className="text-[10px] font-black text-rose-500 uppercase tracking-widest"
                >
                  Hapus Semua
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50/60 border-b border-slate-100">
                      {['#', 'Nama Karyawan', 'Tanggal', 'Shift ID', 'Status', ''].map((h) => (
                        <th key={h} className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-left whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className={cn('border-b border-slate-50 last:border-0', row._error ? 'bg-rose-50/30' : '')}>
                        <td className="px-4 py-3 text-[10px] font-bold text-slate-400">{i + 1}</td>
                        <td className="px-4 py-3 text-xs font-bold text-slate-700 min-w-[120px]">{row.nama_karyawan || <span className="text-rose-400 italic">kosong</span>}</td>
                        <td className="px-4 py-3 text-xs font-bold text-slate-600 whitespace-nowrap">{row.tanggal || <span className="text-rose-400 italic">kosong</span>}</td>
                        <td className="px-4 py-3 text-xs font-bold text-slate-600">{row.shift_id || <span className="text-rose-400 italic">kosong</span>}</td>
                        <td className="px-4 py-3">
                          {row._error ? (
                            <div className="flex items-start gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                              <span className="text-[9px] font-bold text-rose-600 leading-relaxed">{row._error}</span>
                            </div>
                          ) : (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleRemoveRow(i)}
                            className="p-1 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Submit ─── */}
        {hasRows && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3 pb-4"
          >
            {errorCount > 0 && (
              <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs font-bold text-amber-700 leading-relaxed">
                  {errorCount} baris memiliki error dan akan diabaikan. Hanya {validCount} baris valid yang akan dikirim.
                </p>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting || validCount === 0}
              className="w-full flex items-center justify-center gap-3 py-5 bg-[#E09132] hover:bg-[#C97E28] text-white rounded-[1.75rem] font-black text-sm shadow-xl shadow-[#E09132]/25 active:scale-95 transition-all disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Mengirim...
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5" />
                  Kirim {validCount} Jadwal
                </>
              )}
            </button>
          </motion.div>
        )}

        {/* ─── Success state ─── */}
        <AnimatePresence>
          {submitted && !hasRows && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="bg-white rounded-[2rem] p-10 text-center shadow-xl shadow-[#103552]/10 border border-white"
            >
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
              <p className="text-base font-black text-slate-800 mb-1">Jadwal Berhasil Dikirim!</p>
              <p className="text-xs font-bold text-slate-400">Upload file baru untuk import jadwal lagi.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
