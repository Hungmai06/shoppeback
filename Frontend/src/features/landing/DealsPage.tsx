import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, ArrowRight, Heart, Share2,
  AlertCircle, ShoppingBag
} from 'lucide-react';
import { Button, Card, CardContent, Badge } from '../../components/ui/core';
import { useAppStore } from '../../store/appStore';
import type { Order } from '../../store/appStore';
import { toast } from 'sonner';
import { SAMPLE_SHOPEE_PRODUCTS } from '../../store/mockData';

export default function DealsPage() {
  const navigate = useNavigate();
  const { currentUser, addOrder, toggleFavorite, favorites } = useAppStore();
  const [shopeeLink, setShopeeLink] = useState('');
  const [checkedProduct, setCheckedProduct] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const handleCheckLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopeeLink.trim()) {
      toast.error('Vui lòng nhập link sản phẩm Shopee');
      return;
    }

    setIsSearching(true);
    setCheckedProduct(null);

    setTimeout(() => {
      const matched = SAMPLE_SHOPEE_PRODUCTS.find(p =>
        shopeeLink.includes(p.url) ||
        shopeeLink.toLowerCase().includes(p.name.toLowerCase().slice(0, 10))
      );

      if (matched) {
        setCheckedProduct(matched);
      } else {
        const mockName = shopeeLink.split('/').pop()?.replace(/-/g, ' ') || 'Sản phẩm Shopee';
        const cleanName = mockName.substring(0, 50) + (mockName.length > 50 ? '...' : '');
        setCheckedProduct({
          url: shopeeLink,
          name: cleanName.charAt(0).toUpperCase() + cleanName.slice(1),
          price: 950000,
          cashbackRate: 0.07,
          image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=400'
        });
      }
      setIsSearching(false);
      toast.success('Quét sản phẩm hoàn tiền thành công!');
    }, 1000);
  };

  const handleCreateAffiliateLink = async () => {
    if (!currentUser) {
      toast.warning('Vui lòng đăng nhập để tạo link hoàn tiền và tích lũy số dư');
      navigate('/auth');
      return;
    }
    if (!checkedProduct) return;

    // 1. Mở ngay 1 tab mới ở trạng thái chờ để tránh bị trình duyệt chặn popup
    const newTab = window.open('about:blank', '_blank');

    try {
      const API_BASE = import.meta.env.VITE_API_BASE || '/api';
      const token = localStorage.getItem('access_token');

      const res = await fetch(`${API_BASE}/shopee/convert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ url: checkedProduct.url })
      });
      const data = await res.json();

      if (data && data.success && data.affiliateLink) {
        const link1 = data.affiliateLink; // Link setup cookie trong hệ thống
        const link2 = data.originUrl || checkedProduct.url; // Link sản phẩm tra cứu

        const newOrder: Order = {
          id: data.clickId || `HD${Math.floor(1000 + Math.random() * 9000)}`,
          productName: checkedProduct.name,
          productImage: checkedProduct.image,
          orderAmount: checkedProduct.price,
          estimatedCashback: Math.round(checkedProduct.price * checkedProduct.cashbackRate * 0.5),
          status: 'pending',
          createdTime: new Date().toISOString().replace('T', ' ').slice(0, 19),
          userId: currentUser.id
        };
        addOrder(newOrder);

        if (newTab) {
          // Mở NGUYÊN VĂN Link 1 (link setup trong hệ thống) trên tab mới trước
          newTab.location.href = link1;

          // Sau đúng 1.5s (1500ms), tự động nhảy tiếp tab mới đó sang Link 2 (link sản phẩm tra cứu)
          setTimeout(() => {
            try {
              if (!newTab.closed) {
                newTab.location.href = link2;
              }
            } catch (e) {}
          }, 1500);
        }
      } else {
        if (newTab) newTab.close();
        toast.error(data?.message || 'Có lỗi xảy ra khi tạo link hoàn tiền');
      }
    } catch (err: any) {
      if (newTab) newTab.close();
      toast.error('Có lỗi xảy ra khi tạo link hoàn tiền');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Đã sao chép vào bộ nhớ tạm!');
  };

  // Filter products based on search term & categories
  const filteredProducts = SAMPLE_SHOPEE_PRODUCTS.filter(prod => {
    const matchesSearch = prod.name.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesCategory = true;
    if (activeCategory === 'electronics') {
      matchesCategory = prod.name.toLowerCase().includes('sony') || prod.name.toLowerCase().includes('iphone');
    } else if (activeCategory === 'fashion') {
      matchesCategory = prod.name.toLowerCase().includes('giày') || prod.name.toLowerCase().includes('nike');
    } else if (activeCategory === 'beauty') {
      matchesCategory = prod.name.toLowerCase().includes('son') || prod.name.toLowerCase().includes('rouge');
    } else if (activeCategory === 'house') {
      matchesCategory = prod.name.toLowerCase().includes('bình');
    }

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* PAGE HEADER */}
      <div className="text-center max-w-3xl mx-auto mb-12">
        <span className="px-3.5 py-1.5 bg-primary/10 text-primary font-bold text-xs uppercase tracking-wider rounded-full mb-4 inline-block">
          Săn Deal Hoàn Tiền
        </span>
        <h1 className="text-3xl md:text-5xl font-black text-text mb-4 leading-tight">
          Cửa Hàng <span className="gradient-text">Hoàn Tiền Chiết Khấu</span>
        </h1>
        <p className="text-sm md:text-base text-text-secondary">
          Dán link Shopee bất kỳ để nhận chiết khấu hoặc chọn mua các deal hot đang có tỷ lệ hoàn tiền cao nhất dưới đây.
        </p>
      </div>

      {/* SEARCH / LINK GENERATOR CARD */}
      <div className="max-w-3xl mx-auto mb-16" id="search-anchor">
        <form onSubmit={handleCheckLink} className="w-full bg-white p-2.5 rounded-[22px] shadow-soft border border-border flex flex-col md:flex-row gap-2">
          <div className="flex-1 flex items-center px-4.5 gap-2.5">
            <Search className="h-5 w-5 text-text-secondary shrink-0" />
            <input
              type="text"
              placeholder="Dán link sản phẩm Shopee của bạn vào đây..."
              value={shopeeLink}
              onChange={(e) => setShopeeLink(e.target.value)}
              className="w-full bg-transparent border-none focus:ring-0 outline-none text-text text-sm md:text-base py-3"
            />
          </div>
          <Button
            type="submit"
            className="py-3.5 px-8 md:w-auto w-full text-sm md:text-base font-bold shrink-0"
            disabled={isSearching}
          >
            {isSearching ? 'Đang kiểm tra...' : 'Kiểm tra hoàn tiền'}
          </Button>
        </form>

        {/* Dynamic sample button for testing */}
        {!checkedProduct && (
          <div className="flex items-center justify-center gap-2 flex-wrap text-xs text-text-secondary mt-4 bg-white/40 py-2.5 px-5 rounded-full border border-border/40 inline-flex shadow-[0_4px_12px_rgba(0,0,0,0.01)] mx-auto w-full justify-center">
            <span className="font-semibold text-text/80">Chọn sản phẩm mẫu:</span>
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
      </div>

      {/* PREVIEW LINK ANALYZER */}
      <AnimatePresence>
        {checkedProduct && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="max-w-3xl mx-auto mb-16"
          >
            <Card className="border border-primary/25 overflow-hidden bg-gradient-to-br from-white to-orange-50/20 card-shadow">
              <CardContent className="p-6 md:p-8">
                <div className="flex flex-col md:flex-row gap-6 items-start">
                  <img
                    src={checkedProduct.image}
                    alt={checkedProduct.name}
                    referrerPolicy="no-referrer"
                    className="w-full md:w-48 h-48 object-cover rounded-card border border-border shadow-sm shrink-0"
                  />

                  <div className="flex-1 flex flex-col text-left">
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <Badge className="bg-orange-500 text-white border-none py-1 px-3 text-xs font-bold">Shopee Mall</Badge>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => { toggleFavorite(checkedProduct.url); toast.success('Đã cập nhật yêu thích'); }}
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

                    <h4 className="text-base md:text-lg font-bold text-text mb-3 leading-snug line-clamp-2">
                      {checkedProduct.name}
                    </h4>

                    <div className="grid grid-cols-2 gap-4 bg-white/80 border border-border p-4 rounded-input shadow-[0_2px_10px_rgba(0,0,0,0.01)] mb-4">
                      <div>
                        <p className="text-xs font-semibold text-text-secondary">Giá bán Shopee</p>
                        <p className="text-base md:text-lg font-extrabold text-text">{checkedProduct.price.toLocaleString('vi-VN')}đ</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-primary">Tiền hoàn dự kiến</p>
                        <p className="text-base md:text-lg font-black text-primary">
                          {Math.round(checkedProduct.price * checkedProduct.cashbackRate * 0.5).toLocaleString('vi-VN')}đ ({Math.round(checkedProduct.cashbackRate * 50)}%)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 text-xs text-text-secondary leading-relaxed mb-6">
                      <AlertCircle className="h-4.5 w-4.5 text-warning shrink-0 mt-0.5" />
                      <p>
                        Nhấn nút <b>Tạo Link Hoàn Tiền</b> dưới đây để lấy đường dẫn mua hàng. Hệ thống tự động ghi nhận hoa hồng sau khi đặt hàng thành công.
                      </p>
                    </div>

                    <div>
                      <Button
                        onClick={handleCreateAffiliateLink}
                        className="w-full font-bold flex items-center justify-center gap-2 group py-3.5"
                      >
                        Ấn vào ngay mua hàng để hoàn tiền
                        <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FILTER & GRID */}
      <div className="border-t border-border/50 pt-12">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10">
          <div>
            <h2 className="text-xl md:text-2xl font-extrabold text-text mb-2">Danh sách Deal hoàn tiền cực Hot</h2>
            <p className="text-xs md:text-sm text-text-secondary">Tỷ lệ hoàn tiền lên đến 15% cho mọi sản phẩm.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            {/* Search deal input */}
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
              <input
                type="text"
                placeholder="Tìm sản phẩm..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-border text-xs rounded-input focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {/* Category buttons */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {[
                { id: 'all', label: 'Tất cả' },
                { id: 'electronics', label: 'Điện tử' },
                { id: 'fashion', label: 'Thời trang' },
                { id: 'beauty', label: 'Mỹ phẩm' },
                { id: 'house', label: 'Gia dụng' }
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-button border whitespace-nowrap transition-colors ${activeCategory === cat.id ? 'bg-primary border-primary text-white' : 'bg-white border-border text-text-secondary hover:bg-border/20'}`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* PRODUCTS GRID */}
        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredProducts.map((prod, index) => (
              <Card key={index} className="flex flex-col h-full hover:shadow-lg transition-all duration-300 border-border/40 overflow-hidden">
                <div className="relative group h-48 bg-border/20 shrink-0">
                  <img
                    src={prod.image}
                    alt={prod.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <Badge className="absolute top-3 left-3 bg-gradient-to-r from-orange-600 to-orange-400 text-white border-none py-1 px-2.5 text-[10px] font-black shadow-sm">
                    Hoàn {Math.round(prod.cashbackRate * 100)}%
                  </Badge>
                </div>
                <CardContent className="p-5 flex-1 flex flex-col justify-between text-left">
                  <div>
                    <h3 className="font-bold text-text text-sm mb-2 line-clamp-2 min-h-[40px] leading-snug">
                      {prod.name}
                    </h3>
                    <div className="flex justify-between items-baseline mb-4">
                      <div>
                        <p className="text-[10px] text-text-secondary font-semibold">Giá bán</p>
                        <p className="text-sm font-bold text-text">{prod.price.toLocaleString('vi-VN')}đ</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-primary font-bold">Nhận hoàn</p>
                        <p className="text-sm font-black text-primary">{(prod.price * prod.cashbackRate).toLocaleString('vi-VN')}đ</p>
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      setShopeeLink(prod.url);
                      setCheckedProduct(prod);
                      const element = document.getElementById('search-anchor');
                      if (element) element.scrollIntoView({ behavior: 'smooth' });
                      toast.success(`Đã chọn: ${prod.name.slice(0, 15)}...`);
                    }}
                    className="w-full py-2.5 text-xs font-bold"
                  >
                    Xem chi tiết hoàn tiền
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white border border-border rounded-card card-shadow">
            <ShoppingBag className="h-12 w-12 text-text-secondary/30 mx-auto mb-4" />
            <p className="text-text-secondary font-semibold text-sm">Không tìm thấy sản phẩm phù hợp</p>
          </div>
        )}
      </div>
    </div>
  );
}
