import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';
import type { Order } from '../../store/appStore';
import { 
  Search, Lock, ShoppingBag, 
  TrendingUp, Wallet, Clock 
} from 'lucide-react';
import { Button, Card, CardContent, Badge } from '../../components/ui/core';

// Mock orders for non-logged-in visitors to demonstrate tracking capability
const MOCK_PREVIEW_ORDERS: Order[] = [
  {
    id: 'HD8932',
    productName: 'Điện thoại Apple iPhone 15 Pro Max 256GB - Chính hãng VNA',
    productImage: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&q=80&w=400',
    orderAmount: 29990000,
    estimatedCashback: 2099300,
    status: 'pending',
    createdTime: '2026-07-06 14:15:00',
    userId: 'guest'
  },
  {
    id: 'HD7823',
    productName: 'Tai nghe chụp tai Bluetooth Sony WH-1000XM4 Chống ồn chủ động',
    productImage: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=400',
    orderAmount: 6490000,
    estimatedCashback: 454300,
    realCashback: 454300,
    status: 'approved',
    createdTime: '2026-07-02 09:30:00',
    userId: 'guest'
  },
  {
    id: 'HD4310',
    productName: 'Bình Giữ Nhiệt Lock&Lock Feather Light 450ml - Thép Không Gỉ',
    productImage: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&q=80&w=400',
    orderAmount: 350000,
    estimatedCashback: 24500,
    realCashback: 24500,
    status: 'paid',
    createdTime: '2026-06-25 11:20:00',
    userId: 'guest'
  },
  {
    id: 'HD3299',
    productName: 'Son Kem Lì Black Rouge Air Fit Velvet Tint Ver 9 4.4g',
    productImage: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&q=80&w=400',
    orderAmount: 189000,
    estimatedCashback: 13230,
    status: 'rejected',
    createdTime: '2026-06-18 18:45:00',
    userId: 'guest',
    notes: 'Đơn hàng bị Shopee hủy bỏ'
  }
];

export default function TrackingPage() {
  const navigate = useNavigate();
  const { currentUser, orders, fetchUserOrders } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const isLoggedIn = !!currentUser;

  // Auto fetch user orders on mount
  useEffect(() => {
    if (currentUser) {
      fetchUserOrders();
    }
  }, [currentUser, fetchUserOrders]);
  
  // Decide which orders array to display
  const activeOrders = isLoggedIn 
    ? orders.filter(o => o.userId === currentUser.id)
    : MOCK_PREVIEW_ORDERS;

  // Filter orders by search term and status dropdown
  const filteredOrders = activeOrders.filter(o => {
    const matchesSearch = o.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          o.productName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' ? true : o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate order statistics
  const totalOrdersCount = isLoggedIn ? activeOrders.length : 0;
  
  const totalAmount = isLoggedIn 
    ? activeOrders.reduce((sum, o) => sum + o.orderAmount, 0)
    : 0;

  const pendingCashback = isLoggedIn 
    ? activeOrders
      .filter(o => o.status === 'pending')
      .reduce((sum, o) => sum + o.estimatedCashback, 0)
    : 0;

  const approvedCashback = isLoggedIn 
    ? activeOrders
      .filter(o => o.status === 'approved' || o.status === 'paid')
      .reduce((sum, o) => sum + (o.realCashback || o.estimatedCashback) * 0.5, 0)
    : 0;

  const getStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-amber-500 text-white border-none text-[11px] py-1 px-2.5 font-bold">Chờ đối soát</Badge>;
      case 'approved':
        return <Badge className="bg-emerald-500 text-white border-none text-[11px] py-1 px-2.5 font-bold">Đã duyệt</Badge>;
      case 'paid':
        return <Badge className="bg-blue-500 text-white border-none text-[11px] py-1 px-2.5 font-bold">Đã trả tiền</Badge>;
      case 'rejected':
        return <Badge className="bg-rose-500 text-white border-none text-[11px] py-1 px-2.5 font-bold">Không đối soát được</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative">
      {/* HEADER SECTION */}
      <div className="text-center max-w-3xl mx-auto mb-12">
        <span className="px-3.5 py-1.5 bg-primary/10 text-primary font-bold text-xs uppercase tracking-wider rounded-full mb-4 inline-block">
          Tra cứu tích lũy
        </span>
        <h1 className="text-3xl md:text-5xl font-black text-text mb-4 leading-tight">
          Lịch Sử <span className="gradient-text">Hoàn Tiền Đối Soát</span>
        </h1>
        <p className="text-sm md:text-base text-text-secondary">
          Kiểm tra tiến độ ghi nhận đơn hàng Shopee và số tiền hoàn dự kiến được cộng vào tài khoản của bạn.
        </p>
      </div>

      {/* STATS OVERVIEW */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-10 relative">
        {[
          { icon: <ShoppingBag className="h-5 w-5 text-text" />, label: "Tổng đơn hàng", value: `${totalOrdersCount} đơn` },
          { icon: <TrendingUp className="h-5 w-5 text-amber-500" />, label: "Tổng giá trị mua", value: `${totalAmount.toLocaleString('vi-VN')}đ` },
          { icon: <Clock className="h-5 w-5 text-amber-500 animate-pulse" />, label: "Tạm tính (Chờ)", value: `${pendingCashback.toLocaleString('vi-VN')}đ` },
          { icon: <Wallet className="h-5 w-5 text-emerald-500" />, label: "Đã duyệt & Đã trả", value: `${approvedCashback.toLocaleString('vi-VN')}đ` }
        ].map((stat, idx) => (
          <Card key={idx} className="border-border/50 bg-white shadow-sm overflow-hidden text-left relative">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="bg-bg p-3 rounded-[12px] shrink-0">
                {stat.icon}
              </div>
              <div>
                <p className="text-xs font-semibold text-text-secondary leading-tight mb-1">{stat.label}</p>
                <p className="text-base md:text-lg font-black text-text">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* TABLE SECTION WITH AUTHENTICATION GATING */}
      <div className="bg-white rounded-card border border-border/50 shadow-soft p-6 relative overflow-hidden">
        {/* FILTER CONTROLS */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h2 className="text-lg font-bold text-text">Chi tiết các đơn hàng tích lũy</h2>
          <div className="flex gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
              <input
                type="text"
                placeholder="Tìm mã đơn, tên sản phẩm..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-border text-xs rounded-input focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-2 px-3 border border-border text-xs rounded-input bg-white focus:ring-2 focus:ring-primary"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="pending">Chờ đối soát</option>
              <option value="approved">Đã duyệt</option>
              <option value="paid">Đã thanh toán</option>
              <option value="rejected">Không đối soát được</option>
            </select>
          </div>
        </div>

        {/* ORDER DATA TABLE */}
        <div className="overflow-x-auto min-h-[250px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-bg/50 font-bold text-text-secondary">
                <th className="py-3.5 px-4 rounded-l-input">Mã đơn</th>
                <th className="py-3.5 px-4">Thời gian ghi nhận</th>
                <th className="py-3.5 px-4">Sản phẩm</th>
                <th className="py-3.5 px-4 text-right">Giá trị đơn</th>
                <th className="py-3.5 px-4 text-right">Tiền hoàn dự kiến</th>
                <th className="py-3.5 px-4 text-center rounded-r-input">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length > 0 ? (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="border-b border-border hover:bg-primary/5 transition-colors">
                    <td className="py-4 px-4 font-bold text-text">{order.id}</td>
                    <td className="py-4 px-4 text-text-secondary">{order.createdTime || 'Vừa xong'}</td>
                    <td className="py-4 px-4 max-w-[280px]">
                      <div className="flex items-center gap-3">
                        <img 
                          src={order.productImage} 
                          alt={order.productName} 
                          className="w-10 h-10 object-cover rounded-button border border-border"
                        />
                        <span className="font-bold text-text leading-snug line-clamp-2">{order.productName}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right font-semibold text-text">{order.orderAmount.toLocaleString('vi-VN')}đ</td>
                    <td className="py-4 px-4 text-right font-bold text-primary">
                      {order.estimatedCashback.toLocaleString('vi-VN')}đ
                    </td>
                    <td className="py-4 px-4 text-center">{getStatusBadge(order.status)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-text-secondary/60 font-semibold">
                    Không tìm thấy đơn hàng nào phù hợp
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* CSS GLASSMORPHIC LOCK OVERLAY */}
        {!isLoggedIn && (
          <div className="absolute inset-0 bg-white/45 backdrop-blur-md z-10 flex flex-col items-center justify-center p-6 text-center">
            <div className="max-w-md bg-white p-8 rounded-card shadow-soft border border-primary/10 flex flex-col items-center animate-fade-in">
              <div className="bg-primary/10 p-4 rounded-full text-primary mb-5 shadow-inner">
                <Lock className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-black text-text mb-3 leading-tight">Đăng nhập để theo dõi tích lũy thực tế</h3>
              <p className="text-xs text-text-secondary leading-relaxed mb-6">
                Hệ thống tự động đồng bộ thời gian mua, số tiền chiết khấu Shopee đối soát từ tài khoản của bạn để bạn rút về tài khoản ngân hàng.
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
