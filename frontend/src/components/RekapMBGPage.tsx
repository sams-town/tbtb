import React from 'react';
import { motion } from 'motion/react';
import {
  UtensilsCrossed,
  Search,
  Download,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle2,
  XCircle,
  Users,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useToast } from './Toast';
import * as XLSX from 'xlsx';

const BASE_URL = import.meta.env.VITE_API_MEANDPAY;

interface MBGRecord {
  id: string;
  user_id: string;
  tanggal: string;
  status: 'hadir' | 'tidak_hadir' | null;
  keterangan?: string;
  user?: {
    name: string;
    foto_karyawan?: string | null;
    jabatan?: { nama_jabatan: string } | null;
  };
}

interface SummaryItem {
  user_id: string;
  name: string;
  jabatan?: string;
  total_hadir: number;
  total_tidak_hadir: number;
  total_hari: number;
  persentase: number;
}

export function RekapMBGPage() {
  const { addToast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [records, setRecords] = React.useState<MBGRecord[]>([]);
  const [summary, setSummary] = React.useState<SummaryItem[]>([]);
  const [search, setSearch] = React.useState('');
  const [view, setView] = React.useState<'summary' | 'detail'>('summary');

  // Filter: bulan (1–12) dan tahun
  const now = new Date();
  const [bulan, setBulan] = React.useState<number>(now.getMonth() + 1);
  const [tahun, setTahun] = React.useState<number>(now.getFullYear());

  // Pagination
  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 20;

  // Label bulan–tahun untuk nama file export
  const bulanLabel = new Date(tahun, bulan - 1, 1).toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const url = new URL(`${BASE_URL}/mbg/rekap/bulanan`);
      url.searchParams.append('bulan', String(bulan));
      url.searchParams.append('tahun', String(tahun));

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const json = await res.json();

      if (json.success) {
        const data: MBGRecord[] = Array.isArray(json.data) ? json.data : [];
        setRecords(data);
        buildSummary(data);
        setCurrentPage(1);
      } else {
        addToast({ type: 'error', title: 'Error', message: json.message || 'Gagal memuat data.' });
      }
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Terjadi kesalahan sistem.' });
    } finally {
      setLoading(false);
    }
  };

  const buildSummary = (data: MBGRecord[]) => {
    const map: Record<string, SummaryItem> = {};
    data.forEach((rec) => {
      const uid = rec.user_id;
      if (!map[uid]) {
        map[uid] = {
          user_id: uid,
          name: rec.user?.name || uid,
          jabatan: rec.user?.jabatan?.nama_jabatan,
          total_hadir: 0,
          total_tidak_hadir: 0,
          total_hari: 0,
          persentase: 0,
        };
      }
      map[uid].total_hari += 1;
      if (rec.status === 'hadir') map[uid].total_hadir += 1;
      if (rec.status === 'tidak_hadir') map[uid].total_tidak_hadir += 1;
    });

    const result = Object.values(map).map((item) => ({
      ...item,
      persentase:
        item.total_hari > 0
          ? Math.round((item.total_hadir / item.total_hari) * 100)
          : 0,
    }));

    setSummary(result.sort((a, b) => b.total_hadir - a.total_hadir));
  };

  const filteredSummary = summary.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredRecords = records.filter((r) =>
    (r.user?.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const totalPages = Math.ceil(filteredRecords.length / pageSize);

  // Stats
  const totalHadir = records.filter((r) => r.status === 'hadir').length;
  const totalTidak = records.filter((r) => r.status === 'tidak_hadir').length;
  const pctHadir =
    records.length > 0 ? Math.round((totalHadir / records.length) * 100) : 0;

  const handleExportXLSX = () => {
    if (view === 'summary') {
      const header = ['Nama', 'Jabatan', 'Total Hadir', 'Total Tidak Hadir', 'Total Hari', 'Persentase Hadir'];
      const data = filteredSummary.map((s) => [
        s.name,
        s.jabatan || '-',
        s.total_hadir,
        s.total_tidak_hadir,
        s.total_hari,
        `${s.persentase}%`,
      ]);
      const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Rekap MBG');
      XLSX.writeFile(wb, `Rekap_MBG_${bulan}_${tahun}.xlsx`);
    } else {
      const header = ['Nama', 'Tanggal', 'Status', 'Keterangan'];
      const data = filteredRecords.map((r) => [
        r.user?.name || r.user_id,
        r.tanggal.split('T')[0],
        r.status === 'hadir' ? 'Hadir' : r.status === 'tidak_hadir' ? 'Tidak Hadir' : 'Belum',
        r.keterangan || '',
      ]);
      const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Detail MBG');
      XLSX.writeFile(wb, `Detail_MBG_${bulan}_${tahun}.xlsx`);
    }
    addToast({ type: 'success', title: 'Berhasil', message: 'File Excel berhasil diunduh.' });
  };

  // Opsi tahun: 3 tahun ke belakang s.d. tahun ini
  const tahunOptions = Array.from({ length: 4 }, (_, i) => now.getFullYear() - i);

  const bulanOptions = [
    { value: 1, label: 'Januari' },
    { value: 2, label: 'Februari' },
    { value: 3, label: 'Maret' },
    { value: 4, label: 'April' },
    { value: 5, label: 'Mei' },
    { value: 6, label: 'Juni' },
    { value: 7, label: 'Juli' },
    { value: 8, label: 'Agustus' },
    { value: 9, label: 'September' },
    { value: 10, label: 'Oktober' },
    { value: 11, label: 'November' },
    { value: 12, label: 'Desember' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto space-y-8 pb-20"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center">
            <UtensilsCrossed className="w-6 h-6 text-orange-500" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Rekap MBG</h1>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              Makan Bersama / Makan Siang
            </p>
          </div>
        </div>
        <button
          onClick={handleExportXLSX}
          disabled={records.length === 0}
          className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-40 shadow-sm"
        >
          <Download className="w-4 h-4" />
          Export Excel
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Bulan */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
              Bulan
            </label>
            <select
              value={bulan}
              onChange={(e) => setBulan(Number(e.target.value))}
              className="w-full text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 outline-none focus:border-[#103552]/40 focus:ring-2 focus:ring-[#96D1C6]/30 transition-all cursor-pointer"
            >
              {bulanOptions.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
          {/* Tahun */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
              Tahun
            </label>
            <select
              value={tahun}
              onChange={(e) => setTahun(Number(e.target.value))}
              className="w-full text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 outline-none focus:border-[#103552]/40 focus:ring-2 focus:ring-[#96D1C6]/30 transition-all cursor-pointer"
            >
              {tahunOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-8 py-3.5 bg-[#103552] text-white rounded-2xl font-black text-sm shadow-lg shadow-[#103552]/20 hover:bg-[#103552] transition-all active:scale-95 disabled:opacity-60 whitespace-nowrap"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Tampilkan
        </button>
      </div>

      {/* Summary Stats */}
      {records.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Entri" value={records.length} icon={Users} color="text-[#103552] bg-[#96D1C6]/20" />
          <StatCard label="Hadir" value={totalHadir} icon={CheckCircle2} color="text-emerald-600 bg-emerald-50" />
          <StatCard label="Tidak Hadir" value={totalTidak} icon={XCircle} color="text-rose-600 bg-rose-50" />
          <StatCard label="% Hadir" value={`${pctHadir}%`} icon={TrendingUp} color="text-amber-600 bg-amber-50" />
        </div>
      )}

      {/* View Toggle + Search */}
      {records.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 gap-1">
            <button
              onClick={() => setView('summary')}
              className={cn(
                'px-5 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all',
                view === 'summary' ? 'bg-white text-[#103552] shadow-sm' : 'text-slate-400 hover:text-slate-700'
              )}
            >
              Ringkasan
            </button>
            <button
              onClick={() => setView('detail')}
              className={cn(
                'px-5 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all',
                view === 'detail' ? 'bg-white text-[#103552] shadow-sm' : 'text-slate-400 hover:text-slate-700'
              )}
            >
              Detail
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama pegawai..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-2xl outline-none focus:border-[#103552]/40 focus:ring-2 focus:ring-[#96D1C6]/30 transition-all shadow-sm"
            />
          </div>
        </div>
      )}

      {/* Empty state */}
      {records.length === 0 && !loading && (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-16 text-center">
          <UtensilsCrossed className="w-16 h-16 text-slate-200 mx-auto mb-4" />
          <p className="text-sm font-black text-slate-400 uppercase tracking-widest">
            Pilih bulan &amp; tahun lalu klik Tampilkan
          </p>
        </div>
      )}

      {/* Summary Table */}
      {records.length > 0 && view === 'summary' && (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">{bulanLabel}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="text-left px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">#</th>
                  <th className="text-left px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nama Pegawai</th>
                  <th className="text-left px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Jabatan</th>
                  <th className="text-center px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Hadir</th>
                  <th className="text-center px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tdk Hadir</th>
                  <th className="text-center px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Hari</th>
                  <th className="text-center px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">% Hadir</th>
                </tr>
              </thead>
              <tbody>
                {filteredSummary.map((s, i) => (
                  <tr key={s.user_id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-xs font-bold text-slate-400">{i + 1}</td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-black text-slate-800">{s.name}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-bold text-slate-400">{s.jabatan || '-'}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-600 text-xs font-black rounded-xl">
                        {s.total_hadir}x
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-block px-3 py-1 bg-rose-50 text-rose-600 text-xs font-black rounded-xl">
                        {s.total_tidak_hadir}x
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-xs font-black text-slate-600">{s.total_hari}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="flex-1 max-w-[80px] h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-400 rounded-full transition-all"
                            style={{ width: `${s.persentase}%` }}
                          />
                        </div>
                        <span className="text-xs font-black text-slate-700 w-10 text-right">{s.persentase}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredSummary.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-sm font-bold text-slate-400">
                      Tidak ada data
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Table */}
      {records.length > 0 && view === 'detail' && (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">{bulanLabel}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="text-left px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">#</th>
                  <th className="text-left px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nama</th>
                  <th className="text-left px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tanggal</th>
                  <th className="text-center px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="text-left px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRecords.map((rec, i) => {
                  const badge = statusBadge(rec.status);
                  return (
                    <tr key={rec.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-xs font-bold text-slate-400">
                        {(currentPage - 1) * pageSize + i + 1}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-black text-slate-800">{rec.user?.name || rec.user_id}</p>
                        {rec.user?.jabatan?.nama_jabatan && (
                          <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                            {rec.user.jabatan.nama_jabatan}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                          <span className="text-xs font-bold text-slate-600">
                            {new Date(rec.tanggal).toLocaleDateString('id-ID', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={cn('text-[10px] font-black px-3 py-1 rounded-xl uppercase', badge.cls)}>
                          {badge.text}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400 max-w-[180px] truncate">
                        {rec.keterangan || '-'}
                      </td>
                    </tr>
                  );
                })}
                {paginatedRecords.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm font-bold text-slate-400">
                      Tidak ada data
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
              <p className="text-xs font-bold text-slate-400">
                {(currentPage - 1) * pageSize + 1}–
                {Math.min(currentPage * pageSize, filteredRecords.length)} dari {filteredRecords.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 text-slate-400 hover:bg-[#96D1C6]/20 hover:text-[#103552] disabled:opacity-30 transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-black text-slate-600 px-2">
                  {currentPage} / {totalPages}
                </span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 text-slate-400 hover:bg-[#96D1C6]/20 hover:text-[#103552] disabled:opacity-30 transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: any;
  color: string;
}) {
  return (
    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
      <div className={cn('w-10 h-10 rounded-2xl flex items-center justify-center mb-3', color)}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-2xl font-black text-slate-900 tracking-tight">{value}</p>
    </div>
  );
}

function statusBadge(status: string | null | undefined) {
  if (status === 'hadir') return { text: 'Hadir', cls: 'bg-emerald-50 text-emerald-600' };
  if (status === 'tidak_hadir') return { text: 'Tidak Hadir', cls: 'bg-rose-50 text-rose-600' };
  return { text: 'Belum', cls: 'bg-slate-100 text-slate-400' };
}
