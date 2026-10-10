import { useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { useAppStore } from '../../store/appStore';
import { toast } from 'sonner';

interface GoogleLoginButtonProps {
  text?: string;
  referralCode?: string;
  disabled?: boolean;
  onSuccessCallback?: () => void;
}

export default function GoogleLoginButton({ text, referralCode, disabled, onSuccessCallback }: GoogleLoginButtonProps) {
  const [loading, setLoading] = useState(false);
  const { loginWithGoogle, closeAuthModal } = useAppStore();
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  const triggerGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      try {
        const result = await loginWithGoogle(
          tokenResponse.access_token,
          undefined,
          undefined,
          undefined,
          referralCode || localStorage.getItem('referralCode') || undefined
        );

        if (result) {
          toast.success(`Chào mừng ${result.name} đã đăng nhập Google thành công!`);
          localStorage.removeItem('referralCode');
          closeAuthModal();
          if (onSuccessCallback) onSuccessCallback();
        } else {
          toast.error('Đăng nhập Google thất bại trên máy chủ.');
        }
      } catch (err: any) {
        toast.error('Lỗi khi đồng bộ tài khoản Google: ' + (err.message || 'Lỗi không xác định'));
      } finally {
        setLoading(false);
      }
    },
    onError: (error) => {
      console.error('Google Login Error:', error);
      toast.error('Đăng nhập Google thất bại hoặc bị hủy');
      setLoading(false);
    }
  });

  const handleClick = () => {
    if (!googleClientId || googleClientId === 'not-configured') {
      toast.error('Chưa cấu hình VITE_GOOGLE_CLIENT_ID trong file .env');
      return;
    }
    setLoading(true);
    triggerGoogleLogin();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
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
      <span>{loading ? 'Đang mở đăng nhập Google...' : (text || 'Tiếp tục với Google')}</span>
    </button>
  );
}
