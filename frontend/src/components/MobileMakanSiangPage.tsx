import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  UtensilsCrossed,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  Loader2,
  ChevronLeft,
  Info,
  RefreshCw,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useToast } from './Toast';

const BASE_URL = import.meta.env.VITE_API_MEANDPAY;

interface MakanSiangRecord {
  id: string;
  user_id: string;
  tanggal: string;
  status: 'hadir' | 'tidak_hadir' | null;
  keterangan?: string;
  created_at?: string;
}

export function MobileMakanSiangPage() {
  const { addToast } = useToast();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [todayRecord, setTodayRecord] = useState<MakanSiangRecord | null>(null);
  const [history, setHistory] = useState<MakanSiangRecord[]>([]);
  const [keterangan, setKeterangan] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const todayStr = new Date().toLocaleDateString('en-CA');
  const todayDisplay = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setUserData(user);
    fetchData(user.id);
  }, []);

  const fetchData = async (userId: string) => {
    setLoading(true);
    try {
      // Fetch today's record
      const resToday = await fetch(
        `${BASE_URL}/makan-siang?user_id=${userId}&tanggal=${todayStr}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      const jsonToday = await resToday.json();
      if (jsonToday.success) {
        const data = Array.isArray(jsonToday.data) ? jsonToday.data[0] : jsonToday.data;
        setTodayRecord(data || null);
      }

      // Fetch history (last 10)
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 14);
      const startStr = startDate.toLocaleDateString('en-CA');
      const resHistory = await fetch(
        `${BASE_URL}/makan-siang?user_id=${userId}&start_date=${startStr}&end_date=${todayStr}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      const jsonHistory = await resHistory.json();
      if (jsonHistory.success) {
        const list = (Array.isArray(jsonHistory.data) ? jsonHistory.data : [])
          .sort((a: any, b: any) => (b.tanggal > a.tanggal ? 1 : -1))
          .slice(0, 10);
        setHistory(list);
      }
    } catch (_) {
      addToast({ type: 'error', title: 'Gagal', message: 'Tidak dapat memuat data makan siang.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (status: 'hadir' | 'tidak_hadir') => {
    if (!userData?.id) return;
    setSubmitting(true);
    try {
      const method = todayRecord?.id ? 'PUT' : 'POST';
      const url = todayRecord?.id
        ? `${BASE_URL}/makan-siang/${todayRecord.id}`
        : `${BASE_URL}/makan-siang`;

      const body: any = {
        user_id: userData.id,
        tanggal: todayStr,
        status,
        keterangan,
      };

      // Method spoofing pattern sama seperti absensi
      const formData = new FormData();
      Object.entries(body).forEach(([k, v]) => formData.append(k, String(v)));
      if (method === 'PUT') formData.append('_method', 'PUT');

      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: formData,
      });
      const json = await res.json();

      if (json.success) {
        addToast({
          type: 'success',
          title: 'Berhasil',
          message:
            status === 'hadir'
              ? 'Konfirmasi makan siang berhasil dicatat!'
              : 'Keterangan tidak hadir makan siang berhasil disimpan.',
        });
        setKeterangan('');
        fetchData(userData.id);
      } else {
        addToast({ type: 'error', title: 'Gagal', message: json.message || 'Terjadi kesalahan.' });
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message || 'Terjadi kesalahan sistem.' });
    } finally {
      setSubmitting(false);
    }
  };

  const statusLabel = (status: string | null | undefined) => {
    if (status === 'hadir') return { text: 'Hadir', color: 'text-emerald-600 bg-emerald-50' };
    if (status === 'tidak_hadir') return { text: 'Tidak Hadir', color: 'text-rose-600 bg-rose-50' };
    return { text: 'Belum', color: 'text-slate-400 bg-slate-100' };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F0F4FF] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Memuat data...</p>
        </div>
      </div>
    );
  }

  const todayStatus = statusLabel(todayRecord?.status);
  const isConfirmed = !!todayRecord?.status;

  return (
    <div className="min-h-screen bg-[#F0F4FF] pb-28">
      {/* ─── HEADER ─── */}
      <div className="relative bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-400 pt-14 pb-28 px-6 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-yellow-300/20 rounded-full blur-3xl" />

        <div className="relative z-10 flex items-center gap-4 mb-6">
          <button
            onClick={() => window.history.back()}
            className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 active:scale-90 transition-all"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <p className="text-white/60 text-[10px] font-black uppercase tracking-widest">Program MBG</p>
            <h1 className="text-white text-xl font-black tracking-tight">Makan Siang</h1>
          </div>
        </div>

        <div className="relative z-10 text-center">
          <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-[2rem] flex items-center justify-center mx-auto mb-4 border border-white/30 shadow-2xl">
            <UtensilsCrossed className="w-10 h-10 text-white" />
          </div>
          <p className="text-white/70 text-[11px] font-black uppercase tracking-widest">{todayDisplay}</p>
        </div>
      </div>

      {/* ─── STATUS CARD ─── */}
      <div className="px-5 -mt-16 relative z-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[2.5rem] shadow-2xl shadow-orange-500/10 p-6 border border-white"
        >
          <div className="flex items-center justify-between mb-5">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status Hari Ini</p>
            <button
              onClick={() => fetchData(userData?.id)}
              className="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-all active:scale-90"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-4 mb-6">
            <div
              className={cn(
                'w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner',
                isConfirmed
                  ? todayRecord?.status === 'hadir'
                    ? 'bg-emerald-50'
                    : 'bg-rose-50'
                  : 'bg-slate-100'
              )}
            >
              {isConfirmed ? (
                todayRecord?.status === 'hadir' ? (
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                ) : (
                  <XCircle className="w-8 h-8 text-rose-500" />
                )
              ) : (
                <Clock className="w-8 h-8 text-slate-400" />
              )}
            </div>
            <div>
              <p className="text-lg font-black text-slate-800 tracking-tight">
                {isConfirmed
                  ? todayRecord?.status === 'hadir'
                    ? 'Makan Siang Hadir'
                    : 'Tidak Hadir Makan Siang'
                  : 'Belum Konfirmasi'}
              </p>
              <span
                className={cn(
                  'text-[10px] font-black px-3 py-1 rounded-xl uppercase tracking-wide',
                  todayStatus.color
                )}
              >
                {todayStatus.text}
              </span>
            </div>
          </div>

          {!isConfirmed && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-2xl border border-amber-100">
                <Info className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-[11px] font-bold text-amber-700 leading-relaxed">
                  Silahkan konfirmasi kehadiran makan siang Anda hari ini.
                </p>
              </div>

              <textarea
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
                placeholder="Keterangan (opsional)..."
                rows={2}
                className="w-full text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 resize-none outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-300"
              />

              <div className="grid grid-cols-2 gap-3">
                <button
                  disabled={submitting}
                  onClick={() => handleSubmit('hadir')}
                  className="flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-[1.5rem] font-black text-sm shadow-lg shadow-emerald-500/25 active:scale-95 transition-all disabled:opacity-60"
                >
                  {submitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5" />
                  )}
                  Hadir
                </button>
                <button
                  disabled={submitting}
                  onClick={() => handleSubmit('tidak_hadir')}
                  className="flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-[1.5rem] font-black text-sm shadow-lg shadow-rose-500/25 active:scale-95 transition-all disabled:opacity-60"
                >
                  {submitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <XCircle className="w-5 h-5" />
                  )}
                  Tidak
                </button>
              </div>
            </div>
          )}

          {isConfirmed && (
            <button
              disabled={submitting}
              onClick={() => {
                setTodayRecord(null);
              }}
              className="w-full py-3 mt-2 bg-slate-100 text-slate-500 rounded-2xl text-sm font-bold hover:bg-slate-200 transition-all active:scale-95"
            >
              Ubah Konfirmasi
            </button>
          )}
        </motion.div>
      </div>

      {/* ─── HISTORY ─── */}
      <div className="px-5 mt-6">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between mb-4"
        >
          <h2 className="text-base font-black text-slate-800 tracking-tight">Riwayat 14 Hari</h2>
          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
            {showHistory ? 'Sembunyikan' : 'Tampilkan'}
          </span>
        </button>

        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden space-y-2"
            >
              {history.length === 0 ? (
                <div className="bg-white rounded-[1.5rem] p-8 text-center border border-slate-100 shadow-sm">
                  <UtensilsCrossed className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                  <p className="text-xs font-bold text-slate-400">Belum ada riwayat.</p>
                </div>
              ) : (
                history.map((rec, i) => {
                  const s = statusLabel(rec.status);
                  const dateDisplay = new Date(rec.tanggal).toLocaleDateString('id-ID', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  });
                  return (
                    <motion.div
                      key={rec.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="bg-white rounded-[1.5rem] px-5 py-4 flex items-center gap-4 shadow-sm border border-slate-100"
                    >
                      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', s.color)}>
                        {rec.status === 'hadir' ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : rec.status === 'tidak_hadir' ? (
                          <XCircle className="w-5 h-5" />
                        ) : (
                          <Clock className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-black text-slate-700">{dateDisplay}</p>
                        {rec.keterangan && (
                          <p className="text-[10px] font-bold text-slate-400 truncate mt-0.5">{rec.keterangan}</p>
                        )}
                      </div>
                      <span className={cn('text-[10px] font-black px-3 py-1 rounded-xl uppercase', s.color)}>
                        {s.text}
                      </span>
                    </motion.div>
                  );
                })
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
