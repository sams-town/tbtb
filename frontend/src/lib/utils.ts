import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPhotoUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;

  const envApiData = import.meta.env.VITE_API_MEANDPAY_DATA;
  const envApi = import.meta.env.VITE_API_MEANDPAY;
  const apiBase = (envApiData || (envApi ? envApi.replace(/\/api\/?$/, '') : '') || 'https://api-absen.hris-thb.id').replace(/\/$/, '');

  let cleanUrl = url.trim();

  // Bersihkan localhost/127.0.0.1 dari backend yang tidak sengaja terbawa
  if (cleanUrl.includes('localhost:') || cleanUrl.includes('127.0.0.1:') || cleanUrl.includes('localhost/') || cleanUrl.includes('127.0.0.1/')) {
    try {
      const parsed = new URL(cleanUrl);
      cleanUrl = parsed.pathname;
    } catch (_) {
      cleanUrl = cleanUrl.replace(/^https?:\/\/[^\/]+/, '');
    }
  }

  // Jika URL domain lama yang sudah tidak aktif
  if (cleanUrl.includes('meandpay.hermansyahali07.my.id')) {
    try {
      const parsed = new URL(cleanUrl);
      cleanUrl = parsed.pathname;
    } catch (_) {
      cleanUrl = cleanUrl.replace(/^https?:\/\/[^\/]+/, '');
    }
  }

  // Jika berupa path relatif (atau hasil ekstraksi dari localhost)
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    const cleanPath = cleanUrl.replace(/^\/+/, '');
    if (cleanPath.startsWith('uploads/') || cleanPath.startsWith('lemburs/') || cleanPath.startsWith('beritas/')) {
      return `${apiBase}/${cleanPath}`;
    }
    if (cleanPath.startsWith('profile/')) {
      return `${apiBase}/uploads/${cleanPath}`;
    }
    if (cleanPath.startsWith('face-base64-')) {
      return `${apiBase}/uploads/profile/${cleanPath}`;
    }
    return `${apiBase}/uploads/${cleanPath}`;
  }

  // Jika URL publik valid, pastikan menggunakan HTTPS (mixed content fix)
  return cleanUrl.startsWith('http://') ? cleanUrl.replace('http://', 'https://') : cleanUrl;
}
