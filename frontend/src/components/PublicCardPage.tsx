import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { Loader2, MapPin, Briefcase, User, IdCard, QrCode as QrCodeIcon } from 'lucide-react';
import QRCode from 'react-qr-code';
import { cn } from '../lib/utils';

const BASE_URL = import.meta.env.VITE_API_MEANDPAY;
const DATA_URL = import.meta.env.VITE_API_MEANDPAY_DATA;

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

export function PublicCardPage() {
  const location = useLocation();

  // Ambil :id dari pathname: /#/card/:id
  const pathParts = location.pathname.split('/').filter(Boolean);
  const cardIdx = pathParts.indexOf('card');
  const id = cardIdx >= 0 ? pathParts[cardIdx + 1] : null;

  const [data, setData] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [imgError, setImgError] = useState(false);

  const cardUrl = `https://hris-thb.id/#/card/${id}`;

  useEffect(() => {
    if (!id) { setError('ID tidak ditemukan.'); setLoading(false); return; }
    const fetchCard = async () => {
      try {
        const res = await fetch(`${BASE_URL}/users/card/${id}`);
        const json = await res.json();
        if (json.success && json.data) {
          setData(json.data);
        } else {
          setError(json.message || 'Data pegawai tidak ditemukan.');
        }
      } catch {
        setError('Gagal menghubungi server. Coba lagi nanti.');
      } finally {
        setLoading(false);
      }
    };
    fetchCard();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F0F0F0] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-[#103552] animate-spin" />
          <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Memuat kartu...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#F0F0F0] flex items-center justify-center px-6">
        <div className="bg-white rounded-[2rem] p-10 text-center max-w-sm w-full shadow-xl">
          <IdCard className="w-14 h-14 text-slate-200 mx-auto mb-4" />
          <p className="text-base font-black text-slate-700 mb-2">Kartu Tidak Ditemukan</p>
          <p className="text-sm font-bold text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  const photoUrl = getPhotoUrl(data.foto_karyawan);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a2438] via-[#103552] to-[#185B5A] flex items-center justify-center p-6">
      {/* Decorative */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-[#E09132]/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-sm"
      >
        {/* Card */}
        <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-2xl shadow-black/30">

          {/* Header strip */}
          <div className="relative bg-gradient-to-r from-[#103552] to-[#185B5A] pt-10 pb-20 px-8">
            <div className="absolute inset-0 opacity-10"
              style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #E09132 0%, transparent 50%)' }} />
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <p className="text-white/60 text-[9px] font-black uppercase tracking-[0.3em]">ID Card</p>
                <p className="text-white text-lg font-black tracking-tight leading-tight mt-0.5">Kartu Identitas<br/>Pegawai</p>
              </div>
              {/* Logo placeholder */}
              <div className="w-12 h-12 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center">
                <IdCard className="w-6 h-6 text-white" />
              </div>
            </div>
            {/* Orange accent bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#E09132] via-[#E09132]/60 to-transparent" />
          </div>

          {/* Photo circle — overlaps header */}
          <div className="flex justify-center -mt-16 relative z-10">
            <div className="w-28 h-28 rounded-[1.5rem] border-4 border-white shadow-xl overflow-hidden bg-slate-100">
              {photoUrl && !imgError ? (
                <img
                  src={photoUrl}
                  alt={data.name}
                  className="w-full h-full object-cover"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#96D1C6]/40 to-[#103552]/20 flex items-center justify-center">
                  <User className="w-12 h-12 text-[#103552]/40" />
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="px-8 pt-5 pb-6 text-center">
            <h1 className="text-xl font-black text-[#103552] tracking-tight leading-tight">{data.name}</h1>
            {data.jabatan?.nama_jabatan && (
              <p className="text-sm font-bold text-[#E09132] mt-1 uppercase tracking-widest">{data.jabatan.nama_jabatan}</p>
            )}
          </div>

          {/* Detail rows */}
          <div className="mx-6 mb-6 bg-slate-50 rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
            {[
              { icon: IdCard,    label: 'NIP / Username', value: data.no_pkwt || data.username },
              { icon: Briefcase, label: 'Jabatan',        value: data.jabatan?.nama_jabatan ?? '-' },
              { icon: MapPin,    label: 'Lokasi Kerja',   value: data.lokasi?.nama_lokasi ?? '-' },
              { icon: QrCodeIcon,label: 'Berlaku s/d',    value: fmtDate(data.masa_berlaku) },
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
          <div className="mx-6 mb-8 flex flex-col items-center gap-3">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">Scan untuk verifikasi</p>
            <div className="p-3 bg-white rounded-2xl border-2 border-slate-100 shadow-sm">
              <QRCode value={cardUrl} size={100} bgColor="#ffffff" fgColor="#103552" level="M" />
            </div>
            <p className="text-[9px] font-bold text-slate-300 text-center break-all max-w-[200px]">{cardUrl}</p>
          </div>

          {/* Footer bar */}
          <div className="bg-gradient-to-r from-[#103552] to-[#185B5A] px-8 py-4 text-center">
            <p className="text-white/50 text-[9px] font-black uppercase tracking-widest">Kartu ini resmi dan terverifikasi digital</p>
          </div>
        </div>

        <p className="text-center text-white/30 text-[10px] font-bold mt-4">
          Powered by MeAndPay HRIS
        </p>
      </motion.div>
    </div>
  );
}
