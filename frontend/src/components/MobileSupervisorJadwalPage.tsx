import React, { useState, useEffect, useRef } from 'react';
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
  Calendar,
  Users,
  Clock,
  ArrowRight,
  FileSpreadsheet,
  Sparkles,
  RefreshCw,
  Lock,
  ShieldCheck,
  Check,
  Info,
  CalendarDays,
  Building2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useToast } from './Toast';
import * as XLSX from 'xlsx';

const BASE_URL = import.meta.env.VITE_API_MEANDPAY;

// --- Interfaces -------------------------------------------------------------
interface Shift {
  id: string;
  nama_shift: string;
  jam_masuk: string;
  jam_keluar: string;
  jam_mulai_istirahat?: string | null;
  jam_selesai_istirahat?: string | null;
}

interface Employee {
  id: string;
  name: string;
  username: string;
  jabatan?: { nama_jabatan?: string } | string | null;
  lokasi?: { nama_lokasi?: string } | string | null;
}

interface ParsedScheduleItem {
  user_id: string;
  nama_karyawan: string;
  jabatan: string;
  shift_id: string | null;
  kode_shift: string;
  nama_shift: string;
  tanggal: string; // YYYY-MM-DD
  lock_location?: number;
  error?: string;
}

interface EmployeeRosterSummary {
  user_id: string;
  nama_karyawan: string;
  jabatan: string;
  matched: boolean;
  shiftsByDate: Record<number, string>;
  totalShift: number;
  totalOff: number;
}

const SHIFT_CODE_MAP: Record<string, { nama: string; jam: string }> = {
  P: { nama: 'Pagi', jam: '07.00 - 14.00' },
  S: { nama: 'Siang', jam: '14.00 - 21.00' },
  M: { nama: 'Malam', jam: '21.00 - 07.00' },
  MD: { nama: 'Middle', jam: '10.00 - 17.00' },
  MD10: { nama: 'Middle 10', jam: '10.00 - 17.00' },
  MD11: { nama: 'Middle 11', jam: '11.00 - 18.00' },
  L: { nama: 'Libur / Off', jam: '00.00 - 00.00' },
  OFF: { nama: 'Libur / Off', jam: '00.00 - 00.00' },
  OH: { nama: 'Office Hour', jam: '08.00 - 17.00' },
  P1: { nama: 'Non Shift / Teknisi', jam: '08.00 - 16.00' },
  P1S: { nama: 'Non-shift Sabtu (Setengah Hari)', jam: '08.00 - 12.00' },
  N7: { nama: 'Spv Gizi / Linen', jam: '07.00 - 15.00' },
  N7S: { nama: 'Spv Gizi Sabtu (Setengah Hari)', jam: '07.00 - 12.00' },
  DSP: { nama: 'Dokter & SOD Pagi', jam: '08.00 - 17.00' },
  DSM: { nama: 'Dokter & SOD Malam', jam: '17.00 - 08.00' },
  S1: { nama: 'Siang Fisioterapi', jam: '13.00 - 20.00' },
  S2: { nama: 'Siang Gizi / Kantin', jam: '13.00 - 21.00' },
  TM: { nama: 'Teknisi Malam', jam: '21.00 - 08.00' },
  FM: { nama: 'Fismed Sabtu', jam: '08.30 - 12.30' },
  PT: { nama: 'Part Timer', jam: '08.00 - 14.00' },
  AG: { nama: 'Ahli Gizi', jam: '09.00 - 17.00' },
  SCP: { nama: 'Security Pagi', jam: '07.00 - 19.00' },
  SCM: { nama: 'Security Malam', jam: '19.00 - 07.00' },
  RMP: { nama: 'Rekam Medis Pagi', jam: '08.00 - 15.00' },
  RMS: { nama: 'Rekam Medis Sore', jam: '15.00 - 22.00' },
  RMM: { nama: 'Rekam Medis Malam', jam: '22.00 - 08.00' },
};

const BULAN_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const HARI_NAMES_SHORT = ['M', 'S', 'S', 'R', 'K', 'J', 'S'];

export function MobileSupervisorJadwalPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const now = new Date();
  const [selectedBulan, setSelectedBulan] = useState<number>(now.getMonth() + 1);
  const [selectedTahun, setSelectedTahun] = useState<number>(now.getFullYear());
  const [unitName, setUnitName] = useState<string>('Ruang Rawat Inap Edelwies');

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(true);

  const [fileName, setFileName] = useState<string>('');
  const [parsedItems, setParsedItems] = useState<ParsedScheduleItem[]>([]);
  const [rosterSummaries, setRosterSummaries] = useState<EmployeeRosterSummary[]>([]);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'roster' | 'list'>('roster');

  const daysInMonth = new Date(selectedTahun, selectedBulan, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const authHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json',
  });

  useEffect(() => {
    fetchMasterData();
  }, []);

  const fetchMasterData = async () => {
    setLoadingData(true);
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
      const [shiftRes, empRes] = await Promise.all([
        fetch(`${BASE_URL}/shifts`, { headers }),
        fetch(`${BASE_URL}/users?limit=10000`, { headers }),
      ]);

      const shiftJson = await shiftRes.json();
      const empJson = await empRes.json();

      if (shiftJson.success && Array.isArray(shiftJson.data)) {
        setShifts(shiftJson.data);
      }
      if (empJson.success) {
        const empList = Array.isArray(empJson.data?.data)
          ? empJson.data.data
          : Array.isArray(empJson.data)
          ? empJson.data
          : [];
        setEmployees(empList);
      }
    } catch (err: any) {
      console.error('Error fetching master data:', err);
      addToast({ type: 'error', title: 'Gagal Memuat Data', message: 'Gagal mengambil data shift dan karyawan.' });
    } finally {
      setLoadingData(false);
    }
  };

  const resolveShiftId = (code: string): { id: string | null; nama: string } => {
    const clean = String(code || '').trim().toUpperCase();
    if (!clean || clean === 'L' || clean === 'LIBUR' || clean === 'OFF') {
      return { id: null, nama: 'Libur / Off' };
    }

    const exact = shifts.find((s) => s.nama_shift.trim().toUpperCase() === clean);
    if (exact) return { id: exact.id, nama: exact.nama_shift };

    if (clean === 'P' || clean === 'PAGI') {
      const match = shifts.find((s) => s.nama_shift.toLowerCase().includes('pagi'));
      if (match) return { id: match.id, nama: match.nama_shift };
    }
    if (clean === 'S' || clean === 'SIANG') {
      const match = shifts.find((s) => s.nama_shift.toLowerCase().includes('siang'));
      if (match) return { id: match.id, nama: match.nama_shift };
    }
    if (clean === 'M' || clean === 'MALAM') {
      const match = shifts.find((s) => s.nama_shift.toLowerCase().includes('malam'));
      if (match) return { id: match.id, nama: match.nama_shift };
    }
    if (clean.startsWith('MD') || clean.includes('MIDDLE')) {
      const match = shifts.find((s) => s.nama_shift.toLowerCase().includes('middle'));
      if (match) return { id: match.id, nama: match.nama_shift };
    }
    if (clean === 'OH') {
      const match = shifts.find((s) => s.nama_shift.toLowerCase().includes('office'));
      if (match) return { id: match.id, nama: match.nama_shift };
    }

    const byId = shifts.find((s) => String(s.id) === clean);
    if (byId) return { id: byId.id, nama: byId.nama_shift };

    const anyShift = shifts[0];
    return {
      id: anyShift ? anyShift.id : null,
      nama: SHIFT_CODE_MAP[clean]?.nama || clean,
    };
  };

  const resolveEmployee = (rawName: string): Employee | undefined => {
    if (!rawName) return undefined;
    const clean = rawName.trim().toLowerCase();

    let found = employees.find((e) => e.name.trim().toLowerCase() === clean);
    if (found) return found;

    found = employees.find(
      (e) => e.name.toLowerCase().includes(clean) || clean.includes(e.name.toLowerCase())
    );
    if (found) return found;

    found = employees.find((e) => e.username.toLowerCase() === clean);
    return found;
  };

  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const bulanLabel = BULAN_NAMES[selectedBulan - 1];

    const sheetTitle = `Jadwal ${bulanLabel} ${selectedTahun}`;

    const r1 = ['JADWAL KERJA TENAGA PENUNJANG MEDIS RS TAMAN HARAPAN BARU'];
    const r2 = [];
    const r3 = ['Unit', `: ${unitName}`];
    const r4 = ['Bulan', `: ${bulanLabel} ${selectedTahun}`];
    const r5 = ['Total Jam Kerja Efektif', ': 175 Jam'];
    const r6 = [];

    const dayLetters = ['Nama Lengkap', 'Jabatan'];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(selectedTahun, selectedBulan - 1, d);
      const dayIdx = dateObj.getDay();
      dayLetters.push(HARI_NAMES_SHORT[dayIdx]);
    }

    const dateNumbers: any[] = ['', ''];
    for (let d = 1; d <= daysInMonth; d++) {
      dateNumbers.push(d);
    }

    const dataRows: any[] = [];
    const sourceEmployees = employees.slice(0, 15);

    if (sourceEmployees.length > 0) {
      sourceEmployees.forEach((emp) => {
        const jab = typeof emp.jabatan === 'object' ? emp.jabatan?.nama_jabatan : emp.jabatan || 'Perawat / Staf';
        const row = [emp.name, jab];
        for (let d = 1; d <= daysInMonth; d++) {
          const mod = d % 5;
          const sample = mod === 0 ? 'L' : mod === 1 ? 'P' : mod === 2 ? 'MD10' : mod === 3 ? 'S' : 'M';
          row.push(sample);
        }
        dataRows.push(row);
      });
    } else {
      const contoh = [
        ['Jihan Musliha', 'Spv Rawat Inap Edelwies'],
        ['Dini Dwiaryani', 'Perawat Rawat Inap Edelwies'],
        ['Mutiara Putri Arisa', 'Perawat Rawat Inap Edelwies'],
        ['Putri Esha Mutiara', 'Perawat Rawat Inap Edelwies'],
        ['Rima Rosiana', 'Perawat Rawat Inap Edelwies'],
        ['Siti Sarah Izmy', 'Perawat Rawat Inap Edelwies'],
        ['Ina Mujiyana', 'Perawat Rawat Inap Edelwies'],
      ];
      contoh.forEach(([n, j]) => {
        const row = [n, j];
        for (let d = 1; d <= daysInMonth; d++) {
          row.push(d % 7 === 1 ? 'L' : 'P');
        }
        dataRows.push(row);
      });
    }

    const ws1Data = [r1, r2, r3, r4, r5, r6, dayLetters, dateNumbers, ...dataRows];
    const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);

    ws1['!cols'] = [
      { wch: 28 },
      { wch: 30 },
      ...Array.from({ length: daysInMonth }, () => ({ wch: 6 })),
    ];

    XLSX.utils.book_append_sheet(wb, ws1, sheetTitle.slice(0, 31));

    const kodeRows = Object.entries(SHIFT_CODE_MAP).map(([kode, val], i) => [
      i + 1,
      kode,
      val.nama,
      val.jam,
    ]);
    const ws2 = XLSX.utils.aoa_to_sheet([
      ['No', 'Kode Shift', 'Nama Shift', 'Jam Kerja'],
      ...kodeRows,
    ]);
    ws2['!cols'] = [{ wch: 6 }, { wch: 12 }, { wch: 28 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Kode Shift');

    if (employees.length > 0) {
      const empData = employees.map((e) => [
        e.id,
        e.name,
        e.username,
        typeof e.jabatan === 'object' ? e.jabatan?.nama_jabatan : e.jabatan || '-',
      ]);
      const ws3 = XLSX.utils.aoa_to_sheet([
        ['ID Karyawan', 'Nama Karyawan', 'Username', 'Jabatan'],
        ...empData,
      ]);
      ws3['!cols'] = [{ wch: 12 }, { wch: 28 }, { wch: 18 }, { wch: 25 }];
      XLSX.utils.book_append_sheet(wb, ws3, 'Referensi Karyawan');
    }

    const cleanUnit = unitName.trim().replace(/[^a-zA-Z0-9]/g, '_') || 'Unit';
    const filename = `Template_Jadwal_${cleanUnit}_${bulanLabel}_${selectedTahun}.xlsx`;
    XLSX.writeFile(wb, filename);
    addToast({
      type: 'success',
      title: 'Template Diunduh',
      message: `Template jadwal periode ${bulanLabel} ${selectedTahun} berhasil diunduh.`,
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setUploadSuccess(false);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const buffer = ev.target?.result as ArrayBuffer;
        const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true });
        const firstSheetName = wb.SheetNames[0];
        const sheet = wb.Sheets[firstSheetName];
        const rawGrid: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        if (!rawGrid || rawGrid.length < 4) {
          addToast({ type: 'error', title: 'File Kosong', message: 'Tidak ada baris data yang valid dalam file.' });
          return;
        }

        parseExcelContent(rawGrid);
      } catch (err: any) {
        console.error('Parse error:', err);
        addToast({ type: 'error', title: 'Format Tidak Valid', message: 'Gagal membaca format file Excel.' });
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const parseExcelContent = (grid: any[][]) => {
    const items: ParsedScheduleItem[] = [];
    const summaries: EmployeeRosterSummary[] = [];

    let dateRowIdx = -1;
    let nameColIdx = 0;
    let jabColIdx = 1;

    for (let r = 0; r < Math.min(grid.length, 15); r++) {
      const row = grid[r];
      const hasDates = row.some((c, idx) => Number(c) === 1 && Number(row[idx + 1]) === 2);
      if (hasDates) {
        dateRowIdx = r;
        break;
      }
    }

    if (dateRowIdx !== -1) {
      const dateRow = grid[dateRowIdx];

      const colToDay: Record<number, number> = {};
      dateRow.forEach((val, colIdx) => {
        const dNum = parseInt(String(val), 10);
        if (!isNaN(dNum) && dNum >= 1 && dNum <= 31) {
          colToDay[colIdx] = dNum;
        }
      });

      for (let r = dateRowIdx + 1; r < grid.length; r++) {
        const row = grid[r];
        const rawName = String(row[nameColIdx] || '').trim();
        const rawJabatan = String(row[jabColIdx] || '').trim();

        if (!rawName || rawName.toLowerCase().includes('total') || rawName.includes('===') || rawName.startsWith(':')) {
          continue;
        }

        const matchedEmp = resolveEmployee(rawName);
        const empId = matchedEmp ? String(matchedEmp.id) : '';
        const empName = matchedEmp ? matchedEmp.name : rawName;
        const empJabatan = matchedEmp
          ? typeof matchedEmp.jabatan === 'object'
            ? matchedEmp.jabatan?.nama_jabatan || '-'
            : matchedEmp.jabatan || '-'
          : rawJabatan || '-';

        const summary: EmployeeRosterSummary = {
          user_id: empId,
          nama_karyawan: empName,
          jabatan: empJabatan,
          matched: Boolean(matchedEmp),
          shiftsByDate: {},
          totalShift: 0,
          totalOff: 0,
        };

        Object.entries(colToDay).forEach(([colIdxStr, dayNum]) => {
          const colIdx = Number(colIdxStr);
          const cellCode = String(row[colIdx] || '').trim().toUpperCase();

          if (!cellCode) return;

          summary.shiftsByDate[dayNum] = cellCode;

          const { id: shiftId, nama: shiftNama } = resolveShiftId(cellCode);

          if (shiftId) {
            summary.totalShift += 1;
          } else {
            summary.totalOff += 1;
          }

          const tglStr = `${selectedTahun}-${String(selectedBulan).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

          items.push({
            user_id: empId,
            nama_karyawan: empName,
            jabatan: empJabatan,
            shift_id: shiftId,
            kode_shift: cellCode,
            nama_shift: shiftNama,
            tanggal: tglStr,
            lock_location: 0,
            error: !empId ? 'Karyawan tidak terdaftar di database' : undefined,
          });
        });

        summaries.push(summary);
      }
    } else {
      const headerRow = grid[0].map((h) => String(h).trim().toLowerCase());
      const idIdx = headerRow.findIndex((h) => h.includes('id') && (h.includes('karyawan') || h.includes('user')));
      const nameIdx = headerRow.findIndex((h) => h.includes('nama') && h.includes('karyawan'));
      const shiftIdx = headerRow.findIndex((h) => h.includes('shift'));
      const tglIdx = headerRow.findIndex((h) => h.includes('tanggal') || h.includes('date'));

      for (let r = 1; r < grid.length; r++) {
        const row = grid[r];
        const rawId = idIdx >= 0 ? String(row[idIdx]).trim() : '';
        const rawName = nameIdx >= 0 ? String(row[nameIdx]).trim() : '';
        const rawShift = shiftIdx >= 0 ? String(row[shiftIdx]).trim() : '';
        const rawDate = tglIdx >= 0 ? String(row[tglIdx]).trim() : '';

        if (!rawId && !rawName) continue;

        const matchedEmp = employees.find((e) => String(e.id) === rawId) || resolveEmployee(rawName);
        const { id: shiftId, nama: shiftNama } = resolveShiftId(rawShift);

        const empId = matchedEmp ? String(matchedEmp.id) : rawId;
        const empName = matchedEmp ? matchedEmp.name : rawName;

        items.push({
          user_id: empId,
          nama_karyawan: empName,
          jabatan: '-',
          shift_id: shiftId,
          kode_shift: rawShift,
          nama_shift: shiftNama,
          tanggal: rawDate || `${selectedTahun}-${String(selectedBulan).padStart(2, '0')}-01`,
          lock_location: 0,
          error: !empId ? 'Karyawan tidak ditemukan' : undefined,
        });
      }
    }

    setParsedItems(items);
    setRosterSummaries(summaries);

    if (items.length > 0) {
      addToast({
        type: 'success',
        title: 'File Berhasil Dibaca',
        message: `Terbaca ${summaries.length} pegawai dengan total ${items.length} jadwal shift.`,
      });
    } else {
      addToast({
        type: 'error',
        title: 'Data Tidak Ditemukan',
        message: 'Tidak ada baris jadwal shift yang berhasil diproses dari file.',
      });
    }
  };

  const handleImportAndSync = async () => {
    const validItems = parsedItems.filter((it) => it.user_id && it.shift_id);

    if (validItems.length === 0) {
      addToast({
        type: 'error',
        title: 'Tidak Ada Jadwal Valid',
        message: 'Semua jadwal kosong atau karyawan belum terdaftar di database.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const payload = validItems.map((it) => ({
        user_id: it.user_id,
        shift_id: it.shift_id,
        tanggal: it.tanggal,
        start_date: it.tanggal,
        end_date: it.tanggal,
        lock_location: 0,
      }));

      const res = await fetch(`${BASE_URL}/supervisor/jadwal/import`, {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (json.success) {
        setUploadSuccess(true);
        addToast({
          type: 'success',
          title: 'Sinkronisasi Berhasil!',
          message: `${validItems.length} jadwal shift telah otomatis masuk ke database, langsung tersinkron ke dashboard admin, absensi, dan jadwal mobile karyawan.`,
        });
      } else {
        throw new Error(json.message || 'Gagal menyimpan jadwal ke server');
      }
    } catch (err: any) {
      console.error('Import error:', err);
      addToast({
        type: 'error',
        title: 'Sinkronisasi Gagal',
        message: err.message || 'Terjadi kesalahan saat menyimpan jadwal.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const validCount = parsedItems.filter((i) => i.user_id && i.shift_id).length;
  const offCount = parsedItems.filter((i) => i.user_id && !i.shift_id).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-4 pb-32 px-3 sm:px-6 pt-2"
    >
      {/* -- Top Navigation & Header (Mobile-Optimized) -- */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          {/* Back & Title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate('/beranda')}
              className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 flex items-center justify-center transition-all shrink-0"
              title="Kembali ke Beranda"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-black text-slate-800 tracking-tight leading-tight truncate">
                Input Jadwal Shift
              </h1>
              <p className="text-[11px] font-bold text-slate-400 truncate">
                Supervisor Unit RS THB
              </p>
            </div>
          </div>

          {/* Badge Status */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200/80 rounded-xl text-emerald-800 text-[11px] font-black shrink-0 shadow-sm">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden xs:inline">Live Sync</span>
            <span className="xs:hidden">Sync</span>
          </div>
        </div>

        {/* Info Periode Aktif Strip */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500">
          <span className="flex items-center gap-1.5 text-slate-400">
            <Calendar className="w-3.5 h-3.5 text-[#185B5A]" />
            Periode Aktif:
          </span>
          <span className="px-2.5 py-0.5 bg-slate-100 rounded-lg text-slate-700 font-black">
            {BULAN_NAMES[selectedBulan - 1]} {selectedTahun}
          </span>
        </div>
      </div>

      {/* -- Step 1: Atur Periode & Unduh Template -- */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 sm:p-6 space-y-4">
        {/* Section Title */}
        <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
          <div className="w-6 h-6 rounded-lg bg-emerald-50 text-[#185B5A] flex items-center justify-center font-black text-xs">
            1
          </div>
          <h2 className="text-xs font-black text-slate-700 uppercase tracking-wider">
            Periode & Unduh Template
          </h2>
        </div>

        {/* Dropdowns Grid: 2 kolom untuk Bulan & Tahun */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Pilih Bulan */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
              Bulan
            </label>
            <div className="relative">
              <select
                value={selectedBulan}
                onChange={(e) => {
                  setSelectedBulan(Number(e.target.value));
                  setParsedItems([]);
                  setRosterSummaries([]);
                }}
                className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#185B5A]/30 transition-all cursor-pointer appearance-none truncate pr-7"
              >
                {BULAN_NAMES.map((bName, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {bName} {idx + 1 === now.getMonth() + 1 ? '• Kini' : ''}
                  </option>
                ))}
              </select>
              <CalendarDays className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Pilih Tahun */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
              Tahun
            </label>
            <div className="relative">
              <select
                value={selectedTahun}
                onChange={(e) => {
                  setSelectedTahun(Number(e.target.value));
                  setParsedItems([]);
                  setRosterSummaries([]);
                }}
                className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#185B5A]/30 transition-all cursor-pointer appearance-none pr-7"
              >
                {[2025, 2026, 2027, 2028].map((yr) => (
                  <option key={yr} value={yr}>
                    {yr} {yr === now.getFullYear() ? '• Kini' : ''}
                  </option>
                ))}
              </select>
              <Calendar className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Nama Unit / Ruangan (Full Width) */}
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
            Nama Unit / Ruangan
          </label>
          <div className="relative">
            <input
              type="text"
              value={unitName}
              onChange={(e) => setUnitName(e.target.value)}
              placeholder="Contoh: Ruang Rawat Inap Edelwies"
              className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-2xl pl-9 pr-3 py-2.5 outline-none focus:ring-2 focus:ring-[#185B5A]/30 transition-all"
            />
            <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Banner Unduh Template Excel (Mobile Stack Layout) */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50/40 to-white border border-emerald-100/90 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100/80 text-[#185B5A] flex items-center justify-center shrink-0 mt-0.5">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-black text-slate-800 leading-snug">
                Template Roster RS THB ({BULAN_NAMES[selectedBulan - 1]} {selectedTahun})
              </h4>
              <p className="text-[11px] font-bold text-slate-500 mt-0.5 leading-normal">
                Format matriks {daysInMonth} hari, tanggal, dan nama staf unit otomatis terisi.
              </p>
            </div>
          </div>

          <button
            onClick={handleDownloadTemplate}
            disabled={loadingData}
            className="w-full py-3 bg-[#185B5A] hover:bg-[#124544] active:scale-[0.98] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-[#185B5A]/20 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loadingData ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>Download Template Excel</span>
          </button>
        </div>
      </div>

      {/* -- Step 2: Upload File -- */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 sm:p-6 space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
          <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-black text-xs">
            2
          </div>
          <h2 className="text-xs font-black text-slate-700 uppercase tracking-wider">
            Unggah File Jadwal
          </h2>
        </div>

        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-slate-200 hover:border-[#185B5A] bg-slate-50/70 hover:bg-emerald-50/20 rounded-2xl p-6 text-center cursor-pointer transition-all space-y-2 group active:scale-[0.99]"
        >
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="w-11 h-11 rounded-2xl bg-white border border-slate-200 text-slate-400 group-hover:text-[#185B5A] group-hover:border-[#185B5A] flex items-center justify-center mx-auto shadow-sm transition-all">
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-black text-slate-800">
              {fileName ? fileName : 'Pilih File Excel Jadwal (.xlsx / .csv)'}
            </p>
            <p className="text-[10px] font-bold text-slate-400 mt-0.5">
              Mendukung format Matriks Roster Unit RS THB
            </p>
          </div>
          {fileName && (
            <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-full">
              ✓ File Siap Divalidasi
            </span>
          )}
        </div>
      </div>

      {/* -- Step 3: Preview & Validasi Roster -- */}
      {parsedItems.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <div>
              <h2 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Preview Jadwal Terbaca
              </h2>
              <p className="text-[10px] font-bold text-slate-400">
                {rosterSummaries.length} pegawai • {validCount} jadwal shift
              </p>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl text-[10px] font-black">
              <button
                onClick={() => setActiveTab('roster')}
                className={cn(
                  'px-3 py-1.5 rounded-lg transition-all',
                  activeTab === 'roster'
                    ? 'bg-white text-[#185B5A] shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                )}
              >
                Roster
              </button>
              <button
                onClick={() => setActiveTab('list')}
                className={cn(
                  'px-3 py-1.5 rounded-lg transition-all',
                  activeTab === 'list'
                    ? 'bg-white text-[#185B5A] shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                )}
              >
                Daftar
              </button>
            </div>
          </div>

          {/* Mini Badges Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
              <p className="text-[9px] font-black text-slate-400 uppercase">Pegawai</p>
              <p className="text-sm font-black text-slate-800">{rosterSummaries.length}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100 text-center">
              <p className="text-[9px] font-black text-emerald-700 uppercase">Shift Kerja</p>
              <p className="text-sm font-black text-emerald-800">{validCount}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-100/70 border border-slate-200 text-center">
              <p className="text-[9px] font-black text-slate-500 uppercase">Libur / Off</p>
              <p className="text-sm font-black text-slate-700">{offCount}</p>
            </div>
          </div>

          {/* Tampilan 1: Roster Matrix (Horizontal Scroll Smooth) */}
          {activeTab === 'roster' && (
            <div className="border border-slate-200 rounded-2xl overflow-x-auto shadow-inner bg-slate-50/20 max-h-72">
              <table className="w-full text-[11px] text-center border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 sticky top-0 z-20">
                    <th className="p-2.5 text-left font-black text-slate-700 sticky left-0 bg-slate-50 min-w-[130px] z-30 border-r border-slate-200">
                      Nama Pegawai
                    </th>
                    {daysArray.map((d) => {
                      const dateObj = new Date(selectedTahun, selectedBulan - 1, d);
                      const isSunday = dateObj.getDay() === 0;
                      return (
                        <th
                          key={d}
                          className={cn(
                            'p-1.5 font-black border-r border-slate-200 min-w-[30px]',
                            isSunday ? 'bg-rose-50 text-rose-600' : 'text-slate-600'
                          )}
                        >
                          <span className="block text-[8px] uppercase">{HARI_NAMES_SHORT[dateObj.getDay()]}</span>
                          <span className="block text-[10px]">{d}</span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {rosterSummaries.map((summary, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60">
                      <td className="p-2.5 text-left font-black text-slate-800 sticky left-0 bg-white border-r border-slate-200 z-10 truncate max-w-[130px]">
                        <div className="flex items-center gap-1.5">
                          <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', summary.matched ? 'bg-emerald-500' : 'bg-amber-400')} />
                          <span className="truncate">{summary.nama_karyawan}</span>
                        </div>
                      </td>
                      {daysArray.map((d) => {
                        const code = summary.shiftsByDate[d] || '-';
                        const isOff = code === 'L' || code === 'OFF';
                        const isMalam = code === 'M';
                        const isSiang = code === 'S';
                        const isPagi = code === 'P';

                        return (
                          <td
                            key={d}
                            className={cn(
                              'p-1 text-[10px] font-black border-r border-slate-100',
                              isOff ? 'text-slate-300' :
                              isMalam ? 'text-indigo-600' :
                              isSiang ? 'text-amber-600' :
                              isPagi ? 'text-emerald-600' : 'text-slate-700'
                            )}
                          >
                            {code}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Tampilan 2: Detail List */}
          {activeTab === 'list' && (
            <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full text-[11px] text-left">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="p-2.5 font-black text-slate-600">Tgl</th>
                    <th className="p-2.5 font-black text-slate-600">Pegawai</th>
                    <th className="p-2.5 font-black text-slate-600">Shift</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedItems.slice(0, 100).map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="p-2 font-mono text-[10px] text-slate-500">{item.tanggal.slice(8)}/{item.tanggal.slice(5, 7)}</td>
                      <td className="p-2 font-black text-slate-800 truncate max-w-[120px]">{item.nama_karyawan}</td>
                      <td className="p-2">
                        <span className={cn(
                          'inline-block px-2 py-0.5 rounded text-[9px] font-black',
                          item.shift_id ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                        )}>
                          {item.kode_shift} ({item.nama_shift})
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Tombol Eksekusi Sinkronisasi (Mobile-Friendly Full Width) */}
          <div className="pt-2">
            <button
              onClick={handleImportAndSync}
              disabled={submitting || validCount === 0}
              className="w-full py-4 bg-[#185B5A] hover:bg-[#124544] active:scale-[0.98] text-white text-xs font-black uppercase tracking-wider rounded-2xl transition-all shadow-xl shadow-[#185B5A]/25 flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sedang Menyinkronkan...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-emerald-300" />
                  <span>Import & Sinkronisasi Jadwal ({validCount} Shift)</span>
                </>
              )}
            </button>
            <p className="text-[10px] font-bold text-center text-slate-400 mt-2">
              Jadwal langsung tersimpan ke database dan otomatis sinkron ke Admin & Mesin Absensi.
            </p>
          </div>
        </div>
      )}

      {/* -- Notifikasi Sukses Penuh -- */}
      {uploadSuccess && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-5 rounded-3xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-xl space-y-3"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
              <Check className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-tight">Jadwal Shift Berhasil Di-Import!</h3>
              <p className="text-[11px] text-emerald-100">
                Periode {BULAN_NAMES[selectedBulan - 1]} {selectedTahun} langsung aktif di sistem admin & mobile.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/beranda')}
            className="w-full py-3 bg-white text-[#185B5A] text-xs font-black uppercase tracking-wider rounded-xl hover:bg-emerald-50 transition-all shadow-sm active:scale-[0.98]"
          >
            Kembali ke Beranda
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}
