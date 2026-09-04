import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, ArrowRight, ExternalLink, Sparkles, AlertCircle, ShoppingBag, ShieldCheck, Lock } from 'lucide-react';
import { Button } from '../ui/core';

interface TwoStepRedirectModalProps {
  isOpen: boolean;
  onClose: () => void;
  link1: string; // Link Cookie Hệ Thống
  link2: string; // Link Sản Phẩm Gốc
  productName?: string;
  onStep1Completed?: () => void;
}

export default function TwoStepRedirectModal({
  isOpen,
  onClose,
  link1,
  link2,
  productName,
  onStep1Completed
}: TwoStepRedirectModalProps) {
  const [step1Completed, setStep1Completed] = useState(false);

  if (!isOpen) return null;

  const openUrl = (url: string) => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|FBAN|FBAV|Instagram|Zalo/i.test(navigator.userAgent) || window.innerWidth < 768;
    if (isMobile) {
      window.location.href = url;
    } else {
      const win = window.open(url, '_blank');
      if (!win || win.closed || typeof win.closed === 'undefined') {
        window.location.href = url;
      }
    }
  };

  const handleStep1 = () => {
    setStep1Completed(true);
    if (onStep1Completed) onStep1Completed();
    openUrl(link1);
  };

  const handleStep2 = () => {
    if (!step1Completed) return;
    openUrl(link2);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="bg-white border border-orange-100 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden relative"
        >
          {/* Header gradient banner */}
          <div className="bg-gradient-to-r from-orange-500 via-primary to-amber-500 p-6 text-white relative">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[11px] font-bold uppercase tracking-wider mb-2">
              <Sparkles className="h-3.5 w-3.5" /> Quy trình mua hàng 2 bước
            </div>
            <h3 className="text-xl font-black leading-tight">
              Kích Hoạt Mã Hoàn Tiền Shopee
            </h3>
            {productName && (
              <p className="text-xs text-white/90 font-medium mt-1 truncate">
                {productName}
              </p>
            )}
          </div>

          {/* Modal Content */}
          <div className="p-6 flex flex-col gap-5">
            <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 leading-relaxed space-y-1">
                <p className="font-bold text-amber-950">📌 Hướng dẫn mở khóa mua hàng để nhận tiền hoàn:</p>
                <p>
                  Để Shopee tự động ghi nhận tiền hoàn vào ví của bạn, bạn cần thực hiện <b>Bước 1</b> trước để kích hoạt mã hệ thống. Sau khi bấm Bước 1, <b>Bước 2 sẽ tự động mở khóa</b>!
                </p>
              </div>
            </div>

            {/* STEP 1 CONTAINER */}
            <div className={`p-4 rounded-2xl border transition-all duration-300 ${step1Completed ? 'bg-emerald-50/70 border-emerald-300 shadow-sm' : 'bg-orange-50/60 border-orange-200 ring-2 ring-orange-300/50'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${step1Completed ? 'bg-emerald-600 text-white' : 'bg-primary text-white'}`}>
                  {step1Completed ? '✓ BƯỚC 1: ĐÃ KÍCH HOẠT' : 'BƯỚC 1: BẮT BUỘC KÍCH HOẠT'}
                </span>
                {step1Completed && (
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" /> Đã mở khóa Bước 2
                  </span>
                )}
              </div>
              <div className="space-y-1 mb-3">
                <p className="text-xs font-bold text-text">
                  Giới thiệu sản phẩm hệ thống: <span className="text-primary font-black">Giấy ăn gấu trúc Top Gia gia đình</span>
                </p>
                <p className="text-[11px] text-text-secondary leading-relaxed">
                  Bấm nút bên dưới để mở trang tiếp thị hệ thống (Giấy ăn Top Gia). Shopee sẽ tự động lưu cookie tích lũy hoa hồng cho bạn. Sau khi mở xong, <b>Bước 2 sẽ được mở khóa</b>!
                </p>
              </div>
              <Button
                onClick={handleStep1}
                className={`w-full py-3 text-xs font-bold flex items-center justify-center gap-2 ${step1Completed ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-primary text-white hover:bg-primary/95 shadow-md shadow-primary/20'}`}
              >
                <ShieldCheck className="h-4 w-4" />
                {step1Completed ? '✓ 1. Đã Bấm Kích Hoạt (Bấm lại nếu muốn)' : '1. Bấm Kích Hoạt Mã Hoàn Tiền (Giấy Ăn Top Gia)'}
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* STEP 2 CONTAINER */}
            <div className={`p-4 rounded-2xl border transition-all duration-300 ${step1Completed ? 'bg-blue-50/70 border-blue-300 shadow-md ring-2 ring-blue-400/40' : 'bg-gray-100/80 border-gray-200 opacity-75'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${step1Completed ? 'bg-blue-600 text-white' : 'bg-gray-400 text-white'}`}>
                  {step1Completed ? 'BƯỚC 2: ĐÃ MỞ KHÓA' : '🔒 BƯỚC 2: ĐANG KHÓA'}
                </span>
                {!step1Completed && (
                  <span className="text-[10px] font-bold text-gray-500 flex items-center gap-1">
                    <Lock className="h-3.5 w-3.5 text-gray-400" /> Cần làm Bước 1 trước
                  </span>
                )}
              </div>
              <p className="text-xs text-text-secondary font-medium mb-3">
                2. Bấm nút bên dưới để mở chính xác sản phẩm bạn cần mua trên Shopee.
              </p>
              <Button
                onClick={handleStep2}
                disabled={!step1Completed}
                className={`w-full py-3 text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  step1Completed
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30 animate-pulse'
                    : 'bg-gray-300 text-gray-500 border border-gray-300 cursor-not-allowed opacity-60'
                }`}
              >
                {step1Completed ? (
                  <>
                    <ShoppingBag className="h-4 w-4" />
                    2. Bấm Đến Trang Sản Phẩm Cần Mua Ngay
                    <ArrowRight className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 text-gray-400" />
                    Vui lòng thực hiện Bước 1 (Giấy ăn Top Gia) trước để mở khóa
                  </>
                )}
              </Button>
            </div>

            {/* TIP BOX FOR MOBILE USERS */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-[11px] text-text-secondary leading-relaxed">
              <span className="font-bold text-text">💡 Hướng dẫn nhanh:</span> Bấm <b>(1) Kích hoạt mã (Giấy ăn Top Gia)</b> ➔ Shopee mở ra ➔ Quay lại tab này <b>Bước 2 sẽ tự động mở khóa</b> ➔ Bấm <b>(2) Đến sản phẩm mua hàng</b> để nhận tiền hoàn!
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
