import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar,
  Search,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Filter,
  Loader2,
  CheckCircle,
  Check,
  Download,
  Eye,
  X,
  User,
  Building2,
  MapPin,
  FileText,
  ExternalLink,
  XCircle,
} from 'lucide-react';
import { cn, formatPhotoUrl } from '../lib/utils';
import { useToast } from './Toast';
import { AddLeave } from './AddLeave';
import { EditLeave } from './EditLeave';

interface Leave {
  id: string;
  lokasi_id: string;
  user_id: string;
  nama_cuti: string;
  tanggal: string;
  alasan_cuti: string;
  foto_cuti: string | null;
  status_cuti: string;
  catatan: string | null;
  user_approval: string;
  created_at: string;
  updated_at: string;
  users: {
    id: string;
    name: string;
    jabatan_id?: string;
    jabatan?: { id: string; nama_jabatan: string };
  } | null;
  pemohon: {
    id: string;
    name: string;
    jabatan_id?: string;
    jabatan?: { id: string; nama_jabatan: string };
  } | null;
}

interface LeavePageProps {
  initialFilters?: {
    userId?: string;
    startDate?: string;
    endDate?: string;
  };
}

export function LeavePage({ initialFilters }: LeavePageProps = {}) {
  const { addToast } = useToast();
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState<Leave | null>(null);
  const [detailLeave, setDetailLeave] = useState<Leave | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [jabatans, setJabatans] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [filterEmployeeId, setFilterEmployeeId] = useState(initialFilters?.userId || '');
  const [filterStartDate, setFilterStartDate] = useState(initialFilters?.startDate || '');
  const [filterEndDate, setFilterEndDate] = useState(initialFilters?.endDate || '');
  const [empSearch, setEmpSearch] = useState('');
  const [showEmpDropdown, setShowEmpDropdown] = useState(false);
  const [displayedLeaves, setDisplayedLeaves] = useState<Leave[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setCurrentUser(user);
    fetchData(user);
  }, []);

  const fetchData = async (userParam?: any) => {
    try {
      setLoading(true);
      setError(null);

      const activeUser = userParam || currentUser || JSON.parse(localStorage.getItem('user') || '{}');
      const roles: string[] = Array.isArray(activeUser?.roles)
        ? activeUser.roles.map((r: any) => String(r).toLowerCase())
        : activeUser?.role ? [String(activeUser.role).toLowerCase()] : [];

      const isMaster =
        activeUser?.id?.toString() === '1' ||
        Number(activeUser?.id) === 1 ||
        activeUser?.is_admin === 'superadmin' ||
        activeUser?.is_admin === 'admin' ||
        roles.includes('superadmin') ||
        roles.includes('admin');

      const isManagerRole =
        roles.includes('manager') ||
        roles.includes('supervisor') ||
        activeUser?.is_supervisor === 1 ||
        activeUser?.is_supervisor === true ||
        activeUser?.is_admin === 'manager';

      // 1. Ambil seluruh data pegawai — exclude dokter & superadmin
      let empData: any[] = [];
      try {
        // Gunakan /users/all?exclude_role=dokter agar dokter tidak muncul di daftar pegawai cuti
        const empRes = await fetch(`${import.meta.env.VITE_API_MEANDPAY}/users/all?exclude_role=dokter`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const empJson = await empRes.json();
        if (empJson.success && Array.isArray(empJson.data) && empJson.data.length > 0) {
          empData = empJson.data;
        } else {
          const fallbackRes = await fetch(`${import.meta.env.VITE_API_MEANDPAY}/users?limit=1000&exclude_role=dokter`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          });
          const fallbackJson = await fallbackRes.json();
          if (fallbackJson.success && Array.isArray(fallbackJson.data)) {
            empData = fallbackJson.data;
          }
        }
      } catch (_) {
        try {
          const fallbackRes = await fetch(`${import.meta.env.VITE_API_MEANDPAY}/users?limit=1000&exclude_role=dokter`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          });
          const fallbackJson = await fallbackRes.json();
          if (fallbackJson.success && Array.isArray(fallbackJson.data)) {
            empData = fallbackJson.data;
          }
        } catch (_2) {}
      }

      // Filter sisi-klien: buang superadmin/admin & dokter jika lolos dari backend
      empData = empData.filter((e: any) => {
        const adminVal = (e.is_admin || '').toLowerCase();
        if (['superadmin', 'super admin', 'super_admin', 'admin'].includes(adminVal)) return false;
        const roleNames = Array.isArray(e.roles) ? e.roles.map((r: any) => (typeof r === 'string' ? r : r.name || '').toLowerCase()) : [];
        if (roleNames.some((r: string) => r.includes('dokter'))) return false;
        const jabName = (e.jabatan?.nama_jabatan || '').toLowerCase();
        if (jabName.includes('dokter')) return false;
        return true;
      });

      setEmployees(empData);

      // 2. Ambil data cuti dan jabatan secara paralel
      const [cutisRes, jabRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_MEANDPAY}/cutis`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }),
        fetch(`${import.meta.env.VITE_API_MEANDPAY}/jabatans`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
      ]);

      const cutisJson = await cutisRes.json();
      const jabJson = await jabRes.json();

      let managedDivisions: string[] = [];
      if (jabJson.success && Array.isArray(jabJson.data)) {
        setJabatans(jabJson.data);
        managedDivisions = jabJson.data
          .filter((j: any) => j.manager?.toString() === activeUser?.id?.toString())
          .map((j: any) => j.id.toString());
      }

      if (cutisJson.success && Array.isArray(cutisJson.data)) {
        let result = cutisJson.data;

        // Exclude cuti dokter & superadmin di sisi klien sebagai safety net
        result = result.filter((item: any) => {
          const userObj = item.pemohon || item.users;
          if (userObj) {
            const adminVal = (userObj.is_admin || '').toLowerCase();
            if (['superadmin', 'super admin', 'super_admin', 'admin'].includes(adminVal)) return false;
            const jabName = (userObj.jabatan?.nama_jabatan || '').toLowerCase();
            if (jabName.includes('dokter')) return false;
          }
          return true;
        });

        // Jika bukan master dan bukan role manager/supervisor, tapi punya divisi yang dimanage, filter sesuai divisi
        if (!isMaster && !isManagerRole && managedDivisions.length > 0) {
          result = result.filter((item: any) => {
            const emp = empData.find((e: any) => e.id?.toString() === item.user_id?.toString());
            const jId = emp?.jabatan_id?.toString() || emp?.jabatan?.id?.toString();
            return managedDivisions.includes(jId);
          });
        }

        setLeaves(result);

        let filteredDisplay = [...result];
        if (filterEmployeeId) {
          filteredDisplay = filteredDisplay.filter((item: any) => item.user_id?.toString() === filterEmployeeId.toString());
        }
        if (filterStartDate) {
          filteredDisplay = filteredDisplay.filter((item: any) => {
            const startStr = item.tanggal?.split(' - ')[0];
            return startStr ? new Date(startStr) >= new Date(filterStartDate) : false;
          });
        }
        if (filterEndDate) {
          filteredDisplay = filteredDisplay.filter((item: any) => {
            const parts = item.tanggal?.split(' - ') || [];
            const endStr = parts[parts.length - 1];
            return endStr ? new Date(endStr) <= new Date(filterEndDate) : false;
          });
        }

        setDisplayedLeaves(filteredDisplay);
      } else {
        setError(cutisJson.message || 'Gagal mengambil data cuti');
      }
    } catch (err) {
      setError('Terdapat masalah saat menghubungi server.');
    } finally {
      setLoading(false);
    }
  };

  const getManagerForUser = (userId: string) => {
    const employee = employees.find(e => e.id?.toString() === userId?.toString());
    const jabId = employee?.jabatan_id || employee?.jabatan?.id;
    if (!jabId) return null;
    const jabatan = jabatans.find(j => j.id?.toString() === jabId?.toString());
    return jabatan?.manager;
  };

  const canApprove = (leave: Leave) => {
    if (!currentUser) return false;

    const roles: string[] = Array.isArray(currentUser.roles)
      ? currentUser.roles.map((r: any) => String(r).toLowerCase())
      : currentUser.role ? [String(currentUser.role).toLowerCase()] : [];

    const isCurrentUserAdmin =
      currentUser.is_admin === 'admin' ||
      currentUser.is_admin === 'superadmin' ||
      currentUser.id?.toString() === '1' ||
      roles.includes('admin') ||
      roles.includes('superadmin');

    const managerId = getManagerForUser(leave.user_id);
    const isCurrentUserManager =
      roles.includes('manager') ||
      roles.includes('supervisor') ||
      currentUser.is_supervisor === 1 ||
      currentUser.is_supervisor === true ||
      currentUser.is_admin === 'manager' ||
      (managerId && managerId?.toString() === currentUser.id?.toString());

    const status = leave.status_cuti?.toLowerCase();

    if (isCurrentUserManager) {
      // Manager can approve if Pending / Menunggu
      return status === 'pending' || status === 'menunggu';
    }

    if (isCurrentUserAdmin) {
      // Admin can approve if Pending / Menunggu or Disetujui Manager
      return status === 'pending' || status === 'menunggu' || status === 'disetujui manager';
    }

    return false;
  };

  const executeApprove = async (overrideId?: string) => {
    const targetId = overrideId || approvingId;
    if (!targetId) return;
    try {
      setIsApproving(true);
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const approverId = user.id ? String(user.id) : '1';
      const roles: string[] = Array.isArray(user.roles) ? user.roles.map((r: any) => String(r).toLowerCase()) : [];
      const isAdmin = user.is_admin === 'admin' || user.is_admin === 'superadmin' || user.id?.toString() === '1' || roles.includes('admin') || roles.includes('superadmin');

      const res = await fetch(`${import.meta.env.VITE_API_MEANDPAY}/cutis/${targetId}/approve`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_approval: String(approverId),
          status: isAdmin ? 'Diterima' : 'Disetujui Manager'
        })
      });
      const json = await res.json();
      if (json.success) {
        addToast({ type: 'success', message: 'Cuti berhasil disetujui!' });
        setApprovingId(null);
        if (detailLeave && detailLeave.id === targetId) {
          setDetailLeave({ ...detailLeave, status_cuti: isAdmin ? 'Diterima' : 'Disetujui Manager' });
        }
        fetchData();
      } else {
        addToast({ type: 'error', message: json.message || 'Gagal menyetujui cuti' });
      }
    } catch (err) {
      addToast({ type: 'error', message: 'Terdapat masalah pada server' });
    } finally {
      setIsApproving(false);
    }
  };

  const executeReject = async (overrideId?: string) => {
    const targetId = overrideId || rejectingId;
    if (!targetId) return;
    try {
      setIsRejecting(true);
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const approverId = user.id ? String(user.id) : '1';

      const res = await fetch(`${import.meta.env.VITE_API_MEANDPAY}/cutis/${targetId}/reject`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_approval: String(approverId),
          status: 'Ditolak'
        })
      });
      const json = await res.json();
      if (json.success) {
        addToast({ type: 'success', message: 'Pengajuan cuti berhasil ditolak.' });
        setRejectingId(null);
        if (detailLeave && detailLeave.id === targetId) {
          setDetailLeave({ ...detailLeave, status_cuti: 'Ditolak' });
        }
        fetchData();
      } else {
        addToast({ type: 'error', message: json.message || 'Gagal menolak cuti' });
      }
    } catch (err) {
      addToast({ type: 'error', message: 'Terdapat masalah pada server' });
    } finally {
      setIsRejecting(false);
    }
  };

  const executeDelete = async () => {
    if (!deletingId) return;
    try {
      setIsDeleting(true);
      const res = await fetch(`${import.meta.env.VITE_API_MEANDPAY}/cutis/${deletingId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const json = await res.json();
      if (json.success) {
        addToast({ type: 'success', message: 'Data cuti berhasil dihapus' });
        setDeletingId(null);
        fetchData();
      } else {
        addToast({ type: 'error', message: json.message || 'Gagal menghapus data cuti' });
      }
    } catch (err) {
      addToast({ type: 'error', message: 'Terdapat masalah pada server' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSearch = () => {
    let result = [...leaves];
    if (filterEmployeeId) {
      result = result.filter(item => item.user_id?.toString() === filterEmployeeId.toString());
    }
    if (filterStartDate) {
      result = result.filter(item => {
        const startStr = item.tanggal?.split(' - ')[0];
        return startStr ? new Date(startStr) >= new Date(filterStartDate) : false;
      });
    }
    if (filterEndDate) {
      result = result.filter(item => {
        const parts = item.tanggal?.split(' - ') || [];
        const endStr = parts[parts.length - 1];
        return endStr ? new Date(endStr) <= new Date(filterEndDate) : false;
      });
    }
    setDisplayedLeaves(result);
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const url = new URL(`${import.meta.env.VITE_API_MEANDPAY}/cutis/export`);
      if (filterEmployeeId) url.searchParams.append('user_id', filterEmployeeId);
      if (filterStartDate)  url.searchParams.append('start_date', filterStartDate);
      if (filterEndDate)    url.searchParams.append('end_date', filterEndDate);

      const res = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename[^;=\n]*=([^;\n]*)/);
      const filename = match
        ? match[1].replace(/['"]/g, '').trim()
        : `Rekap_Cuti_${new Date().toISOString().split('T')[0]}.csv`;

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);

      addToast({ type: 'success', title: 'Berhasil', message: 'File CSV berhasil diunduh.' });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Gagal Export', message: err.message || 'Terjadi kesalahan sistem.' });
    } finally {
      setIsExporting(false);
    }
  };

  const getEmployeeName = (item: Leave) => {
    return (
      item.pemohon?.name ||
      item.users?.name ||
      employees.find(e => e.id?.toString() === item.user_id?.toString())?.name ||
      '-'
    );
  };

  if (isAdding) {
    return <AddLeave onBack={() => { setIsAdding(false); fetchData(); }} />;
  }

  if (isEditing) {
    return <EditLeave leave={isEditing} onBack={() => { setIsEditing(null); fetchData(); }} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto space-y-8 pb-20"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Data Cuti Karyawan</h1>
          <p className="text-slate-500 font-medium">Review and manage employee leave requests and medical certificates.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            disabled={isExporting}
            className="flex items-center gap-2 px-6 py-4 bg-white border border-slate-200 text-slate-700 rounded-2xl text-sm font-black transition-all shadow-sm hover:bg-slate-50 active:scale-95 disabled:opacity-60"
          >
            {isExporting
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Download className="w-4 h-4 text-emerald-500" />}
            Export CSV
          </button>
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 px-8 py-4 bg-[#103552] text-white rounded-2xl text-sm font-black transition-all shadow-xl shadow-[#103552]/20 hover:bg-[#103552] active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Tambah
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/30 overflow-hidden">
        <div className="p-8 border-b border-slate-100 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="md:col-span-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block ml-1">
                Pilih Pegawai ({employees.length} Pegawai)
              </label>
              <div className="relative">
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={empSearch}
                    onChange={(e) => {
                      setEmpSearch(e.target.value);
                      setShowEmpDropdown(true);
                    }}
                    onFocus={() => setShowEmpDropdown(true)}
                    placeholder={
                      filterEmployeeId
                        ? employees.find(e => String(e.id) === String(filterEmployeeId))?.name || 'Cari pegawai...'
                        : 'Cari seluruh pegawai...'
                    }
                    className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-[#103552]/10 focus:border-[#103552] transition-all"
                  />
                  {(empSearch || filterEmployeeId) ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEmpSearch('');
                        setFilterEmployeeId('');
                        setShowEmpDropdown(false);
                        let filtered = [...leaves];
                        if (filterStartDate) {
                          filtered = filtered.filter(item => {
                            const startStr = item.tanggal?.split(' - ')[0];
                            return startStr ? new Date(startStr) >= new Date(filterStartDate) : false;
                          });
                        }
                        if (filterEndDate) {
                          filtered = filtered.filter(item => {
                            const parts = item.tanggal?.split(' - ') || [];
                            const endStr = parts[parts.length - 1];
                            return endStr ? new Date(endStr) <= new Date(filterEndDate) : false;
                          });
                        }
                        setDisplayedLeaves(filtered);
                      }}
                      className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50"
                      title="Reset pilihan pegawai"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  ) : (
                    <Search className="absolute right-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                  )}
                </div>

                {showEmpDropdown && (
                  <div
                    className="absolute z-50 w-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-64 overflow-y-auto divide-y divide-slate-50"
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <div
                      className={cn(
                        "px-4 py-2.5 text-xs font-black uppercase tracking-wider cursor-pointer transition-colors flex items-center justify-between",
                        !filterEmployeeId ? "bg-[#103552] text-white" : "text-slate-500 hover:bg-slate-50"
                      )}
                      onClick={() => {
                        setFilterEmployeeId('');
                        setEmpSearch('');
                        setShowEmpDropdown(false);
                      }}
                    >
                      <span>Semua Pegawai ({employees.length})</span>
                      {!filterEmployeeId && <Check className="w-4 h-4" />}
                    </div>
                    {employees
                      .filter(e => !empSearch || (e.name || '').toLowerCase().includes(empSearch.toLowerCase()) || (e.username || '').toLowerCase().includes(empSearch.toLowerCase()))
                      .map((emp) => {
                        const isSelected = String(emp.id) === String(filterEmployeeId);
                        return (
                          <div
                            key={emp.id}
                            className={cn(
                              "px-4 py-2.5 text-sm font-bold cursor-pointer transition-colors flex items-center justify-between",
                              isSelected ? "bg-[#E8F4F3] text-[#103552]" : "text-slate-700 hover:bg-slate-50"
                            )}
                            onClick={() => {
                              setFilterEmployeeId(String(emp.id));
                              setEmpSearch(emp.name || '');
                              setShowEmpDropdown(false);
                            }}
                          >
                            <div>
                              <p className="font-bold text-slate-900">{emp.name}</p>
                              {emp.jabatan?.nama_jabatan && (
                                <p className="text-[10px] font-semibold text-slate-400">{emp.jabatan.nama_jabatan}</p>
                              )}
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-[#103552]" />}
                          </div>
                        );
                      })
                    }
                    {employees.filter(e => !empSearch || (e.name || '').toLowerCase().includes(empSearch.toLowerCase())).length === 0 && (
                      <div className="px-4 py-4 text-xs font-bold text-slate-400 text-center">
                        Pegawai tidak ditemukan
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="md:col-span-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block ml-1">Tanggal Mulai</label>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="w-full px-6 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-[#103552]/10 focus:border-[#103552] transition-all" />
            </div>
            <div className="md:col-span-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block ml-1">Tanggal Akhir</label>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="w-full px-6 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-[#103552]/10 focus:border-[#103552] transition-all" />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleSearch}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-900 text-white rounded-2xl text-sm font-black transition-all hover:bg-slate-800 active:scale-95">
                <Search className="w-4 h-4" />
                Cari Data
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto scrollbar-hide">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="w-8 h-8 text-[#185B5A] animate-spin" />
              <p className="text-sm font-bold text-slate-400">Memuat data cuti...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center">
                <AlertCircle className="w-7 h-7 text-rose-500" />
              </div>
              <p className="text-sm font-bold text-slate-600">{error}</p>
              <button
                onClick={() => fetchData()}
                className="px-6 py-2.5 bg-[#103552] text-white rounded-xl text-sm font-bold hover:bg-[#103552] transition-all active:scale-95"
              >
                Coba Lagi
              </button>
            </div>
          ) : displayedLeaves.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-16 h-16 rounded-3xl bg-slate-50 flex items-center justify-center shadow-inner">
                <Calendar className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-sm font-bold text-slate-400">Belum ada data cuti.</p>
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="py-6 px-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-left border-b border-slate-100">No.</th>
                  <th className="py-6 px-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-left border-b border-slate-100">Nama Pegawai</th>
                  <th className="py-6 px-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-left border-b border-slate-100">Lokasi ID</th>
                  <th className="py-6 px-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-left border-b border-slate-100">Jenis</th>
                  <th className="py-6 px-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-left border-b border-slate-100">Tanggal</th>
                  <th className="py-6 px-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-left border-b border-slate-100">Alasan</th>
                  <th className="py-6 px-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center border-b border-slate-100">Lampiran</th>
                  <th className="py-6 px-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-left border-b border-slate-100">Status</th>
                  <th className="py-6 px-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right border-b border-slate-100">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {displayedLeaves.map((item, index) => {
                  const empName = getEmployeeName(item);
                  const isPdf = item.foto_cuti?.toLowerCase().includes('.pdf');
                  return (
                    <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="py-6 px-8 text-sm font-black text-slate-300 group-hover:text-slate-900 transition-colors">{(index + 1).toString().padStart(2, '0')}</td>
                      <td className="py-6 px-8 text-sm font-black text-slate-900">{empName}</td>
                      <td className="py-6 px-8 text-sm font-bold text-slate-600">{item.lokasi_id}</td>
                      <td className="py-6 px-8 text-sm font-bold text-slate-600">{item.nama_cuti}</td>
                      <td className="py-6 px-8 text-sm font-bold text-slate-600">
                        {item.tanggal?.includes('-') ? item.tanggal : new Date(item.tanggal).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </td>
                      <td className="py-6 px-8 text-sm font-bold text-slate-600 max-w-[150px] truncate" title={item.alasan_cuti}>{item.alasan_cuti}</td>
                      <td className="py-6 px-8">
                        {item.foto_cuti ? (
                          <div
                            onClick={() => setDetailLeave(item)}
                            className="cursor-pointer flex items-center justify-center mx-auto"
                            title="Klik untuk lihat detail lampiran"
                          >
                            {isPdf ? (
                              <div className="w-12 h-14 rounded-xl bg-rose-50 border border-rose-200 flex flex-col items-center justify-center text-rose-500 shadow-sm hover:scale-105 transition-transform">
                                <FileText className="w-5 h-5" />
                                <span className="text-[8px] font-black mt-0.5">PDF</span>
                              </div>
                            ) : (
                              <div className="w-12 h-14 rounded-xl bg-slate-100 overflow-hidden border border-slate-200 shadow-sm relative group/img hover:scale-105 transition-transform">
                                <img src={formatPhotoUrl(item.foto_cuti)} alt="Lampiran" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                  <Eye className="w-4 h-4 text-white" />
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-center text-sm font-bold text-slate-300">-</div>
                        )}
                      </td>
                      <td className="py-6 px-8">
                        <span className={cn(
                          "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                          item.status_cuti?.toLowerCase() === 'diterima' || item.status_cuti?.toLowerCase() === 'approved'
                            ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                            : item.status_cuti?.toLowerCase() === 'ditolak' || item.status_cuti?.toLowerCase() === 'rejected'
                            ? "bg-rose-50 text-rose-600 border border-rose-100"
                            : item.status_cuti?.toLowerCase() === 'disetujui manager'
                            ? "bg-blue-50 text-blue-600 border border-blue-100"
                            : "bg-amber-50 text-amber-600 border border-amber-100"
                        )}>
                          {item.status_cuti}
                        </span>
                      </td>
                      <td className="py-6 px-8">
                        <div className="flex items-center justify-end gap-1.5 transition-opacity">
                          {/* Tombol Detail Lampiran */}
                          <button
                            onClick={() => setDetailLeave(item)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-[#96D1C6]/15 text-[#103552] rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-[#96D1C6]/30 transition-all border border-[#96D1C6]/30"
                            title="Lihat Detail & Lampiran"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Detail
                          </button>

                          {item.status_cuti?.toLowerCase() === 'diterima' || item.status_cuti?.toLowerCase() === 'approved' ? (
                            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase tracking-widest border border-emerald-100/50">
                              <Check className="w-3.5 h-3.5" />
                              Approved
                            </span>
                          ) : (
                            <>
                              {canApprove(item) && (
                                <button
                                  onClick={() => setApprovingId(item.id)}
                                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95"
                                >
                                  Approve
                                </button>
                              )}
                              <button
                                onClick={() => setIsEditing(item)}
                                className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-[#103552] hover:text-white transition-all border border-slate-200"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => setDeletingId(item.id)}
                                className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all border border-slate-200"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* MODAL DETAIL LAMPIRAN CUTI */}
      <AnimatePresence>
        {detailLeave && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden max-h-[90vh] flex flex-col"
            >
              {/* Header Modal */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#96D1C6]/20 flex items-center justify-center text-[#103552]">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">Detail Pengajuan Cuti</h3>
                    <p className="text-xs text-slate-400 font-bold">
                      {getEmployeeName(detailLeave)} • ID #{detailLeave.id}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest",
                    detailLeave.status_cuti?.toLowerCase() === 'diterima' || detailLeave.status_cuti?.toLowerCase() === 'approved'
                      ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                      : detailLeave.status_cuti?.toLowerCase() === 'ditolak' || detailLeave.status_cuti?.toLowerCase() === 'rejected'
                      ? "bg-rose-50 text-rose-600 border border-rose-100"
                      : detailLeave.status_cuti?.toLowerCase() === 'disetujui manager'
                      ? "bg-blue-50 text-blue-600 border border-blue-100"
                      : "bg-amber-50 text-amber-600 border border-amber-100"
                  )}>
                    {detailLeave.status_cuti}
                  </span>
                  <button
                    onClick={() => setDetailLeave(null)}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Body Modal */}
              <div className="p-6 overflow-y-auto space-y-6">
                {/* Info Pegawai & Jenis Cuti */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nama Pegawai</p>
                    <p className="text-sm font-black text-slate-900">{getEmployeeName(detailLeave)}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Jenis Cuti</p>
                    <p className="text-sm font-black text-[#103552]">{detailLeave.nama_cuti}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tanggal</p>
                    <p className="text-sm font-black text-slate-900">{detailLeave.tanggal}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 col-span-2 md:col-span-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Alasan Cuti</p>
                    <p className="text-sm font-medium text-slate-700 leading-relaxed">{detailLeave.alasan_cuti || '-'}</p>
                  </div>
                </div>

                {/* Bagian Lampiran / Bukti */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-[#103552]" />
                      Lampiran / Berkas Bukti Cuti
                    </h4>
                    {detailLeave.foto_cuti && (
                      <a
                        href={formatPhotoUrl(detailLeave.foto_cuti)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#103552] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#103552]/90 transition-all shadow-sm"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Buka Tab Baru
                      </a>
                    )}
                  </div>

                  {detailLeave.foto_cuti ? (
                    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50 p-4 flex flex-col items-center justify-center">
                      {detailLeave.foto_cuti.toLowerCase().includes('.pdf') ? (
                        <div className="w-full space-y-4">
                          <div className="w-full h-80 rounded-xl overflow-hidden border border-slate-200 bg-white">
                            <iframe
                              src={formatPhotoUrl(detailLeave.foto_cuti)}
                              className="w-full h-full"
                              title="Lampiran Cuti PDF"
                            />
                          </div>
                          <div className="flex justify-center">
                            <a
                              href={formatPhotoUrl(detailLeave.foto_cuti)}
                              download
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#103552] text-white rounded-xl text-xs font-bold shadow-md hover:bg-[#103552]/90"
                            >
                              <Download className="w-4 h-4" /> Unduh Dokumen PDF
                            </a>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3 w-full flex flex-col items-center">
                          <div className="max-h-96 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm flex items-center justify-center w-full">
                            <img
                              src={formatPhotoUrl(detailLeave.foto_cuti)}
                              alt="Bukti Cuti"
                              className="max-h-96 max-w-full object-contain"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <a
                            href={formatPhotoUrl(detailLeave.foto_cuti)}
                            download
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                          >
                            <Download className="w-3.5 h-3.5" /> Unduh Foto
                          </a>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-8 border border-dashed border-slate-200 rounded-2xl text-center bg-slate-50/50">
                      <ImageIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-400">Tidak ada lampiran berkas atau foto yang diunggah.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Modal: Actions */}
              <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setDetailLeave(null)}
                  className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
                >
                  Tutup
                </button>

                {canApprove(detailLeave) && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isRejecting || isApproving}
                      onClick={() => executeReject(detailLeave.id)}
                      className="flex items-center gap-1.5 px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md active:scale-95 disabled:opacity-60"
                    >
                      {isRejecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                      Tolak
                    </button>
                    <button
                      type="button"
                      disabled={isApproving || isRejecting}
                      onClick={() => executeApprove(detailLeave.id)}
                      className="flex items-center gap-1.5 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md shadow-emerald-500/20 active:scale-95 disabled:opacity-60"
                    >
                      {isApproving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      Setujui
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deletingId && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100"
            >
              <div className="flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-8 h-8 text-rose-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Hapus Data Cuti?</h3>
                  <p className="text-sm text-slate-500 mt-1">Data cuti yang dihapus tidak dapat dikembalikan lagi.</p>
                </div>
                <div className="flex gap-3 w-full mt-2">
                  <button
                    onClick={() => setDeletingId(null)}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    onClick={executeDelete}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-white bg-rose-500 hover:bg-rose-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ya, Hapus'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {approvingId && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100"
            >
              <div className="flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                  <CheckCircle className="w-8 h-8 text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Setujui Cuti?</h3>
                  <p className="text-sm text-slate-500 mt-1">Sisa cuti pegawai akan dikurangi sesuai ketentuan setelah disetujui.</p>
                </div>
                <div className="flex gap-3 w-full mt-2">
                  <button
                    onClick={() => setApprovingId(null)}
                    disabled={isApproving}
                    className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    onClick={() => executeApprove()}
                    disabled={isApproving}
                    className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isApproving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ya, Setujui'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
