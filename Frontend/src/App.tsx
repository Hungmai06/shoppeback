import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import PublicLayout from './components/layout/PublicLayout';
import LandingPage from './features/landing/LandingPage';
import { useAppStore } from './store/appStore';
import AuthModal from './components/auth/AuthModal';
import InstallPWA from './components/common/InstallPWA';

// Lazy load secondary routes & heavy admin panel to optimize Safari initial load
const TrackingPage = lazy(() => import('./features/landing/TrackingPage'));
const WalletPage = lazy(() => import('./features/landing/WalletPage'));
const SupportPage = lazy(() => import('./features/landing/SupportPage'));
const ReferralPage = lazy(() => import('./features/landing/ReferralPage'));
const AuthPages = lazy(() => import('./features/auth/AuthPages'));
const AdminPanel = lazy(() => import('./features/admin/AdminPanel'));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
  </div>
);

function App() {
  const initializeAuth = useAppStore(state => state.initializeAuth);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return (
    <Router>
      <div className="min-h-screen bg-bg">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public Views sharing Header/Footer Layout */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/tracking" element={<TrackingPage />} />
              <Route path="/wallet" element={<WalletPage />} />
              <Route path="/support" element={<SupportPage />} />
              <Route path="/referral" element={<ReferralPage />} />
            </Route>
            
            {/* Authentication flow (Login, Register, Forgot, Reset, OTP) */}
            <Route path="/auth" element={<AuthPages />} />
            
            {/* Admin Dashboard */}
            <Route path="/admin" element={<AdminPanel />} />
            
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
