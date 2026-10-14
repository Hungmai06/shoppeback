import { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
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

  const handleSuccess = async (credentialResponse: any) => {
    if (!credentialResponse?.credential) {
      toast.error('Không nhận được token xác thực từ Google');
      return;
    }
    setLoading(true);
    try {
      const result = await loginWithGoogle({
        credential: credentialResponse.credential,
        referralCode: referralCode || localStorage.getItem('referralCode') || undefined
      });

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
  };

  const handleError = () => {
    console.error('Google Login Error');
    toast.error('Đăng nhập Google thất bại hoặc bị hủy');
    setLoading(false);
  };

  if (!googleClientId || googleClientId === 'not-configured') {
    return (
      <div className="w-full py-2.5 px-3 text-center text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
        Chưa cấu hình Google Client ID trong file .env
      </div>
    );
  }

  const isSignUp = text?.toLowerCase().includes('ký');

  return (
    <div className={`w-full flex justify-center items-center min-h-[44px] transition-opacity ${loading || disabled ? 'opacity-60 pointer-events-none' : ''}`}>
      <div className="w-full flex justify-center [&>div]:w-full [&_iframe]:!w-full [&_iframe]:!max-w-full">
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={handleError}
          theme="outline"
          size="large"
          text={isSignUp ? 'signup_with' : 'signin_with'}
          shape="rectangular"
          width="100%"
          useOneTap={false}
        />
      </div>
    </div>
  );
}
