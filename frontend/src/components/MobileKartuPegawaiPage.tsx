import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ChevronLeft,
  Download,
  Loader2,
  User,
  MapPin,
  Briefcase,
  IdCard,
  RefreshCw,
} from 'lucide-react';
import QRCode from 'react-qr-code';
import { cn } from '../lib/utils';

const BASE_URL  = import.meta.env.VITE_API_MEANDPAY;
const DATA_URL  = import.meta.env.VITE_API_MEANDPAY_DATA;

interface CardData {
  id: string;
  name: string;
  username: string;
  no_pkwt?: string | null;
  foto_karyawan?: string | null;
  jabatan?: { nama_jabatan: string } | null;
  lokasi?: { nama_lokasi: string } | null;
  masa_berlaku?: string | null;
}

function getPhotoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http') || path.startsWith('blob:') || path.startsWith('data:')) return path;
  const base = (DATA_URL || BASE_URL.replace('/api', '')).replace(/\/$/, '');
  const clean = path.replace(/^\//, '');
  if (clean.startsWith('uploads/')) return `${base}/${clean}`;
  return `${base}/uploads/${clean}`;
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function MobileKartuPegawaiPage() {
  const [data, setData] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [imgError, setImgError] = useState(false);
  const [saving, setSaving] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const userId = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}').id; } catch { return null; }
  })();

  const cardUrl = `https://hris-thb.id/#/card/${userId}`;

  const fetchCard = async () => {
    if (!userId) { setError('Sesi tidak ditemukan. Silahkan login ulang.'); setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`${BASE_URL}/users/card/${userId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      } else {
        // fallback ke data di localStorage
        const local = JSON.parse(localStorage.getItem('user') || '{}');
        if (local.id) {
          setData({
            id: local.id,
            name: local.name ?? '-',
            username: local.username ?? '-',
            no_pkwt: local.no_pkwt ?? null,
            foto_karyawan: local.foto_karyawan ?? null,
            jabatan: local.jabatan ?? null,
            lokasi: local.lokasi ?? null,
            masa_berlaku: local.masa_berlaku ?? null,
          });
        } else {
          setError(json.message || 'Gagal memuat data kartu.');
        }
      }
    } catch {
      setError('Gagal menghubungi server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCard(); }, []);

  // ── Download PNG via html2canvas-style (manual canvas render) ──
  const handleDownload = async () => {
    if (!data) return;
    setSaving(true);
    try {
      // Gunakan html2canvas jika tersedia, fallback ke screenshot approach
      const html2canvas = (await import('html2canvas')).default;
      const card = cardRef.current;
      if (!card) return;

      const canvas = await html2canvas(card, {
        scale: 3,
        useCORS: true,
        backgroundColor: null,
        logging: false,
      });

      const link = document.createElement('a');
      link.download = `ID_Card_${data.username}_${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      // Fallback: buka halaman publik untuk print/screenshot
      window.open(cardUrl, '_blank');
    } finally {
      setSaving(false);
    }
  };

  const photoUrl = data ? getPhotoUrl(data.foto_karyawan) : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F0F0F0] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-[#103552] animate-spin" />
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Memuat kartu...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-[#F0F0F0] flex flex-col items-center justify-center gap-6 px-8">
        <IdCard className="w-16 h-16 text-slate-200" />
        <p className="text-sm font-black text-slate-500 text-center">{error}</p>
        <button onClick={fetchCard} className="flex items-center gap-2 px-6 py-3 bg-[#103552] text-white rounded-2xl font-black text-sm active:scale-95 transition-all">
          <RefreshCw className="w-4 h-4" /> Coba Lagi
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a2438] via-[#103552] to-[#185B5A] pb-28">

      {/* ─── HEADER ─── */}
      <div className="relative pt-14 pb-6 px-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-[#E09132]/10 rounded-full blur-2xl" />
        </div>
        <div className="relative z-10 flex items-center gap-4 mb-2">
          <button
            onClick={() => window.history.back()}
            className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 active:scale-90 transition-all"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <p className="text-white/60 text-[10px] font-black uppercase tracking-widest">Identitas Digital</p>
            <h1 className="text-white text-xl font-black tracking-tight">Kartu Pegawai</h1>
          </div>
        </div>
      </div>

      {/* ─── CARD ─── */}
      <div className="px-5">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          ref={cardRef}
          className="bg-white rounded-[2.5rem] overflow-hidden shadow-2xl shadow-black/30"
        >
          {/* Header strip */}
          <div className="relative bg-gradient-to-r from-[#103552] to-[#185B5A] pt-8 pb-16 px-7">
            <div className="absolute inset-0 opacity-10"
              style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #E09132 0%, transparent 50%)' }} />
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <p className="text-white/60 text-[9px] font-black uppercase tracking-[0.3em]">ID Card</p>
                <p className="text-white text-base font-black tracking-tight leading-tight mt-0.5">Kartu Identitas<br/>Pegawai</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center">
                <IdCard className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#E09132] via-[#E09132]/60 to-transparent" />
          </div>

          {/* Photo */}
          <div className="flex justify-center -mt-14 relative z-10">
            <div className="w-24 h-24 rounded-[1.25rem] border-4 border-white shadow-xl overflow-hidden bg-slate-100">
              {photoUrl && !imgError ? (
                <img
                  src={photoUrl}
                  alt={data?.name}
                  className="w-full h-full object-cover"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#96D1C6]/40 to-[#103552]/20 flex items-center justify-center">
                  <User className="w-10 h-10 text-[#103552]/40" />
                </div>
              )}
            </div>
          </div>

          {/* Name + jabatan */}
          <div className="px-7 pt-4 pb-5 text-center">
            <h2 className="text-lg font-black text-[#103552] tracking-tight leading-tight">{data?.name}</h2>
            {data?.jabatan?.nama_jabatan && (
              <p className="text-xs font-black text-[#E09132] mt-1 uppercase tracking-widest">{data.jabatan.nama_jabatan}</p>
            )}
          </div>

          {/* Detail rows */}
          <div className="mx-5 mb-5 bg-slate-50 rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
            {[
              { icon: IdCard,    label: 'NIP / Username', value: data?.no_pkwt || data?.username || '-' },
              { icon: Briefcase, label: 'Jabatan',         value: data?.jabatan?.nama_jabatan ?? '-' },
              { icon: MapPin,    label: 'Lokasi Kerja',    value: data?.lokasi?.nama_lokasi ?? '-' },
              { icon: IdCard,    label: 'Berlaku s/d',     value: fmtDate(data?.masa_berlaku) },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3 px-4 py-3">
                <div className="w-7 h-7 rounded-lg bg-[#96D1C6]/20 flex items-center justify-center shrink-0">
                  <Icon className="w-3.5 h-3.5 text-[#103552]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
                  <p className="text-xs font-black text-slate-700 truncate">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* QR Code */}
          <div className="mx-5 mb-6 flex flex-col items-center gap-3">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">Scan untuk verifikasi</p>
            <div className="p-3 bg-white rounded-2xl border-2 border-slate-100 shadow-sm">
              <QRCode value={cardUrl} size={96} bgColor="#ffffff" fgColor="#103552" level="M" />
            </div>
            <p className="text-[9px] font-bold text-slate-300 text-center break-all max-w-[200px]">{cardUrl}</p>
          </div>

          {/* Footer */}
          <div className="bg-gradient-to-r from-[#103552] to-[#185B5A] px-7 py-3 text-center">
            <p className="text-white/40 text-[9px] font-black uppercase tracking-widest">Kartu ini resmi dan terverifikasi digital</p>
          </div>
        </motion.div>
      </div>

      {/* ─── ACTIONS ─── */}
      <div className="px-5 mt-6 space-y-3">
        <button
          onClick={handleDownload}
          disabled={saving}
          className="w-full flex items-center justify-center gap-3 py-4 bg-[#E09132] hover:bg-[#C97E28] text-white rounded-[1.75rem] font-black text-sm shadow-xl shadow-[#E09132]/25 active:scale-95 transition-all disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
          {saving ? 'Menyimpan...' : 'Simpan sebagai Gambar'}
        </button>

        <p className="text-center text-[10px] font-bold text-white/30">
          ID: {data?.id} · {data?.username}
        </p>
      </div>
    </div>
  );
}
