import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, Download, X, Share, PlusSquare, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/core';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // Check if app is already installed / running in standalone mode
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    setIsStandalone(!!isStandaloneMode);

    if (isStandaloneMode) return;

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // Check local storage if user recently dismissed banner
    const dismissed = localStorage.getItem('pwa_banner_dismissed');
    if (!dismissed) {
      if (isIosDevice) {
        setShowBanner(true);
      }
    }

    // Listen for beforeinstallprompt on Android/Chrome/Desktop
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (!dismissed) {
        setShowBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setShowBanner(false);
        setDeferredPrompt(null);
      }
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('pwa_banner_dismissed', 'true');
  };

  if (isStandalone || (!showBanner && !deferredPrompt && !isIOS)) return null;

  return (
    <>
      {/* FLOATING BOTTOM INSTALL BANNER */}
      <AnimatePresence>
        {showBanner && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ duration: 0.3 }}
            className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-40 bg-white dark:bg-slate-900 border border-primary/30 rounded-[20px] p-4 shadow-2xl backdrop-blur-lg flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <img src="/icon.png" alt="Hũ tài lộc" className="w-12 h-12 object-contain rounded-2xl shadow-sm shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-text flex items-center gap-1">
                  Thêm Hũ tài lộc vào Màn hình chính
                </h4>
                <p className="text-[11px] text-text-secondary mt-0.5 leading-tight">
                  Tạo ứng dụng trên điện thoại/máy tính để dán link hoàn tiền siêu tốc!
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                onClick={handleInstallClick}
                className="py-2 px-3 text-xs font-bold bg-primary text-white shadow-sm flex items-center gap-1"
              >
                <Download className="h-3.5 w-3.5" />
                Cài đặt
              </Button>
              <button
                onClick={handleDismiss}
                className="p-1.5 text-text-secondary hover:text-text rounded-full hover:bg-border/30 transition-colors"
                title="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* iOS STEP-BY-STEP INSTALL GUIDE MODAL */}
      <AnimatePresence>
        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowIOSGuide(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-[24px] p-6 shadow-2xl z-10 text-center"
            >
              <button
                onClick={() => setShowIOSGuide(false)}
                className="absolute top-4 right-4 p-2 text-text-secondary hover:text-text"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto mb-4">
                <Smartphone className="h-6 w-6" />
              </div>

              <h3 className="text-base font-bold text-text mb-2">Thêm vào màn hình iPhone / iPad</h3>
              <p className="text-xs text-text-secondary mb-6 leading-relaxed">
                Thực hiện 2 bước đơn giản trên trình duyệt Safari để cài đặt ứng dụng:
              </p>

              <div className="flex flex-col gap-4 text-left text-xs bg-bg p-4 rounded-input border border-border/60 mb-6">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg shrink-0 mt-0.5">
                    <Share className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="font-bold text-text">Bước 1:</span> Chạm vào biểu tượng <span className="font-bold text-blue-600">Chia sẻ (Share)</span> ở thanh công cụ dưới Safari.
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-orange-50 text-orange-600 rounded-lg shrink-0 mt-0.5">
                    <PlusSquare className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="font-bold text-text">Bước 2:</span> Cuộn xuống và chọn <span className="font-bold text-orange-600">"Thêm vào Màn hình chính"</span> (Add to Home Screen).
                  </div>
                </div>
              </div>

              <Button
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-3 font-bold flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                Đã hiểu
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
