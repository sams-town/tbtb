import React from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCircle2,
  Clock,
  MessageSquare,
  UserPlus,
  AlertCircle,
  MoreVertical,
  Search,
  Filter,
  Trash2,
  CheckCheck,
  ChevronLeft,
  Calendar,
  Zap,
  Navigation,
  Fingerprint,
  Loader2,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useToast } from './Toast';

const BASE_URL = import.meta.env.VITE_API_MEANDPAY;

interface Notification {
  id: string;
  type: 'request' | 'system' | 'mention' | 'alert';
  title: string;
  message: string;
  time: string;
  user?: {
    name: string;
    avatar: string;
  };
  unread: boolean;
  action?: string;
  apiData?: any;
}

export function MobileNotificationsPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = React.useState<'all' | 'unread'>('all');
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [approvingId, setApprovingId] = React.useState<string | null>(null);
  const [rejectingId, setRejectingId]   = React.useState<string | null>(null);

  React.useEffect(() => {
    fetchNotifications();
    // Re-fetch saat halaman mendapat fokus kembali (setelah back dari detail)
    const handleFocus = () => fetchNotifications();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const res = await fetch(`${import.meta.env.VITE_API_MEANDPAY}/notifications?notifiable_id=${user.id}&limit=50`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const json = await res.json();
      if (json.success) {
        const transformed: Notification[] = json.data.map((item: any) => {
          let parsedData: any = {};
          try {
            parsedData = typeof item.data === 'string' ? JSON.parse(item.data) : item.data;
          } catch (e) {
            console.error('Failed to parse notification data', e);
          }

          const isUnread = !item.read_at;
          const fromName = parsedData.from || 'System';

          const fotoKaryawan = item.user?.foto_karyawan;
          const avatarUrl = fotoKaryawan
            ? fotoKaryawan
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(fromName)}&background=random`;

          return {
            id: item.id,
            type: determineType(parsedData.message),
            title: determineTitle(parsedData.message, fromName),
            message: parsedData.message || 'You have a new notification',
            time: item.created_at ? new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-',
            user: {
              name: fromName,
              avatar: avatarUrl
            },
            unread: isUnread,
            action: parsedData.action,
            apiData: item
          };
        });
        setNotifications(transformed);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const determineType = (text: string = ''): Notification['type'] => {
    const lower = text.toLowerCase();
    if (lower.includes('kontrak') || lower.includes('pkwt')) return 'alert';
    if (lower.includes('approval') || lower.includes('pengajuan') || lower.includes('mengajukan')) return 'request';
    if (lower.includes('diterima') || lower.includes('ditolak') || lower.includes('approve')) return 'system';
    return 'mention';
  };

  const determineTitle = (text: string = '', from: string): string => {
    const lower = text.toLowerCase();
    if (lower.includes('kontrak') || lower.includes('pkwt')) return 'Pemberitahuan Kontrak';
    if (lower.includes('sakit')) return 'Pemberitahuan Sakit';
    if (lower.includes('izin masuk')) return 'Pemberitahuan Izin Masuk';
    if (lower.includes('izin telat')) return 'Pemberitahuan Izin Telat';
    if (lower.includes('pulang cepat')) return 'Pemberitahuan Izin Pulang Cepat';
    if (lower.includes('cuti')) return 'Pemberitahuan Cuti';
    if (lower.includes('lembur')) return 'Pemberitahuan Lembur';
    if (lower.includes('lokasi')) return 'Pemberitahuan Lokasi';
    return `Pemberitahuan dari ${from}`;
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await fetch(`${import.meta.env.VITE_API_MEANDPAY}/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, unread: false, apiData: { ...n.apiData, read_at: new Date().toISOString() } } : n));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(n => n.unread);
      await Promise.all(unreadNotifications.map(n =>
        fetch(`${import.meta.env.VITE_API_MEANDPAY}/notifications/${n.id}/read`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
      ));
      setNotifications(prev => prev.map(n => ({ ...n, unread: false, apiData: { ...n.apiData, read_at: new Date().toISOString() } })));
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Hapus semua notifikasi?')) return;
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const res = await fetch(`${import.meta.env.VITE_API_MEANDPAY}/notifications/clear?notifiable_id=${user.id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const json = await res.json();
      if (json.success) {
        setNotifications([]);
      }
    } catch (err) {
      console.error('Error clearing notifications:', err);
    }
  };

  // ── Detect entity (lembur/cuti/kasbon) dari data notifikasi ──────────────
  const detectEntity = (notif: Notification) => {
    let parsed: any = {};
    try {
      parsed = typeof notif.apiData?.data === 'string'
        ? JSON.parse(notif.apiData.data)
        : notif.apiData?.data || {};
    } catch (_) {}

    const msg = notif.message?.toLowerCase() || '';
    if (parsed.lembur_id || parsed.overtime_id || msg.includes('lembur')) {
      return { type: 'lembur', id: parsed.lembur_id || parsed.overtime_id };
    }
    if (parsed.cuti_id || parsed.leave_id || msg.includes('cuti') || msg.includes('izin')) {
      return { type: 'cuti', id: parsed.cuti_id || parsed.leave_id };
    }
    if (parsed.kasbon_id || msg.includes('kasbon')) {
      return { type: 'kasbon', id: parsed.kasbon_id };
    }
    return null;
  };

  const isPengajuan = (notif: Notification) => {
    const msg  = notif.message?.toLowerCase() || '';
    // Cek dari field type notifikasi (dari DB: 'Pengajuan Lembur', 'Pengajuan Cuti', dll)
    const tipe = (notif.apiData?.type || '').toLowerCase();
    return tipe.includes('pengajuan') ||
           msg.includes('mengajukan') ||
           msg.includes('pengajuan') ||
           msg.includes('permohonan');
  };

  const handleApprove = async (notif: Notification) => {
    const entity = detectEntity(notif);
    if (!entity?.id) {
      addToast({ type: 'error', title: 'Error', message: 'ID pengajuan tidak ditemukan.' });
      return;
    }
    const managerId = JSON.parse(localStorage.getItem('user') || '{}').id;
    setApprovingId(notif.id);
    try {
      let res: Response;
      if (entity.type === 'lembur') {
        res = await fetch(`${BASE_URL}/lemburs/${entity.id}/approve`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: JSON.stringify({ approved_by: managerId }),
        });
      } else if (entity.type === 'cuti') {
        res = await fetch(`${BASE_URL}/cutis/${entity.id}/approve`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: JSON.stringify({ user_approval: managerId }),
        });
      } else {
        res = await fetch(`${BASE_URL}/kasbons/${entity.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: JSON.stringify({ status: 'APPROVED' }),
        });
      }
      const json = await res.json();
      if (json.success) {
        addToast({ type: 'success', title: 'Disetujui', message: 'Pengajuan berhasil disetujui.' });
        handleMarkAsRead(notif.id);
        fetchNotifications();
      } else {
        addToast({ type: 'error', title: 'Gagal', message: json.message || 'Gagal menyetujui.' });
      }
    } catch (e: any) {
      addToast({ type: 'error', title: 'Error', message: e.message });
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (notif: Notification) => {
    const entity = detectEntity(notif);
    if (!entity?.id) {
      addToast({ type: 'error', title: 'Error', message: 'ID pengajuan tidak ditemukan.' });
      return;
    }
    const managerId = JSON.parse(localStorage.getItem('user') || '{}').id;
    setRejectingId(notif.id);
    try {
      let res: Response;
      if (entity.type === 'lembur') {
        res = await fetch(`${BASE_URL}/lemburs/${entity.id}/approve`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: JSON.stringify({ approved_by: managerId, status: 'Rejected' }),
        });
      } else if (entity.type === 'cuti') {
        res = await fetch(`${BASE_URL}/cutis/${entity.id}/approve`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: JSON.stringify({ user_approval: managerId, status: 'Ditolak' }),
        });
      } else {
        res = await fetch(`${BASE_URL}/kasbons/${entity.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: JSON.stringify({ status: 'REJECTED' }),
        });
      }
      const json = await res.json();
      if (json.success) {
        addToast({ type: 'success', title: 'Ditolak', message: 'Pengajuan berhasil ditolak.' });
        handleMarkAsRead(notif.id);
        fetchNotifications();
      } else {
        addToast({ type: 'error', title: 'Gagal', message: json.message || 'Gagal menolak.' });
      }
    } catch (e: any) {
      addToast({ type: 'error', title: 'Error', message: e.message });
    } finally {
      setRejectingId(null);
    }
  };

  const handleViewDetail = (notification: Notification) => {
    if (notification.unread) {
      handleMarkAsRead(notification.id);
    }
    
    const msg = notification.message?.toLowerCase();
    if (notification.type === 'alert' || msg.includes('kontrak') || msg.includes('pkwt')) {
      navigate('/beranda');
      return;
    }

    let action = notification.action;
    let userId = '';

    if (!action && msg) {
      let parsedData: any = {};
      try {
        parsedData = typeof notification.apiData?.data === 'string'
          ? JSON.parse(notification.apiData.data)
          : notification.apiData?.data;
      } catch (e) {}
      userId = parsedData?.user_id || '';

      if (msg.includes('cuti') || msg.includes('izin')) {
        action = `leave?user_id=${userId}`;
      } else if (msg.includes('absen') || msg.includes('absensi')) {
        action = `attendance?user_id=${userId}`;
      } else if (msg.includes('lembur')) {
        action = `overtime-data?user_id=${userId}`;
      } else if (msg.includes('dinas')) {
        action = `data-dinas?user_id=${userId}`;
      }
    }

    if (action) {
      const actionLower = action.toLowerCase();
      if (actionLower.includes('cuti') || actionLower.includes('leave')) {
        navigate('/leave', { state: { userId } });
      } else if (actionLower.includes('absensi') || actionLower.includes('absen') || actionLower.includes('attendance')) {
        navigate('/attendance', { state: { userId } });
      } else if (actionLower.includes('lembur') || actionLower.includes('overtime')) {
        navigate('/overtime-data', { state: { userId } });
      } else if (actionLower.includes('dinas')) {
        navigate('/data-dinas', { state: { userId } });
      } else {
        navigate('/beranda');
      }
    }
  };

  const filteredNotifications = notifications.filter(n => 
    activeTab === 'all' || (activeTab === 'unread' && n.unread)
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* ─── HEADER ─── */}
      <div className="bg-gradient-to-br from-[#103552] to-[#185B5A] pt-14 pb-8 px-6 sticky top-0 z-[100] overflow-hidden shadow-lg">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
        <div className="relative z-10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/beranda')}
              className="w-11 h-11 bg-white/15 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 active:scale-90 transition-all"
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
            <div>
              <p className="text-white/50 text-[10px] font-black uppercase tracking-widest mb-0.5">Informasi</p>
              <h2 className="text-2xl font-black text-white tracking-tight">Notifikasi</h2>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={handleMarkAllAsRead}
              className="w-11 h-11 bg-white/15 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 active:scale-90 transition-all"
              title="Tandai Semua Terbaca"
            >
              <CheckCheck className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={handleClearAll}
              className="w-11 h-11 bg-white/15 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 active:scale-90 transition-all text-white/80 hover:text-white"
              title="Hapus Semua Notifikasi"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* ─── TABS ─── */}
      <div className="px-6 py-4 bg-white border-b border-slate-100 flex gap-4 sticky top-[124px] z-[90]">
        <button 
          onClick={() => setActiveTab('all')}
          className={cn(
            "flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all",
            activeTab === 'all' ? "bg-[#103552] text-white shadow-lg shadow-[#96D1C6]/50" : "bg-slate-50 text-slate-400"
          )}
        >
          Semua {notifications.length > 0 && `(${notifications.length})`}
        </button>
        <button 
          onClick={() => setActiveTab('unread')}
          className={cn(
            "flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all",
            activeTab === 'unread' ? "bg-[#103552] text-white shadow-lg shadow-[#96D1C6]/50" : "bg-slate-50 text-slate-400"
          )}
        >
          Belum Dibaca {notifications.filter(n => n.unread).length > 0 && `(${notifications.filter(n => n.unread).length})`}
        </button>
      </div>

      {/* ─── LIST ─── */}
      <div className="px-5 py-6 pb-32">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-4 border-[#103552]/20 border-t-[#103552] rounded-full animate-spin" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Memuat...</p>
          </div>
        ) : filteredNotifications.length > 0 ? (
          <div className="space-y-4">
            {filteredNotifications.map((notif, i) => (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => handleViewDetail(notif)}
                className={cn(
                  "p-5 rounded-[2rem] border transition-all active:scale-[0.98] relative",
                  notif.unread 
                    ? "bg-white border-[#96D1C6]/30 shadow-xl shadow-[#103552]/20/5" 
                    : "bg-slate-50/50 border-slate-100"
                )}
              >
                {notif.unread && (
                  <div className="absolute top-6 left-2 w-1.5 h-1.5 bg-[#103552] rounded-full" />
                )}
                
                <div className="flex gap-4">
                  <div className="relative shrink-0">
                    <img 
                      src={notif.user?.avatar} 
                      className="w-12 h-12 rounded-2xl object-cover shadow-md"
                      alt="avatar"
                      referrerPolicy="no-referrer"
                    />
                    <div className={cn(
                      "absolute -bottom-1 -right-1 w-6 h-6 rounded-lg flex items-center justify-center border-2 border-white shadow-sm",
                      getIconBg(notif.type)
                    )}>
                      {getIcon(notif.type, "w-3 h-3 text-white")}
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className={cn(
                        "text-sm font-black tracking-tight truncate",
                        notif.unread ? "text-slate-900" : "text-slate-500"
                      )}>
                        {notif.title}
                      </h4>
                      <span className="text-[9px] font-bold text-slate-400 whitespace-nowrap ml-2">
                        {notif.time}
                      </span>
                    </div>
                    <p className={cn(
                      "text-xs font-medium leading-relaxed line-clamp-2",
                      notif.unread ? "text-slate-600" : "text-slate-400"
                    )}>
                      {notif.message}
                    </p>
                  </div>
                </div>

                {(notif.action || notif.type === 'alert' || notif.type === 'request' || notif.message?.toLowerCase().includes('kontrak') || notif.message?.toLowerCase().includes('pkwt') || notif.message?.toLowerCase().includes('cuti') || notif.message?.toLowerCase().includes('lembur') || notif.message?.toLowerCase().includes('izin')) && (
                  <div className="mt-4 flex gap-2 flex-wrap justify-end">
                    {/* Tombol Setujui & Tolak — hanya untuk pengajuan */}
                    {isPengajuan(notif) && (
                      <>
                        <button
                          disabled={approvingId === notif.id || rejectingId === notif.id}
                          onClick={(e) => { e.stopPropagation(); handleApprove(notif); }}
                          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all active:scale-95 disabled:opacity-50"
                        >
                          {approvingId === notif.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <ThumbsUp className="w-3 h-3" />}
                          Setujui
                        </button>
                        <button
                          disabled={approvingId === notif.id || rejectingId === notif.id}
                          onClick={(e) => { e.stopPropagation(); handleReject(notif); }}
                          className="flex items-center gap-1.5 px-4 py-2 bg-rose-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 transition-all active:scale-95 disabled:opacity-50"
                        >
                          {rejectingId === notif.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <ThumbsDown className="w-3 h-3" />}
                          Tolak
                        </button>
                      </>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleViewDetail(notif); }}
                      className="px-5 py-2.5 bg-[#96D1C6]/20 text-[#103552] rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#96D1C6]/30 transition-all"
                    >
                      Lihat Detail
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
              <Bell className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-lg font-black text-slate-800 tracking-tight">Tidak ada notifikasi</h3>
            <p className="text-xs font-bold text-slate-400 mt-2 max-w-[200px]">Semua informasi akan muncul di sini saat tersedia.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function getIcon(type: Notification['type'], className = 'w-3 h-3') {
  switch (type) {
    case 'request': return <UserPlus className={className} />;
    case 'mention': return <MessageSquare className={className} />;
    case 'system': return <Clock className={className} />;
    case 'alert': return <AlertCircle className={className} />;
    default: return <Bell className={className} />;
  }
}

function getIconBg(type: Notification['type']) {
  switch (type) {
    case 'request': return 'bg-emerald-500';
    case 'mention': return 'bg-[#103552]';
    case 'system': return 'bg-amber-500';
    case 'alert': return 'bg-rose-500';
    default: return 'bg-slate-500';
  }
}
