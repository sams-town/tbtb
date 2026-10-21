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
  Coins,
  Eye,
  Clock,
  MapPin,
  X,
  FileSpreadsheet,
  Settings,
  SlidersHorizontal,
  History,
  Save,
  Check,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useToast } from './Toast';
import * as XLSX from 'xlsx';

const BASE_URL = import.meta.env.VITE_API_MEANDPAY;

// --- Types -----------------------------------------------------------------
interface MBGRecord {
  id: string;
  user_id: string;
  tanggal: string;
  jam_klaim?: string | null;
  harga?: string | number | null;
  lat?: string | null;
  lng?: string | null;
  jarak?: string | null;
  status: string | null;
  keterangan?: string;
  users?: {
    id?: string;
    name?: string | null;
    jabatan?: string | { nama_jabatan?: string } | null;
    lokasi?: {
      id?: string;
      nama_lokasi?: string | null;
    } | null;
  };
  user?: {
    id?: string;
    name?: string | null;
    jabatan?: string | { nama_jabatan?: string } | null;
  };
}

interface SummaryItem {
  user_id: string;
  name: string;
  jabatan: string;
  total_makan: number; // TOTAL HADIR MAKAN SUDAH BERAPA KALI
  total_hadir: number;
  total_tidak_hadir: number;
  total_hari: number;
  persentase: number;
  total_biaya: number;
  records: MBGRecord[];
}

interface MBGSettingItem {
  id: string;
  harga: string;
  keterangan?: string | null;
  aktif: number | boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

type FilterMode = 'harian' | 'mingguan' | 'bulanan' | 'custom';

// --- Helper Functions -------------------------------------------------------
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

function formatRupiah(amount: number | string | null | undefined): string {
  const num = Number(amount || 0);
  return 'Rp ' + num.toLocaleString('id-ID');
}

function getJabatanLabel(userObj: any): string {
  if (!userObj) return '-';
  if (typeof userObj.jabatan === 'string' && userObj.jabatan.trim()) {
    return userObj.jabatan.trim();
  }
  if (typeof userObj.jabatan === 'object' && userObj.jabatan?.nama_jabatan) {
    return String(userObj.jabatan.nama_jabatan).trim();
  }
  return '-';
}

function isHadirClaim(status: string | null | undefined): boolean {
  if (!status) return true; // Data di tabel mbg_klaims default-nya klaim hadir makan
  const s = status.toLowerCase();
  return !['tidak_hadir', 'tidak hadir', 'batal', 'rejected', 'gagal', 'cancel'].includes(s);
}

function formatPeriodeLabel(mode: FilterMode, params: FilterParams) {
  if (mode === 'harian') {
    return new Date(params.tanggal!).toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }
  if (mode === 'bulanan') {
    return new Date(params.tahun!, params.bulan! - 1, 1).toLocaleDateString('id-ID', {
      month: 'long',
      year: 'numeric',
    });
  }
  const from = new Date(params.startDate!).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const to = new Date(params.endDate!).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return `${from} - ${to}`;
}

function filenameSuffix(mode: FilterMode, params: FilterParams) {
  if (mode === 'harian') return params.tanggal!;
  if (mode === 'bulanan') return `${params.bulan}_${params.tahun}`;
  return `${params.startDate}_${params.endDate}`;
}

interface FilterParams {
  tanggal?: string;
  bulan?: number;
  tahun?: number;
  startDate?: string;
  endDate?: string;
}

// --- Main Component ---------------------------------------------------------
export function RekapMBGPage() {
  const { addToast } = useToast();
  const now = new Date();
  const todayStr = toDateStr(now);

  // -- Filter State --
  const [mode, setMode] = React.useState<FilterMode>('bulanan');

  // Harian
  const [tanggal, setTanggal] = React.useState(todayStr);

  // Mingguan (default Senin minggu berjalan)
  const [weekStart, setWeekStart] = React.useState(() => {
    const d = new Date(now);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return toDateStr(d);
  });
  const weekEnd = addDays(weekStart, 6);

  // Bulanan
  const [bulan, setBulan] = React.useState(now.getMonth() + 1);
  const [tahun, setTahun] = React.useState(now.getFullYear());

  // Custom
  const [customStart, setCustomStart] = React.useState(() => {
    const d = new Date(now);
    d.setDate(1);
    return toDateStr(d);
  });
  const [customEnd, setCustomEnd] = React.useState(todayStr);

  // -- Data State --
  const [loading, setLoading] = React.useState(false);
  const [records, setRecords] = React.useState<MBGRecord[]>([]);
  const [summary, setSummary] = React.useState<SummaryItem[]>([]);
  const [search, setSearch] = React.useState('');
  const [view, setView] = React.useState<'summary' | 'detail'>('summary');
  const [periodeLabel, setPeriodeLabel] = React.useState('');
  const [activeSuffix, setActiveSuffix] = React.useState('');

  // -- Setting Biaya Makan (MBG) State --
  const [activeHarga, setActiveHarga] = React.useState<number>(10000); // Default 10.000 per 1x makan
  const [isSettingOpen, setIsSettingOpen] = React.useState(false);
  const [settingLoading, setSettingLoading] = React.useState(false);
  const [savingSetting, setSavingSetting] = React.useState(false);
  const [inputHarga, setInputHarga] = React.useState<string>('10000');
  const [inputKeterangan, setInputKeterangan] = React.useState<string>('Biaya makan siang bergizi 1x makan');
  const [settingHistory, setSettingHistory] = React.useState<MBGSettingItem[]>([]);

  // Modal State untuk detail riwayat makan pegawai
  const [selectedUserSummary, setSelectedUserSummary] = React.useState<SummaryItem | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 20;

  const authHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json',
  });

  // -- Fetch Setting Biaya MBG dari Backend --
  const fetchActiveSetting = async () => {
    setSettingLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/mbg/settings`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const json = await res.json();
      if (json.success && json.data) {
        const h = Number(json.data.harga || 10000);
        setActiveHarga(h);
        setInputHarga(String(h));
        if (json.data.keterangan) {
          setInputKeterangan(json.data.keterangan);
        }
      } else {
        setActiveHarga(10000);
        setInputHarga('10000');
      }
    } catch (_) {
      setActiveHarga(10000);
      setInputHarga('10000');
    } finally {
      setSettingLoading(false);
    }
  };

  const fetchSettingHistory = async () => {
    try {
      const res = await fetch(`${BASE_URL}/mbg/settings/all`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setSettingHistory(json.data);
      }
    } catch (_) {}
  };

  // Muat setting saat pertama kali dibuka
  React.useEffect(() => {
    fetchActiveSetting();
  }, []);

  // -- Simpan Pengaturan Biaya Makan Baru --
  const handleSaveSetting = async () => {
    const numHarga = parseInt(inputHarga.replace(/[^0-9]/g, ''), 10);
    if (isNaN(numHarga) || numHarga <= 0) {
      addToast({ type: 'error', title: 'Error', message: 'Nominal harga makan harus berupa angka lebih dari 0.' });
      return;
    }

    setSavingSetting(true);
    try {
      const res = await fetch(`${BASE_URL}/mbg/settings`, {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({
          harga: numHarga,
          keterangan: inputKeterangan.trim() || `Tarif Rp ${numHarga.toLocaleString('id-ID')} / 1x makan`,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);

      setActiveHarga(numHarga);
      addToast({
        type: 'success',
        title: 'Berhasil',
        message: `Pengaturan biaya makan per 1x makan berhasil diperbarui menjadi ${formatRupiah(numHarga)}.`,
      });

      // Refresh riwayat & tutup modal
      fetchSettingHistory();
      setIsSettingOpen(false);

      // Re-build summary dengan harga baru jika sudah ada data terambil
      if (records.length > 0) {
        buildSummary(records, numHarga);
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Gagal', message: err.message || 'Gagal menyimpan pengaturan harga.' });
    } finally {
      setSavingSetting(false);
    }
  };

  // -- Summary Builder --
  const buildSummary = (data: MBGRecord[], currentHarga = activeHarga) => {
    const map: Record<string, SummaryItem> = {};

    data.forEach((rec) => {
      const uid = String(rec.user_id);
      const uObj = rec.users || rec.user;
      const userName = uObj?.name || `Pegawai #${uid}`;
      const userJabatan = getJabatanLabel(uObj);

      // Jika di record harga masih 0 atau null, gunakan tarif aktif (default 10.000)
      const recordHarga = Number(rec.harga) > 0 ? Number(rec.harga) : currentHarga;

      if (!map[uid]) {
        map[uid] = {
          user_id: uid,
          name: userName,
          jabatan: userJabatan,
          total_makan: 0,
          total_hadir: 0,
          total_tidak_hadir: 0,
          total_hari: 0,
          persentase: 0,
          total_biaya: 0,
          records: [],
        };
      }

      // Simpan record klaim untuk modal detail riwayat
      map[uid].records.push({
        ...rec,
        harga: recordHarga,
      });

      const hadir = isHadirClaim(rec.status);
      if (hadir) {
        map[uid].total_makan += 1;
        map[uid].total_hadir += 1;
        map[uid].total_biaya += recordHarga;
      } else {
        map[uid].total_tidak_hadir += 1;
      }
      map[uid].total_hari += 1;
    });

    const result = Object.values(map).map((item) => {
      const pct = item.total_hari > 0
        ? Math.round((item.total_hadir / item.total_hari) * 100)
        : 0;
      return {
        ...item,
        persentase: pct,
      };
    });

    // Urutkan dari yang paling sering makan
    setSummary(result.sort((a, b) => b.total_makan - a.total_makan));
  };

  // -- Fetch Data Rekap --
  const fetchData = async () => {
    setLoading(true);
    setRecords([]);
    setSummary([]);
    setCurrentPage(1);

    try {
      let data: MBGRecord[] = [];

      if (mode === 'harian') {
        const url = new URL(`${BASE_URL}/mbg/rekap/harian`);
        url.searchParams.append('tanggal', tanggal);
        const res = await fetch(url.toString(), { headers: authHeader() });
        const json = await res.json();
        if (!json.success) throw new Error(json.message);
        data = Array.isArray(json.data?.data) ? json.data.data
          : Array.isArray(json.data) ? json.data
          : [];
      } else if (mode === 'mingguan') {
        data = await fetchRange(weekStart, weekEnd);
      } else if (mode === 'bulanan') {
        const url = new URL(`${BASE_URL}/mbg/rekap/bulanan`);
        url.searchParams.append('bulan', String(bulan));
        url.searchParams.append('tahun', String(tahun));
        const res = await fetch(url.toString(), { headers: authHeader() });
        const json = await res.json();
        if (!json.success) throw new Error(json.message);
        data = Array.isArray(json.data?.data) ? json.data.data
          : Array.isArray(json.data) ? json.data
          : [];
      } else {
        const diff = diffDays(customStart, customEnd);
        if (diff < 0) {
          addToast({ type: 'error', title: 'Error', message: 'Tanggal akhir harus setelah tanggal mulai.' });
          setLoading(false);
          return;
        }
        data = await fetchRange(customStart, customEnd);
      }

      const params: FilterParams =
        mode === 'harian' ? { tanggal } :
        mode === 'bulanan' ? { bulan, tahun } :
        mode === 'mingguan' ? { startDate: weekStart, endDate: weekEnd } :
        { startDate: customStart, endDate: customEnd };

      setPeriodeLabel(formatPeriodeLabel(mode, params));
      setActiveSuffix(filenameSuffix(mode, params));
      setRecords(data);
      buildSummary(data, activeHarga);

      if (data.length === 0) {
        addToast({ type: 'info', title: 'Informasi', message: 'Tidak ada data klaim MBG pada periode ini.' });
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message || 'Terjadi kesalahan sistem.' });
    } finally {
      setLoading(false);
    }
  };

  const fetchRange = async (start: string, end: string): Promise<MBGRecord[]> => {
    const days = diffDays(start, end);
    const all: MBGRecord[] = [];

    for (let i = 0; i <= days; i++) {
      const tgl = addDays(start, i);
      const url = new URL(`${BASE_URL}/mbg/rekap/harian`);
      url.searchParams.append('tanggal', tgl);
      try {
        const res = await fetch(url.toString(), { headers: authHeader() });
        const json = await res.json();
        if (json.success && Array.isArray(json.data?.data)) {
          all.push(...json.data.data);
        } else if (json.success && Array.isArray(json.data)) {
          all.push(...json.data);
        }
      } catch (_) {
        // Abaikan hari yang gagal
      }
    }
    return all;
  };

  // -- Derived Data --
  const filteredSummary = summary.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.jabatan.toLowerCase().includes(search.toLowerCase())
  );

  const filteredRecords = records.filter((r) => {
    const name = r.users?.name || r.user?.name || '';
    const jab = getJabatanLabel(r.users || r.user);
    return name.toLowerCase().includes(search.toLowerCase()) ||
      jab.toLowerCase().includes(search.toLowerCase());
  });

  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const totalPages = Math.ceil(filteredRecords.length / pageSize);

  // Statistik Ringkasan Atas
  const totalHadirMakan = records.filter((r) => isHadirClaim(r.status)).length;
  const totalTidakHadir = records.filter((r) => !isHadirClaim(r.status)).length;
  // Total biaya: hitung dari nominal record atau fallback ke activeHarga
  const totalBiayaMBG = records.reduce((acc, r) => {
    if (!isHadirClaim(r.status)) return acc;
    const h = Number(r.harga) > 0 ? Number(r.harga) : activeHarga;
    return acc + h;
  }, 0);

  const totalPegawaiUnik = summary.length;
  const avgPctHadir = summary.length > 0
    ? Math.round(summary.reduce((acc, s) => acc + s.persentase, 0) / summary.length)
    : 0;

  // -- Export Excel --
  const handleExportXLSX = () => {
    if (view === 'summary') {
      const header = [
        'No',
        'Nama Pegawai',
        'Jabatan',
        'Total Hadir Makan (Kali)',
        'Hadir',
        'Tdk Hadir',
        'Total Hari',
        '% Hadir',
        'Total Biaya (Rp)',
      ];
      const data = filteredSummary.map((s, idx) => [
        idx + 1,
        s.name,
        s.jabatan || '-',
        s.total_makan,
        s.total_hadir,
        s.total_tidak_hadir,
        s.total_hari,
        `${s.persentase}%`,
        s.total_biaya,
      ]);
      const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Ringkasan Rekap MBG');
      XLSX.writeFile(wb, `Rekap_MBG_Ringkasan_${activeSuffix || mode}.xlsx`);
    } else {
      const header = [
        'No',
        'Nama Pegawai',
        'Jabatan',
        'Tanggal',
        'Jam Klaim',
        'Status',
        'Biaya (Rp)',
        'Jarak GPS',
        'Keterangan',
      ];
      const data = filteredRecords.map((r, idx) => [
        idx + 1,
        r.users?.name || r.user?.name || r.user_id,
        getJabatanLabel(r.users || r.user),
        r.tanggal ? r.tanggal.split('T')[0] : '-',
        r.jam_klaim ? `${r.jam_klaim} WIB` : '-',
        isHadirClaim(r.status) ? 'Hadir Makan' : 'Tidak Hadir',
        Number(r.harga) > 0 ? Number(r.harga) : activeHarga,
        r.jarak ? `${r.jarak} m` : '-',
        r.keterangan || '-',
      ]);
      const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Detail Rekap MBG');
      XLSX.writeFile(wb, `Rekap_MBG_Detail_${activeSuffix || mode}.xlsx`);
    }
    addToast({ type: 'success', title: 'Berhasil', message: 'File Excel berhasil diunduh.' });
  };

  // Preset Pilihan Harga Cepat
  const quickPrices = [10000, 12000, 15000, 20000];

  // -- Options --
  const tahunOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);
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

  const modeTabs: { key: FilterMode; label: string; icon: any }[] = [
    { key: 'harian', label: 'Harian', icon: Calendar },
    { key: 'mingguan', label: 'Mingguan', icon: CalendarDays },
    { key: 'bulanan', label: 'Bulanan', icon: CalendarRange },
    { key: 'custom', label: 'Custom', icon: LayoutGrid },
  ];

  const weekDiff = diffDays(weekStart, weekEnd);
  const customDiff = diffDays(customStart, customEnd);
  const customValid = customDiff >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto space-y-8 pb-24"
    >
      {/* -- Header -- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center shadow-lg shadow-orange-500/20 text-white">
            <UtensilsCrossed className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">Rekap MBG</h1>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200/80 rounded-xl text-xs font-black shadow-sm">
                <Coins className="w-3.5 h-3.5 text-amber-600" />
                <span>{formatRupiah(activeHarga)} / 1x makan</span>
              </span>
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Makan Bersama / Makan Siang Bergizi Karyawan
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Tombol Pengaturan Biaya Makan */}
          <button
            onClick={() => {
              setIsSettingOpen(true);
              fetchSettingHistory();
            }}
            className="flex items-center gap-2 px-5 py-3.5 bg-amber-50 hover:bg-amber-100/80 border border-amber-200 text-amber-800 rounded-2xl text-sm font-black transition-all shadow-sm"
          >
            <Settings className="w-4 h-4 text-amber-600" />
            <span>Pengaturan Biaya Makan</span>
          </button>

          {/* Tombol Export Excel */}
          <button
            onClick={handleExportXLSX}
            disabled={records.length === 0}
            className="flex items-center justify-center gap-2 px-6 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-40 shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* -- Filter Card -- */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 sm:p-8 space-y-6">
        {/* Mode Tabs */}
        <div className="flex flex-wrap gap-2">
          {modeTabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => {
                setMode(key);
                setRecords([]);
                setSummary([]);
              }}
              className={cn(
                'flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border',
                mode === key
                  ? 'bg-[#103552] text-white border-[#103552] shadow-lg shadow-[#103552]/20'
                  : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 hover:text-slate-800'
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Filter Inputs */}
        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col md:flex-row gap-4 items-end"
          >
            {/* HARIAN */}
            {mode === 'harian' && (
              <div className="flex-1 w-full">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                  Pilih Tanggal
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
                <div className="flex-1 w-full">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                    Senin (Tanggal Mulai)
                  </label>
                  <input
                    type="date"
                    value={weekStart}
                    max={todayStr}
                    onChange={(e) => setWeekStart(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div className="flex-1 w-full">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                    Minggu (Tanggal Akhir) <span className="text-slate-400 normal-case font-bold">(Otomatis 7 hari)</span>
                  </label>
                  <input
                    type="date"
                    value={weekEnd}
                    readOnly
                    className={cn(inputCls, 'opacity-70 bg-slate-100 cursor-not-allowed')}
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
                <div className="flex-1 w-full">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                    Bulan
                  </label>
                  <select
                    value={bulan}
                    onChange={(e) => setBulan(Number(e.target.value))}
                    className={selectCls}
                  >
                    {bulanOptions.map((b) => (
                      <option key={b.value} value={b.value}>{b.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 w-full">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                    Tahun
                  </label>
                  <select
                    value={tahun}
                    onChange={(e) => setTahun(Number(e.target.value))}
                    className={selectCls}
                  >
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
                <div className="flex-1 w-full">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                    Dari Tanggal
                  </label>
                  <input
                    type="date"
                    value={customStart}
                    max={customEnd}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div className="flex-1 w-full">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                    Sampai Tanggal
                  </label>
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
              </>
            )}

            {/* Tombol Tampilkan */}
            <button
              onClick={fetchData}
              disabled={loading || (mode === 'custom' && !customValid)}
              className="w-full md:w-auto px-8 py-3.5 bg-[#103552] text-white text-sm font-black uppercase tracking-widest rounded-2xl hover:bg-[#0c2940] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#103552]/20 disabled:opacity-40 shrink-0"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {loading ? 'Memuat...' : 'Tampilkan'}
            </button>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* -- Stat Cards -- */}
      {records.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard
            label="Total Entri Klaim"
            value={records.length}
            icon={UtensilsCrossed}
            color="text-blue-600 bg-blue-50"
          />
          <StatCard
            label="Total Hadir Makan"
            value={`${totalHadirMakan}x`}
            icon={CheckCircle2}
            color="text-emerald-600 bg-emerald-50"
          />
          <StatCard
            label="Pegawai Hadir MBG"
            value={`${totalPegawaiUnik} Orang`}
            icon={Users}
            color="text-indigo-600 bg-indigo-50"
          />
          <StatCard
            label="Total Biaya MBG"
            value={formatRupiah(totalBiayaMBG)}
            icon={Coins}
            color="text-amber-600 bg-amber-50"
          />
          <StatCard
            label="Rata-rata % Hadir"
            value={`${avgPctHadir}%`}
            icon={TrendingUp}
            color="text-teal-600 bg-teal-50"
          />
        </div>
      )}

      {/* -- View Toggle + Search -- */}
      {records.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 gap-1">
            {(['summary', 'detail'] as const).map((v) => (
              <button
                key={v}
                onClick={() => {
                  setView(v);
                  setCurrentPage(1);
                }}
                className={cn(
                  'px-6 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all',
                  view === v
                    ? 'bg-white text-[#103552] shadow-sm font-black'
                    : 'text-slate-500 hover:text-slate-800'
                )}
              >
                {v === 'summary' ? 'Ringkasan Pegawai' : 'Detail Entri Klaim'}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama pegawai atau jabatan..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-11 pr-4 py-3 text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-2xl outline-none focus:border-[#103552]/40 focus:ring-2 focus:ring-[#96D1C6]/30 transition-all shadow-sm"
            />
          </div>
        </div>
      )}

      {/* -- Empty State -- */}
      {records.length === 0 && !loading && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-16 text-center space-y-3">
          <div className="w-16 h-16 rounded-3xl bg-orange-50 text-orange-500 flex items-center justify-center mx-auto">
            <UtensilsCrossed className="w-8 h-8" />
          </div>
          <h3 className="text-base font-black text-slate-700 tracking-tight">Belum Ada Data Rekap</h3>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest max-w-sm mx-auto">
            Silakan pilih mode filter di atas lalu klik tombol "Tampilkan" untuk memuat rekap MBG.
          </p>
        </div>
      )}

      {/* -- Summary Table (Sesuai Permintaan User: Nama Pegawai, Jabatan, Hadir, Tdk Hadir, Total Hari, % Hadir, dan TOTAL HADIR MAKAN SUDAH BERAPA KALI) -- */}
      {records.length > 0 && view === 'summary' && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <PeriodHeader label={periodeLabel} mode={mode} count={filteredSummary.length} />
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-12">#</th>
                  <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nama Pegawai</th>
                  <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Jabatan</th>
                  <th className="px-5 py-4 text-[10px] font-black text-emerald-700 uppercase tracking-widest text-center bg-emerald-50/50">
                    Total Hadir Makan
                  </th>
                  <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Hadir</th>
                  <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Tdk Hadir</th>
                  <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Total Hari</th>
                  <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">% Hadir</th>
                  <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total Biaya</th>
                  <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredSummary.map((s, i) => (
                  <tr
                    key={s.user_id}
                    className="hover:bg-slate-50/60 transition-colors group"
                  >
                    <td className="px-5 py-4 text-xs font-bold text-slate-400 text-center">{i + 1}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#103552] to-[#1c5580] text-white flex items-center justify-center font-black text-xs shadow-sm">
                          {s.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-800">{s.name}</p>
                          <span className="text-[10px] font-bold text-slate-400">ID: #{s.user_id}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-block px-3 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg border border-slate-200/60">
                        {s.jabatan}
                      </span>
                    </td>
                    {/* TOTAL HADIR MAKAN SUDAH BERAPA KALI */}
                    <td className="px-5 py-4 text-center bg-emerald-50/20">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100/80 text-emerald-800 text-xs font-black rounded-xl border border-emerald-200 shadow-sm">
                        <UtensilsCrossed className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{s.total_makan}x Makan</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="inline-block px-2.5 py-1 bg-emerald-50 text-emerald-600 text-xs font-black rounded-xl border border-emerald-100">
                        {s.total_hadir}x
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={cn(
                        'inline-block px-2.5 py-1 text-xs font-black rounded-xl border',
                        s.total_tidak_hadir > 0
                          ? 'bg-rose-50 text-rose-600 border-rose-100'
                          : 'bg-slate-50 text-slate-400 border-slate-100'
                      )}>
                        {s.total_tidak_hadir}x
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="text-xs font-black text-slate-600 bg-slate-100/70 px-2.5 py-1 rounded-xl">
                        {s.total_hari}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${s.persentase}%` }}
                          />
                        </div>
                        <span className="text-xs font-black text-slate-700 w-10 text-right">
                          {s.persentase}%
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="text-xs font-black text-slate-800 font-mono">
                        {formatRupiah(s.total_biaya)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <button
                        onClick={() => setSelectedUserSummary(s)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-[#103552] bg-slate-100 hover:bg-[#103552] hover:text-white rounded-xl transition-all shadow-sm"
                        title="Lihat Riwayat Klaim Makan"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Detail</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredSummary.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center text-sm font-bold text-slate-400">
                      Tidak ada data pegawai yang sesuai dengan pencarian.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* -- Detail Table -- */}
      {records.length > 0 && view === 'detail' && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <PeriodHeader label={periodeLabel} mode={mode} count={filteredRecords.length} />
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-12 text-center">#</th>
                  <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nama Pegawai & Jabatan</th>
                  <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tanggal & Hari</th>
                  <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Jam Klaim</th>
                  <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                  <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Biaya MBG</th>
                  <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Lokasi / Jarak</th>
                  <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginatedRecords.map((rec, i) => {
                  const hadir = isHadirClaim(rec.status);
                  const uObj = rec.users || rec.user;
                  const jabName = getJabatanLabel(uObj);
                  const userName = uObj?.name || `Pegawai #${rec.user_id}`;
                  const rowIdx = (currentPage - 1) * pageSize + i + 1;
                  const itemHarga = Number(rec.harga) > 0 ? Number(rec.harga) : activeHarga;

                  return (
                    <tr
                      key={`${rec.id}-${i}`}
                      className="hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="px-5 py-4 text-xs font-bold text-slate-400 text-center">{rowIdx}</td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-black text-slate-800">{userName}</p>
                        <p className="text-[11px] font-bold text-slate-400 mt-0.5">{jabName}</p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="text-xs font-bold text-slate-700">
                            {rec.tanggal
                              ? new Date(rec.tanggal).toLocaleDateString('id-ID', {
                                  weekday: 'short',
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : '-'}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{rec.jam_klaim ? `${rec.jam_klaim} WIB` : '-'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={cn(
                          'text-[10px] font-black px-3 py-1 rounded-xl uppercase border tracking-wider',
                          hadir
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                            : 'bg-rose-50 text-rose-600 border-rose-200'
                        )}>
                          {hadir ? 'Hadir Makan' : 'Tidak Hadir'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="text-xs font-black text-slate-800 font-mono">
                          {formatRupiah(itemHarga)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{rec.jarak ? `Radius ${rec.jarak}m` : (uObj?.lokasi?.nama_lokasi || 'Kantor')}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-400 max-w-[150px] truncate">
                        {rec.keterangan || '-'}
                      </td>
                    </tr>
                  );
                })}
                {paginatedRecords.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-sm font-bold text-slate-400">
                      Tidak ada detail entri yang sesuai.
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
                Menampilkan {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredRecords.length)} dari {filteredRecords.length} entri
              </p>
              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-[#103552] hover:text-white disabled:opacity-30 transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-black text-slate-700 px-2">{currentPage} / {totalPages}</span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-[#103552] hover:text-white disabled:opacity-30 transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* -- Modal Detail Riwayat Pegawai -- */}
      <AnimatePresence>
        {selectedUserSummary && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#103552] to-[#1c5580] text-white flex items-center justify-center font-black text-lg">
                    {selectedUserSummary.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-800">{selectedUserSummary.name}</h3>
                    <p className="text-xs font-bold text-slate-400">{selectedUserSummary.jabatan} • ID: #{selectedUserSummary.user_id}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedUserSummary(null)}
                  className="w-9 h-9 rounded-xl bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-700 flex items-center justify-center transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Mini Stats */}
              <div className="grid grid-cols-3 gap-3 p-6 bg-slate-50/30 border-b border-slate-100">
                <div className="bg-white p-3.5 rounded-2xl border border-slate-100 text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Hadir Makan</p>
                  <p className="text-lg font-black text-emerald-600">{selectedUserSummary.total_makan}x Makan</p>
                </div>
                <div className="bg-white p-3.5 rounded-2xl border border-slate-100 text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">% Kehadiran</p>
                  <p className="text-lg font-black text-slate-800">{selectedUserSummary.persentase}%</p>
                </div>
                <div className="bg-white p-3.5 rounded-2xl border border-slate-100 text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Nominal</p>
                  <p className="text-lg font-black text-amber-600 font-mono">{formatRupiah(selectedUserSummary.total_biaya)}</p>
                </div>
              </div>

              {/* Modal Body: List Riwayat Klaim */}
              <div className="p-6 overflow-y-auto space-y-3 flex-1">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
                  Riwayat Klaim MBG ({selectedUserSummary.records.length} Entri)
                </h4>
                {selectedUserSummary.records.map((r, idx) => (
                  <div
                    key={r.id || idx}
                    className="p-4 rounded-2xl bg-slate-50/80 border border-slate-100 flex items-center justify-between hover:bg-slate-100/60 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-black text-slate-800">
                          {r.tanggal
                            ? new Date(r.tanggal).toLocaleDateString('id-ID', {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                              })
                            : '-'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500 pl-6">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {r.jam_klaim ? `${r.jam_klaim} WIB` : '-'}
                        </span>
                        {r.jarak && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            {r.jarak}m
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <span className="inline-block px-2.5 py-1 text-[10px] font-black rounded-lg bg-emerald-100 text-emerald-700">
                        Hadir Makan
                      </span>
                      <p className="text-xs font-black text-slate-700 font-mono">
                        {formatRupiah(r.harga)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 text-right">
                <button
                  onClick={() => setSelectedUserSummary(null)}
                  className="px-6 py-2.5 bg-[#103552] text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-[#0c2940] transition-all"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* -- Modal Pengaturan Biaya Makan (MBG) -- */}
      <AnimatePresence>
        {isSettingOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-amber-50/40">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-400 text-white flex items-center justify-center shadow-lg shadow-amber-500/20">
                    <Coins className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-800">Pengaturan Biaya Makan (MBG)</h3>
                    <p className="text-xs font-bold text-slate-400">Atur nominal biaya makan per 1x kehadiran klaim</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsSettingOpen(false)}
                  className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                {/* Info Tarif Aktif */}
                <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent border border-amber-200/80 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest block mb-0.5">
                      Tarif Aktif Saat Ini
                    </span>
                    <p className="text-2xl font-black text-amber-600 font-mono">
                      {formatRupiah(activeHarga)} <span className="text-xs font-bold text-slate-500 normal-case">/ 1x makan</span>
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
                    <Check className="w-5 h-5" />
                  </div>
                </div>

                {/* Preset Cepat */}
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block">
                    Pilihan Tarif Cepat
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {quickPrices.map((qp) => (
                      <button
                        key={qp}
                        type="button"
                        onClick={() => setInputHarga(String(qp))}
                        className={cn(
                          'py-2.5 px-3 rounded-2xl text-xs font-black transition-all border text-center',
                          inputHarga === String(qp)
                            ? 'bg-[#103552] text-white border-[#103552] shadow-sm'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        )}
                      >
                        {formatRupiah(qp)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Input Nominal Biaya */}
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block">
                    Nominal Biaya Per 1x Makan (Rp)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">
                      Rp
                    </span>
                    <input
                      type="number"
                      step="500"
                      min="1000"
                      value={inputHarga}
                      onChange={(e) => setInputHarga(e.target.value)}
                      placeholder="10000"
                      className="w-full pl-12 pr-4 py-3.5 text-base font-black text-slate-800 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-[#103552] focus:ring-2 focus:ring-[#96D1C6]/30 transition-all font-mono"
                    />
                  </div>
                  <p className="text-[11px] font-bold text-slate-400">
                    Contoh: 10000 = Rp 10.000 per 1x kehadiran makan siang.
                  </p>
                </div>

                {/* Input Keterangan */}
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block">
                    Catatan / Keterangan
                  </label>
                  <input
                    type="text"
                    value={inputKeterangan}
                    onChange={(e) => setInputKeterangan(e.target.value)}
                    placeholder="Contoh: Biaya makan siang MBG 10.000"
                    className={inputCls}
                  />
                </div>

                {/* Riwayat Pengaturan Biaya */}
                {settingHistory.length > 0 && (
                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-widest">
                      <History className="w-4 h-4 text-slate-400" />
                      <span>Riwayat Perubahan Biaya</span>
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {settingHistory.map((sh, idx) => (
                        <div
                          key={sh.id || idx}
                          className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                        >
                          <div>
                            <p className="font-black text-slate-800">{formatRupiah(sh.harga)}</p>
                            <p className="text-[10px] font-bold text-slate-400">{sh.keterangan || '-'}</p>
                          </div>
                          <div className="text-right">
                            <span className={cn(
                              'text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider',
                              (sh.aktif === 1 || sh.aktif === true)
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-200 text-slate-500'
                            )}>
                              {(sh.aktif === 1 || sh.aktif === true) ? 'Aktif' : 'Riwayat'}
                            </span>
                            {sh.created_at && (
                              <p className="text-[9px] font-bold text-slate-400 mt-0.5">
                                {new Date(sh.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsSettingOpen(false)}
                  className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-100 transition-all"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveSetting}
                  disabled={savingSetting}
                  className="px-6 py-2.5 bg-[#103552] text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-[#0c2940] transition-all flex items-center gap-2 shadow-sm disabled:opacity-40"
                >
                  {savingSetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>{savingSetting ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// --- Sub-components ----------------------------------------------------------

function PeriodHeader({ label, mode, count }: { label: string; mode: FilterMode; count?: number }) {
  const modeLabel: Record<FilterMode, string> = {
    harian: 'Harian',
    mingguan: 'Mingguan',
    bulanan: 'Bulanan',
    custom: 'Rentang Kustom',
  };

  return (
    <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/40">
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-black text-white bg-[#103552] px-3 py-1 rounded-lg uppercase tracking-widest shadow-sm">
          {modeLabel[mode]}
        </span>
        <div className="flex items-center gap-1.5 text-xs font-black text-slate-600 uppercase tracking-widest">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span>{label}</span>
        </div>
      </div>
      {typeof count === 'number' && (
        <span className="text-xs font-bold text-slate-400">
          Total: <strong className="text-slate-700">{count}</strong> data
        </span>
      )}
    </div>
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
    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
      <div className={cn('w-10 h-10 rounded-2xl flex items-center justify-center mb-3', color)}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <p className="text-xl font-black text-slate-900 tracking-tight">{value}</p>
      </div>
    </div>
  );
}

// Shared input classes
const inputCls =
  'w-full text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 outline-none focus:border-[#103552]/40 focus:ring-2 focus:ring-[#96D1C6]/30 transition-all';

const selectCls = inputCls + ' cursor-pointer';
