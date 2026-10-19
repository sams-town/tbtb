import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPhotoUrl(url: string | null | undefined) {
  if (!url) return '';
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;
  
  const apiBase = (import.meta.env.VITE_API_MEANDPAY_DATA || '').replace(/\/$/, '');
  
  // Paksa HTTPS untuk semua URL HTTP (mixed content fix)
  let safeUrl = url.startsWith('http://') ? url.replace('http://', 'https://') : url;
  
  if (safeUrl.startsWith('https://')) {
    // Kalau sudah dari domain API kita, return as-is
    if (safeUrl.includes(apiBase.replace('https://', '').replace('http://', ''))) {
      return safeUrl;
    }
    // Domain lain (server lama) — coba akses via HTTPS langsung
    // Jika file ada di server lama, browser bisa load via HTTPS
    return safeUrl;
  }
  
  const cleanPath = safeUrl.replace(/^\//, '');
  if (cleanPath.startsWith('uploads/') || cleanPath.startsWith('lemburs/') || cleanPath.startsWith('beritas/')) {
    return `${apiBase}/${cleanPath}`;
  }
  
  return `${apiBase}/uploads/${cleanPath}`;
}
