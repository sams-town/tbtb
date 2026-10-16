import React from 'react';
import { motion } from 'motion/react';
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
  Loader2,
  XCircle,
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

interface NotificationsPageProps {
  onNavigate?: (page: string, filters?: Record<string, string>) => void;
  onRefreshCount?: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseNotifData(apiData: any): any {
  try {
    return typeof apiData?.data === 'string' ? JSON.parse(apiData.data) : (apiData?.data ?? {});
  } catch {
    return {};
  }
}

/**
 * Cek apakah notifikasi ini adalah pengajuan yang bisa di-approve/tolak.
 * True jika: type === 'request' ATAU message mengandung kata kunci pengajuan.
 */
function isPengajuan(notif: Notification): boolean {
  const msg = notif.message?.toLowerCase() ?? '';
  return (
    notif.type === 'request' ||
    msg.includes('mengajukan') ||
    msg.includes('pengajuan') ||
    msg.includes('permohonan')
  );
}

/**
 * Deteksi entitas pengajuan dan kembalikan { entity, id }.
 * entity: 'lembur' | 'cuti' | 'kasbon' | null
 */
function detectEntity(notif: Notification): { entity: 'lembur' | 'cuti' | 'kasbon' | null; id: string | null } {
  const data = parseNotifData(notif.apiData);
  const msg  = notif.message?.toLowerCase() ?? '';

  // Coba ambil ID dari parsed data
  const lemburId = data?.lembur_id ?? data?.overtime_id ?? null;
  const cutiId   = data?.cuti_id   ?? data?.leave_id    ?? null;
  const kasbonId = data?.kasbon_id ?? null;

  if (lemburId || msg.includes('lembur') || msg.includes('overtime')) {
    return { entity: 'lembur', id: lemburId ? String(lemburId) : null };
  }
  if (cutiId || msg.includes('cuti') || msg.includes('izin')) {
    return { entity: 'cuti', id: cutiId ? String(cutiId) : null };
  }
  if (kasbonId || msg.includes('kasbon')) {
    return { entity: 'kasbon', id: kasbonId ? String(kasbonId) : null };
  }
  return { entity: null, id: null };
}

// ── Main Component ────────────────────────────────────────────────────────────

export function NotificationsPage({ onNavigate, onRefreshCount }: NotificationsPageProps) {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = React.useState<'all' | 'unread' | 'requests'>('all');
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [loading, setLoading] = React.useState(true);
  // Map notif.id → 'approving' | 'rejecting' | null
  const [actionLoading, setActionLoading] = React.useState<Record<string, 'approving' | 'rejecting' | null>>({});

  React.useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const res = await fetch(`${BASE_URL}/notifications?notifiable_id=${user.id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const json = await res.json();
      if (json.success) {
        const transformed: Notification[] = json.data.map((item: any) => {
          let parsedData: any = {};
          try {
            parsedData = typeof item.data === 'string' ? JSON.parse(item.data) : item.data;
          } catch { /* ignore */ }

          const isUnread    = !item.read_at;
          const fromName    = parsedData.from || 'System';
          const fotoKaryawan= item.user?.foto_karyawan;
          const avatarUrl   = fotoKaryawan
            ? fotoKaryawan
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(fromName)}&background=random`;

          return {
            id: item.id,
            type: determineType(parsedData.message),
            title: determineTitle(parsedData.message, fromName),
            message: parsedData.message || 'You have a new notification',
            time: item.created_at
              ? new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
              : '-',
            user: { name: fromName, avatar: avatarUrl },
            unread: isUnread,
            action: parsedData.action,
            apiData: item,
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
    if (lower.includes('approval') || lower.includes('pengajuan') || lower.includes('mengajukan') || lower.includes('permohonan')) return 'request';
    if (lower.includes('diterima') || lower.includes('ditolak') || lower.includes('approve')) return 'system';
    return 'mention';
  };

  const determineTitle = (text: string = '', from: string): string => {
    const lower = text.toLowerCase();
    if (lower.includes('kontrak') || lower.includes('pkwt')) return 'Pemberitahuan Kontrak';
    if (lower.includes('sakit'))          return 'Pemberitahuan Sakit';
    if (lower.includes('izin masuk'))     return 'Pemberitahuan Izin Masuk';
    if (lower.includes('izin telat'))     return 'Pemberitahuan Izin Telat';
    if (lower.includes('pulang cepat'))   return 'Pemberitahuan Izin Pulang Cepat';
    if (lower.includes('cuti'))           return 'Pemberitahuan Cuti';
    if (lower.includes('lembur'))         return 'Pemberitahuan Lembur';
    if (lower.includes('kasbon'))         return 'Pemberitahuan Kasbon';
    if (lower.includes('lokasi'))         return 'Pemberitahuan Lokasi';
    return `Pemberitahuan dari ${from}`;
  };

  // ── Mark as read ──────────────────────────────────────────────────────────

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch(`${BASE_URL}/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      setNotifications(prev =>
        prev.map(n => n.id === notificationId
          ? { ...n, unread: false, apiData: { ...n.apiData, read_at: new Date().toISOString() } }
          : n
        )
      );
      if (onRefreshCount) onRefreshCount();
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  // ── Approve / Reject ──────────────────────────────────────────────────────

  const handleApproveReject = async (notif: Notification, action: 'approve' | 'reject') => {
    const manager = JSON.parse(localStorage.getItem('user') || '{}');
    const managerId = String(manager.id ?? '');
    const { entity, id } = detectEntity(notif);

    // Jika ID tidak ditemukan dari data, coba cari di apiData.data langsung
    const data = parseNotifData(notif.apiData);
    const entityId = id ?? data?.id ?? null;

    if (!entity) {
      addToast({ type: 'error', title: 'Tidak Bisa Proses', message: 'Tidak dapat mendeteksi jenis pengajuan.' });
      return;
    }
    if (!entityId) {
      addToast({ type: 'error', title: 'ID Tidak Ditemukan', message: 'ID pengajuan tidak ditemukan di data notifikasi.' });
      return;
    }

    setActionLoading(prev => ({ ...prev, [notif.id]: action === 'approve' ? 'approving' : 'rejecting' }));

    try {
      let url   = '';
      let body: Record<string, string> = {};
      let method = 'PUT';

      if (entity === 'lembur') {
        if (action === 'approve') {
          url  = `${BASE_URL}/lemburs/${entityId}/approve`;
          body = { approved_by: managerId };
        } else {
          url  = `${BASE_URL}/lemburs/${entityId}/reject`;
          body = { rejected_by: managerId };
        }
      } else if (entity === 'cuti') {
        if (action === 'approve') {
          url  = `${BASE_URL}/cutis/${entityId}/approve`;
          body = { user_approval: managerId };
        } else {
          url  = `${BASE_URL}/cutis/${entityId}/reject`;
          body = { user_approval: managerId };
        }
      } else if (entity === 'kasbon') {
        url  = `${BASE_URL}/kasbons/${entityId}`;
        body = { status: action === 'approve' ? 'APPROVED' : 'REJECTED' };
      }

      const fd = new FormData();
      Object.entries(body).forEach(([k, v]) => fd.append(k, v));

      const res  = await fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: fd,
      });
      const json = await res.json();

      if (json.success || res.ok) {
        const label = action === 'approve' ? 'disetujui' : 'ditolak';
        addToast({
          type: action === 'approve' ? 'success' : 'info',
          title: action === 'approve' ? 'Disetujui' : 'Ditolak',
          message: `Pengajuan ${entity} berhasil ${label}.`,
        });
        // Tandai as read lalu refresh
        await markAsRead(notif.id);
        fetchNotifications();
      } else {
        addToast({ type: 'error', title: 'Gagal', message: json.message || 'Terjadi kesalahan.' });
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message || 'Terjadi kesalahan sistem.' });
    } finally {
      setActionLoading(prev => ({ ...prev, [notif.id]: null }));
    }
  };

  // ── View Detail ───────────────────────────────────────────────────────────

  const handleViewDetail = (notification: Notification) => {
    if (notification.unread) markAsRead(notification.id);
    if (!onNavigate) return;

    const msg = notification.message?.toLowerCase() ?? '';
    if (notification.type === 'alert' || msg.includes('kontrak') || msg.includes('pkwt')) {
      onNavigate('contracts'); return;
    }

    let action = notification.action;
    const parsedData = parseNotifData(notification.apiData);
    const userId = parsedData?.user_id || '';

    if (!action && msg) {
      if (msg.includes('cuti') || msg.includes('izin'))  action = `leave?user_id=${userId}`;
      else if (msg.includes('absen'))                    action = `data-attendance?user_id=${userId}`;
      else if (msg.includes('lembur'))                   action = `overtime-data?user_id=${userId}`;
      else if (msg.includes('dinas'))                    action = `data-dinas?user_id=${userId}`;
    }

    if (action) {
      const actionLower  = action.toLowerCase();
      const qs           = action.split('?')[1] || '';
      const urlParams    = new URLSearchParams(qs);
      const params: Record<string, string> = {
        userId:    urlParams.get('user_id') || userId,
        startDate: urlParams.get('mulai')   || '',
        endDate:   urlParams.get('akhir')   || '',
      };

      if (actionLower.includes('cuti') || actionLower.includes('leave'))         onNavigate('leave', params);
      else if (actionLower.includes('absen') || actionLower.includes('attendance')) onNavigate('data-attendance', params);
      else if (actionLower.includes('lembur') || actionLower.includes('overtime')) onNavigate('overtime-data', params);
      else if (actionLower.includes('dinas'))                                      onNavigate('data-dinas', params);
      else                                                                         onNavigate('dashboard');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const unread = notifications.filter(n => n.unread);
      await Promise.all(unread.map(n =>
        fetch(`${BASE_URL}/notifications/${n.id}/read`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
      ));
      setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
      if (onRefreshCount) onRefreshCount();
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Hapus semua notifikasi?')) return;
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const res  = await fetch(`${BASE_URL}/notifications/clear?notifiable_id=${user.id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const json = await res.json();
      if (json.success) { setNotifications([]); if (onRefreshCount) onRefreshCount(); }
    } catch (err) { console.error(err); }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const filtered = notifications.filter(n =>
    activeTab === 'all' ||
    (activeTab === 'unread' && n.unread) ||
    (activeTab === 'requests' && isPengajuan(n))
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-[1600px] mx-auto space-y-8"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Notifications</h1>
          <p className="text-slate-500 font-medium">Stay updated with the latest activities and requests.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleMarkAllAsRead}
            className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all active:scale-95">
            <CheckCheck className="w-4 h-4 text-[#103552]" /> Mark all as read
          </button>
          <button onClick={handleClearAll} title="Hapus Semua"
            className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-rose-500 hover:border-rose-100 transition-all">
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Tab + Search */}
      <div className="bg-white p-4 rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/30 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full md:w-auto gap-1">
          <TabButton label="Semua"     active={activeTab === 'all'}      onClick={() => setActiveTab('all')}      count={notifications.length} />
          <TabButton label="Belum Dibaca" active={activeTab === 'unread'} onClick={() => setActiveTab('unread')}  count={notifications.filter(n => n.unread).length} />
          <TabButton label="Pengajuan" active={activeTab === 'requests'} onClick={() => setActiveTab('requests')} count={notifications.filter(isPengajuan).length} />
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Cari notifikasi..."
            className="w-full pl-12 pr-6 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-[#103552]/10 focus:border-[#103552] transition-all" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-8 h-8 rounded-full border-4 border-[#103552]/20 border-t-[#103552] animate-spin"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((notification, index) => {
            const isPengajuanItem = isPengajuan(notification);
            const isActionable   = isPengajuanItem;
            const loadingState   = actionLoading[notification.id];
            const isApproving    = loadingState === 'approving';
            const isRejecting    = loadingState === 'rejecting';
            const isBusy         = isApproving || isRejecting;

            return (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.04 }}
                className={cn(
                  "group relative bg-white p-6 rounded-[2rem] border transition-all hover:shadow-2xl hover:shadow-slate-200/50 flex items-start gap-6",
                  notification.unread ? "border-[#96D1C6]/40 bg-[#E8F4F3]/30" : "border-slate-100"
                )}
              >
                {/* Unread dot */}
                {notification.unread && (
                  <div className="absolute top-8 left-3 w-2 h-2 bg-[#103552] rounded-full shadow-[0_0_8px_rgba(16,53,82,0.4)]"></div>
                )}

                {/* Avatar */}
                <div className="shrink-0">
                  {notification.user ? (
                    <div className="relative">
                      <img src={notification.user.avatar} alt={notification.user.name}
                        className="w-14 h-14 rounded-2xl object-cover shadow-lg" referrerPolicy="no-referrer" />
                      <div className={cn("absolute -bottom-1 -right-1 w-6 h-6 rounded-lg flex items-center justify-center border-2 border-white shadow-sm", getIconBg(notification.type))}>
                        {getIcon(notification.type)}
                      </div>
                    </div>
                  ) : (
                    <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg", getIconBg(notification.type))}>
                      {getIcon(notification.type, 'w-7 h-7')}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div
                    className="cursor-pointer"
                    onClick={() => handleViewDetail(notification)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <h3 className={cn("text-lg font-black tracking-tight truncate", notification.unread ? "text-slate-900" : "text-slate-600")}>
                        {notification.title}
                      </h3>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap ml-4">
                        {notification.time}
                      </span>
                    </div>
                    <p className="text-slate-500 font-medium leading-relaxed mb-4">
                      {notification.message}
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center flex-wrap gap-2">
                    {/* Lihat Detail — selalu tampil jika relevan */}
                    {(notification.action || notification.type === 'alert' || notification.type === 'request' ||
                      ['kontrak','pkwt','cuti','lembur','izin','dinas','absen','kasbon'].some(kw => notification.message?.toLowerCase().includes(kw))
                    ) && (
                      <button
                        onClick={() => handleViewDetail(notification)}
                        className="px-5 py-2 bg-[#96D1C6]/20 text-[#103552] rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#96D1C6]/30 transition-all active:scale-95"
                      >
                        Lihat Detail
                      </button>
                    )}

                    {/* Setujui — hanya untuk pengajuan */}
                    {isActionable && (
                      <button
                        disabled={isBusy}
                        onClick={() => handleApproveReject(notification, 'approve')}
                        className="flex items-center gap-1.5 px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-60"
                      >
                        {isApproving
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <CheckCircle2 className="w-3.5 h-3.5" />
                        }
                        Setujui
                      </button>
                    )}

                    {/* Tolak — hanya untuk pengajuan */}
                    {isActionable && (
                      <button
                        disabled={isBusy}
                        onClick={() => handleApproveReject(notification, 'reject')}
                        className="flex items-center gap-1.5 px-5 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-60"
                      >
                        {isRejecting
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <XCircle className="w-3.5 h-3.5" />
                        }
                        Tolak
                      </button>
                    )}
                  </div>
                </div>

                {/* More options */}
                <button className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all shrink-0">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </motion.div>
            );
          })}

          {filtered.length === 0 && (
            <div className="text-center py-10">
              <Bell className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-900">Belum Ada Notifikasi</h3>
              <p className="text-slate-500 mt-1">Anda sudah melihat semua informasi terbaru.</p>
            </div>
          )}
        </div>
      )}

      {/* Load More */}
      <div className="flex justify-center pt-4">
        <button className="px-8 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-black text-slate-500 hover:text-[#103552] hover:border-[#96D1C6]/30 transition-all active:scale-95 shadow-lg shadow-slate-200/20">
          Load Older Notifications
        </button>
      </div>
    </motion.div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TabButton({ label, active, onClick, count }: {
  label: string; active: boolean; onClick: () => void; count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-5 py-2.5 text-xs font-black uppercase tracking-widest transition-all rounded-xl flex items-center gap-2",
        active ? "bg-white text-[#103552] shadow-sm" : "text-slate-500 hover:text-slate-900"
      )}
    >
      {label}
      {count !== undefined && (
        <span className={cn("px-1.5 py-0.5 rounded-md text-[10px]", active ? "bg-[#96D1C6]/20 text-[#103552]" : "bg-slate-200 text-slate-500")}>
          {count}
        </span>
      )}
    </button>
  );
}

function getIcon(type: Notification['type'], className = 'w-3 h-3') {
  switch (type) {
    case 'request': return <UserPlus className={cn(className, "text-white")} />;
    case 'mention': return <MessageSquare className={cn(className, "text-white")} />;
    case 'system':  return <Clock className={cn(className, "text-white")} />;
    case 'alert':   return <AlertCircle className={cn(className, "text-white")} />;
    default:        return <Bell className={cn(className, "text-white")} />;
  }
}

function getIconBg(type: Notification['type']) {
  switch (type) {
    case 'request': return 'bg-emerald-500';
    case 'mention': return 'bg-[#103552]';
    case 'system':  return 'bg-amber-500';
    case 'alert':   return 'bg-rose-500';
    default:        return 'bg-slate-500';
  }
}
