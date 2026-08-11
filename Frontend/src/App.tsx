import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import PublicLayout from './components/layout/PublicLayout';
import LandingPage from './features/landing/LandingPage';
import TrackingPage from './features/landing/TrackingPage';
import WalletPage from './features/landing/WalletPage';
import SupportPage from './features/landing/SupportPage';
import ReferralPage from './features/landing/ReferralPage';
import AuthPages from './features/auth/AuthPages';
import AdminPanel from './features/admin/AdminPanel';
import { useAppStore } from './store/appStore';

import AuthModal from './components/auth/AuthModal';
import InstallPWA from './components/common/InstallPWA';

function App() {
  const initializeAuth = useAppStore(state => state.initializeAuth);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return (
    <Router>
      <div className="min-h-screen bg-bg">
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
