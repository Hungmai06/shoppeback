import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, ExternalLink, ShieldCheck, Zap,
  CheckCircle2, Copy, ShoppingCart, HelpCircle,
  Search, AlertCircle, Store, ArrowRight, Share2, Heart
} from 'lucide-react';
import { Button } from '../../components/ui/core';
import { useAppStore } from '../../store/appStore';
import { toast } from 'sonner';



export default function TikTokPage() {
  const [searchParams] = useSearchParams();
  const { currentUser, settings, openAuthModal, toggleFavorite, favorites, addOrder } = useAppStore();
  const [tiktokLink, setTiktokLink] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkedProduct, setCheckedProduct] = useState<any>(null);
  const [guideModalOpen, setGuideModalOpen] = useState(false);

  // Khôi phục link từ query param hoặc sessionStorage
  useEffect(() => {
    const queryUrl = searchParams.get('url');
    if (queryUrl) {
      setTiktokLink(queryUrl);
      fetchTikTokProduct(queryUrl);
    } else {
      try {
        const savedProd = sessionStorage.getItem('checked_tiktok_product');
        const savedInput = sessionStorage.getItem('checked_tiktok_input');
        if (savedProd && !checkedProduct) {
          setCheckedProduct(JSON.parse(savedProd));
        }
        if (savedInput && !tiktokLink) {
          setTiktokLink(savedInput);
        }
      } catch {}
    }
  }, [searchParams]);

  // Tự động mở link mua hàng sau khi đăng nhập thành công
  useEffect(() => {
    if (currentUser) {
      try {
        const savedProd = sessionStorage.getItem('checked_tiktok_product');
        const savedInput = sessionStorage.getItem('checked_tiktok_input');
        if (savedProd) {
          setCheckedProduct((prev: any) => prev || JSON.parse(savedProd));
        }
        if (savedInput) {
          setTiktokLink((prev) => prev || savedInput);
        }

        const autoNext = sessionStorage.getItem('pending_auto_next_tiktok');
        if (autoNext === 'true') {
          sessionStorage.removeItem('pending_auto_next_tiktok');
          setTimeout(() => {
            const btn = document.getElementById('btn-tiktok-buy-now');
            if (btn) {
              btn.click();
            }
          }, 350);
        }
      } catch {}
    }
  }, [currentUser]);

  // Hàm gọi API tra cứu và tạo link sản phẩm (1 request qua RioHub POST /product-links)
  const fetchTikTokProduct = async (linkInput: string) => {
    if (!linkInput) return;

    setIsProcessing(true);
    setCheckedProduct(null);

    try {
      const API_BASE = import.meta.env.VITE_API_BASE || '/api';
      const token = localStorage.getItem('token') || localStorage.getItem('access_token') || '';
      const userId = currentUser ? currentUser.id : '';

      const res = await fetch(`${API_BASE}/tiktok/convert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          url: linkInput,
          userId: userId
        })
      });

      const data = await res.json();
      if (res.ok && data.success && data.affiliateLink) {
        const prod = data.productInfo || {
          name: 'Sản phẩm TikTok Shop (Đã gắn mã hoàn tiền)',
          price: 0,
          commissionRate: 10,
          estimatedCashback: 0,
          shopName: 'TikTok Shop Official'
        };

        const finalProductObj = {
          ...prod,
          affiliateLink: data.affiliateLink,
          subId: data.subId,
          productId: data.productId,
          mode: data.mode,
          originUrl: linkInput,
          clickId: data.clickId
        };

        setCheckedProduct(finalProductObj);

        try {
          sessionStorage.setItem('checked_tiktok_product', JSON.stringify(finalProductObj));
          sessionStorage.setItem('checked_tiktok_input', linkInput);
        } catch {}
      } else {
        toast.error(data.message || 'Không thể lấy thông tin tiền hoàn. Vui lòng kiểm tra lại link TikTok!');
      }
    } catch (err: any) {
      console.warn('Lỗi khi tra cứu link TikTok:', err);
      // Fallback khi offline hoặc lỗi network
      let fallbackAffLink = linkInput;
      if (settings?.tiktokCookieUrl) {
        try {
          const cookieBase = settings.tiktokCookieUrl.trim();
          const separator = cookieBase.includes('?') ? '&' : '?';
          fallbackAffLink = `${cookieBase}${separator}url=${encodeURIComponent(linkInput)}&sub_id=${encodeURIComponent(currentUser?.id || '')}`;
        } catch {
          fallbackAffLink = linkInput;
        }
      }

      const fallbackObj = {
        name: 'Sản phẩm TikTok Shop (Ưu đãi hoàn tiền)',
        price: 0,
        commissionRate: 10,
        estimatedCashback: 0,
        shopName: 'TikTok Shop Store',
        affiliateLink: fallbackAffLink,
        subId: currentUser?.id || '',
        originUrl: linkInput,
        isFallback: true
      };

      setCheckedProduct(fallbackObj);
    } finally {
      setIsProcessing(false);
    }
  };

  // 1. Submit form tra cứu link
  const handleCheckLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const linkInput = tiktokLink.trim();
    if (!linkInput) {
      toast.error('Vui lòng dán link sản phẩm TikTok Shop');
      return;
    }

    const isTikTok = linkInput.includes('tiktok.com') ||
                     linkInput.includes('vt.tiktok.com') ||
                     linkInput.includes('shop.tiktok.com') ||
                     linkInput.includes('snssdk.com');

    if (!isTikTok) {
      toast.error('Link không hợp lệ! Vui lòng nhập link từ TikTok hoặc TikTok Shop (vt.tiktok.com/...)');
      return;
    }

    await fetchTikTokProduct(linkInput);
  };

  // 2. Chuyển sang mua hàng bằng Link Affiliate có gắn sub_id
  const handleOpenAffiliateLink = () => {
    if (!checkedProduct || !checkedProduct.affiliateLink) return;

    if (!currentUser) {
      try {
        sessionStorage.setItem('checked_tiktok_product', JSON.stringify(checkedProduct));
        sessionStorage.setItem('checked_tiktok_input', tiktokLink);
        sessionStorage.setItem('pending_auto_next_tiktok', 'true');
      } catch {}

      toast.info('Vui lòng đăng nhập để hệ thống ghi nhận hoa hồng TikTok vào ví của bạn');
      openAuthModal('login');
      return;
    }

    // Ghi nhận đơn hàng pending vào danh sách theo dõi của người dùng (giống Shopee)
    try {
      const newOrder: any = {
        id: checkedProduct.clickId || `TT${Date.now()}${Math.random().toString(36).substring(2, 6)}`,
        productName: checkedProduct.name || 'Sản phẩm TikTok Shop',
        productImage: checkedProduct.image || '',
        orderAmount: Math.floor(checkedProduct.price || 0),
        estimatedCashback: Math.floor(checkedProduct.estimatedCashback || 0),
        status: 'pending',
        createdTime: new Date().toISOString().replace('T', ' ').slice(0, 19),
        userId: currentUser.id,
        productUrl: checkedProduct.originUrl || tiktokLink,
        shopId: checkedProduct.shopName || 'TikTok Shop',
        itemId: checkedProduct.productId || ''
      };
      addOrder(newOrder);
    } catch {}

    const targetUrl = checkedProduct.affiliateLink;
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|FBAN|FBAV|Instagram|Zalo/i.test(navigator.userAgent) || window.innerWidth < 768;

    if (isMobileDevice) {
      window.location.href = targetUrl;
    } else {
      const win = window.open(targetUrl, '_blank');
      if (!win || win.closed || typeof win.closed === 'undefined') {
        window.location.href = targetUrl;
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Đã sao chép link!');
  };

  return (
    <div className="w-full relative pb-16">
      {/* BACKGROUND ACCENTS */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-cyan-100/30 rounded-full blur-[120px] -z-10 pointer-events-none" />
      <div className="absolute top-60 left-10 w-[400px] h-[400px] bg-rose-100/30 rounded-full blur-[100px] -z-10 pointer-events-none" />

      {/* HERO SECTION */}
      <section className="relative px-4 sm:px-6 lg:px-8 pt-6 pb-12 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto mb-10"
        >
          {/* BADGE TIKTOK SHOP */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900 text-white text-xs font-bold shadow-lg shadow-black/10 mb-5">
            <span className="w-2 h-2 rounded-full bg-[#00F2FE] animate-pulse" />
            <span className="text-[#00F2FE]">TIKTOK</span>
            <span className="text-[#FE2C55]">SHOP</span>
            <span className="text-white/60">|</span>
            <span className="text-white font-medium">Hoàn Tiền Mua Sắm Thông Minh</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-4">
            Mua Sắm <span className="text-slate-900 underline decoration-[#FE2C55] decoration-wavy underline-offset-8">TikTok Shop</span> Nhận Hoàn Tiền Đến <span className="bg-gradient-to-r from-[#00F2FE] via-slate-900 to-[#FE2C55] bg-clip-text text-transparent">25%</span>
          </h1>

          <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-medium">
            Dán link sản phẩm để tra cứu mức tiền hoàn trước, sau đó ấn vào nút mua hàng để hệ thống tự động ghi nhận hoa hồng vào ví tiền của bạn.
          </p>
        </motion.div>

        {/* INPUT FORM CONTAINER */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="max-w-3xl mx-auto mb-10"
        >
          <div className="bg-white/95 backdrop-blur-xl border border-slate-200 shadow-xl shadow-slate-200/50 rounded-2xl p-4 sm:p-6 transition-all">
            <form onSubmit={handleCheckLink} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.04-.1z"/>
                  </svg>
                </div>
                <input
                  type="text"
                  value={tiktokLink}
                  onChange={(e) => setTiktokLink(e.target.value)}
                  placeholder="Dán link sản phẩm hoặc link video TikTok Shop (vd: vt.tiktok.com/...)"
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-slate-800 focus:ring-4 focus:ring-slate-800/10 outline-none transition-all"
                />
              </div>
              <Button
                type="submit"
                disabled={isProcessing}
                className="bg-slate-900 hover:bg-black text-white px-8 py-4 rounded-xl font-bold text-sm shadow-md shadow-black/20 flex items-center justify-center gap-2 shrink-0 transition-transform active:scale-95"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Đang tra cứu...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 text-[#00F2FE]" />
                    <span>Kiểm Tra Tiền Hoàn</span>
                  </>
                )}
              </Button>
            </form>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs text-slate-500 font-medium">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Hoàn tiền tự động minh bạch 100% từ TikTok Shop</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Áp dụng đồng thời mọi voucher giảm giá của TikTok Shop</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ======================================================== */}
        {/* RESULT CARD: THẺ HIỂN THỊ KẾT QUẢ TIỀN HOÀN SẢN PHẨM     */}
        {/* ======================================================== */}
        <AnimatePresence>
          {checkedProduct && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ duration: 0.35 }}
              className="max-w-2xl mx-auto mb-16"
            >
              <div className="bg-white border-2 border-slate-900/10 rounded-2xl shadow-xl shadow-slate-200/70 overflow-hidden relative text-left">
                {/* Header ribbon */}
                <div className="bg-slate-900 text-white px-6 py-2.5 flex items-center justify-between text-xs font-bold">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#00F2FE] animate-ping" />
                    <span className="text-[#00F2FE]">TikTok Shop</span>
                    <span>|</span>
                    <span className="text-white/80 font-normal">Đã kích hoạt mã theo dõi hoa hồng</span>
                  </div>
                  {checkedProduct.subId && (
                    <span className="font-mono text-[10px] text-slate-400 bg-white/10 px-2 py-0.5 rounded">
                      SubID: {checkedProduct.subId.substring(0, 16)}...
                    </span>
                  )}
                </div>

                <div className="p-6 md:p-8">
                  <div className="flex flex-col md:flex-row gap-6 items-start">
                    {/* Thumbnail Image */}
                    <div className="relative w-full md:w-44 shrink-0">
                      {checkedProduct.image ? (
                        <img
                          src={checkedProduct.image}
                          alt={checkedProduct.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-44 object-cover rounded-xl border border-slate-200 shadow-sm"
                        />
                      ) : (
                        <div className="w-full h-44 rounded-xl border border-slate-200 bg-slate-900 text-white flex flex-col items-center justify-center p-4 text-center gap-2">
                          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                            <ShoppingCart className="w-6 h-6 text-[#00F2FE]" />
                          </div>
                          <span className="text-xs font-bold text-slate-200">TikTok Shop</span>
                        </div>
                      )}
                      {checkedProduct.sales > 0 && (
                        <div className="absolute bottom-2 left-2 bg-black/75 backdrop-blur-xs text-white px-2 py-0.5 rounded-md text-[10px] font-semibold">
                          Đã bán: {checkedProduct.sales.toLocaleString('vi-VN')}
                        </div>
                      )}
                    </div>

                    {/* Details Column */}
                    <div className="flex-1 flex flex-col w-full">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 text-[11px] font-bold">
                          <Store className="w-3.5 h-3.5 text-slate-600" />
                          <span>{checkedProduct.shopName || 'TikTok Shop Official'}</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              toggleFavorite(checkedProduct.originUrl || tiktokLink);
                            }}
                            className={`p-2 rounded-full border border-slate-200 hover:scale-105 transition-all ${
                              favorites.includes(checkedProduct.originUrl || tiktokLink)
                                ? 'text-danger bg-red-50'
                                : 'text-slate-400 hover:text-slate-800'
                            }`}
                          >
                            <Heart className={`w-4 h-4 ${favorites.includes(checkedProduct.originUrl || tiktokLink) ? 'fill-current' : ''}`} />
                          </button>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(checkedProduct.affiliateLink)}
                            title="Sao chép link affiliate"
                            className="p-2 rounded-full border border-slate-200 text-slate-400 hover:text-slate-800 hover:scale-105 transition-all"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <h3 className="text-base font-bold text-slate-900 leading-snug line-clamp-2 mb-4">
                        {checkedProduct.name}
                      </h3>

                      {/* Cash & Cashback Box */}
                      <div className="grid grid-cols-2 gap-3 bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl mb-4">
                        <div>
                          <p className="text-[11px] font-semibold text-slate-500 uppercase">Giá sản phẩm</p>
                          <div className="flex items-baseline gap-1.5 mt-0.5 flex-wrap">
                            <p className="text-base font-extrabold text-slate-900">
                              {checkedProduct.price > 0
                                ? `${checkedProduct.price.toLocaleString('vi-VN')} đ`
                                : 'Theo giá trên app TikTok'}
                            </p>
                            {checkedProduct.originalPrice > checkedProduct.price && (
                              <span className="text-xs text-slate-400 line-through">
                                {checkedProduct.originalPrice.toLocaleString('vi-VN')} đ
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between gap-1 flex-wrap">
                            <p className="text-[11px] font-semibold text-[#FE2C55] uppercase flex items-center gap-1">
                              <Zap className="w-3 h-3" />
                              <span>Tiền hoàn dự kiến (50%)</span>
                            </p>
                            {checkedProduct.isObserved && (
                              <span className="text-[9px] bg-rose-100 text-rose-700 font-bold px-1.5 py-0.2 rounded-full">
                                {checkedProduct.bonusRate > 0 ? `+${(checkedProduct.bonusRate * 100).toFixed(0)}% Thưởng` : 'Đã gồm thưởng'}
                              </span>
                            )}
                          </div>
                          <p className="text-base font-black text-[#FE2C55] mt-0.5">
                            {checkedProduct.estimatedCashback > 0
                              ? `${checkedProduct.estimatedCashback.toLocaleString('vi-VN')} đ`
                              : `Lên đến ${Number(((checkedProduct.commissionRate || 10) * 0.5).toFixed(1))}% đơn`}
                          </p>
                        </div>
                      </div>

                      {checkedProduct.commissionAmountRange && (
                        <div className="text-[11px] text-slate-500 mb-3 -mt-2 flex items-center gap-1">
                          <span className="font-semibold text-slate-600">Hoa hồng sàn:</span>
                          <span className="font-mono text-slate-700">{checkedProduct.commissionAmountRange} VND</span>
                          <span className="text-slate-400">({checkedProduct.commissionRate}%) • Hoàn 50%</span>
                        </div>
                      )}


                      {/* Notice */}
                      <div className="flex items-start gap-2 text-xs text-slate-500 leading-relaxed mb-5">
                        <AlertCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                        <p>
                          Sau khi ấn vào nút bên dưới, vui lòng hoàn tất đặt hàng trong ứng dụng TikTok để hệ thống tự động ghi nhận đơn hoàn tiền vào ví của bạn.
                        </p>
                      </div>

                      {/* NÚT MUA HÀNG BẰNG LINK AFFILIATE */}
                      <Button
                        id="btn-tiktok-buy-now"
                        onClick={handleOpenAffiliateLink}
                        className="w-full bg-slate-900 hover:bg-black text-white py-4 rounded-xl font-black text-base shadow-lg shadow-black/20 flex items-center justify-center gap-2 group transition-all"
                      >
                        <ShoppingCart className="w-5 h-5 text-[#00F2FE]" />
                        <span>Ấn vào đây mua hàng để nhận hoàn tiền</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* NOTICE / FAQ CARD - PLACED ABOVE STEPS */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 sm:p-10 text-white relative overflow-hidden shadow-xl mb-12">
          <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-[#00F2FE]/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-3xl">
            <div className="flex items-center gap-2 mb-3">
              <HelpCircle className="w-5 h-5 text-[#00F2FE]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#00F2FE]">Lưu ý quan trọng</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold mb-3">Làm sao để đảm bảo đơn hàng TikTok Shop nhận được tiền hoàn?</h3>
            <ul className="space-y-2.5 text-xs sm:text-sm text-slate-300 font-normal leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00F2FE] mt-2 shrink-0" />
                <span>Không nhấn vào link giới thiệu từ nguồn khác sau khi đã bấm kích hoạt hoàn tiền từ hệ thống.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00F2FE] mt-2 shrink-0" />
                <span>Hoàn tất đặt hàng trong vòng 24 giờ kể từ thời điểm mở ứng dụng TikTok qua link affiliate.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00F2FE] mt-2 shrink-0" />
                <span>Đơn hàng hủy, hoàn hàng hoặc gian lận voucher theo chính sách của TikTok Shop sẽ không được tính hoàn tiền.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* 6 STEPS GUIDE SECTION WITH IMAGES 1-5 FROM STEP 2 */}
        <div className="mb-16">
          <div className="text-center mb-8">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Quy trình đơn giản</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
              6 Bước Nhận Tiền Hoàn TikTok Shop
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                step: '01',
                title: 'Đăng ký / Đăng nhập tài khoản',
                desc: 'Đăng nhập để hệ thống tự động ghi nhận tiền hoàn vào ví tài khoản của bạn.',
                icon: <CheckCircle2 className="w-6 h-6 text-[#00F2FE]" />,
                badge: 'Bước 1',
                image: null
              },
              {
                step: '02',
                title: 'Sao chép link sản phẩm TikTok',
                desc: 'Mở app TikTok, ấn vào nút Chia sẻ ở góc trên sản phẩm để sao chép liên kết.',
                icon: <Copy className="w-6 h-6 text-slate-900" />,
                badge: 'Bước 2',
                image: '/tiktok/1.jpg'
              },
              {
                step: '03',
                title: 'Dán link & Nhấn Tìm',
                desc: 'Dán link sản phẩm TikTok vào ô tìm kiếm trên trang chủ rồi nhấn nút Tìm.',
                icon: <Search className="w-6 h-6 text-[#FE2C55]" />,
                badge: 'Bước 3',
                image: '/tiktok/2.jpg'
              },
              {
                step: '04',
                title: 'Ấn nút Mua hàng nhận hoàn tiền',
                desc: 'Khi hiện thông tin sản phẩm và tiền hoàn dự kiến, ấn vào nút mua hàng bên dưới.',
                icon: <ShoppingCart className="w-6 h-6 text-[#00F2FE]" />,
                badge: 'Bước 4',
                image: '/tiktok/3.jpg'
              },
              {
                step: '05',
                title: "Ấn 'Xem mặt hàng' trên TikTok",
                desc: "Chuyển sang app TikTok, ấn vào nút 'Xem mặt hàng' trên bảng thông báo hiện ra.",
                icon: <Zap className="w-6 h-6 text-amber-500" />,
                badge: 'Bước 5',
                image: '/tiktok/4.jpg'
              },
              {
                step: '06',
                title: 'Áp mã & Đặt mua bình thường',
                desc: 'Có mã giảm giá thì áp mã bình thường. Không ấn vào video hay livestream của KOL/KOC khác.',
                icon: <CheckCircle2 className="w-6 h-6 text-emerald-500" />,
                badge: 'Bước 6',
                image: '/tiktok/5.jpg'
              }
            ].map((item, idx) => (
              <div
                key={idx}
                className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-black px-3 py-1 rounded-full bg-slate-900 text-white uppercase tracking-wider">
                      {item.badge}
                    </span>
                    <span className="text-xl font-black text-slate-300">{item.step} / 06</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-1.5">{item.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed font-normal mb-3">{item.desc}</p>
                </div>

                {item.image ? (
                  <div className="w-full h-72 sm:h-80 bg-slate-50 border border-slate-200/80 rounded-xl overflow-hidden flex items-center justify-center shadow-inner">
                    <img
                      src={item.image}
                      alt={`${item.badge} - ${item.title}`}
                      loading="lazy"
                      className="w-full h-full object-contain p-1.5"
                    />
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col justify-between bg-gradient-to-br from-slate-50 to-cyan-50/30 p-5 rounded-xl border border-slate-200 min-h-[260px]">
                    <div className="flex flex-col items-center text-center my-auto">
                      <div className="w-14 h-14 rounded-full bg-slate-900 flex items-center justify-center mb-3 shadow-md">
                        {item.icon}
                      </div>
                      <p className="text-xs font-bold text-slate-800 mb-1">
                        {currentUser ? `Đã đăng nhập (${currentUser.name})` : 'Chưa đăng nhập tài khoản'}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Hãy đăng nhập trước khi tạo link mua hàng để nhận hoàn tiền tự động.
                      </p>
                    </div>
                    {!currentUser && (
                      <Button
                        onClick={() => openAuthModal('login')}
                        className="w-full bg-slate-900 hover:bg-black text-white font-bold text-xs py-2.5 mt-3"
                      >
                        Đăng ký / Đăng nhập ngay
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* POPUP MODAL HƯỚNG DẪN NẾU CẦN */}
      <AnimatePresence>
        {guideModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative text-left"
            >
              <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center mb-4 shadow-lg shadow-black/10">
                <Zap className="w-6 h-6 text-[#00F2FE]" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">
                Kích Hoạt Hoàn Tiền Thành Công!
              </h3>
              <p className="text-xs text-slate-600 mb-5 leading-relaxed">
                Mã theo dõi hoa hồng cho tài khoản của bạn đã sẵn sàng. Nhấn nút bên dưới để mở TikTok và hoàn tất đơn hàng.
              </p>

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => setGuideModalOpen(false)}
                  className="flex-1 border-slate-200 text-slate-700 hover:bg-slate-50 font-bold"
                >
                  Đóng
                </Button>
                <Button
                  onClick={handleOpenAffiliateLink}
                  className="flex-1 bg-slate-900 hover:bg-black text-white font-bold flex items-center justify-center gap-2"
                >
                  <span>Mở TikTok Ngay</span>
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
