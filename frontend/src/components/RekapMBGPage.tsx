import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  CalendarDays,
  CalendarRange,
  LayoutGrid,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useToast } from './Toast';
import * as XLSX from 'xlsx';

const BASE_URL = import.meta.env.VITE_API_MEANDPAY;

// ─── Types ─────────────────────────────────────────────────────────────────
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

type FilterMode = 'harian' | 'mingguan' | 'bulanan' | 'custom';

// ─── Helper ─────────────────────────────────────────────────────────────────
function toDateStr(d: Date) {
  return d.toLocaleDateString('en-CA'); // YYYY-MM-DD
}

function addDays(base: string, n: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

function diffDays(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

function formatPeriodeLabel(mode: FilterMode, params: FilterParams) {
  if (mode === 'harian') {
    return new Date(params.tanggal!).toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  }
  if (mode === 'bulanan') {
    return new Date(params.tahun!, params.bulan! - 1, 1).toLocaleDateString('id-ID', {
      month: 'long', year: 'numeric',
    });
  }
  const from = new Date(params.startDate!).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  const to   = new Date(params.endDate!).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${from} – ${to}`;
}

function filenameSuffix(mode: FilterMode, params: FilterParams) {
  if (mode === 'harian')  return params.tanggal!;
  if (mode === 'bulanan') return `${params.bulan}_${params.tahun}`;
  return `${params.startDate}_${params.endDate}`;
}

interface FilterParams {
  tanggal?: string;      // harian
  bulan?: number;        // bulanan
  tahun?: number;        // bulanan
  startDate?: string;    // mingguan / custom
  endDate?: string;      // mingguan / custom
}

// ─── Main component ─────────────────────────────────────────────────────────
export function RekapMBGPage() {
  const { addToast } = useToast();
  const now = new Date();
  const todayStr = toDateStr(now);

  // ── Filter state ──
  const [mode, setMode] = React.useState<FilterMode>('bulanan');

  // harian
  const [tanggal, setTanggal] = React.useState(todayStr);

  // mingguan
  const [weekStart, setWeekStart] = React.useState(() => {
    const d = new Date(now);
    d.setDate(d.getDate() - d.getDay() + 1); // Senin minggu ini
    return toDateStr(d);
  });
  const weekEnd = addDays(weekStart, 6);

  // bulanan
  const [bulan, setBulan] = React.useState(now.getMonth() + 1);
  const [tahun, setTahun] = React.useState(now.getFullYear());

  // custom
  const [customStart, setCustomStart] = React.useState(() => {
    const d = new Date(now);
    d.setDate(1);
    return toDateStr(d);
  });
  const [customEnd, setCustomEnd] = React.useState(todayStr);

  // ── Data state ──
  const [loading, setLoading] = React.useState(false);
  const [records, setRecords] = React.useState<MBGRecord[]>([]);
  const [summary, setSummary] = React.useState<SummaryItem[]>([]);
  const [search, setSearch] = React.useState('');
  const [view, setView]     = React.useState<'summary' | 'detail'>('summary');
  const [periodeLabel, setPeriodeLabel] = React.useState('');
  const [activeSuffix, setActiveSuffix] = React.useState('');

  // pagination
  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 20;

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = async () => {
    setLoading(true);
    setRecords([]);
    setSummary([]);
    setCurrentPage(1);

    try {
      let data: MBGRecord[] = [];

      if (mode === 'harian') {
        // GET /mbg/rekap/harian?tanggal=YYYY-MM-DD
        const url = new URL(`${BASE_URL}/mbg/rekap/harian`);
        url.searchParams.append('tanggal', tanggal);
        const res  = await fetch(url.toString(), { headers: authHeader() });
        const json = await res.json();
        if (!json.success) throw new Error(json.message);
        data = Array.isArray(json.data) ? json.data : [];

      } else if (mode === 'mingguan') {
        // Panggil /mbg/rekap/harian untuk setiap hari dalam rentang 7 hari
        data = await fetchRange(weekStart, weekEnd);

      } else if (mode === 'bulanan') {
        // GET /mbg/rekap/bulanan?bulan=&tahun=
        const url = new URL(`${BASE_URL}/mbg/rekap/bulanan`);
        url.searchParams.append('bulan', String(bulan));
        url.searchParams.append('tahun', String(tahun));
        const res  = await fetch(url.toString(), { headers: authHeader() });
        const json = await res.json();
        if (!json.success) throw new Error(json.message);
        data = Array.isArray(json.data) ? json.data : [];

      } else {
        // custom — loop per hari seperti mingguan
        const diff = diffDays(customStart, customEnd);
        if (diff < 0) {
          addToast({ type: 'error', title: 'Error', message: 'Tanggal akhir harus setelah tanggal mulai.' });
          setLoading(false);
          return;
        }
        data = await fetchRange(customStart, customEnd);
      }

      // Derive label & filename suffix
      const params: FilterParams =
        mode === 'harian'   ? { tanggal } :
        mode === 'bulanan'  ? { bulan, tahun } :
        mode === 'mingguan' ? { startDate: weekStart, endDate: weekEnd } :
                              { startDate: customStart, endDate: customEnd };

      setPeriodeLabel(formatPeriodeLabel(mode, params));
      setActiveSuffix(filenameSuffix(mode, params));
      setRecords(data);
      buildSummary(data);

    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message || 'Terjadi kesalahan sistem.' });
    } finally {
      setLoading(false);
    }
  };

  // Fetch range: panggil /mbg/rekap/harian per hari, merge hasilnya
  const fetchRange = async (start: string, end: string): Promise<MBGRecord[]> => {
    const days = diffDays(start, end);
    const all: MBGRecord[] = [];

    for (let i = 0; i <= days; i++) {
      const tgl = addDays(start, i);
      const url = new URL(`${BASE_URL}/mbg/rekap/harian`);
      url.searchParams.append('tanggal', tgl);
      try {
        const res  = await fetch(url.toString(), { headers: authHeader() });
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          all.push(...json.data);
        }
      } catch (_) { /* abaikan hari yang gagal */ }
    }
    return all;
  };

  const authHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem('token')}`,
  });

  // ── Summary builder ────────────────────────────────────────────────────────
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
      if (rec.status === 'hadir')       map[uid].total_hadir      += 1;
      if (rec.status === 'tidak_hadir') map[uid].total_tidak_hadir += 1;
    });

    const result = Object.values(map).map((item) => ({
      ...item,
      persentase: item.total_hari > 0
        ? Math.round((item.total_hadir / item.total_hari) * 100)
        : 0,
    }));

    setSummary(result.sort((a, b) => b.total_hadir - a.total_hadir));
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const filteredSummary = summary.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredRecords = records.filter((r) =>
    (r.user?.name || '').toLowerCase().includes(search.toLowerCase())
  );
  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const totalPages  = Math.ceil(filteredRecords.length / pageSize);
  const totalHadir  = records.filter((r) => r.status === 'hadir').length;
  const totalTidak  = records.filter((r) => r.status === 'tidak_hadir').length;
  const pctHadir    = records.length > 0 ? Math.round((totalHadir / records.length) * 100) : 0;

  // ── Export ─────────────────────────────────────────────────────────────────
  const handleExportXLSX = () => {
    if (view === 'summary') {
      const header = ['Nama', 'Jabatan', 'Total Hadir', 'Total Tidak Hadir', 'Total Hari', '% Hadir'];
      const data   = filteredSummary.map((s) => [
        s.name, s.jabatan || '-', s.total_hadir,
        s.total_tidak_hadir, s.total_hari, `${s.persentase}%`,
      ]);
      const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Rekap MBG');
      XLSX.writeFile(wb, `Rekap_MBG_${activeSuffix || mode}.xlsx`);
    } else {
      const header = ['Nama', 'Tanggal', 'Status', 'Keterangan'];
      const data   = filteredRecords.map((r) => [
        r.user?.name || r.user_id,
        r.tanggal.split('T')[0],
        r.status === 'hadir' ? 'Hadir' : r.status === 'tidak_hadir' ? 'Tidak Hadir' : 'Belum',
        r.keterangan || '',
      ]);
      const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Detail MBG');
      XLSX.writeFile(wb, `Detail_MBG_${activeSuffix || mode}.xlsx`);
    }
    addToast({ type: 'success', title: 'Berhasil', message: 'File Excel berhasil diunduh.' });
  };

  // ── Options ────────────────────────────────────────────────────────────────
  const tahunOptions  = Array.from({ length: 4 }, (_, i) => now.getFullYear() - i);
  const bulanOptions  = [
    { value: 1, label: 'Januari' }, { value: 2, label: 'Februari' },
    { value: 3, label: 'Maret' },   { value: 4, label: 'April' },
    { value: 5, label: 'Mei' },     { value: 6, label: 'Juni' },
    { value: 7, label: 'Juli' },    { value: 8, label: 'Agustus' },
    { value: 9, label: 'September'},{ value: 10, label: 'Oktober' },
    { value: 11, label: 'November'},{ value: 12, label: 'Desember' },
  ];

  const modeTabs: { key: FilterMode; label: string; icon: any }[] = [
    { key: 'harian',   label: 'Harian',   icon: Calendar },
    { key: 'mingguan', label: 'Mingguan', icon: CalendarDays },
    { key: 'bulanan',  label: 'Bulanan',  icon: CalendarRange },
    { key: 'custom',   label: 'Custom',   icon: LayoutGrid },
  ];

  // validasi mingguan: max 7 hari
  const weekDiff = diffDays(weekStart, weekEnd);

  // validasi custom
  const customDiff = diffDays(customStart, customEnd);
  const customValid = customDiff >= 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto space-y-8 pb-20"
    >
      {/* ── Header ── */}
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

      {/* ── Filter Card ── */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 space-y-5">

        {/* Mode tabs */}
        <div className="flex flex-wrap gap-2">
          {modeTabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => { setMode(key); setRecords([]); setSummary([]); }}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border',
                mode === key
                  ? 'bg-[#103552] text-white border-[#103552] shadow-lg shadow-[#103552]/20'
                  : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100 hover:text-slate-700',
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Filter inputs — per mode */}
        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col md:flex-row gap-4 items-end"
          >
            {/* HARIAN */}
            {mode === 'harian' && (
              <div className="flex-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                  Tanggal
                </label>
                <input
                  type="date"
                  value={tanggal}
                  max={todayStr}
                  onChange={(e) => setTanggal(e.target.value)}
                  className={inputCls}
                />
              </div>
            )}

            {/* MINGGUAN */}
            {mode === 'mingguan' && (
              <>
                <div className="flex-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                    Senin / Tanggal Mulai Minggu
                  </label>
                  <input
                    type="date"
                    value={weekStart}
                    max={todayStr}
                    onChange={(e) => setWeekStart(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                    Tanggal Akhir <span className="text-slate-300 normal-case font-bold">(otomatis +7)</span>
                  </label>
                  <input
                    type="date"
                    value={weekEnd}
                    readOnly
                    className={cn(inputCls, 'opacity-60 cursor-not-allowed')}
                  />
                </div>
                {weekDiff > 7 && (
                  <p className="text-xs font-bold text-rose-500 w-full -mt-2">
                    Rentang mingguan maksimal 7 hari.
                  </p>
                )}
              </>
            )}

            {/* BULANAN */}
            {mode === 'bulanan' && (
              <>
                <div className="flex-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Bulan</label>
                  <select value={bulan} onChange={(e) => setBulan(Number(e.target.value))} className={selectCls}>
                    {bulanOptions.map((b) => (
                      <option key={b.value} value={b.value}>{b.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Tahun</label>
                  <select value={tahun} onChange={(e) => setTahun(Number(e.target.value))} className={selectCls}>
                    {tahunOptions.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* CUSTOM */}
            {mode === 'custom' && (
              <>
                <div className="flex-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Dari Tanggal</label>
                  <input
                    type="date"
                    value={customStart}
                    max={customEnd}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Sampai Tanggal</label>
                  <input
                    type="date"
                    value={customEnd}
                    min={customStart}
                    max={todayStr}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className={inputCls}
                  />
                </div>
                {!customValid && (
                  <p className="text-xs font-bold text-rose-500 w-full -mt-2">
                    Tanggal akhir harus setelah tanggal mulai.
                  </p>
                )}
                {customValid && customDiff >= 0 && (
                  <p className="text-[10px] font-bold text-slate-400 w-full -mt-2">
                    {customDiff + 1} hari dipilih
                    {customDiff > 30 ? ' · Banyak hari — mungkin butuh waktu lebih lama' : ''}
                  </p>
                )}
              </>
            )}

            {/* Tombol Tampilkan */}
            <button
              onClick={fetchData}
              disabled={loading || (mode === 'custom' && !customValid)}
              className="flex items-center gap-2 px-8 py-3.5 bg-[#103552] text-white rounded-2xl font-black text-sm shadow-lg shadow-[#103552]/20 hover:bg-[#0D4156] transition-all active:scale-95 disabled:opacity-60 whitespace-nowrap"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Tampilkan
            </button>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Stats ── */}
      {records.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Entri"  value={records.length} icon={Users}        color="text-[#103552] bg-[#96D1C6]/20" />
          <StatCard label="Hadir"        value={totalHadir}     icon={CheckCircle2} color="text-emerald-600 bg-emerald-50" />
          <StatCard label="Tidak Hadir"  value={totalTidak}     icon={XCircle}      color="text-rose-600 bg-rose-50" />
          <StatCard label="% Hadir"      value={`${pctHadir}%`} icon={TrendingUp}   color="text-amber-600 bg-amber-50" />
        </div>
      )}

      {/* ── View toggle + search ── */}
      {records.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 gap-1">
            {(['summary', 'detail'] as const).map((v) => (
              <button
                key={v}
                onClick={() => { setView(v); setCurrentPage(1); }}
                className={cn(
                  'px-5 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all',
                  view === v ? 'bg-white text-[#103552] shadow-sm' : 'text-slate-400 hover:text-slate-700',
                )}
              >
                {v === 'summary' ? 'Ringkasan' : 'Detail'}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama pegawai..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="w-full pl-11 pr-4 py-3 text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-2xl outline-none focus:border-[#103552]/40 focus:ring-2 focus:ring-[#96D1C6]/30 transition-all shadow-sm"
            />
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {records.length === 0 && !loading && (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-16 text-center">
          <UtensilsCrossed className="w-16 h-16 text-slate-200 mx-auto mb-4" />
          <p className="text-sm font-black text-slate-400 uppercase tracking-widest">
            Pilih mode filter lalu klik Tampilkan
          </p>
        </div>
      )}

      {/* ── Summary Table ── */}
      {records.length > 0 && view === 'summary' && (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
          <PeriodHeader label={periodeLabel} mode={mode} />
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  {['#', 'Nama Pegawai', 'Jabatan', 'Hadir', 'Tdk Hadir', 'Total Hari', '% Hadir'].map((h) => (
                    <th key={h} className={cn('px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest', h === '#' || h === 'Hadir' || h === 'Tdk Hadir' || h === 'Total Hari' || h === '% Hadir' ? 'text-center' : 'text-left')}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredSummary.map((s, i) => (
                  <tr key={s.user_id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-xs font-bold text-slate-400 text-center">{i + 1}</td>
                    <td className="px-6 py-4"><p className="text-sm font-black text-slate-800">{s.name}</p></td>
                    <td className="px-6 py-4"><p className="text-xs font-bold text-slate-400">{s.jabatan || '-'}</p></td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-600 text-xs font-black rounded-xl">{s.total_hadir}x</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-block px-3 py-1 bg-rose-50 text-rose-600 text-xs font-black rounded-xl">{s.total_tidak_hadir}x</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-xs font-black text-slate-600">{s.total_hari}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="flex-1 max-w-[80px] h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${s.persentase}%` }} />
                        </div>
                        <span className="text-xs font-black text-slate-700 w-10 text-right">{s.persentase}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredSummary.length === 0 && (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-sm font-bold text-slate-400">Tidak ada data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Detail Table ── */}
      {records.length > 0 && view === 'detail' && (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
          <PeriodHeader label={periodeLabel} mode={mode} />
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  {['#', 'Nama', 'Tanggal', 'Status', 'Keterangan'].map((h, i) => (
                    <th key={h} className={cn('px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest', i === 3 ? 'text-center' : 'text-left')}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedRecords.map((rec, i) => {
                  const badge = statusBadge(rec.status);
                  return (
                    <tr key={`${rec.id}-${i}`} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-xs font-bold text-slate-400">{(currentPage - 1) * pageSize + i + 1}</td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-black text-slate-800">{rec.user?.name || rec.user_id}</p>
                        {rec.user?.jabatan?.nama_jabatan && (
                          <p className="text-[10px] font-bold text-slate-400 mt-0.5">{rec.user.jabatan.nama_jabatan}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                          <span className="text-xs font-bold text-slate-600">
                            {new Date(rec.tanggal).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={cn('text-[10px] font-black px-3 py-1 rounded-xl uppercase', badge.cls)}>{badge.text}</span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400 max-w-[180px] truncate">{rec.keterangan || '-'}</td>
                    </tr>
                  );
                })}
                {paginatedRecords.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-sm font-bold text-slate-400">Tidak ada data</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
              <p className="text-xs font-bold text-slate-400">
                {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredRecords.length)} dari {filteredRecords.length}
              </p>
              <div className="flex items-center gap-2">
                <button disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 text-slate-400 hover:bg-[#96D1C6]/20 hover:text-[#103552] disabled:opacity-30 transition-all">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-black text-slate-600 px-2">{currentPage} / {totalPages}</span>
                <button disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => p + 1)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 text-slate-400 hover:bg-[#96D1C6]/20 hover:text-[#103552] disabled:opacity-30 transition-all">
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

// ─── Sub-components ──────────────────────────────────────────────────────────

function PeriodHeader({ label, mode }: { label: string; mode: FilterMode }) {
  const modeLabel: Record<FilterMode, string> = {
    harian:   'Harian',
    mingguan: 'Mingguan',
    bulanan:  'Bulanan',
    custom:   'Rentang Kustom',
  };
  return (
    <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
      <span className="text-[9px] font-black text-white bg-[#103552] px-2.5 py-1 rounded-lg uppercase tracking-widest">
        {modeLabel[mode]}
      </span>
      <Calendar className="w-4 h-4 text-slate-300" />
      <span className="text-xs font-black text-slate-500 uppercase tracking-widest">{label}</span>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: string | number; icon: any; color: string;
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
  if (status === 'hadir')       return { text: 'Hadir',       cls: 'bg-emerald-50 text-emerald-600' };
  if (status === 'tidak_hadir') return { text: 'Tidak Hadir', cls: 'bg-rose-50 text-rose-600' };
  return { text: 'Belum', cls: 'bg-slate-100 text-slate-400' };
}

// Shared input class
const inputCls =
  'w-full text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 outline-none focus:border-[#103552]/40 focus:ring-2 focus:ring-[#96D1C6]/30 transition-all';

const selectCls = inputCls + ' cursor-pointer';
