import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, CheckCircle2, ShieldCheck, Zap, LineChart,
  ArrowRight, Copy, Heart, Share2,
  MessageSquare, Star, ShoppingBag, Sparkles, AlertCircle, Wallet,
  Store, Activity, ShoppingCart, Link2, Clock, ShieldAlert, RefreshCw, Users
} from 'lucide-react';
import { Button, Card, CardContent, Badge, Accordion, AccordionItem } from '../../components/ui/core';
import { useAppStore } from '../../store/appStore';
import type { Order } from '../../store/appStore';
import { toast } from 'sonner';

import { SAMPLE_SHOPEE_PRODUCTS } from '../../store/mockData';

import TwoStepRedirectModal from '../../components/common/TwoStepRedirectModal';

export default function LandingPage() {
  const navigate = useNavigate();
  const { currentUser, addOrder, toggleFavorite, favorites, openAuthModal, settings } = useAppStore();
  const [shopeeLink, setShopeeLink] = useState('');
  const [checkedProduct, setCheckedProduct] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);

  const [lightboxImage, setLightboxImage] = useState<{ src: string; step: number } | null>(null);

  // Quản lý Popup 2 bước mua hàng
  const [redirectModalData, setRedirectModalData] = useState<{
    isOpen: boolean;
    link1: string;
    link2: string;
    productName: string;
  }>({
    isOpen: false,
    link1: '',
    link2: '',
    productName: ''
  });
  const [step1ActivatedUrl, setStep1ActivatedUrl] = useState<string | null>(null);

  const purchasingSteps = [
    { step: 1, badge: "BƯỚC 1", title: "Đăng ký / Đăng nhập tài khoản", image: null },
    { step: 2, badge: "BƯỚC 2", title: "Bước 2", image: "/1.jpg" },
    { step: 3, badge: "BƯỚC 3", title: "Bước 3", image: "/2.jpg" },
    { step: 4, badge: "BƯỚC 4", title: "Bước 4", image: "/3.jpg" },
    { step: 5, badge: "BƯỚC 5", title: "Bước 5", image: "/4.jpg" },
    { step: 6, badge: "BƯỚC 6", title: "Bước 6", image: "/5.jpg" },
    { step: 7, badge: "BƯỚC 7", title: "Bước 7", image: "/6.jpg" },
    { step: 8, badge: "BƯỚC 8", title: "Bước 8", image: "/7.jpg" }
  ];



  const handleCheckLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const linkInput = shopeeLink.trim();
    if (!linkInput) {
      toast.error('Vui lòng nhập link hoặc ID sản phẩm Shopee');
      return;
    }

    const isItemId = /^\d+$/.test(linkInput);
    const isShopeeUrl = linkInput.includes('shopee.vn') ||
                        linkInput.includes('shp.ee') ||
                        linkInput.includes('s.shopee.vn');

    if (!isItemId && !isShopeeUrl) {
      toast.error('Link không hợp lệ! Vui lòng nhập link sản phẩm Shopee hoặc ID sản phẩm.');
      setCheckedProduct(null);
      return;
    }

    setIsSearching(true);
    setCheckedProduct(null);

    try {
      const queryParam = isItemId ? `item_id=${encodeURIComponent(linkInput)}` : `url=${encodeURIComponent(linkInput)}`;
      const API_BASE = import.meta.env.VITE_API_BASE || '/api';

      let data: any = null;

      // 1. Ưu tiên gọi qua Backend API server (Bảo mật API Key & tránh CORS)
      try {
        const response = await fetch(`${API_BASE}/shopee/product-info?${queryParam}`);
        if (response.ok) {
          data = await response.json();
        }
      } catch (beErr) {
        console.warn('Backend proxy fetch failed:', beErr);
      }

      // 2. Nếu Backend chưa cấu hình key và có key ở client settings, fallback gọi trực tiếp với key
      if ((!data || data.code === 'MISSING_API_KEY') && settings?.addlivetagApiKey) {
        try {
          const directUrl = `https://data.addlivetag.com/product-data/product-data.php?${queryParam}&key=${encodeURIComponent(settings.addlivetagApiKey.trim())}`;
          const directRes = await fetch(directUrl, {
            headers: { 'X-API-Key': settings.addlivetagApiKey.trim() }
          });
          if (directRes.ok) {
            data = await directRes.json();
          }
        } catch (dErr) {
          console.warn('Direct fetch failed:', dErr);
        }
      }

      if (data && data.status === 'success' && data.productInfo) {
        const info = data.productInfo;
        const validProductUrl = (info.productLink && !info.productLink.includes('-/-'))
          ? info.productLink
          : (linkInput.trim().startsWith('http')
              ? linkInput.trim()
              : `https://shopee.vn/product/${info.shopId || '0'}/${info.itemId}`);

        const productObj: any = {
          itemId: info.itemId,
          name: info.productName || 'Sản phẩm Shopee',
          shopName: info.shopName || 'Shopee Shop',
          price: Math.floor(Number(info.price) || 0),
          sales: info.sales || 0,
          image: info.imageUrl
            ? (info.imageUrl.startsWith('http') ? info.imageUrl : `https://cf.shopee.vn/file/${info.imageUrl}`)
            : '',
          url: validProductUrl,
          rating: info.rating || '5.0',
          commission: Math.floor(Number(info.commission) || 0),
          sellerComFinal: Math.floor(Number(info.sellerComFinal) || 0),
          shopeeComFinal: Math.floor(Number(info.shopeeComFinal) || 0),
          isXtra: !!info.isXtra,
          lastUpdate: info.lastUpdate || new Date().toLocaleString('vi-VN'),
          dataSource: info.dataSource || 'api',
          priceStats: info.priceStats || null,
          cashbackRate: info.price > 0 ? (Math.floor(Number(info.commission) || 0) / info.price) : 0.07
        };

        setCheckedProduct(productObj);
        try {
          sessionStorage.setItem('checked_shopee_product', JSON.stringify(productObj));
          sessionStorage.setItem('checked_shopee_input', linkInput);
        } catch (e) {}

        toast.success('Đã tìm thấy thông tin sản phẩm Shopee!');
      } else {
        setCheckedProduct(null);
        try {
          sessionStorage.removeItem('checked_shopee_product');
          sessionStorage.removeItem('checked_shopee_input');
        } catch (e) {}

        if (data?.code === 'MISSING_API_KEY' || data?.apiKeyNotice?.status === 'missing') {
          toast.error('Hệ thống chưa cài đặt API Key AddLiveTag. Vui lòng vào Cài đặt Quản trị viên để nhập API Key.');
        } else if (data?.message) {
          toast.error(`Sản phẩm không tồn tại hoặc link Shopee không đúng! (${data.message})`);
        } else {
          toast.error('Sản phẩm không tồn tại hoặc link Shopee không đúng! Vui lòng kiểm tra lại link.');
        }
      }
    } catch (error: any) {
      console.warn('Error fetching Shopee product:', error);
      setCheckedProduct(null);
      try {
        sessionStorage.removeItem('checked_shopee_product');
        sessionStorage.removeItem('checked_shopee_input');
      } catch (e) {}
      toast.error('Không tìm thấy sản phẩm hoặc link không tồn tại. Vui lòng kiểm tra lại link Shopee!');
    } finally {
      setIsSearching(false);
    }
  };

  // Khôi phục sản phẩm tra cứu trên màn hình khi load trang
  useEffect(() => {
    try {
      const savedProd = sessionStorage.getItem('checked_shopee_product');
      const savedInput = sessionStorage.getItem('checked_shopee_input');
      if (savedProd && !checkedProduct) {
        setCheckedProduct(JSON.parse(savedProd));
      }
      if (savedInput && !shopeeLink) {
        setShopeeLink(savedInput);
      }
    } catch (e) {}
  }, []);

  // Sau khi đăng nhập thành công: Giữ nguyên sản phẩm đã tra cứu trên màn hình để thực hiện bước tiếp theo
  useEffect(() => {
    if (currentUser) {
      try {
        const savedProd = sessionStorage.getItem('checked_shopee_product');
        const savedInput = sessionStorage.getItem('checked_shopee_input');
        if (savedProd && !checkedProduct) {
          setCheckedProduct(JSON.parse(savedProd));
        }
        if (savedInput && !shopeeLink) {
          setShopeeLink(savedInput);
        }

        const autoNext = sessionStorage.getItem('pending_auto_next_step');
        if (autoNext === 'true') {
          sessionStorage.removeItem('pending_auto_next_step');
          // Tự động mở Modal bước tiếp theo sau khi đăng nhập xong
          setTimeout(() => {
            const btn = document.getElementById('btn-buy-now-cashback');
            if (btn) {
              btn.click();
            }
          }, 350);
        }
      } catch (e) {}
    }
  }, [currentUser]);

  const handleCreateAffiliateLink = async () => {
    if (!checkedProduct) return;

    if (!currentUser) {
      // Lưu lại thông tin sản phẩm đã tra cứu và đánh dấu để mở tiếp sau khi đăng nhập
      try {
        sessionStorage.setItem('checked_shopee_product', JSON.stringify(checkedProduct));
        sessionStorage.setItem('checked_shopee_input', shopeeLink);
        sessionStorage.setItem('pending_auto_next_step', 'true');
      } catch (e) {}

      openAuthModal('login');
      return;
    }

    const openUrl = (targetUrl: string) => {
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

    try {
      const API_BASE = import.meta.env.VITE_API_BASE || '/api';
      const token = localStorage.getItem('token') || localStorage.getItem('access_token') || '';
      const userId = currentUser.id || '';

      const res = await fetch(`${API_BASE}/shopee/convert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          url: checkedProduct.url,
          userId: userId,
          user_id: userId,
          sub_id1: userId,
          sub_id: userId
        })
      });
      const data = await res.json();

      if (data && data.success && (data.link1 || data.affiliateLink)) {
        const link1 = data.link1 || data.affiliateLink; // Link 1: Cookie tiếp thị hệ thống (Giấy ăn Top Gia)
        const link2 = data.link2 || data.affiliateLink || data.originUrl || checkedProduct.url; // Link 2: Link sản phẩm thật của khách

        const newOrder: Order = {
          id: data.clickId || `CLK${Date.now()}${Math.random().toString(36).substring(2, 6)}`,
          productName: checkedProduct.name,
          productImage: checkedProduct.image,
          orderAmount: Math.floor(checkedProduct.price),
          estimatedCashback: Math.floor((Math.floor(checkedProduct.commission || 0)) * 0.5) || Math.floor(checkedProduct.price * (checkedProduct.cashbackRate || 0.07) * 0.5),
          status: 'pending',
          createdTime: new Date().toISOString().replace('T', ' ').slice(0, 19),
          userId: currentUser.id,
          productUrl: data.originUrl || checkedProduct.url,
          shopId: checkedProduct.shopId || data.shopId || '',
          itemId: checkedProduct.itemId || data.itemId || ''
        };
        addOrder(newOrder);

        if (step1ActivatedUrl === checkedProduct.url) {
          // LẦN 2: Người dùng đã ấn Bước 1 (Giấy ăn Top Gia) trước đó -> Mở trực tiếp link sản phẩm thật
          toast.success('Đang chuyển hướng sang sản phẩm của bạn trên Shopee...');
          setStep1ActivatedUrl(null);
          openUrl(link2);
        } else {
          // LẦN 1: Mở Popup Modal Quy Trình 2 Bước (Ấn Bước 1 Giấy ăn Top Gia thì Bước 2 mới mở khóa)
          setRedirectModalData({
            isOpen: true,
            link1,
            link2,
            productName: checkedProduct.name
          });
        }
      } else {
        toast.error(data?.message || 'Có lỗi xảy ra khi tạo link hoàn tiền');
      }
    } catch (err: any) {
      toast.error('Có lỗi xảy ra khi kết nối máy chủ');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Đã sao chép vào bộ nhớ tạm!');
  };

  return (
    <div className="pb-20">

      {/* HERO SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 md:pt-20 pb-16 md:pb-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto flex flex-col items-center"
        >
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/25 text-primary px-4 py-1.5 rounded-full text-xs font-bold mb-6">
            <Sparkles className="h-4 w-4" />
            <span>Tiết kiệm đến 15% mỗi lần mua sắm</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-text leading-[1.2] mb-6">
            Mua sắm thông minh <br />
            <span className="gradient-text">Hoàn tiền mỗi ngày</span>
          </h1>

          <p className="text-base md:text-lg text-text-secondary max-w-2xl leading-relaxed mb-8">
            Dán link sản phẩm Shopee để kiểm tra tiền hoàn dự kiến và tạo link hoàn tiền nhanh chóng.
          </p>

          {/* LARGE SEARCH INPUT */}
          <form onSubmit={handleCheckLink} className="w-full max-w-2xl bg-white p-2 rounded-[20px] shadow-soft border border-border flex flex-col md:flex-row gap-2 mb-8">
            <div className="flex-1 flex items-center px-3 gap-2">
              <Search className="h-5 w-5 text-text-secondary shrink-0" />
              <input
                type="text"
                placeholder="Dán link Shopee..."
                value={shopeeLink}
                onChange={(e) => setShopeeLink(e.target.value)}
                className="w-full bg-transparent border-none focus:ring-0 outline-none text-text text-sm md:text-base py-2.5"
              />
            </div>
            <Button
              type="submit"
              className="py-3 px-6 md:w-auto w-full text-sm md:text-base font-bold shrink-0"
              disabled={isSearching}
            >
              {isSearching ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Đang quét...
                </span>
              ) : 'Kiểm tra tiền hoàn'}
            </Button>
          </form>

          {/* Platforms supported */}
          <div className="flex items-center justify-center gap-4 flex-wrap text-xs md:text-sm font-semibold text-text-secondary mb-12">
            <span>Nền tảng hỗ trợ:</span>
            <span className="flex items-center gap-1.5 px-3.5 py-1.5 bg-orange-50 border border-orange-200 text-orange-600 rounded-full">
              <span className="w-2 h-2 rounded-full bg-orange-600 animate-pulse" />
              Shopee
            </span>
            <span className="flex items-center gap-1.5 px-3.5 py-1.5 bg-border/20 border border-border text-text-secondary rounded-full opacity-60">
              TikTok Shop
              <Badge variant="outline" className="text-[9px] py-0 px-1 bg-white font-bold ml-1">Sắp ra mắt</Badge>
            </span>
          </div>
        </motion.div>

        {/* RESULT CARD (ANALYZE PREVIEW) */}
        <AnimatePresence>
          {checkedProduct && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="max-w-2xl mx-auto mb-20"
            >
              <Card className="border border-primary/20 overflow-hidden relative bg-gradient-to-br from-white to-orange-50/20 card-shadow">
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-xl" />
                <CardContent className="p-6 md:p-8">
                  <div className="flex flex-col md:flex-row gap-6 items-start">
                    <div className="relative w-full md:w-44 shrink-0">
                      {checkedProduct.image ? (
                        <img
                          src={checkedProduct.image}
                          alt={checkedProduct.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-44 object-cover rounded-card border border-border shadow-sm"
                        />
                      ) : (
                        <div className="w-full h-44 rounded-card border border-border bg-orange-50/50 flex flex-col items-center justify-center text-orange-400 gap-2">
                          <ShoppingBag className="w-10 h-10 text-orange-400" />
                          <span className="text-xs font-semibold text-text-secondary">Shopee</span>
                        </div>
                      )}
                      {checkedProduct.sales > 0 && (
                        <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-xs text-white px-2 py-0.5 rounded-md text-[10px] font-semibold">
                          Đã bán: {checkedProduct.sales}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 flex flex-col text-left w-full">
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="secondary" className="bg-orange-500 text-white border-none py-1 px-3 text-xs font-bold">Shopee</Badge>
                          {checkedProduct.isXtra && (
                            <Badge className="bg-amber-500 text-white border-none py-1 px-2.5 text-[10px] font-black uppercase tracking-wider animate-pulse">Xtra Co</Badge>
                          )}
                          {checkedProduct.rating && (
                            <span className="flex items-center gap-0.5 text-xs font-bold text-amber-500 bg-amber-55 px-2 py-0.5 rounded-full border border-amber-200">
                              <Star className="h-3 w-3 fill-current" />
                              {checkedProduct.rating}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => { toggleFavorite(checkedProduct.url); toast.success('Đã cập nhật danh sách yêu thích'); }}
                            className={`p-2 rounded-full border border-border bg-white shadow-sm hover:scale-105 transition-all ${favorites.includes(checkedProduct.url) ? 'text-danger border-danger/25 bg-red-50/50' : 'text-text-secondary hover:text-text'}`}
                          >
                            <Heart className={`h-4.5 w-4.5 ${favorites.includes(checkedProduct.url) ? 'fill-current' : ''}`} />
                          </button>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(checkedProduct.url)}
                            className="p-2 rounded-full border border-border bg-white shadow-sm text-text-secondary hover:text-text hover:scale-105 transition-all"
                          >
                            <Share2 className="h-4.5 w-4.5" />
                          </button>
                        </div>
                      </div>

                      <h4 className="text-base font-bold text-text mb-1 leading-snug line-clamp-2">
                        {checkedProduct.name}
                      </h4>

                      {checkedProduct.shopName && (
                        <div className="flex items-center gap-1 text-xs text-text-secondary mb-4 font-semibold">
                          <Store className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span>Shop: {checkedProduct.shopName}</span>
                          <span className="text-border mx-1">|</span>
                          <span className="font-mono text-[10px] text-text-secondary/70">ID: {checkedProduct.itemId}</span>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4 bg-white/70 backdrop-blur-sm border border-border/50 p-4 rounded-input shadow-[0_2px_10px_rgba(0,0,0,0.01)] mb-4">
                        <div>
                          <p className="text-xs font-semibold text-text-secondary">Giá sản phẩm</p>
                          <p className="text-lg font-bold text-text">{checkedProduct.price.toLocaleString('vi-VN')}đ</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-primary flex items-center gap-1">
                            Tiền hoàn dự kiến
                          </p>
                          <p className="text-lg font-extrabold text-primary">
                            {Math.floor((checkedProduct.commission || 0) * 0.5).toLocaleString('vi-VN')}đ
                          </p>
                        </div>
                      </div>



                      <div className="flex items-start gap-2 text-xs text-text-secondary leading-relaxed mb-4">
                        <AlertCircle className="h-4.5 w-4.5 text-warning shrink-0 mt-0.5" />
                        <p>
                          Tiền hoàn hiển thị chỉ mang tính tham khảo. Tiền hoàn thực tế sẽ được cập nhật sau khi Shopee đối soát.
                        </p>
                      </div>

                      <div>
                        {step1ActivatedUrl === checkedProduct.url && (
                          <div className="mb-3 px-3.5 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-800 font-bold">
                            <span className="flex items-center gap-1.5">
                              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                              Đã kích hoạt hoa hồng! Bấm Bước 2 để mở sản phẩm của bạn.
                            </span>
                            <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-extrabold shrink-0">BƯỚC 2</span>
                          </div>
                        )}

                        <Button
                          id="btn-buy-now-cashback"
                          onClick={handleCreateAffiliateLink}
                          className={`w-full font-extrabold flex items-center justify-center gap-2 group py-4 transition-all text-base shadow-lg rounded-xl ${
                            step1ActivatedUrl === checkedProduct.url
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30 ring-2 ring-emerald-400'
                              : 'bg-primary text-white hover:bg-primary/95 shadow-primary/20 hover:shadow-xl hover:shadow-primary/30'
                          }`}
                        >
                          {step1ActivatedUrl === checkedProduct.url ? (
                            <>
                              <ShoppingBag className="h-5 w-5" />
                              Ấn lần 2 để mở trang sản phẩm mua hàng ngay
                              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                            </>
                          ) : (
                            <>
                              <ShoppingBag className="h-5 w-5" />
                              Ấn vào ngay mua hàng để hoàn tiền (2 bước)
                              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                            </>
                          )}
                        </Button>
                      </div>

                      {/* DATA SOURCE AND LAST UPDATE */}
                      <div className="mt-5 pt-3 border-t border-border/40 flex flex-wrap items-center justify-between gap-2 text-[10px] text-text-secondary/70">
                        <span className="flex items-center gap-1">
                          <Activity className="h-3 w-3 text-primary" />
                          <span>Nguồn dữ liệu: </span>
                          <span className="font-bold text-text-secondary uppercase">
                            {checkedProduct.dataSource === 'api'
                              ? 'API Shopee'
                              : checkedProduct.dataSource === 'db'
                                ? 'Cache Database'
                                : 'Mô phỏng (Fallback)'}
                          </span>
                        </span>
                        <span>Cập nhật: {checkedProduct.lastUpdate}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* QUICK TEST TRIGGER FOR USER DEMO */}
        {!checkedProduct && (
          <div className="max-w-2xl mx-auto flex items-center justify-center gap-2.5 flex-wrap text-xs text-text-secondary mb-16 bg-white/50 py-3.5 px-6 rounded-full border border-border/40 inline-flex shadow-[0_4px_20px_rgba(0,0,0,0.01)]">
            <span className="font-semibold text-text/80">Nhấn thử sản phẩm mẫu:</span>
            {SAMPLE_SHOPEE_PRODUCTS.map((prod, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setShopeeLink(prod.url);
                  setCheckedProduct(prod);
                  toast.success(`Đã chọn: ${prod.name.slice(0, 15)}...`);
                }}
                className="px-2.5 py-1 bg-white hover:bg-primary/5 hover:text-primary hover:border-primary/30 border border-border rounded-[8px] transition-all font-medium"
              >
                {prod.name.split(' ').slice(0, 3).join(' ')}
              </button>
            ))}
          </div>
        )}

        {/* 8-STEP CASHBACK PURCHASING GUIDE WITH DIRECT IMAGES */}
        <div className="bg-white border border-border/80 rounded-card p-6 md:p-10 card-shadow text-left mt-8 mb-12 max-w-7xl mx-auto hover:shadow-soft transition-all duration-300">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-primary/10 text-primary font-extrabold text-xs uppercase tracking-wider rounded-full mb-3">
              🚀 Quy trình mua hàng hoàn tiền
            </span>
            <h2 className="text-2xl md:text-4xl font-black text-text mb-3 leading-tight">
              Hướng Dẫn <span className="gradient-text">8 Bước Mua Hàng</span>
            </h2>
            <p className="text-xs md:text-sm text-text-secondary leading-relaxed">
              Các bước lần lượt từ Bước 1 đến Bước 8 với hình ảnh hiển thị trực tiếp hỗ trợ mua sắm hoàn tiền dễ dàng.
            </p>
          </div>

          {/* 8 Steps Grid Layout (Direct Image Display on Every Step Card) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {purchasingSteps.map((s) => (
              <div
                key={s.step}
                className="bg-white border border-border/80 hover:border-primary/50 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group relative overflow-hidden"
              >
                {/* Card Top Header */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-black px-3 py-1 rounded-full bg-primary text-white shadow-xs">
                    {s.badge}
                  </span>
                  <span className="text-xs font-bold text-text-secondary font-mono">
                    {s.step} / 8
                  </span>
                </div>

                {/* Card Body / Image Content */}
                {s.step === 1 ? (
                  <div className="flex-1 flex flex-col justify-between bg-gradient-to-br from-bg to-orange-50/40 p-5 rounded-xl border border-primary/20 min-h-[220px]">
                    <div className="flex flex-col items-center text-center my-auto">
                      <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3">
                        <Users className="h-7 w-7" />
                      </div>
                      <h4 className="font-extrabold text-text text-sm mb-1">Đăng ký / Đăng nhập</h4>
                      <p className="text-[11px] text-text-secondary leading-relaxed mb-3">
                        Đăng nhập để hệ thống tự động ghi nhận tiền hoàn vào tài khoản của bạn.
                      </p>
                      {currentUser ? (
                        <Badge variant="success" className="py-1 px-3 text-[11px] font-bold">
                          Đã đăng nhập ({currentUser.name})
                        </Badge>
                      ) : (
                        <Badge variant="warning" className="py-1 px-3 text-[11px] font-bold">
                          Chưa đăng nhập
                        </Badge>
                      )}
                    </div>
                    <Button
                      onClick={() => {
                        if (!currentUser) openAuthModal('login');
                        else navigate('/dashboard');
                      }}
                      className="w-full font-bold text-xs py-2.5 mt-2"
                    >
                      {currentUser ? 'Vào Dashboard cá nhân' : 'Đăng ký / Đăng nhập ngay'}
                    </Button>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col gap-2">
                    <div
                      onClick={() => setLightboxImage({ src: s.image!, step: s.step })}
                      className="w-full h-64 sm:h-72 bg-bg border border-border/60 rounded-xl overflow-hidden cursor-pointer relative group/img flex items-center justify-center shadow-inner"
                    >
                      <img
                        src={s.image!}
                        alt={`Hình ảnh ${s.badge}`}
                        onError={(e) => {
                          const target = e.currentTarget;
                          if (s.image && !target.src.includes('png')) {
                            target.src = s.image.replace('.jpg', '.png');
                          }
                        }}
                        className="w-full h-full object-contain p-1.5 group-hover/img:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1.5">
                        <Search className="h-4 w-4" /> Phóng to ảnh {s.badge}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* LIGHTBOX MODAL FOR FULL-SCREEN IMAGE VIEWING */}
        <AnimatePresence>
          {lightboxImage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLightboxImage(null)}
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
            >
              <motion.div
                initial={{ scale: 0.85, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.85, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl overflow-hidden max-w-4xl max-h-[90vh] shadow-2xl relative flex flex-col cursor-default"
              >
                <div className="p-4 bg-white border-b border-border flex items-center justify-between">
                  <span className="font-extrabold text-sm text-text flex items-center gap-2">
                    <span className="px-3 py-1 bg-primary text-white rounded-full text-xs">
                      BƯỚC {lightboxImage.step}
                    </span>
                    Ảnh minh họa quy trình mua hàng
                  </span>
                  <button
                    onClick={() => setLightboxImage(null)}
                    className="w-8 h-8 rounded-full bg-bg hover:bg-border text-text font-bold text-sm flex items-center justify-center transition-colors"
                  >
                    ✕
                  </button>
                </div>
                <div className="p-4 bg-black flex justify-center items-center overflow-auto">
                  <img
                    src={lightboxImage.src}
                    alt={`Phóng to Bước ${lightboxImage.step}`}
                    className="max-h-[75vh] w-auto object-contain rounded-lg"
                  />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* IMPORTANT NOTICE FOR CASHBACK ACCURACY */}
        <div className="bg-white border border-border/80 rounded-card p-6 md:p-8 card-shadow text-left mt-8 mb-12 max-w-7xl mx-auto hover:shadow-soft transition-all duration-300">
          {/* Header Row */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-primary text-white font-bold text-xs uppercase tracking-wider rounded-full">
                📌 Lưu ý quan trọng
              </span>
              <h2 className="text-xl md:text-2xl font-black text-text">
                Để đơn hàng được ghi nhận hoàn tiền chính xác
              </h2>
            </div>
            <p className="text-xs md:text-sm text-text-secondary max-w-md leading-relaxed">
              Làm đúng các bước dưới đây để tránh mất lượt hoàn tiền khi mua hàng qua Shopee hoặc TikTok Shop.
            </p>
          </div>

          {/* Steps Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
            {/* Step 1 */}
            <div className="bg-white border border-border/60 p-5 rounded-input transition-all duration-300 flex flex-col gap-3 hover:shadow-md hover:-translate-y-1.5 hover:border-primary/30 cursor-pointer">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <ShoppingCart className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-bold text-text text-sm mb-1">Giỏ hàng trống</h4>
                <p className="text-[11px] text-text-secondary leading-relaxed">Chỉ thêm sản phẩm sau khi bấm link hoàn tiền.</p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-white border border-border/60 p-5 rounded-input transition-all duration-300 flex flex-col gap-3 hover:shadow-md hover:-translate-y-1.5 hover:border-purple-500/30 cursor-pointer">
              <div className="w-10 h-10 rounded-full bg-purple-100/60 flex items-center justify-center shrink-0">
                <Link2 className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h4 className="font-bold text-text text-sm mb-1">Không mở link khác</h4>
                <p className="text-[11px] text-text-secondary leading-relaxed">Tránh click link Facebook, Telegram, YouTube, KOLs trước khi thanh toán.</p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-white border border-border/60 p-5 rounded-input transition-all duration-300 flex flex-col gap-3 hover:shadow-md hover:-translate-y-1.5 hover:border-amber-500/30 cursor-pointer">
              <div className="w-10 h-10 rounded-full bg-amber-100/60 flex items-center justify-center shrink-0">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h4 className="font-bold text-text text-sm mb-1">Thanh toán sớm</h4>
                <p className="text-[11px] text-text-secondary leading-relaxed">Nên hoàn tất đơn trong vòng 20 - 30 phút.</p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="bg-white border border-border/60 p-5 rounded-input transition-all duration-300 flex flex-col gap-3 hover:shadow-md hover:-translate-y-1.5 hover:border-red-500/30 cursor-pointer">
              <div className="w-10 h-10 rounded-full bg-red-100/60 flex items-center justify-center shrink-0">
                <ShieldAlert className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <h4 className="font-bold text-text text-sm mb-1">Tắt Adblock</h4>
                <p className="text-[11px] text-text-secondary leading-relaxed">Tránh chặn mã theo dõi khiến đơn không được ghi nhận.</p>
              </div>
            </div>

            {/* Step 5 */}
            <div className="bg-white border border-border/60 p-5 rounded-input transition-all duration-300 flex flex-col gap-3 hover:shadow-md hover:-translate-y-1.5 hover:border-blue-500/30 cursor-pointer">
              <div className="w-10 h-10 rounded-full bg-blue-100/60 flex items-center justify-center shrink-0">
                <RefreshCw className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h4 className="font-bold text-text text-sm mb-1">Đặt lại đúng cách</h4>
                <p className="text-[11px] text-text-secondary leading-relaxed">Hủy đơn thì cần quay lại web lấy link hoàn tiền mới.</p>
              </div>
            </div>
          </div>

          {/* Bottom Tip Callout */}
          <div className="bg-[#111111] text-white p-4 rounded-input flex items-center justify-center text-center gap-2">
            <span className="text-xs md:text-sm font-semibold flex items-center gap-1.5 flex-wrap justify-center">
              💡 <span className="text-amber-400 font-bold">Mẹo nhỏ:</span> Click link hoàn tiền → thêm sản phẩm → thanh toán ngay để tăng tỷ lệ ghi nhận đơn.
            </span>
          </div>
        </div>

        {/* FEATURE CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-7xl mx-auto mt-8">
          {[
            { icon: <Zap className="h-6 w-6 text-primary" />, title: "Miễn phí", desc: "Không phát sinh bất kỳ chi phí ẩn nào khi sử dụng hệ thống." },
            { icon: <CheckCircle2 className="h-6 w-6 text-success" />, title: "Nhanh chóng", desc: "Tạo link hoàn tiền và chuyển khoản tự động tức thì." },
            { icon: <ShieldCheck className="h-6 w-6 text-info" />, title: "An toàn", desc: "Bảo mật thông tin đơn hàng và tài khoản ngân hàng tuyệt đối." },
            { icon: <LineChart className="h-6 w-6 text-accent" />, title: "Đối soát minh bạch", desc: "Cập nhật dữ liệu từ Shopee rõ ràng, chi tiết từng giao dịch." }
          ].map((item, idx) => (
            <div key={idx} className="bg-white border border-border/50 p-6 rounded-card card-shadow text-left hover:translate-y-[-5px] transition-transform duration-300">
              <div className="bg-bg p-3 rounded-[16px] inline-block mb-4">
                {item.icon}
              </div>
              <h3 className="font-bold text-text text-base mb-2">{item.title}</h3>
              <p className="text-xs text-text-secondary leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* REFERRAL PROMO BANNER (Premium Design) */}
        <div className="max-w-7xl mx-auto mt-16 bg-white rounded-3xl p-8 md:p-12 relative overflow-hidden border border-orange-100 shadow-soft">
          {/* Abstract Glowing Background Elements */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-orange-100/60 to-amber-50/30 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/4 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-gradient-to-tr from-rose-50/50 to-orange-50/30 rounded-full blur-[60px] translate-y-1/3 -translate-x-1/3 pointer-events-none"></div>

          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-12">
            {/* Left Text Content */}
            <div className="max-w-xl text-left flex-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-primary rounded-full text-xs font-bold uppercase tracking-wider mb-6 border border-orange-100 shadow-sm">
                <Users className="h-4 w-4" /> Chương trình đối tác
              </div>
              <h2 className="text-3xl md:text-5xl font-black text-text mb-5 leading-[1.15] tracking-tight">
                Mời bạn bè, nhận <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-primary">20% hoa hồng</span> trọn đời
              </h2>
              <p className="text-text-secondary text-sm md:text-base leading-relaxed mb-8 font-medium">
                Xây dựng nguồn thu nhập thụ động bền vững. Bất cứ khi nào người bạn giới thiệu mua sắm và nhận được tiền hoàn, bạn sẽ tự động được cộng thêm 20% vào ví.
              </p>
              {currentUser ? (
                <Button onClick={() => {
                  const refLink = `${window.location.origin}/auth?mode=register&ref=${currentUser.id}`;
                  navigator.clipboard.writeText(refLink);
                  toast.success('Đã sao chép link giới thiệu!');
                }} className="bg-primary hover:bg-primary/90 text-white font-bold px-8 py-3.5 rounded-full shadow-lg shadow-primary/30 flex items-center gap-2.5 transition-all hover:scale-105 active:scale-95">
                  <Copy className="h-5 w-5" /> Lấy Link Giới Thiệu Ngay
                </Button>
              ) : (
                <Button onClick={() => navigate('/auth?mode=register')} className="bg-primary hover:bg-primary/90 text-white font-bold px-8 py-3.5 rounded-full shadow-lg shadow-primary/30 flex items-center gap-2.5 transition-all hover:scale-105 active:scale-95">
                  Lấy Mã Giới Thiệu Ngay
                </Button>
              )}
            </div>

            {/* Right Floating Card */}
            <div className="flex-shrink-0 relative">
              {/* Glowing shadow behind card */}
              <div className="absolute inset-0 bg-gradient-to-tr from-orange-400 to-primary rounded-3xl blur-2xl opacity-20 animate-pulse"></div>
              <div className="bg-white p-8 md:p-10 rounded-3xl border border-orange-100 shadow-xl relative z-10 flex flex-col items-center justify-center min-w-[220px] min-h-[220px]">
                <div className="absolute -top-4 -right-4 bg-yellow-400 text-yellow-900 text-[10px] font-black uppercase px-4 py-2 rounded-full shadow-md transform rotate-12">
                  Không giới hạn
                </div>
                <div className="w-20 h-20 bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl flex items-center justify-center mb-4 border border-orange-100 text-primary shadow-inner">
                  <Wallet className="h-10 w-10" />
                </div>
                <h3 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-orange-500 to-red-600 mb-1">+20%</h3>
                <p className="font-bold text-text-secondary text-sm mt-1">Hoa hồng F1</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW CASHBACK WORKS */}
      <section id="cach-hoat-dong" className="bg-bg py-24 border-y border-border/50 relative overflow-hidden">
        {/* Background glow decoration */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="max-w-2xl mx-auto mb-16">
            <span className="px-3.5 py-1.5 bg-primary/10 text-primary font-bold text-xs uppercase tracking-wider rounded-full mb-4 inline-block">
              Quy trình tự động
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-text mb-4">
              Nhận tiền hoàn chỉ với <span className="gradient-text font-black inline-block">4 bước đơn giản</span>
            </h2>
            <p className="text-sm md:text-base text-text-secondary leading-relaxed">
              Hoạt động cực kỳ đơn giản và tự động. Bạn mua sắm bình thường, chúng tôi hoàn lại tiền.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { num: "01", icon: <Search className="h-6 w-6 text-primary" />, title: "Dán link sản phẩm", desc: "Tìm sản phẩm bạn muốn mua trên Shopee và dán link vào ô kiểm tra tiền hoàn tại trang chủ." },
              { num: "02", icon: <Sparkles className="h-6 w-6 text-amber-500" />, title: "Tạo link hoàn tiền", desc: "Hệ thống tự động phân tích và tạo cho bạn một đường link mua hàng hoàn tiền độc quyền." },
              { num: "03", icon: <ShoppingBag className="h-6 w-6 text-emerald-500" />, title: "Đặt mua sản phẩm", desc: "Click vào link vừa tạo và mua sắm như bình thường trên ứng dụng hoặc trang web Shopee." },
              { num: "04", icon: <Wallet className="h-6 w-6 text-blue-500" />, title: "Nhận tiền hoàn về ví", desc: "Sau khi giao dịch thành công, tiền hoàn sẽ được ghi nhận và đối soát tự động về ví của bạn." }
            ].map((step, idx) => (
              <div key={idx} className="bg-white border border-border/60 hover:border-primary/20 p-8 rounded-card card-shadow text-center hover:translate-y-[-8px] hover:shadow-soft transition-all duration-300 flex flex-col items-center justify-between h-full group relative">
                {/* Step number badge */}
                <div className="absolute top-4 right-5 text-sm font-black text-text/10 group-hover:text-primary/20 transition-colors font-mono">
                  {step.num}
                </div>

                <div className="flex flex-col items-center">
                  {/* Icon container */}
                  <div className="w-14 h-14 rounded-2xl bg-bg border border-border flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 group-hover:border-primary/20 transition-all duration-300">
                    {step.icon}
                  </div>

                  <h3 className="font-extrabold text-text text-base md:text-lg mb-3">
                    {step.title}
                  </h3>
                  <p className="text-xs md:text-sm text-text-secondary leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>





      {/* TESTIMONIALS */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl font-extrabold text-text mb-4">
            Đánh giá từ <span className="text-primary">thành viên tiết kiệm</span>
          </h2>
          <p className="text-sm text-text-secondary">
            Lắng nghe trải nghiệm của những người dùng thông thái đã mua sắm và tích lũy được hàng triệu đồng cùng chúng tôi.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              quote: "Hồi đầu thấy hoàn tiền mấy nghìn một món tưởng ít, ai ngờ cộng dồn mua cả cái tủ lạnh với điện thoại sau 3 tháng vào ví rút được hơn 2 triệu luôn. Siêu ưng ý!",
              author: "Chị Minh Thư",
              role: "Mua sắm gia đình, Hà Nội",
              avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=150"
            },
            {
              quote: "Là tín đồ Shopee đặt hàng mỗi ngày, từ khi biết trang web này mình tiết kiệm được hẳn 10% chi phí mua sắm. Thao tác dán link tạo mã mất chưa tới 5 giây, cực kỳ tiện lợi.",
              author: "Bạn Hoàng Nam",
              role: "Sinh viên, TP. HCM",
              avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150"
            },
            {
              quote: "Rút tiền cực kỳ nhanh và minh bạch. Chỉ cần đủ 50k là tạo yêu cầu chuyển khoản, chiều hôm trước rút sáng hôm sau tiền đã ting ting tài khoản. Sẽ giới thiệu cho bạn bè dùng thử.",
              author: "Anh Quốc Bảo",
              role: "Nhân viên văn phòng, Đà Nẵng",
              avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=150"
            }
          ].map((item, idx) => (
            <Card key={idx} className="bg-white border border-border/50 p-6 flex flex-col justify-between h-full relative">
              <div className="absolute top-6 right-6 text-primary/10">
                <MessageSquare className="h-10 w-10 fill-current" />
              </div>
              <div>
                <div className="flex gap-1 mb-4 text-warning">
                  {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
                </div>
                <p className="text-xs md:text-sm text-text-secondary leading-relaxed italic mb-6">
                  "{item.quote}"
                </p>
              </div>
              <div className="flex items-center gap-3">
                <img src={item.avatar} alt={item.author} className="w-11 h-11 rounded-full object-cover border border-border" />
                <div>
                  <h4 className="font-bold text-text text-sm leading-tight">{item.author}</h4>
                  <p className="text-[10px] text-text-secondary font-semibold">{item.role}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* FREQUENTLY ASKED QUESTIONS */}
      <section id="hoi-dap" className="bg-white py-20 border-t border-border/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-extrabold text-text mb-4">
              Giải đáp thắc mắc thường gặp
            </h2>
            <p className="text-sm text-text-secondary">
              Mọi thắc mắc của bạn về quy trình hoàn tiền, đối soát và rút số dư sẽ được trả lời tại đây.
            </p>
          </div>

          <Accordion>
            <AccordionItem title="Quy trình hoàn tiền hoạt động như thế nào?" isOpenDefault={true}>
              Chúng tôi liên kết với Shopee qua chương trình Tiếp thị liên kết (Affiliate Marketing). Khi bạn tạo link hoàn tiền và mua sắm thông qua link đó, Shopee sẽ trả hoa hồng cho chúng tôi. Chúng tôi trích tới 50% số tiền hoa hồng nhận được để trả lại cho bạn dưới dạng Tiền Hoàn.
            </AccordionItem>
            <AccordionItem title="Tại sao đơn hàng đã hoàn thành nhưng tiền hoàn vẫn ở trạng thái Chờ đối soát?">
              Sau khi bạn nhận hàng thành công, Shopee cần thời gian thông thường 7 ngày để đối soát, xác nhận không xảy ra trả hàng, hoàn tiền hoặc gian lận. Khi Shopee phê duyệt đơn hàng, hệ thống sẽ tự động cập nhật số dư khả dụng cho bạn rút tiền.
            </AccordionItem>
            <AccordionItem title="Số dư tối thiểu để rút tiền là bao nhiêu?">
              Hạn mức rút tiền tối thiểu của ví hoàn tiền là 50,000đ. Bạn có thể gửi yêu cầu rút tiền bất cứ lúc nào khi số dư khả dụng đạt trên 50,000đ. Tiền sẽ được chuyển khoản trực tiếp vào tài khoản ngân hàng liên kết của bạn.
            </AccordionItem>
            <AccordionItem title="Chương trình giới thiệu bạn bè nhận 20% hoa hồng là gì?">
              Khi bạn đăng ký tài khoản, hệ thống sẽ cấp cho bạn một "Mã giới thiệu". Nếu bạn bè của bạn nhập mã này khi đăng ký tài khoản, họ sẽ trở thành người do bạn giới thiệu. Sau đó, bất cứ khi nào bạn bè của bạn nhận được hoàn tiền từ các đơn hàng thành công, bạn sẽ tự động nhận được thêm 20% thu nhập (trích từ ngân sách hệ thống, bạn bè không bị trừ tiền).
            </AccordionItem>
            <AccordionItem title="Tôi có cần tạo tài khoản để được nhận hoàn tiền không?">
              Bạn có thể sử dụng công cụ kiểm tra tiền hoàn miễn phí mà không cần đăng nhập. Tuy nhiên, để tạo link mua hàng, tích lũy số dư và rút tiền về tài khoản ngân hàng, bạn bắt buộc phải đăng nhập/đăng ký tài khoản để hệ thống có thể ghi nhận đúng mã định danh của bạn.
            </AccordionItem>
            <AccordionItem title="Tôi có được hoàn tiền khi áp dụng mã giảm giá của Shopee không?">
              Có! Bạn vẫn nhận được tiền hoàn bình thường dựa trên số tiền thanh toán thực tế (sau khi đã áp dụng Shopee Voucher, Shop Voucher và Shopee Xu).
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* MODAL MUA HÀNG 2 BƯỚC KHÓA BƯỚC 2 CHO TỚI KHI BẤM BƯỚC 1 */}
      <TwoStepRedirectModal
        isOpen={redirectModalData.isOpen}
        onClose={() => setRedirectModalData(prev => ({ ...prev, isOpen: false }))}
        link1={redirectModalData.link1}
        link2={redirectModalData.link2}
        productName={redirectModalData.productName}
        onStep1Completed={() => {
          if (checkedProduct) setStep1ActivatedUrl(checkedProduct.url);
        }}
      />
    </div>
  );
}
