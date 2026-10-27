import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import PublicLayout from './components/layout/PublicLayout';
import LandingPage from './features/landing/LandingPage';
import { useAppStore } from './store/appStore';
import { RefreshCw } from 'lucide-react';
import AuthModal from './components/auth/AuthModal';
import InstallPWA from './components/common/InstallPWA';

// Code-splitting: chỉ tải khi người dùng vào trang tương ứng
const TrackingPage = lazy(() => import('./features/landing/TrackingPage'));
const WalletPage = lazy(() => import('./features/landing/WalletPage'));
const SupportPage = lazy(() => import('./features/landing/SupportPage'));
const ReferralPage = lazy(() => import('./features/landing/ReferralPage'));
const AuthPages = lazy(() => import('./features/auth/AuthPages'));
const AdminPanel = lazy(() => import('./features/admin/AdminPanel'));

function PageFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <RefreshCw className="w-6 h-6 animate-spin text-primary" />
    </div>
  );
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const currentUser = useAppStore(state => state.currentUser);
  const isAuthLoading = useAppStore(state => state.isAuthLoading);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm font-bold text-text-secondary">Đang kiểm tra quyền Quản trị hệ thống...</p>
        </div>
      </div>
    );
  }

  if (!currentUser || currentUser.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function App() {
  const initializeAuth = useAppStore(state => state.initializeAuth);

  useEffect(() => {
    // 1. Xử lý phản hồi từ Google OAuth Redirect (Cùng 1 tab - Giống luyentu.com)
    const hash = window.location.hash;
    if (hash && (hash.includes('id_token=') || hash.includes('access_token='))) {
      try {
        const cleanHash = hash.startsWith('#') ? hash.substring(1) : hash;
        const params = new URLSearchParams(cleanHash);
        const idToken = params.get('id_token');
        const accessToken = params.get('access_token');

        if (idToken || accessToken) {
          // Xóa hash trên URL ngay lập tức để URL sạch sẽ
          window.history.replaceState(null, '', window.location.pathname + window.location.search);

          const referralCode = localStorage.getItem('referralCode') || undefined;

          useAppStore.getState().loginWithGoogle({
            credential: idToken || undefined,
            accessToken: accessToken || undefined,
            referralCode
          }).then((user) => {
            if (user) {
              toast.success(`Chào mừng ${user.name} đã đăng nhập Google thành công!`);
              localStorage.removeItem('referralCode');
              const returnUrl = localStorage.getItem('auth_return_url');
              if (returnUrl) {
                localStorage.removeItem('auth_return_url');
                if (returnUrl !== window.location.pathname && !returnUrl.startsWith('/auth')) {
                  window.location.href = returnUrl;
                }
              }
            } else {
              toast.error('Đăng nhập Google không thành công.');
            }
          }).catch((err) => {
            console.error('Google Auth callback error:', err);
            toast.error('Lỗi xác thực Google: ' + (err.message || 'Lỗi không xác định'));
          });
        }
      } catch (err) {
        console.error('Parse Google Hash error:', err);
      }
    } else if (hash && hash.includes('error=')) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      toast.info('Bạn đã hủy đăng nhập Google.');
      initializeAuth();
    } else {
      initializeAuth();
    }

    // 2. Lắng nghe khi quay lại tab để cập nhật trạng thái nếu cần
    const handleVisibilityOrFocus = () => {
      const token = localStorage.getItem('token');
      if (token && !useAppStore.getState().currentUser) {
        initializeAuth();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [initializeAuth]);

  return (
    <Router>
      <div className="min-h-screen bg-bg">
        <Suspense fallback={<PageFallback />}>
        <Routes>
          {/* Public Views sharing Header/Footer Layout */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/shopee" element={<LandingPage />} />
            <Route path="/tiktok" element={<LandingPage />} />
            <Route path="/tracking" element={<TrackingPage />} />
            <Route path="/wallet" element={<WalletPage />} />
            <Route path="/support" element={<SupportPage />} />
            <Route path="/referral" element={<ReferralPage />} />
          </Route>
          
          {/* Authentication flow (Login, Register, Forgot, Reset, OTP) */}
          <Route path="/auth" element={<AuthPages />} />
          
          {/* Admin Dashboard */}
          <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />
          
          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
        
        {/* Global Login/Register Popup Modal */}
        <AuthModal />

        {/* PWA Add to Home Screen Banner & Guide */}
        <InstallPWA />

        {/* Toast alerts notifier */}
        <Toaster position="top-right" richColors />
      </div>
    </Router>
  );
}

export default App;
