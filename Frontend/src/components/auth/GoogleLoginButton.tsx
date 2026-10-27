import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface GoogleLoginButtonProps {
  text?: string;
  referralCode?: string;
  disabled?: boolean;
  onSuccessCallback?: () => void;
}

export default function GoogleLoginButton({ text, referralCode, disabled }: GoogleLoginButtonProps) {
  const [loading, setLoading] = useState(false);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  // Safari (bfcache): khi bấm Back/Cancel từ trang Google, trang được khôi phục nguyên trạng thái -> nút bị kẹt "Đang chuyển..."
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setLoading(false);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  const handleGoogleLogin = () => {
    if (!googleClientId || googleClientId === 'not-configured') {
      toast.error('Chưa cấu hình Google Client ID trong file .env');
      return;
    }

    setLoading(true);

    if (referralCode) {
      localStorage.setItem('referralCode', referralCode);
    }

    // Lưu lại URL hiện tại để sau khi redirect xong quay lại đúng trang
    const currentUrl = window.location.pathname + window.location.search;
    localStorage.setItem('auth_return_url', currentUrl);

    const redirectUri = window.location.origin;
    const nonce = Math.random().toString(36).substring(2) + Date.now().toString(36);

    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleAuthUrl.searchParams.set('client_id', googleClientId);
    googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
    googleAuthUrl.searchParams.set('response_type', 'id_token token');
    googleAuthUrl.searchParams.set('scope', 'openid email profile');
    googleAuthUrl.searchParams.set('prompt', 'select_account');
    googleAuthUrl.searchParams.set('nonce', nonce);

    // Chuyển hướng trực tiếp trên CÙNG 1 TAB (Same Tab Redirect - Y hệt luyentu.com)
    window.location.href = googleAuthUrl.toString();
  };

  return (
    <button
      type="button"
      onClick={handleGoogleLogin}
      disabled={disabled || loading}
      className="w-full py-3 px-4 flex items-center justify-center gap-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-text border border-border/90 rounded-button shadow-xs hover:shadow-sm font-bold text-xs sm:text-sm transition-all cursor-pointer group active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        />
      </svg>
      <span>{loading ? 'Đang chuyển đến Google...' : (text || 'Đăng nhập bằng Google')}</span>
    </button>
  );
}
