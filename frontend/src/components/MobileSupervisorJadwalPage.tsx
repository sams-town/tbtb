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
  shift_id: string | null; // null jika Libur / Off
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
  shiftsByDate: Record<number, string>; // day 1..31 -> kode shift
  totalShift: number;
  totalOff: number;
}

// Master Kode Shift standar RS THB
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

const HARI_NAMES_SHORT = ['M', 'S', 'S', 'R', 'K', 'J', 'S']; // Minggu (0) - Sabtu (6)

export function MobileSupervisorJadwalPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const now = new Date();
  // Dropdown Bulan & Tahun secara real-time default
  const [selectedBulan, setSelectedBulan] = useState<number>(now.getMonth() + 1);
  const [selectedTahun, setSelectedTahun] = useState<number>(now.getFullYear());
  const [unitName, setUnitName] = useState<string>('Ruang Rawat Inap Edelwies');

  // Master Data
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(true);

  // File & Upload State
  const [fileName, setFileName] = useState<string>('');
  const [parsedItems, setParsedItems] = useState<ParsedScheduleItem[]>([]);
  const [rosterSummaries, setRosterSummaries] = useState<EmployeeRosterSummary[]>([]);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'roster' | 'list'>('roster');

  // Hitung jumlah hari di bulan terpilih
  const daysInMonth = new Date(selectedTahun, selectedBulan, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Auth Header
  const authHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json',
  });

  // -- Fetch Master Shift & Karyawan --
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

  // Helper mencari ID Shift di database berdasarkan Kode (P, S, M, MD10, dll)
  const resolveShiftId = (code: string): { id: string | null; nama: string } => {
    const clean = String(code || '').trim().toUpperCase();
    if (!clean || clean === 'L' || clean === 'LIBUR' || clean === 'OFF') {
      return { id: null, nama: 'Libur / Off' };
    }

    // 1. Cek kecocokan langsung dengan nama_shift di DB
    const exact = shifts.find(
      (s) => s.nama_shift.trim().toUpperCase() === clean
    );
    if (exact) return { id: exact.id, nama: exact.nama_shift };

    // 2. Mapping spesifik berdasarkan kode standar
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

    // 3. Cek apakah kode berupa angka id_shift langsung
    const byId = shifts.find((s) => String(s.id) === clean);
    if (byId) return { id: byId.id, nama: byId.nama_shift };

    // Fallback: gunakan shift pertama jika ada atau tandai nama kodenya
    const anyShift = shifts[0];
    return {
      id: anyShift ? anyShift.id : null,
      nama: SHIFT_CODE_MAP[clean]?.nama || clean,
    };
  };

  // Helper mencari ID Karyawan berdasarkan Nama Lengkap
  const resolveEmployee = (rawName: string): Employee | undefined => {
    if (!rawName) return undefined;
    const clean = rawName.trim().toLowerCase();

    // 1. Exact match nama
    let found = employees.find((e) => e.name.trim().toLowerCase() === clean);
    if (found) return found;

    // 2. Contains match
    found = employees.find(
      (e) =>
        e.name.toLowerCase().includes(clean) || clean.includes(e.name.toLowerCase())
    );
    if (found) return found;

    // 3. Username match
    found = employees.find((e) => e.username.toLowerCase() === clean);
    return found;
  };

  // -- Download Template Excel Sesuai Format Rumah Sakit --
  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const bulanLabel = BULAN_NAMES[selectedBulan - 1];

    // --- Sheet 1: Template Roster Matrix ---
    const sheetTitle = `Jadwal ${bulanLabel} ${selectedTahun}`;

    // Row 1: Judul
    const r1 = ['JADWAL KERJA TENAGA PENUNJANG MEDIS RS TAMAN HARAPAN BARU'];
    const r2 = [];
    const r3 = ['Unit', `: ${unitName}`];
    const r4 = ['Bulan', `: ${bulanLabel} ${selectedTahun}`];
    const r5 = ['Total Jam Kerja Efektif', ': 175 Jam'];
    const r6 = [];

    // Row 7: Header Inisial Hari (M, S, S, R, K, J, S)
    const dayLetters = ['Nama Lengkap', 'Jabatan'];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(selectedTahun, selectedBulan - 1, d);
      const dayIdx = dateObj.getDay();
      dayLetters.push(HARI_NAMES_SHORT[dayIdx]);
    }

    // Row 8: Angka Tanggal (1..N)
    const dateNumbers: any[] = ['', ''];
    for (let d = 1; d <= daysInMonth; d++) {
      dateNumbers.push(d);
    }

    // Rows Data: Masukkan karyawan aktif atau contoh
    const dataRows: any[] = [];
    const sourceEmployees = employees.slice(0, 15);

    if (sourceEmployees.length > 0) {
      sourceEmployees.forEach((emp) => {
        const jab = typeof emp.jabatan === 'object' ? emp.jabatan?.nama_jabatan : emp.jabatan || 'Perawat / Staf';
        const row = [emp.name, jab];
        // Isi contoh pola shift (P, S, M, L, MD10)
        for (let d = 1; d <= daysInMonth; d++) {
          const mod = d % 5;
          const sample = mod === 0 ? 'L' : mod === 1 ? 'P' : mod === 2 ? 'MD10' : mod === 3 ? 'S' : 'M';
          row.push(sample);
        }
        dataRows.push(row);
      });
    } else {
      // Default jika data karyawan belum terambil
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

    // Styling lebar kolom
    ws1['!cols'] = [
      { wch: 28 }, // Nama Lengkap
      { wch: 30 }, // Jabatan
      ...Array.from({ length: daysInMonth }, () => ({ wch: 6 })), // Tanggal 1..N
    ];

    XLSX.utils.book_append_sheet(wb, ws1, sheetTitle.slice(0, 31));

    // --- Sheet 2: Daftar Kode Shift RS THB ---
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

    // --- Sheet 3: Referensi Karyawan Aktif ---
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

    const filename = `Template_Jadwal_${unitName.replace(/[^a-zA-Z0-9]/g, '_')}_${bulanLabel}_${selectedTahun}.xlsx`;
    XLSX.writeFile(wb, filename);
    addToast({
      type: 'success',
      title: 'Template Diunduh',
      message: `Template jadwal periode ${bulanLabel} ${selectedTahun} berhasil diunduh.`,
    });
  };

  // -- Parse File Upload (Mendukung Matrix Roster & Standard List) --
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

        if (!rawGrid || rawGrid.length < 5) {
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

  // Parser Pintar: Membaca Format Matriks Roster RS THB atau Tabel Kolom
  const parseExcelContent = (grid: any[][]) => {
    const items: ParsedScheduleItem[] = [];
    const summaries: EmployeeRosterSummary[] = [];

    // Cari baris header tanggal (baris yang memiliki angka 1, 2, 3...)
    let dateRowIdx = -1;
    let nameColIdx = 0;
    let jabColIdx = 1;

    for (let r = 0; r < Math.min(grid.length, 15); r++) {
      const row = grid[r];
      // Cari apakah ada deretan angka tanggal 1, 2, 3
      const hasDates = row.some((c, idx) => Number(c) === 1 && Number(row[idx + 1]) === 2);
      if (hasDates) {
        dateRowIdx = r;
        break;
      }
    }

    if (dateRowIdx !== -1) {
      // FORMAT MATRIKS ROSTER (PERSIS DENGAN GAMBAR USER)
      const dateRow = grid[dateRowIdx];

      // Petakan kolom tanggal 1..daysInMonth
      const colToDay: Record<number, number> = {};
      dateRow.forEach((val, colIdx) => {
        const dNum = parseInt(String(val), 10);
        if (!isNaN(dNum) && dNum >= 1 && dNum <= 31) {
          colToDay[colIdx] = dNum;
        }
      });

      // Baris setelah dateRow adalah data karyawan
      for (let r = dateRowIdx + 1; r < grid.length; r++) {
        const row = grid[r];
        const rawName = String(row[nameColIdx] || '').trim();
        const rawJabatan = String(row[jabColIdx] || '').trim();

        if (!rawName || rawName.toLowerCase().includes('total') || rawName.includes('===') || rawName.startsWith(':')) {
          continue; // Lewati baris kosong / footer
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

        // Baca setiap kolom tanggal
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

          // Format tanggal YYYY-MM-DD
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
      // FORMAT TABEL KOLOM (Fallback: ID Karyawan, Tanggal, ID Shift)
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

  // -- Submit & Sinkronisasi Langsung ke Admin dan Seluruh Sistem --
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
      // Siapkan payload batch ke endpoint supervisor
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
  const errorCount = parsedItems.filter((i) => !i.user_id).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto space-y-6 pb-28 px-2 sm:px-4"
    >
      {/* -- Header Modul Supervisor -- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/beranda')}
            className="w-11 h-11 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#185B5A] to-[#258280] text-white flex items-center justify-center shadow-lg shadow-[#185B5A]/20 p-3">
            <ClipboardList className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
                Input Jadwal Shift Supervisor
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                <ShieldCheck className="w-3 h-3" /> Live Sync Admin
              </span>
            </div>
            <p className="text-xs font-bold text-slate-400 mt-0.5">
              Upload Jadwal Unit Otomatis Sinkron ke Sistem Admin & Absensi
            </p>
          </div>
        </div>

        {/* Info Real-Time Bulan */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-4 py-2.5 rounded-2xl self-start sm:self-center">
          <Calendar className="w-4 h-4 text-[#185B5A]" />
          <span className="text-xs font-bold text-slate-600">
            Periode: <strong>{BULAN_NAMES[selectedBulan - 1]} {selectedTahun}</strong>
          </span>
        </div>
      </div>

      {/* -- Panel Pemilihan Bulan, Unit & Download Template -- */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
            1. Atur Periode Bulan & Unduh Template Resmi
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Dropdown Bulan */}
          <div>
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">
              Pilih Bulan (Real-Time)
            </label>
            <select
              value={selectedBulan}
              onChange={(e) => {
                setSelectedBulan(Number(e.target.value));
                setParsedItems([]);
                setRosterSummaries([]);
              }}
              className="w-full text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#185B5A]/30 transition-all cursor-pointer"
            >
              {BULAN_NAMES.map((bName, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {bName} {idx + 1 === now.getMonth() + 1 ? '• (Bulan Ini)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Dropdown Tahun */}
          <div>
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">
              Pilih Tahun
            </label>
            <select
              value={selectedTahun}
              onChange={(e) => {
                setSelectedTahun(Number(e.target.value));
                setParsedItems([]);
                setRosterSummaries([]);
              }}
              className="w-full text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#185B5A]/30 transition-all cursor-pointer"
            >
              {[2025, 2026, 2027, 2028].map((yr) => (
                <option key={yr} value={yr}>
                  Tahun {yr} {yr === now.getFullYear() ? '• (Tahun Ini)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Nama Unit / Ruangan */}
          <div>
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">
              Nama Unit / Ruangan
            </label>
            <input
              type="text"
              value={unitName}
              onChange={(e) => setUnitName(e.target.value)}
              placeholder="Contoh: Ruang Rawat Inap Edelwies"
              className="w-full text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#185B5A]/30 transition-all"
            />
          </div>
        </div>

        {/* Tombol Unduh Template */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50/50 to-white border border-emerald-100">
          <div className="space-y-1">
            <h4 className="text-sm font-black text-emerald-900 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Template Excel Resmi RS THB ({BULAN_NAMES[selectedBulan - 1]} {selectedTahun})
            </h4>
            <p className="text-xs font-bold text-emerald-700/80">
              Template otomatis terisi rentang tanggal {daysInMonth} hari, inisial hari kalender, dan nama staf unit Anda.
            </p>
          </div>
          <button
            onClick={handleDownloadTemplate}
            disabled={loadingData}
            className="w-full sm:w-auto px-6 py-3 bg-[#185B5A] hover:bg-[#124544] text-white text-xs font-black uppercase tracking-wider rounded-2xl transition-all shadow-md shadow-[#185B5A]/20 flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
          >
            {loadingData ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>Download Template Excel</span>
          </button>
        </div>
      </div>

      {/* -- Panel Upload File -- */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Upload className="w-4 h-4 text-blue-500" />
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
            2. Unggah File Jadwal (.xlsx, .xls, .csv)
          </h2>
        </div>

        {/* Dropzone Box */}
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-slate-200 hover:border-[#185B5A] bg-slate-50/60 hover:bg-emerald-50/30 rounded-3xl p-8 text-center cursor-pointer transition-all space-y-3 group"
        >
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 group-hover:border-[#185B5A] text-slate-400 group-hover:text-[#185B5A] flex items-center justify-center mx-auto shadow-sm transition-all">
            <Upload className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-black text-slate-800">
              {fileName ? fileName : 'Klik untuk Pilih File Jadwal Excel'}
            </p>
            <p className="text-xs font-bold text-slate-400 mt-0.5">
              Mendukung format Matriks Roster Unit (.xlsx) atau File CSV
            </p>
          </div>
          {fileName && (
            <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-black rounded-full">
              File Terpilih: {fileName}
            </span>
          )}
        </div>
      </div>

      {/* -- Panel Hasil Pembacaan & Preview Jadwal -- */}
      {parsedItems.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden space-y-6 p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                Data Jadwal Berhasil Divalidasi
              </h2>
              <p className="text-xs font-bold text-slate-400 mt-0.5">
                Periksa daftar jadwal sebelum disinkronkan ke sistem Admin
              </p>
            </div>

            {/* View Toggle */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-black">
              <button
                onClick={() => setActiveTab('roster')}
                className={cn(
                  'px-4 py-2 rounded-lg transition-all',
                  activeTab === 'roster'
                    ? 'bg-white text-[#185B5A] shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                )}
              >
                Tampilan Roster ({rosterSummaries.length} Pegawai)
              </button>
              <button
                onClick={() => setActiveTab('list')}
                className={cn(
                  'px-4 py-2 rounded-lg transition-all',
                  activeTab === 'list'
                    ? 'bg-white text-[#185B5A] shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                )}
              >
                Daftar Detail ({parsedItems.length} Shift)
              </button>
            </div>
          </div>

          {/* Mini Stats Baris */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Pegawai</p>
              <p className="text-xl font-black text-slate-800">{rosterSummaries.length} Orang</p>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
              <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Jadwal Shift Kerja</p>
              <p className="text-xl font-black text-emerald-800">{validCount} Hari</p>
            </div>
            <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100">
              <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Libur / Off (L)</p>
              <p className="text-xl font-black text-blue-800">{offCount} Hari</p>
            </div>
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100">
              <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Pegawai Tidak Cocok</p>
              <p className="text-xl font-black text-amber-800">
                {rosterSummaries.filter((s) => !s.matched).length} Orang
              </p>
            </div>
          </div>

          {/* Tampilan 1: Roster Matrix (Sama Persis seperti Excel Rumah Sakit) */}
          {activeTab === 'roster' && (
            <div className="border border-slate-200 rounded-2xl overflow-x-auto">
              <table className="w-full text-xs text-center border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="p-3 text-left font-black text-slate-700 sticky left-0 bg-slate-50 min-w-[160px] z-10 border-r border-slate-200">
                      Nama Pegawai
                    </th>
                    <th className="p-3 text-left font-black text-slate-500 min-w-[140px] border-r border-slate-200">
                      Jabatan
                    </th>
                    {daysArray.map((d) => {
                      const dateObj = new Date(selectedTahun, selectedBulan - 1, d);
                      const isSunday = dateObj.getDay() === 0;
                      return (
                        <th
                          key={d}
                          className={cn(
                            'p-2 font-black border-r border-slate-200 min-w-[34px]',
                            isSunday ? 'bg-rose-50 text-rose-600 font-black' : 'text-slate-600'
                          )}
                        >
                          <span className="block text-[9px] uppercase">{HARI_NAMES_SHORT[dateObj.getDay()]}</span>
                          <span className="block text-xs">{d}</span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rosterSummaries.map((summary, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3 text-left font-black text-slate-800 sticky left-0 bg-white border-r border-slate-200 z-10">
                        <div className="flex items-center gap-1.5">
                          <span className={cn('w-2 h-2 rounded-full shrink-0', summary.matched ? 'bg-emerald-500' : 'bg-amber-400')} />
                          <span className="truncate max-w-[140px]">{summary.nama_karyawan}</span>
                        </div>
                      </td>
                      <td className="p-3 text-left font-bold text-slate-500 border-r border-slate-200 truncate max-w-[140px]">
                        {summary.jabatan}
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
                              'p-1 text-xs font-black border-r border-slate-100',
                              isOff ? 'text-slate-400 bg-slate-50/50' :
                              isMalam ? 'text-indigo-600 font-black' :
                              isSiang ? 'text-amber-600 font-black' :
                              isPagi ? 'text-emerald-600 font-black' : 'text-slate-700'
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

          {/* Tampilan 2: Daftar Detail Per Tanggal */}
          {activeTab === 'list' && (
            <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-96 overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="p-3 font-black text-slate-600">Tanggal</th>
                    <th className="p-3 font-black text-slate-600">Pegawai</th>
                    <th className="p-3 font-black text-slate-600">Kode Shift</th>
                    <th className="p-3 font-black text-slate-600">Nama Shift</th>
                    <th className="p-3 font-black text-slate-600 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedItems.slice(0, 150).map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60">
                      <td className="p-3 font-mono font-bold text-slate-600">{item.tanggal}</td>
                      <td className="p-3 font-black text-slate-800">{item.nama_karyawan}</td>
                      <td className="p-3 font-black text-emerald-700">{item.kode_shift}</td>
                      <td className="p-3 font-bold text-slate-600">{item.nama_shift}</td>
                      <td className="p-3 text-center">
                        {item.user_id ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                            Valid
                          </span>
                        ) : (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
                            Belum Ada ID
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Tombol Eksekusi Sinkronisasi */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <Info className="w-4 h-4 text-blue-500 shrink-0" />
              <span>
                Begitu tombol ditekan, jadwal akan langsung tersimpan dan otomatis sinkron ke Admin & Mesin Absensi.
              </span>
            </div>

            <button
              onClick={handleImportAndSync}
              disabled={submitting || validCount === 0}
              className="w-full sm:w-auto px-8 py-4 bg-[#185B5A] hover:bg-[#124544] text-white text-sm font-black uppercase tracking-wider rounded-2xl transition-all shadow-xl shadow-[#185B5A]/25 flex items-center justify-center gap-2 disabled:opacity-40 shrink-0"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sedang Menyinkronkan...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5 text-emerald-300" />
                  <span>Import & Sinkronisasi Jadwal ({validCount} Shift)</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* -- Notifikasi Sukses Penuh -- */}
      {uploadSuccess && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-8 rounded-3xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
              <Check className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight">Jadwal Shift Berhasil Di-Import!</h3>
              <p className="text-xs text-emerald-100 mt-1 max-w-xl">
                Jadwal shift periode {BULAN_NAMES[selectedBulan - 1]} {selectedTahun} telah otomatis masuk ke sistem.
                Admin, aplikasi absensi mobile, dan rekap MBG langsung tersinkronisasi secara real-time.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/beranda')}
            className="px-6 py-3 bg-white text-[#185B5A] text-xs font-black uppercase tracking-wider rounded-2xl hover:bg-emerald-50 transition-all shadow-md shrink-0"
          >
            Kembali ke Beranda
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}
