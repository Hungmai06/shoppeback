import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Sau khi deploy bản mới, tab cũ có thể tải chunk JS đã bị xoá -> tự tải lại trang đúng 1 lần (không lặp vô hạn)
window.addEventListener('vite:preloadError', () => {
  const key = 'chunk_reload_at';
  const last = Number(sessionStorage.getItem(key) || 0);
  if (Date.now() - last > 10000) {
    sessionStorage.setItem(key, String(Date.now()));
    window.location.reload();
  }
});

// Đăng nhập Google dùng redirect OAuth riêng (GoogleLoginButton), không cần GoogleOAuthProvider
// → tránh tải script accounts.google.com/gsi/client làm chậm trang trên Safari.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

