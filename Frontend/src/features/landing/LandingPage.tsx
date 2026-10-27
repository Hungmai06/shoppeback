import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, CheckCircle2, ShieldCheck, Zap, LineChart,
  ArrowRight, Copy, Heart, Share2,
  MessageSquare, Star, ShoppingBag, Sparkles, AlertCircle, Wallet,
  Store, Activity, ShoppingCart, Link2, Clock, ShieldAlert, RefreshCw, Users,
  Clipboard, Info
} from 'lucide-react';
import { Button, Card, CardContent, Badge, Accordion, AccordionItem } from '../../components/ui/core';
import { useAppStore } from '../../store/appStore';
import type { Order } from '../../store/appStore';
import { toast } from 'sonner';

import TwoStepRedirectModal from '../../components/common/TwoStepRedirectModal';

// Custom Shopee Brand Icon
function ShopeeBrandIcon({ className = "w-5 h-5", inverted = false }: { className?: string; inverted?: boolean }) {
  if (inverted) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M6 3L3 7V20C3 20.5304 3.21071 21.0391 3.58579 21.4142C3.96086 21.7893 4.46957 22 5 22H19C19.5304 22 20.0391 21.7893 20.4142 21.4142C20.7893 21.0391 21 20.5304 21 20V7L18 3H6Z"
          fill="white"
        />
        <path d="M3 7H21" stroke="#EE4D2D" strokeWidth="1.5" strokeLinecap="round" />
        <path
          d="M16 10C16 12.2091 14.2091 14 12 14C9.79086 14 8 12.2091 8 10"
          stroke="#EE4D2D"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M13.5 16.5C13.5 17.3 12.8 18 12 18C11.2 18 10.5 17.3 10.5 16.5"
          stroke="#FFB000"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M6 3L3 7V20C3 20.5304 3.21071 21.0391 3.58579 21.4142C3.96086 21.7893 4.46957 22 5 22H19C19.5304 22 20.0391 21.7893 20.4142 21.4142C20.7893 21.0391 21 20.5304 21 20V7L18 3H6Z"
        fill="#EE4D2D"
      />
      <path d="M3 7H21" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M16 10C16 12.2091 14.2091 14 12 14C9.79086 14 8 12.2091 8 10"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M13.5 16.5C13.5 17.3 12.8 18 12 18C11.2 18 10.5 17.3 10.5 16.5"
        stroke="#FFB000"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Custom TikTok Brand Icon
function TikTokBrandIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg className="w-full h-full drop-shadow-xs" viewBox="0 0 24 24" fill="currentColor">
        <path
          d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.04-.1z"
        />
      </svg>
      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#00F2FE] border border-white" />
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentUser, addOrder, toggleFavorite, favorites, openAuthModal, settings } = useAppStore();

  // Platform selection state: 'shopee' | 'tiktok'
  const initialPlatform = searchParams.get('platform') === 'tiktok' ? 'tiktok' : 'shopee';
  const [activePlatform, setActivePlatform] = useState<'shopee' | 'tiktok'>(initialPlatform);
  const [guidePlatform, setGuidePlatform] = useState<'shopee' | 'tiktok'>(initialPlatform);

  useEffect(() => {
    setGuidePlatform(activePlatform);
  }, [activePlatform]);

  // Unified search state (Shopee & TikTok)
  const [unifiedLink, setUnifiedLink] = useState('');

  // Shopee states
  const [shopeeLink, setShopeeLink] = useState('');
  const [checkedProduct, setCheckedProduct] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);

  // TikTok states
  const [tiktokLink, setTiktokLink] = useState('');
  const [checkedTikTokProduct, setCheckedTikTokProduct] = useState<any>(null);
  const [isTikTokSearching, setIsTikTokSearching] = useState(false);

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
    { step: 2, badge: "BƯỚC 2", title: "Bước 2", image: "/guide/1-sm.jpg", full: "/guide/1-lg.jpg" },
    { step: 3, badge: "BƯỚC 3", title: "Bước 3", image: "/guide/2-sm.jpg", full: "/guide/2-lg.jpg" },
    { step: 4, badge: "BƯỚC 4", title: "Bước 4", image: "/guide/3-sm.jpg", full: "/guide/3-lg.jpg" },
    { step: 5, badge: "BƯỚC 5", title: "Bước 5", image: "/guide/4-sm.jpg", full: "/guide/4-lg.jpg" },
    { step: 6, badge: "BƯỚC 6", title: "Bước 6", image: "/guide/5-sm.jpg", full: "/guide/5-lg.jpg" },
    { step: 7, badge: "BƯỚC 7", title: "Bước 7", image: "/guide/6-sm.jpg", full: "/guide/6-lg.jpg" },
    { step: 8, badge: "BƯỚC 8", title: "Bước 8", image: "/guide/7-sm.jpg", full: "/guide/7-lg.jpg" }
  ];

  const tiktokPurchasingSteps = [
    {
      step: 1,
      badge: "BƯỚC 1",
      title: "Đăng ký / Đăng nhập tài khoản",
      desc: "Đăng nhập để hệ thống tự động ghi nhận tiền hoàn vào ví tài khoản của bạn.",
      isAuth: true
    },
    {
      step: 2,
      badge: "BƯỚC 2",
      title: "Sao chép link TikTok Shop",
      desc: "Mở app TikTok, tìm sản phẩm muốn mua trong video, livestream hoặc giỏ hàng. Bấm Chia sẻ ➔ chọn 'Sao chép liên kết'.",
      icon: <Copy className="h-6 w-6 text-[#00F2FE]" />,
      hint: "Hỗ trợ link vt.tiktok.com, tiktok.com hoặc video có giỏ vàng"
    },
    {
      step: 3,
      badge: "BƯỚC 3",
      title: "Dán link & Tra cứu hoàn tiền",
      desc: "Dán link vào ô tìm kiếm ở đầu trang và bấm 'Tìm'. Hệ thống sẽ tự động kích hoạt mã theo dõi hoa hồng cho bạn.",
      icon: <Search className="h-6 w-6 text-[#FE2C55]" />,
      hint: "Kiểm tra mức hoàn tiền và tạo link tiếp thị tự động"
    },
    {
      step: 4,
      badge: "BƯỚC 4",
      title: "Bấm 'Mua hàng nhận hoàn tiền'",
      desc: "Nhấn nút 'Ấn vào đây mua hàng để nhận hoàn tiền TikTok'. Hệ thống sẽ tự động mở ứng dụng TikTok trên máy bạn.",
      icon: <ShoppingCart className="h-6 w-6 text-[#00F2FE]" />,
      hint: "Tự động chuyển tiếp an toàn sang app TikTok chính thức"
    },
    {
      step: 5,
      badge: "BƯỚC 5",
      title: "Thêm giỏ & Thanh toán ngay",
      desc: "Trong ứng dụng TikTok, thêm sản phẩm vào giỏ và hoàn tất đặt hàng trong 24h. Vẫn áp dụng trọn vẹn voucher TikTok Shop & FreeShip.",
      icon: <Zap className="h-6 w-6 text-amber-500" />,
      hint: "Tránh bấm link KOL khác trước khi thanh toán"
    },
    {
      step: 6,
      badge: "BƯỚC 6",
      title: "Nhận tiền hoàn về ví",
      desc: "Sau khi đơn hàng giao thành công, tiền hoàn sẽ được ghi nhận vào ví cá nhân của bạn để rút về tài khoản ngân hàng.",
      icon: <Wallet className="h-6 w-6 text-emerald-500" />,
      hint: "Rút tiền nhanh chóng về mọi tài khoản ngân hàng Việt Nam"
    }
  ];

  const fetchShopeeProduct = async (linkInput: string) => {
    const rawInput = linkInput.trim();
    if (!rawInput) {
      toast.error('Vui lòng nhập link hoặc ID sản phẩm Shopee');
      return;
    }

    const isItemId = /^\d+$/.test(rawInput);
    const isShopeeUrl = rawInput.includes('shopee.vn') ||
                        rawInput.includes('shp.ee') ||
                        rawInput.includes('s.shopee.vn');

    const isTikTokUrl = rawInput.includes('tiktok.com') ||
                        rawInput.includes('vt.tiktok.com') ||
                        rawInput.includes('shop.tiktok.com') ||
                        rawInput.includes('snssdk.com');

    if (isTikTokUrl) {
      setActivePlatform('tiktok');
      setTiktokLink(rawInput);
      setUnifiedLink(rawInput);
      fetchTikTokProduct(rawInput);
      return;
    }

    if (!isItemId && !isShopeeUrl) {
      toast.error('Link không hợp lệ! Vui lòng nhập link sản phẩm Shopee hoặc TikTok Shop.');
      setCheckedProduct(null);
      return;
    }

    setIsSearching(true);
    setCheckedProduct(null);

    try {
      const queryParam = isItemId ? `item_id=${encodeURIComponent(rawInput)}` : `url=${encodeURIComponent(rawInput)}`;
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
          : (rawInput.startsWith('http')
              ? rawInput
              : `https://shopee.vn/product/${info.shopId || '0'}/${info.itemId}`);

        const rawComm = Math.max(
          Number(info.commission) || 0,
          (Number(info.sellerComFinal) || 0) + (Number(info.shopeeComFinal) || 0)
        );
        const estCashback = Math.floor(rawComm * 0.5);

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
          commission: rawComm,
          estimatedCashback: estCashback, // Chính xác 50% hoa hồng do API trả ra
          sellerComFinal: Math.floor(Number(info.sellerComFinal) || 0),
          shopeeComFinal: Math.floor(Number(info.shopeeComFinal) || 0),
          isXtra: !!info.isXtra,
          lastUpdate: info.lastUpdate || new Date().toLocaleString('vi-VN'),
          dataSource: info.dataSource || 'api',
          priceStats: info.priceStats || null,
          cashbackRate: info.price > 0 ? (estCashback / info.price) : 0.035
        };

        setCheckedProduct(productObj);
        try {
          sessionStorage.setItem('checked_shopee_product', JSON.stringify(productObj));
          sessionStorage.setItem('checked_shopee_input', rawInput);
        } catch (e) {}
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

  const handleUnifiedSearch = async (linkParam?: string) => {
    const rawInput = (linkParam !== undefined ? linkParam : (unifiedLink || shopeeLink || tiktokLink)).trim();
    if (!rawInput) {
      toast.error('Vui lòng nhập link sản phẩm Shopee hoặc TikTok Shop');
      return;
    }

    const isTikTokUrl = rawInput.includes('tiktok.com') ||
                        rawInput.includes('vt.tiktok.com') ||
                        rawInput.includes('shop.tiktok.com') ||
                        rawInput.includes('snssdk.com');

    if (isTikTokUrl) {
      setActivePlatform('tiktok');
      setTiktokLink(rawInput);
      setUnifiedLink(rawInput);
      setCheckedProduct(null);
      await fetchTikTokProduct(rawInput);
    } else {
      setActivePlatform('shopee');
      setShopeeLink(rawInput);
      setUnifiedLink(rawInput);
      setCheckedTikTokProduct(null);
      await fetchShopeeProduct(rawInput);
    }
  };

  const handlePasteLink = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        const clean = text.trim();
        setUnifiedLink(clean);
        toast.success('Đã dán link từ bộ nhớ tạm!');
        await handleUnifiedSearch(clean);
      } else {
        toast.info('Bộ nhớ tạm đang trống. Hãy sao chép link Shopee hoặc TikTok trước.');
      }
    } catch (e) {
      toast.info('Vui lòng dán trực tiếp link vào ô tìm kiếm (Ctrl + V)');
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

      const savedTikTokProd = sessionStorage.getItem('checked_tiktok_product');
      const savedTikTokInput = sessionStorage.getItem('checked_tiktok_input');
      if (savedTikTokProd && !checkedTikTokProduct) {
        setCheckedTikTokProduct(JSON.parse(savedTikTokProd));
      }
      if (savedTikTokInput && !tiktokLink) {
        setTiktokLink(savedTikTokInput);
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
          setTimeout(() => {
            const btn = document.getElementById('btn-buy-now-cashback');
            if (btn) {
              btn.click();
            }
          }, 350);
        }

        const autoNextTikTok = sessionStorage.getItem('pending_auto_next_tiktok');
        if (autoNextTikTok === 'true') {
          sessionStorage.removeItem('pending_auto_next_tiktok');
          setTimeout(() => {
            const btn = document.getElementById('btn-buy-now-tiktok');
            if (btn) {
              btn.click();
            }
          }, 350);
        }
      } catch (e) {}
    }
  }, [currentUser]);

  // Tra cứu sản phẩm TikTok Shop
  const fetchTikTokProduct = async (linkInput: string) => {
    if (!linkInput) return;

    setIsTikTokSearching(true);
    setCheckedTikTokProduct(null);

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

        const rawComm = Math.floor(Number(prod.commissionAmount || prod.estimatedCommission) || 0);
        const estCashback = (prod.estimatedCashback !== undefined && prod.estimatedCashback !== null && prod.estimatedCashback > 0)
          ? Math.floor(Number(prod.estimatedCashback))
          : (rawComm > 0
              ? Math.floor(rawComm * 0.5)
              : (prod.price > 0 && prod.commissionRate > 0
                  ? Math.floor(prod.price * (prod.commissionRate / 100) * 0.5)
                  : 0));
        const userCashbackRate = Number(((prod.userCashbackRate || (prod.commissionRate || 10) * 0.5)).toFixed(1));

        const finalProductObj = {
          ...prod,
          estimatedCashback: estCashback, // Chính xác 50% hoa hồng API
          userCashbackRate,
          affiliateLink: data.affiliateLink,
          subId: data.subId,
          productId: data.productId,
          mode: data.mode,
          originUrl: linkInput,
          clickId: data.clickId
        };

        setCheckedTikTokProduct(finalProductObj);
        try {
          sessionStorage.setItem('checked_tiktok_product', JSON.stringify(finalProductObj));
          sessionStorage.setItem('checked_tiktok_input', linkInput);
        } catch (e) {}
      } else {
        toast.error(data.message || 'Không thể lấy thông tin tiền hoàn TikTok. Vui lòng kiểm tra lại link!');
      }
    } catch (err: any) {
      console.warn('Lỗi khi tra cứu link TikTok:', err);
      toast.error('Lỗi kết nối khi tra cứu link TikTok. Vui lòng thử lại!');
    } finally {
      setIsTikTokSearching(false);
    }
  };

  const handleOpenTikTokAffiliateLink = () => {
    if (!checkedTikTokProduct || !checkedTikTokProduct.affiliateLink) return;

    if (!currentUser) {
      try {
        sessionStorage.setItem('checked_tiktok_product', JSON.stringify(checkedTikTokProduct));
        sessionStorage.setItem('checked_tiktok_input', tiktokLink);
        sessionStorage.setItem('pending_auto_next_tiktok', 'true');
      } catch (e) {}

      toast.info('Vui lòng đăng nhập để hệ thống ghi nhận hoa hồng TikTok vào ví của bạn');
      openAuthModal('login');
      return;
    }

    try {
      const newOrder: any = {
        id: checkedTikTokProduct.clickId || `TT${Date.now()}${Math.random().toString(36).substring(2, 6)}`,
        productName: checkedTikTokProduct.name || 'Sản phẩm TikTok Shop',
        productImage: checkedTikTokProduct.image || '',
        orderAmount: Math.floor(checkedTikTokProduct.price || 0),
        estimatedCashback: Math.floor(checkedTikTokProduct.estimatedCashback || 0),
        status: 'pending',
        createdTime: new Date().toISOString().replace('T', ' ').slice(0, 19),
        userId: currentUser.id,
        productUrl: checkedTikTokProduct.originUrl || tiktokLink,
        platform: 'tiktok'
      };
      addOrder(newOrder);
    } catch (e) {}

    window.open(checkedTikTokProduct.affiliateLink, '_blank', 'noopener,noreferrer');
  };

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

      {/* HERO SECTION - UNIFIED SHOPEE & TIKTOK CASHBACK */}
      <section className="relative overflow-hidden pt-10 md:pt-14 pb-4 md:pb-6 text-center bg-gradient-to-b from-[#EFF6FF]/70 via-[#F8FAFC]/50 to-transparent">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[360px] pointer-events-none" style={{ background: 'radial-gradient(closest-side, rgba(96,165,250,0.14), rgba(96,165,250,0))' }} />

        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl mx-auto px-4 flex flex-col items-center relative z-10"
        >
          {/* TOP PILL BADGE */}
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/90 border border-blue-200/80 shadow-xs mb-5 backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5 text-emerald-500 fill-emerald-500" />
            <span className="text-[11px] md:text-xs font-black uppercase tracking-wider text-blue-600">
              MUA SẮM THÔNG MINH
            </span>
          </div>

          {/* MAIN HEADING WITH 3D MAGNIFYING GLASS */}
          <div className="flex items-center justify-center gap-3 md:gap-5 mb-4 flex-wrap">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.15] text-center">
              Tìm sản phẩm <br />
              <span className="bg-gradient-to-r from-[#2563EB] via-[#0284C7] to-[#06B6D4] bg-clip-text text-transparent">
                Nhận hoàn tiền
              </span>
            </h1>

            {/* 3D MAGNIFYING GLASS WITH % ICON */}
            <div className="relative w-16 h-16 md:w-20 md:h-20 shrink-0 drop-shadow-xl">
              <div className="w-full h-full rounded-full bg-gradient-to-tr from-[#2563EB] via-[#38BDF8] to-sky-100 p-1.5 shadow-lg shadow-blue-500/25">
                <div className="w-full h-full rounded-full bg-gradient-to-b from-sky-50 to-white flex items-center justify-center border-2 border-white">
                  <span className="text-[#2563EB] font-black text-2xl md:text-3xl">%</span>
                </div>
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 md:w-7 md:h-7 rounded-full bg-gradient-to-tr from-[#1D4ED8] to-[#06B6D4] border-2 border-white shadow-md transform rotate-45" />
            </div>
          </div>

          {/* SUBTITLE */}
          <p className="text-sm md:text-base text-slate-500 max-w-lg leading-relaxed mb-8 font-medium">
            Tìm kiếm sản phẩm trên Shopee và TikTok Shop để nhận hoàn tiền tự động.
          </p>

          {/* UNIFIED SEARCH CAPSULE (SHOPEE & TIKTOK) */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleUnifiedSearch();
            }}
            className="w-full max-w-2xl bg-white p-2 rounded-[28px] md:rounded-full shadow-[0_12px_40px_rgba(37,99,235,0.09)] border border-blue-100/90 ring-4 ring-blue-500/5 flex flex-col sm:flex-row items-center gap-2 mb-3.5 transition-all"
          >
            <div className="flex-1 flex items-center px-3 gap-2.5 w-full">
              <Search className="h-5 w-5 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Bạn muốn mua gì?"
                value={unifiedLink}
                onChange={(e) => setUnifiedLink(e.target.value)}
                className="w-full bg-transparent border-none focus:ring-0 outline-none text-slate-800 text-sm md:text-base py-2.5 font-medium placeholder:text-slate-400"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0 px-1 pb-1 sm:p-0">
              {/* DÁN LINK BUTTON */}
              <button
                type="button"
                onClick={handlePasteLink}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold text-xs md:text-sm border border-blue-200/60 transition-all cursor-pointer shrink-0 active:scale-95"
              >
                <Clipboard className="w-4 h-4 text-blue-500" />
                <span>Dán link</span>
              </button>

              {/* TÌM BUTTON */}
              <button
                type="submit"
                disabled={isSearching || isTikTokSearching}
                className="flex-1 sm:flex-none inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-gradient-to-r from-[#2563EB] to-[#06B6D4] hover:opacity-95 text-white font-black text-sm md:text-base shadow-md shadow-blue-500/25 transition-all cursor-pointer shrink-0 active:scale-95 disabled:opacity-50 min-w-[76px]"
              >
                {isSearching || isTikTokSearching ? (
                  <RefreshCw className="animate-spin w-4 h-4 text-white" />
                ) : (
                  <span>Tìm</span>
                )}
              </button>
            </div>
          </form>

          {/* HINT BELOW INPUT */}
          <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 font-medium mb-5">
            <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span>Nhập <strong>tên</strong> hoặc <strong>link</strong> sản phẩm muốn mua để kiểm tra</span>
          </div>

          {/* DUAL PLATFORM SUPPORT BADGES */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/70 border border-slate-200/60 text-xs text-slate-500 shadow-2xs mb-1">
            <span className="font-semibold text-slate-400">Hỗ trợ 2 sàn:</span>
            <button
              type="button"
              onClick={() => {
                setActivePlatform('shopee');
                setGuidePlatform('shopee');
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold text-xs transition-all cursor-pointer ${
                activePlatform === 'shopee'
                  ? 'bg-orange-500 text-white shadow-xs'
                  : 'bg-orange-50 text-orange-600 border border-orange-200/60 hover:bg-orange-100'
              }`}
            >
              <ShopeeBrandIcon className="w-3.5 h-3.5" inverted={activePlatform === 'shopee'} />
              Shopee
            </button>
            <button
              type="button"
              onClick={() => {
                setActivePlatform('tiktok');
                setGuidePlatform('tiktok');
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold text-xs transition-all cursor-pointer ${
                activePlatform === 'tiktok'
                  ? 'bg-slate-900 text-white shadow-xs ring-2 ring-cyan-400/40'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <TikTokBrandIcon className="w-3.5 h-3.5" />
              TikTok Shop
            </button>
          </div>
        </motion.div>
      </section>

      {/* RESULTS & FEATURES CONTENT SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-0">
        {/* RESULT CARD - SHOPEE */}
        <AnimatePresence>
          {activePlatform === 'shopee' && checkedProduct && (
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
                            onClick={() => { toggleFavorite(checkedProduct.url); }}
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
                          {checkedProduct.commission > 0 && (
                            <span className="text-[10px] text-text-secondary block mt-0.5 font-medium">
                              (50% trên tổng {checkedProduct.commission.toLocaleString('vi-VN')}đ hoa hồng)
                            </span>
                          )}
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

        {/* RESULT CARD - TIKTOK */}
        <AnimatePresence>
          {activePlatform === 'tiktok' && checkedTikTokProduct && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="max-w-2xl mx-auto mb-20"
            >
              <Card className="border border-slate-300 overflow-hidden relative bg-gradient-to-br from-white to-slate-50/50 card-shadow">
                <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-400/10 rounded-full blur-xl" />
                <CardContent className="p-6 md:p-8">
                  <div className="flex flex-col md:flex-row gap-6 items-start">
                    <div className="relative w-full md:w-44 shrink-0">
                      {checkedTikTokProduct.image ? (
                        <img
                          src={checkedTikTokProduct.image}
                          alt={checkedTikTokProduct.name}
                          className="w-full h-44 object-cover rounded-card border border-border shadow-sm"
                        />
                      ) : (
                        <div className="w-full h-44 rounded-card border border-border bg-slate-900 flex flex-col items-center justify-center text-white gap-2">
                          <ShoppingBag className="w-10 h-10 text-[#00F2FE]" />
                          <span className="text-xs font-semibold text-slate-300">TikTok Shop</span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 flex flex-col text-left w-full">
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge className="bg-slate-900 text-white border-none py-1 px-3 text-xs font-bold flex items-center gap-1">
                            <span className="text-[#00F2FE]">TikTok</span>
                            <span className="text-[#FE2C55]">Shop</span>
                          </Badge>
                          {(checkedTikTokProduct.userCashbackRate > 0 || checkedTikTokProduct.commissionRate > 0) && (
                            <Badge className="bg-emerald-500 text-white border-none py-1 px-2.5 text-[10px] font-black uppercase tracking-wider">
                              Hoàn {checkedTikTokProduct.userCashbackRate || Number((checkedTikTokProduct.commissionRate * 0.5).toFixed(1))}%
                            </Badge>
                          )}
                        </div>
                      </div>

                      <h4 className="text-base font-bold text-text mb-1 leading-snug line-clamp-2">
                        {checkedTikTokProduct.name}
                      </h4>

                      {checkedTikTokProduct.shopName && (
                        <div className="flex items-center gap-1 text-xs text-text-secondary mb-4 font-semibold">
                          <Store className="h-3.5 w-3.5 text-slate-700 shrink-0" />
                          <span>Shop: {checkedTikTokProduct.shopName}</span>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4 bg-white/70 backdrop-blur-sm border border-border/50 p-4 rounded-input shadow-[0_2px_10px_rgba(0,0,0,0.01)] mb-4">
                        <div>
                          <p className="text-xs font-semibold text-text-secondary">Giá sản phẩm</p>
                          <p className="text-lg font-bold text-text">
                            {checkedTikTokProduct.price > 0 ? `${checkedTikTokProduct.price.toLocaleString('vi-VN')}đ` : 'Theo giá app TikTok'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                            Tiền hoàn dự kiến
                          </p>
                          <p className="text-lg font-extrabold text-emerald-600">
                            {checkedTikTokProduct.estimatedCashback > 0
                              ? `${checkedTikTokProduct.estimatedCashback.toLocaleString('vi-VN')}đ`
                              : `Lên đến ${checkedTikTokProduct.userCashbackRate || Number(((checkedTikTokProduct.commissionRate || 10) * 0.5).toFixed(1))}%`}
                          </p>
                          {(checkedTikTokProduct.commissionAmount > 0 || checkedTikTokProduct.estimatedCommission > 0) && (
                            <span className="text-[10px] text-text-secondary block mt-0.5 font-medium">
                              (50% trên tổng {(checkedTikTokProduct.commissionAmount || checkedTikTokProduct.estimatedCommission).toLocaleString('vi-VN')}đ hoa hồng)
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-start gap-2 text-xs text-text-secondary leading-relaxed mb-4">
                        <AlertCircle className="h-4.5 w-4.5 text-slate-500 shrink-0 mt-0.5" />
                        <p>
                          Sau khi ấn vào nút bên dưới, vui lòng hoàn tất đặt hàng trong ứng dụng TikTok để hệ thống tự động ghi nhận đơn hoàn tiền vào ví của bạn.
                        </p>
                      </div>

                      <button
                        type="button"
                        id="btn-buy-now-tiktok"
                        onClick={handleOpenTikTokAffiliateLink}
                        className="w-full bg-[#0B0F19] hover:bg-black text-white font-black flex items-center justify-center gap-2.5 py-4 transition-all text-base shadow-xl shadow-black/30 border border-[#00F2FE]/40 rounded-xl cursor-pointer group active:scale-[0.99]"
                      >
                        <ShoppingCart className="h-5 w-5 text-[#00F2FE]" />
                        <span>Ấn vào đây mua hàng để nhận hoàn tiền TikTok</span>
                        <ArrowRight className="h-4 w-4 text-[#00F2FE] group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>


        {/* UNIFIED BUYING GUIDE & IMPORTANT NOTES SECTION */}
        <div id="guide-and-notes-section" className="scroll-mt-20 max-w-7xl mx-auto mt-2 sm:mt-4 mb-8">
          <div className="text-center max-w-3xl mx-auto mb-8">
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-primary/10 text-primary font-extrabold text-xs uppercase tracking-wider rounded-full mb-3">
              🚀 Cẩm nang mua sắm & Lưu ý hoàn tiền
            </span>
            <h2 className="text-2xl md:text-4xl font-black text-text mb-3 leading-tight">
              Hướng Dẫn Mua Hàng & Chú Ý Trước Khi Mua
            </h2>
            <p className="text-xs md:text-sm text-text-secondary leading-relaxed max-w-xl mx-auto mb-6">
              Hệ thống hoàn tiền cho cả <strong>Shopee</strong> và <strong>TikTok Shop</strong>. Chọn sàn bên dưới để xem hướng dẫn từng bước và lưu ý:
            </p>

            {/* DUAL PLATFORM TABS */}
            <div className="inline-flex p-1.5 bg-slate-100/90 backdrop-blur-sm border border-slate-200/80 rounded-2xl shadow-inner gap-2 max-w-full">
              {/* SHOPEE TAB */}
              <button
                type="button"
                onClick={() => setGuidePlatform('shopee')}
                className={`flex items-center gap-3 px-5 sm:px-7 py-3 rounded-xl font-bold transition-all cursor-pointer text-left ${
                  guidePlatform === 'shopee'
                    ? 'bg-white text-[#EE4D2D] shadow-md shadow-orange-500/10 ring-2 ring-[#EE4D2D]/40 scale-[1.02]'
                    : 'text-slate-600 hover:text-[#EE4D2D] hover:bg-white/50'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                  guidePlatform === 'shopee' ? 'bg-[#EE4D2D] text-white shadow-xs' : 'bg-orange-100 text-[#EE4D2D]'
                }`}>
                  <ShopeeBrandIcon className="w-5 h-5" inverted={guidePlatform === 'shopee'} />
                </div>
                <div>
                  <div className="text-sm sm:text-base font-black flex items-center gap-1.5">
                    Shopee
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      guidePlatform === 'shopee' ? 'bg-[#EE4D2D]/10 text-[#EE4D2D]' : 'bg-slate-200 text-slate-600'
                    }`}>
                      8 Bước
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium hidden sm:block">
                    Hướng dẫn có ảnh & 5 lưu ý
                  </div>
                </div>
              </button>

              {/* TIKTOK SHOP TAB */}
              <button
                type="button"
                onClick={() => setGuidePlatform('tiktok')}
                className={`flex items-center gap-3 px-5 sm:px-7 py-3 rounded-xl font-bold transition-all cursor-pointer text-left ${
                  guidePlatform === 'tiktok'
                    ? 'bg-slate-900 text-white shadow-md shadow-black/20 ring-2 ring-cyan-400/50 scale-[1.02]'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-white/50'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                  guidePlatform === 'tiktok' ? 'bg-slate-800 text-white shadow-xs' : 'bg-slate-200 text-slate-800'
                }`}>
                  <TikTokBrandIcon className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm sm:text-base font-black flex items-center gap-1.5">
                    <span>TikTok Shop</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      guidePlatform === 'tiktok' ? 'bg-cyan-400/20 text-[#00F2FE]' : 'bg-slate-200 text-slate-600'
                    }`}>
                      Quy trình app
                    </span>
                  </div>
                  <div className={`text-[11px] font-medium hidden sm:block ${
                    guidePlatform === 'tiktok' ? 'text-slate-300' : 'text-slate-500'
                  }`}>
                    6 bước thao tác & 5 lưu ý
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* TAB 1: SHOPEE GUIDE & NOTES */}
        {guidePlatform === 'shopee' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* 8-STEP CASHBACK PURCHASING GUIDE WITH DIRECT IMAGES (SHOPEE) */}
            <div className="bg-white border border-border/80 rounded-card p-6 md:p-10 card-shadow text-left max-w-7xl mx-auto hover:shadow-soft transition-all duration-300">
              <div className="text-center max-w-3xl mx-auto mb-10">
                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-orange-100 text-[#EE4D2D] font-extrabold text-xs uppercase tracking-wider rounded-full mb-3">
                  <ShopeeBrandIcon className="w-3.5 h-3.5" /> 8 Bước Đặt Hàng Shopee
                </span>
                <h3 className="text-2xl md:text-3xl font-black text-text mb-2 leading-tight">
                  Quy Trình Mua Hàng <span className="text-[#EE4D2D]">Shopee</span>
                </h3>
                <p className="text-xs md:text-sm text-text-secondary leading-relaxed">
                  Các bước lần lượt từ Bước 1 đến Bước 8 với hình ảnh hiển thị trực tiếp. Bấm vào ảnh để phóng to.
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
                          onClick={() => setLightboxImage({ src: (s as any).full || s.image!, step: s.step })}
                          className="w-full h-64 sm:h-72 bg-bg border border-border/60 rounded-xl overflow-hidden cursor-pointer relative group/img flex items-center justify-center shadow-inner"
                        >
                          <img
                            src={s.image!}
                            alt={`Hình ảnh ${s.badge}`}
                            loading="lazy"
                            decoding="async"
                            width={480}
                            height={984}
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
                        Ảnh minh họa quy trình mua hàng Shopee
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

            {/* IMPORTANT NOTICE FOR CASHBACK ACCURACY (SHOPEE) */}
            <div className="bg-white border border-border/80 rounded-card p-6 md:p-8 card-shadow text-left max-w-7xl mx-auto hover:shadow-soft transition-all duration-300">
              {/* Header Row */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="space-y-2">
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-[#EE4D2D] text-white font-bold text-xs uppercase tracking-wider rounded-full">
                    📌 Lưu ý quan trọng Shopee
                  </span>
                  <h2 className="text-xl md:text-2xl font-black text-text">
                    Để đơn hàng Shopee được ghi nhận hoàn tiền chính xác
                  </h2>
                </div>
                <p className="text-xs md:text-sm text-text-secondary max-w-md leading-relaxed">
                  Làm đúng các bước dưới đây để tránh mất lượt hoàn tiền khi mua hàng qua Shopee.
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
                  💡 <span className="text-amber-400 font-bold">Mẹo nhỏ Shopee:</span> Click link hoàn tiền → thêm sản phẩm → thanh toán ngay để tăng tỷ lệ ghi nhận đơn.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TIKTOK SHOP GUIDE & NOTES */}
        {guidePlatform === 'tiktok' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* PURCHASING GUIDE (TIKTOK SHOP) */}
            <div className="bg-white border border-slate-300 rounded-card p-6 md:p-10 card-shadow text-left max-w-7xl mx-auto hover:shadow-soft transition-all duration-300 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-100/30 rounded-full blur-3xl pointer-events-none" />
              <div className="text-center max-w-3xl mx-auto mb-10 relative z-10">
                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-slate-900 text-white font-extrabold text-xs uppercase tracking-wider rounded-full mb-3 shadow-sm">
                  <span className="text-[#00F2FE]">TIKTOK</span>
                  <span className="text-[#FE2C55]">SHOP</span>
                  <span className="text-slate-400">|</span>
                  <span>Quy trình hoàn tiền</span>
                </span>
                <h2 className="text-2xl md:text-4xl font-black text-slate-900 mb-3 leading-tight">
                  Hướng Dẫn <span className="bg-gradient-to-r from-[#00F2FE] via-slate-900 to-[#FE2C55] bg-clip-text text-transparent">Quy Trình Mua Hàng TikTok Shop</span>
                </h2>
                <p className="text-xs md:text-sm text-slate-500 leading-relaxed font-medium">
                  Quy trình 6 bước chi tiết giúp bạn mua sắm trên TikTok Shop và nhận tiền hoàn tự động 100% vào ví.
                </p>
              </div>

              {/* 6 Steps Grid Layout */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
                {tiktokPurchasingSteps.map((s) => (
                  <div
                    key={s.step}
                    className="bg-white border border-slate-200/90 hover:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group relative overflow-hidden"
                  >
                    {/* Card Top Header */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-black px-3 py-1 rounded-full bg-slate-900 text-white shadow-xs">
                        {s.badge}
                      </span>
                      <span className="text-xs font-bold text-slate-400 font-mono">
                        {s.step} / 6
                      </span>
                    </div>

                    {/* Card Body */}
                    {s.isAuth ? (
                      <div className="flex-1 flex flex-col justify-between bg-gradient-to-br from-slate-50 to-cyan-50/30 p-5 rounded-xl border border-slate-200 min-h-[220px]">
                        <div className="flex flex-col items-center text-center my-auto">
                          <div className="w-14 h-14 rounded-full bg-slate-900 flex items-center justify-center text-[#00F2FE] mb-3 shadow-md">
                            <Users className="h-7 w-7" />
                          </div>
                          <h4 className="font-extrabold text-slate-900 text-sm mb-1">{s.title}</h4>
                          <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
                            {s.desc}
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
                          className="w-full bg-slate-900 hover:bg-black text-white font-bold text-xs py-2.5 mt-2"
                        >
                          {currentUser ? 'Vào Dashboard cá nhân' : 'Đăng ký / Đăng nhập ngay'}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col justify-between p-2">
                        <div>
                          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                            {s.icon}
                          </div>
                          <h4 className="font-extrabold text-slate-900 text-base mb-2">{s.title}</h4>
                          <p className="text-xs text-slate-600 leading-relaxed mb-4">
                            {s.desc}
                          </p>
                        </div>
                        <div className="pt-3 border-t border-slate-100">
                          <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                            {s.hint}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* IMPORTANT NOTICE FOR CASHBACK ACCURACY (TIKTOK SHOP) */}
            <div className="bg-white border border-slate-300 rounded-card p-6 md:p-8 card-shadow text-left max-w-7xl mx-auto hover:shadow-soft transition-all duration-300">
              {/* Header Row */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="space-y-2">
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-slate-900 text-white font-bold text-xs uppercase tracking-wider rounded-full">
                    📌 Lưu ý quan trọng TikTok Shop
                  </span>
                  <h2 className="text-xl md:text-2xl font-black text-slate-900">
                    Để đơn hàng TikTok Shop được ghi nhận hoàn tiền chính xác
                  </h2>
                </div>
                <p className="text-xs md:text-sm text-slate-500 max-w-md leading-relaxed font-medium">
                  Làm đúng các bước dưới đây để tránh mất lượt hoàn tiền khi mua sắm trên TikTok Shop.
                </p>
              </div>

              {/* Steps Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
                {/* Step 1 */}
                <div className="bg-white border border-slate-200 p-5 rounded-input transition-all duration-300 flex flex-col gap-3 hover:shadow-md hover:-translate-y-1.5 hover:border-slate-800 cursor-pointer">
                  <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center shrink-0">
                    <ShoppingCart className="h-5 w-5 text-[#00F2FE]" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm mb-1">Mở qua link hoàn tiền</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed">Bắt buộc ấn nút mua hàng từ web để kích hoạt theo dõi hoa hồng TikTok.</p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="bg-white border border-slate-200 p-5 rounded-input transition-all duration-300 flex flex-col gap-3 hover:shadow-md hover:-translate-y-1.5 hover:border-purple-500/30 cursor-pointer">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                    <Link2 className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm mb-1">Không click link ngoài</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed">Tránh ấn link bio, livestream của KOL khác trước khi thanh toán.</p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="bg-white border border-slate-200 p-5 rounded-input transition-all duration-300 flex flex-col gap-3 hover:shadow-md hover:-translate-y-1.5 hover:border-amber-500/30 cursor-pointer">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                    <Clock className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm mb-1">Thanh toán trong 24h</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed">Nên hoàn tất đơn trong vòng 24 giờ sau khi mở ứng dụng TikTok.</p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="bg-white border border-slate-200 p-5 rounded-input transition-all duration-300 flex flex-col gap-3 hover:shadow-md hover:-translate-y-1.5 hover:border-blue-500/30 cursor-pointer">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <ShoppingBag className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm mb-1">Thêm giỏ sau mở link</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed">Bấm link hoàn tiền xong mới thêm sản phẩm vào giỏ để không bị đè mã.</p>
                  </div>
                </div>

                {/* Step 5 */}
                <div className="bg-white border border-slate-200 p-5 rounded-input transition-all duration-300 flex flex-col gap-3 hover:shadow-md hover:-translate-y-1.5 hover:border-red-500/30 cursor-pointer">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                    <ShieldAlert className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm mb-1">Đơn hàng hợp lệ</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed">Đơn hàng bị hủy hoặc hoàn trả sẽ không được hoàn tiền theo quy định.</p>
                  </div>
                </div>
              </div>

              {/* Bottom Tip Callout */}
              <div className="bg-slate-900 text-white p-4 rounded-input flex items-center justify-center text-center gap-2 border border-slate-800">
                <span className="text-xs md:text-sm font-semibold flex items-center gap-1.5 flex-wrap justify-center">
                  💡 <span className="text-[#00F2FE] font-bold">Mẹo nhỏ TikTok Shop:</span> Sao chép đúng link từ app TikTok → dán vào web kích hoạt hoàn tiền → mở app đặt ngay để đảm bảo 100% được ghi nhận.
                </span>
              </div>
            </div>
          </div>
        )}

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
