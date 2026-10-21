import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Save, X, Calendar, User, FileText, Image as ImageIcon, Loader2, Download, Search, Check, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { Card, SectionTitle, FormInput, FormSelect, Field, Toast } from './common/FormUI';

interface AddLeaveProps {
    onBack: () => void;
}

export function AddLeave({ onBack }: AddLeaveProps) {
    const [form, setForm] = useState({ user_id: '', nama_cuti: '', tanggal_mulai: '', tanggal_akhir: '', alasan_cuti: '' });
    const [photo, setPhoto] = useState<{ preview: string | null; file: File | null; isPdf?: boolean; fileName?: string }>({ preview: null, file: null });
    const [employees, setEmployees] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingEmployees, setLoadingEmployees] = useState(false);
    const [templateUrl, setTemplateUrl] = useState<string | null>(null);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Searchable employee dropdown state
    const [isEmpDropdownOpen, setIsEmpDropdownOpen] = useState(false);
    const [empSearch, setEmpSearch] = useState('');
    const empDropdownRef = useRef<HTMLDivElement>(null);

    const getFileUrl = (path: string | null) => {
        if (!path) return null;
        if (path.startsWith('http') || path.startsWith('blob:')) return path;
        let cleanPath = path.replace(/^\//, '');
        if (cleanPath.startsWith('uploads/')) cleanPath = cleanPath.slice(8);
        return `${import.meta.env.VITE_API_MEANDPAY_DATA}/uploads/${cleanPath}`;
    };

    useEffect(() => {
        const fetchAllEmployees = async () => {
            setLoadingEmployees(true);
            try {
                let res = await fetch(`${import.meta.env.VITE_API_MEANDPAY}/users/all`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                if (!res.ok) {
                    res = await fetch(`${import.meta.env.VITE_API_MEANDPAY}/users?limit=1000`, {
                        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                    });
                }
                const j = await res.json();
                const list = Array.isArray(j.data) ? j.data : (j.data?.users || []);
                const mapped = list.map((e: any) => ({
                    value: String(e.id),
                    label: e.name || e.username || `User #${e.id}`,
                    sublabel: e.jabatan?.nama_jabatan ? `${e.jabatan.nama_jabatan}` : '',
                    data: e
                })).sort((a: any, b: any) => a.label.localeCompare(b.label));
                setEmployees(mapped);
            } catch (err) {
                console.error('Failed to load employees:', err);
            } finally {
                setLoadingEmployees(false);
            }
        };

        fetchAllEmployees();

        fetch(`${import.meta.env.VITE_API_MEANDPAY}/settings/1`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
            .then(r => r.json())
            .then(j => {
                const item = Array.isArray(j.data) ? j.data[0] : j.data;
                if (item?.file_form_cuti) setTemplateUrl(getFileUrl(item.file_form_cuti));
            })
            .catch(() => { });
    }, []);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (empDropdownRef.current && !empDropdownRef.current.contains(e.target as Node)) {
                setIsEmpDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredEmployees = useMemo(() => {
        if (!empSearch.trim()) return employees;
        const q = empSearch.toLowerCase();
        return employees.filter(e => 
            e.label.toLowerCase().includes(q) || 
            (e.sublabel && e.sublabel.toLowerCase().includes(q))
        );
    }, [employees, empSearch]);

    const selectedEmp = employees.find(e => e.value === form.user_id)?.data;
    const selectedEmpObj = employees.find(e => e.value === form.user_id);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.user_id || !form.nama_cuti || !form.tanggal_mulai || !form.tanggal_akhir || !form.alasan_cuti) {
            return setToast({ type: 'error', message: 'Lengkapi semua form pengajuan cuti' });
        }
        if (!selectedEmp?.lokasi_id) {
            return setToast({ type: 'error', message: 'Karyawan yang dipilih belum memiliki lokasi kantor' });
        }

        setLoading(true);
        try {
            const fd = new FormData();
            Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)));
            fd.append('lokasi_id', selectedEmp.lokasi_id);
            if (photo.file) fd.append('foto_cuti', photo.file);

            const res = await fetch(`${import.meta.env.VITE_API_MEANDPAY}/cutis`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: fd
            });
            const j = await res.json();
            if (j.success || res.ok) {
                setToast({ type: 'success', message: 'Pengajuan cuti berhasil dikirim' });
                setTimeout(onBack, 1500);
            } else {
                throw new Error(j.message || 'Gagal mengajukan cuti');
            }
        } catch (err: any) {
            setToast({ type: 'error', message: err.message || 'Gagal mengirim pengajuan cuti' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto pb-20 space-y-6">
            <div className="flex gap-4 items-center">
                <button onClick={onBack} className="p-2.5 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-[#96D1C6] transition-all">
                    <ArrowLeft className="w-5 h-5 text-slate-600" />
                </button>
                <div>
                    <h1 className="text-xl font-bold text-slate-900">Formulir Cuti</h1>
                    <p className="text-sm text-slate-400">Ajukan cuti atau izin pegawai</p>
                </div>
            </div>

            <Card className="space-y-6">
                {templateUrl && (
                    <div className="flex items-center justify-between p-4 bg-[#96D1C6]/20 border border-[#96D1C6]/30 rounded-2xl mb-2">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-[#103552] shadow-sm">
                                <FileText className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-xs font-black text-[#103552] uppercase tracking-tight">Template Formulir Cuti</p>
                                <p className="text-[10px] font-bold text-[#96D1C6]">Unduh & lengkapi sebelum mengunggah</p>
                            </div>
                        </div>
                        <a
                            href={templateUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 bg-[#103552] text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-[#96D1C6]/50 active:scale-95 transition-all"
                        >
                            <Download className="w-3.5 h-3.5" />
                            Unduh File
                        </a>
                    </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Searchable Pegawai Selector */}
                        <div className="space-y-1.5" ref={empDropdownRef}>
                            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                                Pegawai <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setIsEmpDropdownOpen(prev => !prev)}
                                    className="w-full py-2.5 pl-10 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-left text-sm text-slate-700 flex items-center justify-between focus:outline-none focus:border-[#103552]/60 focus:ring-4 focus:ring-[#96D1C6]/20 transition-all cursor-pointer"
                                >
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                    <span className={selectedEmpObj ? 'font-semibold text-slate-900 truncate' : 'text-slate-400'}>
                                        {loadingEmployees ? 'Memuat seluruh pegawai...' : (selectedEmpObj ? selectedEmpObj.label : 'Pilih Pegawai (Cari Nama / Jabatan)')}
                                    </span>
                                    <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                </button>

                                {isEmpDropdownOpen && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden">
                                        <div className="p-2 border-b border-slate-100 bg-slate-50">
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                <input
                                                    type="text"
                                                    autoFocus
                                                    placeholder="Cari nama atau jabatan..."
                                                    value={empSearch}
                                                    onChange={e => setEmpSearch(e.target.value)}
                                                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#103552]"
                                                />
                                            </div>
                                        </div>
                                        <div className="max-h-60 overflow-y-auto divide-y divide-slate-50">
                                            {filteredEmployees.length === 0 ? (
                                                <div className="p-4 text-center text-xs text-slate-400">Pegawai tidak ditemukan</div>
                                            ) : (
                                                filteredEmployees.map(emp => {
                                                    const isSelected = form.user_id === emp.value;
                                                    return (
                                                        <button
                                                            key={emp.value}
                                                            type="button"
                                                            onClick={() => {
                                                                setForm({ ...form, user_id: emp.value });
                                                                setIsEmpDropdownOpen(false);
                                                                setEmpSearch('');
                                                            }}
                                                            className={cn(
                                                                "w-full text-left px-4 py-2.5 flex items-center justify-between text-xs transition-colors hover:bg-slate-50",
                                                                isSelected && "bg-[#103552]/5 text-[#103552] font-bold"
                                                            )}
                                                        >
                                                            <div>
                                                                <p className="font-semibold text-slate-800">{emp.label}</p>
                                                                {emp.sublabel && <p className="text-[10px] text-slate-400">{emp.sublabel}</p>}
                                                            </div>
                                                            {isSelected && <Check className="w-4 h-4 text-[#103552]" />}
                                                        </button>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <FormSelect
                            label="Jenis Cuti"
                            options={['Cuti Tahunan', 'Cuti Melahirkan', 'Cuti Keluarga Meninggal', 'Cuti Menikah', 'Off Dengan Surat Dokter', 'Lain-Lain (Unpaid Leave)', 'Izin Datang Terlambat', 'Izin Pulang Cepat']}
                            value={form.nama_cuti}
                            onChange={(n: any, v: any) => setForm({ ...form, nama_cuti: v })}
                            icon={FileText}
                            placeholder="Pilih Cuti"
                            required
                        />
                        <FormInput
                            label="Mulai"
                            type="date"
                            icon={Calendar}
                            value={form.tanggal_mulai}
                            onChange={(n: any, v: any) => setForm({ ...form, tanggal_mulai: v })}
                            required
                        />
                        <FormInput
                            label="Sampai"
                            type="date"
                            icon={Calendar}
                            value={form.tanggal_akhir}
                            onChange={(n: any, v: any) => setForm({ ...form, tanggal_akhir: v })}
                            required
                        />
                    </div>

                    <Field label="Unggah Lampiran / Foto Bukti">
                        <div className="flex items-center gap-6 p-4 border-2 border-dashed rounded-2xl bg-slate-50 border-slate-200">
                            <div className="relative size-20 border bg-white rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
                                {photo.preview ? (
                                    photo.isPdf ? (
                                        <div className="flex flex-col items-center justify-center p-2 text-center text-rose-500">
                                            <FileText className="w-8 h-8" />
                                            <span className="text-[9px] font-bold uppercase">PDF</span>
                                        </div>
                                    ) : (
                                        <img src={photo.preview} className="size-full object-cover" alt="Preview" />
                                    )
                                ) : (
                                    <ImageIcon className="text-slate-300 w-8 h-8" />
                                )}
                                <input
                                    type="file"
                                    accept="image/*,.pdf"
                                    onChange={e => {
                                        const f = e.target.files?.[0];
                                        if (f) {
                                            const isPdf = f.type === 'application/pdf' || f.name.endsWith('.pdf');
                                            if (isPdf) {
                                                setPhoto({ file: f, preview: 'pdf', isPdf: true, fileName: f.name });
                                            } else {
                                                const r = new FileReader();
                                                r.onload = () => setPhoto({ file: f, preview: r.result as string, isPdf: false, fileName: f.name });
                                                r.readAsDataURL(f);
                                            }
                                        }
                                    }}
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                />
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-semibold text-slate-700">
                                    {photo.fileName ? photo.fileName : 'Klik untuk memilih file foto atau dokumen PDF'}
                                </p>
                                <p className="text-[11px] text-slate-400">Lampiran bukti surat dokter, foto, atau formulir (opsional)</p>
                            </div>
                        </div>
                    </Field>

                    <Field label="Alasan Cuti" required>
                        <textarea
                            rows={3}
                            value={form.alasan_cuti}
                            onChange={e => setForm({ ...form, alasan_cuti: e.target.value })}
                            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#103552]/60 focus:ring-4 focus:ring-[#96D1C6]/20 transition-all text-sm"
                            placeholder="Tuliskan keterangan / alasan pengajuan cuti atau izin..."
                        />
                    </Field>

                    <div className="flex justify-end gap-3 pt-6 border-t font-bold">
                        <button type="button" onClick={onBack} className="px-6 py-3 text-slate-500 hover:text-slate-800 transition-colors">
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-8 py-3 bg-[#103552] text-white rounded-xl shadow-lg flex items-center gap-2 hover:bg-[#103552]/90 active:scale-95 transition-all"
                        >
                            {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />} Simpan
                        </button>
                    </div>
                </form>
            </Card>
            <AnimatePresence>{toast && <Toast {...toast} onClose={() => setToast(null)} />}</AnimatePresence>
        </motion.div>
    );
}
