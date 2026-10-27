import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';
import type { Order } from '../../store/appStore';
import { 
  Search, Lock, ShoppingBag, 
  TrendingUp, Wallet, Clock, Coins, Landmark
} from 'lucide-react';
import { Button, Card, CardContent, Badge } from '../../components/ui/core';

const TikTokIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 3 15.68a6.34 6.34 0 0 0 10.82 4.49 6.27 6.27 0 0 0 1.94-4.5V8.92a8.28 8.28 0 0 0 4.83 1.57V7.05a4.8 4.8 0 0 1-1-.36z" />
  </svg>
);

const ShopeeIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M19.5 7.5h-2.25V6A5.25 5.25 0 0 0 12 .75 5.25 5.25 0 0 0 6.75 6v1.5H4.5A2.25 2.25 0 0 0 2.25 9.75l1.5 11.25A2.25 2.25 0 0 0 6 23.25h12a2.25 2.25 0 0 0 2.25-2.25l1.5-11.25A2.25 2.25 0 0 0 19.5 7.5zm-11.25-1.5a3.75 3.75 0 0 1 7.5 0v1.5h-7.5V6zm4.12 11.83c-2.3 0-3.62-1.12-3.62-2.83 0-1.85 1.5-2.45 3.12-2.9 1.5-.42 2.15-.75 2.15-1.48 0-.75-.72-1.25-1.8-1.25-1.2 0-2.12.55-2.58 1.15l-1.05-.98c.75-.92 2-1.62 3.65-1.62 2.1 0 3.42 1.12 3.42 2.75 0 1.78-1.42 2.38-3.05 2.82-1.55.42-2.22.78-2.22 1.55 0 .8.8 1.32 1.98 1.32 1.45 0 2.45-.65 2.92-1.32l1.05.95c-.75 1.05-2.15 1.86-3.96 1.86z"/>
  </svg>
);

// Mock orders for non-logged-in visitors to demonstrate tracking capability (both Shopee & TikTok)
const MOCK_PREVIEW_ORDERS: (Order & { platform?: 'shopee' | 'tiktok' })[] = [
  {
    id: 'TT893201',
    productName: 'Set 5 Áo Thun Cotton Compact Form Rộng Cực Đẹp',
    productImage: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&q=80&w=400',
    orderAmount: 389000,
    estimatedCashback: 29175,
    status: 'pending',
    createdTime: '2026-10-23 14:15:00',
    platform: 'tiktok',
    userId: 'guest'
  },
  {
    id: 'HD8932',
    productName: 'Điện thoại Apple iPhone 15 Pro Max 256GB - Chính hãng VNA',
    productImage: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&q=80&w=400',
    orderAmount: 29990000,
    estimatedCashback: 1049650,
    status: 'pending',
    createdTime: '2026-10-22 14:15:00',
    platform: 'shopee',
    userId: 'guest'
  },
  {
    id: 'TT782399',
    productName: 'Kem Dưỡng Ẩm Phục Hồi Da B5 La Roche-Posay Cicaplast Baume',
    productImage: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&q=80&w=400',
    orderAmount: 345000,
    estimatedCashback: 25875,
    realCashback: 25875,
    status: 'approved',
    createdTime: '2026-10-20 09:30:00',
    platform: 'tiktok',
    userId: 'guest'
  },
  {
    id: 'HD7823',
    productName: 'Tai nghe chụp tai Bluetooth Sony WH-1000XM4 Chống ồn chủ động',
    productImage: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=400',
    orderAmount: 6490000,
    estimatedCashback: 227150,
    realCashback: 227150,
    status: 'approved',
    createdTime: '2026-10-18 09:30:00',
    platform: 'shopee',
    userId: 'guest'
  },
  {
    id: 'HD4310',
    productName: 'Bình Giữ Nhiệt Lock&Lock Feather Light 450ml - Thép Không Gỉ',
    productImage: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&q=80&w=400',
    orderAmount: 350000,
    estimatedCashback: 12250,
    realCashback: 12250,
    status: 'paid',
    createdTime: '2026-10-10 11:20:00',
    platform: 'shopee',
    userId: 'guest'
  }
];

export default function TrackingPage() {
  const navigate = useNavigate();
  const { currentUser, orders, withdrawals, fetchUserOrders, fetchUserWithdrawals } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState<'all' | 'shopee' | 'tiktok'>('all');

  const isLoggedIn = !!currentUser;

  // Tự động tải đơn hàng và lịch sử rút tiền của người dùng khi đã đăng nhập
  useEffect(() => {
    if (isLoggedIn) {
      fetchUserOrders();
      fetchUserWithdrawals();
    }
  }, [isLoggedIn]);
  
  // Decide which orders array to display
  const activeOrders = isLoggedIn 
    ? orders.filter(o => o.userId === currentUser.id)
    : MOCK_PREVIEW_ORDERS;

  // Lọc theo nền tảng sàn (Shopee / TikTok Shop)
  const platformFilteredOrders = activeOrders.filter(o => {
    const p = (o as any).platform || 'shopee';
    if (platformFilter === 'shopee') return p !== 'tiktok';
    if (platformFilter === 'tiktok') return p === 'tiktok';
    return true;
  });

  // Filter orders by search term and status dropdown
  const filteredOrders = platformFilteredOrders.filter(o => {
    const matchesSearch = o.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          o.productName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' ? true : o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Số lượng đơn từng sàn
  const shopeeOrdersCount = activeOrders.filter(o => (o as any).platform !== 'tiktok').length;
  const tiktokOrdersCount = activeOrders.filter(o => (o as any).platform === 'tiktok').length;

  // Tính toán số liệu tài chính rõ ràng:
  // 1. Số dư ví khả dụng (Có thể bấm rút tiền ngay)
  const availableBalance = isLoggedIn ? Math.max(0, currentUser.balance || 0) : 0;

  // 2. Hoa hồng nhận được (Đã duyệt / đã trả đối soát thành công)
  const approvedOrders = isLoggedIn ? activeOrders.filter(o => o.status === 'approved' || o.status === 'paid') : [];
  const totalCashbackReceived = isLoggedIn
    ? (currentUser.completedOrderCashback !== undefined && currentUser.completedOrderCashback !== null && currentUser.completedOrderCashback > 0
        ? currentUser.completedOrderCashback
        : approvedOrders.reduce((sum, o) => sum + (o.realCashback !== undefined && o.realCashback !== null ? o.realCashback : o.estimatedCashback), 0))
    : 0;

  // 3. Đã rút (Tổng tiền đã rút thành công về tài khoản ngân hàng)
  const approvedWithdrawals = isLoggedIn
    ? withdrawals.filter(w => w.userId === currentUser.id && w.status === 'approved')
    : [];
  const totalWithdrawn = isLoggedIn
    ? (currentUser.totalWithdrawn !== undefined && currentUser.totalWithdrawn !== null && currentUser.totalWithdrawn > 0
        ? currentUser.totalWithdrawn
        : approvedWithdrawals.reduce((sum, w) => sum + (w.amount || 0), 0))
    : 0;

  // 4. Tạm tính (Chờ đối soát từ sàn Shopee & TikTok - 50% hoa hồng)
  const pendingCashback = isLoggedIn 
    ? platformFilteredOrders
      .filter(o => o.status === 'pending')
      .reduce((sum, o) => sum + (o.estimatedCashback || 0), 0)
    : 0;

  // 5. Tổng đơn hàng
  const totalOrdersCount = isLoggedIn ? platformFilteredOrders.length : 0;
  
  // 6. Tổng giá trị mua hàng (GMV)
  const totalAmount = isLoggedIn 
    ? platformFilteredOrders.reduce((sum, o) => sum + (o.orderAmount || 0), 0)
    : 0;

  const getStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-amber-500 text-white border-none text-[11px] py-1 px-2.5 font-bold">Chờ đối soát</Badge>;
      case 'approved':
        return <Badge className="bg-emerald-500 text-white border-none text-[11px] py-1 px-2.5 font-bold">Đã duyệt</Badge>;
      case 'paid':
        return <Badge className="bg-blue-500 text-white border-none text-[11px] py-1 px-2.5 font-bold">Đã thanh toán</Badge>;
      case 'rejected':
        return <Badge className="bg-rose-500 text-white border-none text-[11px] py-1 px-2.5 font-bold">Không đối soát được</Badge>;
      case 'returned':
        return <Badge className="bg-orange-500 text-white border-none text-[11px] py-1 px-2.5 font-bold">Hoàn hàng</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative">
      {/* HEADER SECTION */}
      <div className="text-center max-w-3xl mx-auto mb-10">
        <span className="px-3.5 py-1.5 bg-primary/10 text-primary font-bold text-xs uppercase tracking-wider rounded-full mb-3 inline-block">
          Tra cứu tích lũy
        </span>
        <h1 className="text-3xl md:text-5xl font-black text-text mb-3 leading-tight">
          Lịch Sử <span className="gradient-text">Hoàn Tiền Đối Soát</span>
        </h1>
        <p className="text-sm md:text-base text-text-secondary">
          Theo dõi minh bạch số dư, hoa hồng nhận được, số tiền đã rút và trạng thái hoàn tiền (50%) đơn Shopee & TikTok Shop.
        </p>
      </div>

      {/* STATS OVERVIEW - 6 CỘT CHỈ SỐ RÕ RÀNG */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5 sm:gap-4 mb-6 relative">
        {/* Cột 1: Số dư ví */}
        <Card className="border-emerald-300 bg-gradient-to-br from-emerald-500/10 via-white to-white shadow-sm overflow-hidden text-left relative hover:shadow-md transition-shadow">
          <CardContent className="p-4 sm:p-4.5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide">Số dư ví</span>
              <div className="bg-emerald-100 text-emerald-700 p-2 rounded-xl">
                <Wallet className="h-4 w-4" />
              </div>
            </div>
            <div>
              <p className="text-lg sm:text-xl font-black text-emerald-700 tracking-tight">
                {availableBalance.toLocaleString('vi-VN')}đ
              </p>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[10px] text-emerald-600/90 font-medium">Khả dụng</span>
                {isLoggedIn && (
                  <button 
                    onClick={() => navigate('/wallet')} 
                    className="text-[10px] font-bold text-emerald-700 hover:underline flex items-center gap-0.5"
                  >
                    Rút ngay →
                  </button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cột 2: Hoa hồng nhận được */}
        <Card className="border-blue-200 bg-gradient-to-br from-blue-500/5 via-white to-white shadow-sm overflow-hidden text-left relative hover:shadow-md transition-shadow">
          <CardContent className="p-4 sm:p-4.5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wide">Hoa hồng nhận</span>
              <div className="bg-blue-100 text-blue-700 p-2 rounded-xl">
                <Coins className="h-4 w-4" />
              </div>
            </div>
            <div>
              <p className="text-lg sm:text-xl font-black text-blue-700 tracking-tight">
                {totalCashbackReceived.toLocaleString('vi-VN')}đ
              </p>
              <p className="text-[10px] text-text-secondary font-medium mt-1">Đã đối soát cộng ví</p>
            </div>
          </CardContent>
        </Card>

        {/* Cột 3: Đã rút */}
        <Card className="border-purple-200 bg-gradient-to-br from-purple-500/5 via-white to-white shadow-sm overflow-hidden text-left relative hover:shadow-md transition-shadow">
          <CardContent className="p-4 sm:p-4.5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-purple-800 uppercase tracking-wide">Đã rút tiền</span>
              <div className="bg-purple-100 text-purple-700 p-2 rounded-xl">
                <Landmark className="h-4 w-4" />
              </div>
            </div>
            <div>
              <p className="text-lg sm:text-xl font-black text-purple-700 tracking-tight">
                {totalWithdrawn.toLocaleString('vi-VN')}đ
              </p>
              <p className="text-[10px] text-text-secondary font-medium mt-1">Về tài khoản ngân hàng</p>
            </div>
          </CardContent>
        </Card>

        {/* Cột 4: Tạm tính (Chờ) */}
        <Card className="border-amber-200 bg-gradient-to-br from-amber-500/5 via-white to-white shadow-sm overflow-hidden text-left relative hover:shadow-md transition-shadow">
          <CardContent className="p-4 sm:p-4.5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wide">Tạm tính (Chờ)</span>
              <div className="bg-amber-100 text-amber-700 p-2 rounded-xl">
                <Clock className="h-4 w-4 animate-pulse" />
              </div>
            </div>
            <div>
              <p className="text-lg sm:text-xl font-black text-amber-600 tracking-tight">
                {pendingCashback.toLocaleString('vi-VN')}đ
              </p>
              <p className="text-[10px] text-text-secondary font-medium mt-1">Đang chờ sàn đối soát</p>
            </div>
          </CardContent>
        </Card>

        {/* Cột 5: Tổng đơn hàng */}
        <Card className="border-border/60 bg-white shadow-sm overflow-hidden text-left relative hover:shadow-md transition-shadow">
          <CardContent className="p-4 sm:p-4.5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wide">
                {platformFilter === 'tiktok' ? 'Đơn TikTok' : platformFilter === 'shopee' ? 'Đơn Shopee' : 'Tổng đơn hàng'}
              </span>
              <div className="bg-bg text-text p-2 rounded-xl">
                <ShoppingBag className="h-4 w-4" />
              </div>
            </div>
            <div>
              <p className="text-lg sm:text-xl font-black text-text tracking-tight">
                {totalOrdersCount} <span className="text-xs font-semibold text-text-secondary">đơn</span>
              </p>
              <p className="text-[10px] text-text-secondary font-medium mt-1">
                {shopeeOrdersCount} Shopee • {tiktokOrdersCount} TikTok
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Cột 6: Tổng giá trị mua */}
        <Card className="border-border/60 bg-white shadow-sm overflow-hidden text-left relative hover:shadow-md transition-shadow">
          <CardContent className="p-4 sm:p-4.5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wide">Tổng giá trị mua</span>
              <div className="bg-bg text-amber-500 p-2 rounded-xl">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div>
              <p className="text-lg sm:text-xl font-black text-text tracking-tight">
                {totalAmount.toLocaleString('vi-VN')}đ
              </p>
              <p className="text-[10px] text-text-secondary font-medium mt-1">Tổng GMV đơn hàng</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* DÒNG BIỂU THỊ RÕ DÒNG TIỀN (CÔNG THỨC VÍ MINH BẠCH) */}
      <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3.5 sm:p-4 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xs">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 font-bold text-emerald-900">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span>Quy luật dòng tiền ví:</span>
          </div>
          <div className="flex items-center gap-1.5 font-semibold text-slate-700 bg-white/80 px-2.5 py-1 rounded-lg border border-emerald-100 flex-wrap">
            <span className="text-blue-700 font-bold">Hoa hồng nhận ({totalCashbackReceived.toLocaleString('vi-VN')}đ)</span>
            <span>−</span>
            <span className="text-purple-700 font-bold">Đã rút ({totalWithdrawn.toLocaleString('vi-VN')}đ)</span>
            <span>=</span>
            <span className="text-emerald-700 font-black">Số dư ví ({availableBalance.toLocaleString('vi-VN')}đ)</span>
          </div>
        </div>
        {isLoggedIn && (
          <Button 
            size="sm" 
            onClick={() => navigate('/wallet')} 
            className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow-xs"
          >
            Vào ví rút tiền →
          </Button>
        )}
      </div>

      {/* TABLE SECTION WITH AUTHENTICATION GATING */}
      <div className="bg-white rounded-card border border-border/50 shadow-soft p-5 sm:p-6 relative overflow-hidden">
        
        {/* PLATFORM TABS & FILTER CONTROLS */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full lg:w-auto">
            <h2 className="text-lg font-bold text-text whitespace-nowrap">Chi tiết các đơn hàng tích lũy</h2>
            
            {/* PLATFORM FILTER PILLS */}
            <div className="flex items-center gap-1.5 bg-bg p-1 rounded-input border border-border self-start">
              <button
                type="button"
                onClick={() => setPlatformFilter('all')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${platformFilter === 'all' ? 'bg-primary text-white shadow-xs' : 'text-text-secondary hover:text-text'}`}
              >
                Tất cả ({activeOrders.length})
              </button>
              <button
                type="button"
                onClick={() => setPlatformFilter('shopee')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${platformFilter === 'shopee' ? 'bg-[#EE4D2D] text-white shadow-xs' : 'text-text-secondary hover:text-text'}`}
              >
                <ShopeeIcon className="w-3.5 h-3.5" /> Shopee ({shopeeOrdersCount})
              </button>
              <button
                type="button"
                onClick={() => setPlatformFilter('tiktok')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${platformFilter === 'tiktok' ? 'bg-slate-900 text-white shadow-xs' : 'text-text-secondary hover:text-text'}`}
              >
                <TikTokIcon className="w-3.5 h-3.5" /> TikTok Shop ({tiktokOrdersCount})
              </button>
            </div>
          </div>

          <div className="flex gap-2.5 w-full lg:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
              <input
                type="text"
                placeholder="Tìm mã đơn, tên sản phẩm..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-border text-xs rounded-input focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-2 px-3 border border-border text-xs rounded-input bg-white focus:ring-2 focus:ring-primary outline-none font-medium cursor-pointer"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="pending">Chờ đối soát</option>
              <option value="approved">Đã duyệt</option>
              <option value="paid">Đã thanh toán</option>
              <option value="rejected">Không đối soát được</option>
              <option value="returned">Hoàn hàng</option>
            </select>
          </div>
        </div>

        {/* ORDER DATA TABLE */}
        <div className="overflow-x-auto min-h-[250px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-bg/60 font-bold text-text-secondary">
                <th className="py-3.5 px-3 rounded-l-input">Sàn</th>
                <th className="py-3.5 px-3">Mã đơn</th>
                <th className="py-3.5 px-3">Thời gian ghi nhận</th>
                <th className="py-3.5 px-4">Sản phẩm</th>
                <th className="py-3.5 px-3 text-right">Giá trị đơn</th>
                <th className="py-3.5 px-3 text-right">Hoa hồng dự kiến (50%)</th>
                <th className="py-3.5 px-3 text-right">Hoa hồng nhận được</th>
                <th className="py-3.5 px-3 text-center rounded-r-input">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length > 0 ? (
                filteredOrders.map((order) => {
                  const isTikTok = (order as any).platform === 'tiktok';
                  const isApproved = order.status === 'approved' || order.status === 'paid';
                  const isPending = order.status === 'pending';
                  const realVal = order.realCashback !== undefined && order.realCashback !== null 
                    ? order.realCashback 
                    : order.estimatedCashback;

                  return (
                    <tr key={order.id} className="border-b border-border hover:bg-primary/5 transition-colors">
                      <td className="py-4 px-3">
                        {isTikTok ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-900 text-white shadow-xs">
                            <TikTokIcon className="h-3 w-3" /> TikTok
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-orange-50 text-[#EE4D2D] border border-orange-200 shadow-xs">
                            <ShopeeIcon className="h-3 w-3" /> Shopee
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-3 font-mono font-bold text-text">{order.id}</td>
                      <td className="py-4 px-3 text-text-secondary font-medium whitespace-nowrap">{order.createdTime ? String(order.createdTime).substring(0, 16) : 'Vừa xong'}</td>
                      <td className="py-4 px-4 max-w-[260px]">
                        <div className="flex items-center gap-2.5">
                          {order.productImage ? (
                            <img 
                              src={order.productImage} 
                              alt={order.productName} 
                              className="w-9 h-9 object-cover rounded-button border border-border shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-button bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                              <ShoppingBag className="w-4 h-4" />
                            </div>
                          )}
                          <span className="font-bold text-text leading-snug line-clamp-2" title={order.productName}>{order.productName}</span>
                        </div>
                      </td>
                      <td className="py-4 px-3 text-right font-semibold text-text whitespace-nowrap">{Math.floor(order.orderAmount).toLocaleString('vi-VN')}đ</td>
                      <td className="py-4 px-3 text-right font-bold text-primary whitespace-nowrap">
                        {Math.floor(order.estimatedCashback).toLocaleString('vi-VN')}đ
                      </td>
                      <td className="py-4 px-3 text-right font-bold whitespace-nowrap">
                        {isApproved ? (
                          <span className="text-emerald-600 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-md text-xs">
                            +{Math.floor(realVal).toLocaleString('vi-VN')}đ
                          </span>
                        ) : isPending ? (
                          <span className="text-amber-600 text-[11px] font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            Chờ đối soát
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">0đ</span>
                        )}
                      </td>
                      <td className="py-4 px-3 text-center whitespace-nowrap">{getStatusBadge(order.status)}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-text-secondary/60 font-semibold">
                    Không tìm thấy đơn hàng nào phù hợp
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* CSS GLASSMORPHIC LOCK OVERLAY */}
        {!isLoggedIn && (
          <div className="absolute inset-0 bg-white/55 backdrop-blur-md z-10 flex flex-col items-center justify-center p-6 text-center">
            <div className="max-w-md bg-white p-8 rounded-card shadow-soft border border-primary/10 flex flex-col items-center animate-fade-in">
              <div className="bg-primary/10 p-4 rounded-full text-primary mb-5 shadow-inner">
                <Lock className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-black text-text mb-3 leading-tight">Đăng nhập để theo dõi tích lũy thực tế</h3>
              <p className="text-xs text-text-secondary leading-relaxed mb-6">
                Hệ thống tự động đồng bộ thời gian mua, trạng thái đối soát từ Shopee & TikTok Shop về tài khoản để bạn kiểm tra và rút tiền về ngân hàng.
              </p>
              <div className="flex gap-4 w-full justify-center">
                <Button onClick={() => navigate('/auth')} className="px-6 font-bold py-2.5">Đăng nhập ngay</Button>
                <Button variant="outline" onClick={() => navigate('/auth')} className="px-6 font-bold py-2.5 border-border">Đăng ký thành viên</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
