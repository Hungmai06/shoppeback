import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Wallet, Bell, Heart,
  ArrowUpRight, LifeBuoy, Settings, LogOut, Package, Clock,
  CheckCircle2, AlertTriangle, Coins, Upload,
  Check, ShieldCheck, ChevronRight,
  FileText, Landmark, Users, Copy, MousePointerClick, UserPlus, Send, Link2
} from 'lucide-react';
import {
  Button, Card, CardContent, CardHeader, CardTitle, CardDescription,
  Badge, TableContainer, TableHeader, TableBody, TableRow,
  TableHead, TableCell, Input, Dialog, DialogHeader, DialogTitle, DialogContent
} from '../../components/ui/core';
import { useAppStore } from '../../store/appStore';
import type { Order } from '../../store/appStore';
import { toast } from 'sonner';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell, Legend
} from 'recharts';

interface ReferralStats {
  clicks: number;
  f1Count: number;
  pendingCommission: number;
  approvedCommission: number;
}

interface ReferralHistory {
  id: string;
  f1Name: string;
  tier: string;
  baseCashback: number;
  bonus: number;
  status: string;
  createdAt: string;
}

export default function UserDashboard() {
  const navigate = useNavigate();
  const {
    currentUser, logout, orders, withdrawals, notifications,
    favorites, markNotificationAsRead, markAllNotificationsAsRead,
    addWithdrawalRequest, uploadOrderScreenshot, toggleFavorite,
    updateProfile
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'wallet' | 'withdraw' | 'favorites' | 'notifications' | 'support' | 'settings' | 'referral'>('dashboard');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Withdrawal Form States
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawBank, setWithdrawBank] = useState(currentUser?.bankName || '');
  const [withdrawAccount, setWithdrawAccount] = useState(currentUser?.accountNumber || '');
  const [withdrawHolder, setWithdrawHolder] = useState(currentUser?.accountHolder || '');

  // Settings States
  const [profileName, setProfileName] = useState(currentUser?.name || '');
  const [profilePhone, setProfilePhone] = useState(currentUser?.phone || '');
  const [profileBank, setProfileBank] = useState(currentUser?.bankName || '');
  const [profileNumber, setProfileNumber] = useState(currentUser?.accountNumber || '');
  const [profileHolder, setProfileHolder] = useState(currentUser?.accountHolder || '');
  const [profileTelegram, setProfileTelegram] = useState(currentUser?.telegramChatId || '');
  const [emailNotify, setEmailNotify] = useState(currentUser?.emailNotify || false);
  const [telegramNotify, setTelegramNotify] = useState(currentUser?.telegramNotify || false);
  const [passwordOld, setPasswordOld] = useState('');
  const [passwordNew, setPasswordNew] = useState('');

  // Screenshot Upload state
  const [uploadingOrderId, setUploadingOrderId] = useState<string | null>(null);

  // Referral states
  const [refStats, setRefStats] = useState<ReferralStats>({
    clicks: 0, f1Count: 0, pendingCommission: 0, approvedCommission: 0
  });
  const [refHistory, setRefHistory] = useState<ReferralHistory[]>([]);
  const [refLoading, setRefLoading] = useState(true);

  // Redirect if not logged in
  React.useEffect(() => {
    if (!currentUser) {
      navigate('/auth/login');
    } else {
      // Fetch referral data
      const fetchReferralData = async () => {
        try {
          const token = localStorage.getItem('token');
          const [statsRes, historyRes] = await Promise.all([
            fetch('/api/referrals/stats', { headers: { Authorization: `Bearer ${token}` } }),
            fetch('/api/referrals/history', { headers: { Authorization: `Bearer ${token}` } })
          ]);

          if (statsRes.ok) {
            const statsData = await statsRes.json();
            setRefStats(statsData);
          }
          if (historyRes.ok) {
            const historyData = await historyRes.json();
            setRefHistory(historyData);
          }
        } catch (error) {
          console.error("Failed to load referral data", error);
        } finally {
          setRefLoading(false);
        }
      };
      fetchReferralData();
    }
  }, [currentUser, navigate]);

  if (!currentUser) return null;

  // Filter orders for current user
  const userOrders = orders.filter(o => o.userId === currentUser.id);
  const userWithdrawals = withdrawals.filter(w => w.userId === currentUser.id);

  // Computations for dashboard metrics
  const totalOrders = userOrders.length;

  const pendingCashback = Math.round(userOrders
    .filter(o => o.status === 'pending')
    .reduce((sum, o) => sum + o.estimatedCashback, 0));

  const approvedCashback = Math.round(userOrders
    .filter(o => o.status === 'approved')
    .reduce((sum, o) => sum + (o.realCashback || o.estimatedCashback), 0));

  const alreadyWithdrawn = Math.round(userWithdrawals
    .filter(w => w.status === 'approved' || w.status === 'pending')
    .reduce((sum, w) => sum + w.amount, 0));

  // Available balance for withdrawal = Approved cashback - Already withdrawn (Approved or Pending)
  const availableBalance = Math.max(0, approvedCashback - alreadyWithdrawn);

  // Chart Data preparation
  const monthlyData = [
    { name: 'Tháng 2', cashback: 85000 },
    { name: 'Tháng 3', cashback: 120000 },
    { name: 'Tháng 4', cashback: 95000 },
    { name: 'Tháng 5', cashback: 180000 },
    { name: 'Tháng 6', cashback: approvedCashback > 0 ? approvedCashback : 250000 },
    { name: 'Tháng 7', cashback: pendingCashback },
  ];

  const statusData = [
    { name: 'Hoàn thành', value: userOrders.filter(o => o.status === 'approved').length, color: '#22C55E' },
    { name: 'Đang chờ xử lý', value: userOrders.filter(o => o.status === 'pending').length, color: '#3B82F6' },
    { name: 'Hủy', value: userOrders.filter(o => o.status === 'rejected').length, color: '#EF4444' },
    { name: 'Hoàn hàng', value: userOrders.filter(o => o.status === 'returned').length, color: '#F97316' },
    { name: 'Đã thanh toán', value: userOrders.filter(o => o.status === 'paid').length, color: '#F59E0B' },
  ].filter(item => item.value > 0);

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(withdrawAmount);

    if (isNaN(amount) || amount < 50000) {
      toast.error('Số tiền rút tối thiểu là 50.000đ');
      return;
    }

    if (amount > availableBalance) {
      toast.error('Số dư khả dụng không đủ để thực hiện giao dịch');
      return;
    }

    if (!withdrawBank || !withdrawAccount || !withdrawHolder) {
      toast.error('Vui lòng cung cấp đầy đủ thông tin tài khoản ngân hàng');
      return;
    }

    const success = await addWithdrawalRequest(amount, withdrawBank, withdrawAccount, withdrawHolder);
    if (success) {
      toast.success('Gửi yêu cầu rút tiền thành công!');
      setWithdrawAmount('');
      setActiveTab('wallet'); // Go to wallet tab
    } else {
      toast.error('Có lỗi xảy ra, vui lòng thử lại.');
    }
  };

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({
      name: profileName,
      phone: profilePhone,
      bankName: profileBank,
      accountNumber: profileNumber,
      accountHolder: profileHolder.toUpperCase(),
      telegramChatId: profileTelegram,
      emailNotify,
      telegramNotify
    });
    toast.success('Cập nhật thông tin tài khoản thành công!');
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordOld || !passwordNew) {
      toast.error('Vui lòng điền mật khẩu cũ và mới');
      return;
    }
    toast.success('Thay đổi mật khẩu thành công!');
    setPasswordOld('');
    setPasswordNew('');
  };

  const handleUploadScreenshotSimulation = (orderId: string) => {
    setUploadingOrderId(orderId);

    setTimeout(() => {
      uploadOrderScreenshot(orderId, 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&q=80&w=400');
      toast.success('Đã tải lên ảnh chụp đơn hàng! Admin sẽ đối soát nhanh chóng hơn.');

      // Update selected order in dialog
      const updatedOrder = orders.find(o => o.id === orderId);
      if (updatedOrder) {
        setSelectedOrder({ ...updatedOrder, screenshot: 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&q=80&w=400' });
      }
      setUploadingOrderId(null);
    }, 1500);
  };

  const getStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'pending': return <Badge variant="info">Đang chờ xử lý</Badge>;
      case 'approved': return <Badge variant="success">Hoàn thành</Badge>;
      case 'rejected': return <Badge variant="danger">Hủy</Badge>;
      case 'returned': return <Badge variant="warning" className="bg-orange-50 text-orange-600 border-orange-200">Hoàn hàng</Badge>;
      case 'paid': return <Badge variant="warning">Đã thanh toán</Badge>;
    }
  };

  const getTimelineStepIndex = (status: Order['status']) => {
    switch (status) {
      case 'pending': return 1;
      case 'approved': return 2;
      case 'paid': return 3;
      case 'rejected': return -1;
      case 'returned': return -1;
      default: return 0;
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col font-poppins">

      {/* HEADER BAR */}
      <header className="sticky top-0 z-30 glass-panel shadow-sm w-full py-4 px-6 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-3">
          <div className="gradient-bg p-2 rounded-[12px] text-white">
            <Coins className="h-5 w-5" />
          </div>
          <span className="font-bold text-text hidden sm:inline">Khu Vực Thành Viên</span>
          <span className="text-xs text-text-secondary font-medium">/{currentUser.name}</span>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveTab('notifications')}
            className="relative p-2 rounded-full hover:bg-border/30 text-text-secondary hover:text-text transition-all"
          >
            <Bell className="h-5 w-5" />
            {notifications.filter(n => !n.read).length > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-danger rounded-full ring-2 ring-white animate-pulse" />
            )}
          </button>

          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="hidden md:flex gap-1.5 border-border items-center"
              onClick={() => { logout(); toast.info('Đã đăng xuất'); navigate('/'); }}
            >
              <LogOut className="h-3.5 w-3.5" />
              Đăng xuất
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col md:flex-row relative">

        {/* SIDEBAR NAVIGATION */}
        <aside className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-border p-4 flex flex-col gap-1 md:h-[calc(100vh-73px)] sticky top-[73px] z-20 overflow-y-auto">
          {[
            { id: 'dashboard', icon: <LayoutDashboard className="h-4.5 w-4.5" />, label: 'Dashboard Tổng quan' },
            { id: 'orders', icon: <ShoppingCart className="h-4.5 w-4.5" />, label: 'Quản lý đơn hàng' },
            { id: 'wallet', icon: <Wallet className="h-4.5 w-4.5" />, label: 'Ví hoàn tiền' },
            { id: 'referral', icon: <Users className="h-4.5 w-4.5" />, label: 'Tiếp thị liên kết' },
            { id: 'withdraw', icon: <ArrowUpRight className="h-4.5 w-4.5" />, label: 'Yêu cầu rút tiền' },
            { id: 'favorites', icon: <Heart className="h-4.5 w-4.5" />, label: 'Sản phẩm yêu thích' },
            { id: 'notifications', icon: <Bell className="h-4.5 w-4.5" />, label: 'Thông báo cá nhân' },
            { id: 'support', icon: <LifeBuoy className="h-4.5 w-4.5" />, label: 'Hỗ trợ kỹ thuật' },
            { id: 'settings', icon: <Settings className="h-4.5 w-4.5" />, label: 'Cài đặt tài khoản' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-3.5 px-4 py-3 text-sm font-semibold rounded-[12px] transition-all text-left ${activeTab === tab.id ? 'bg-primary/5 text-primary' : 'text-text-secondary hover:text-text hover:bg-border/20'}`}
            >
              {tab.icon}
              <span className="flex-1">{tab.label}</span>
              {tab.id === 'notifications' && notifications.filter(n => !n.read).length > 0 && (
                <Badge variant="danger" className="py-0 px-2 text-[10px]">{notifications.filter(n => !n.read).length}</Badge>
              )}
            </button>
          ))}

          <div className="mt-auto pt-6 border-t border-border/40 hidden md:block">
            <button
              onClick={() => { logout(); toast.info('Đã đăng xuất'); navigate('/'); }}
              className="flex w-full items-center gap-3 px-4 py-3 text-xs font-bold text-danger rounded-[12px] hover:bg-red-50 transition-all text-left"
            >
              <LogOut className="h-4 w-4" />
              Đăng xuất tài khoản
            </button>
          </div>
        </aside>

        {/* DASHBOARD CONTENT BODY */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl">

          {/* TAB 1: OVERVIEW DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="flex flex-col gap-8">

              {/* TOP WIDGETS CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { title: "Tổng số đơn hàng", value: totalOrders, desc: "Đã mua qua link hoàn tiền", color: "text-text", icon: <Package className="h-5 w-5 text-text-secondary" /> },
                  { title: "Tiền hoàn chờ duyệt", value: `${pendingCashback.toLocaleString('vi-VN')}đ`, desc: "Shopee đang đối soát", color: "text-info", icon: <Clock className="h-5 w-5 text-info" /> },
                  { title: "Tiền hoàn đã duyệt", value: `${approvedCashback.toLocaleString('vi-VN')}đ`, desc: "Tích lũy hoàn thành", color: "text-success", icon: <CheckCircle2 className="h-5 w-5 text-success" /> },
                  { title: "Số dư khả dụng", value: `${availableBalance.toLocaleString('vi-VN')}đ`, desc: "Đủ điều kiện rút về ví", color: "text-primary", icon: <Wallet className="h-5 w-5 text-primary" /> }
                ].map((card, idx) => (
                  <Card key={idx} className="border-border/50 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-primary/2 rounded-full blur-lg" />
                    <CardHeader className="p-5 pb-2 flex flex-row items-center justify-between">
                      <CardDescription className="font-bold text-text-secondary uppercase tracking-wider text-[10px]">{card.title}</CardDescription>
                      {card.icon}
                    </CardHeader>
                    <CardContent className="p-5 pt-0">
                      <p className={`text-2xl font-black ${card.color} mb-1.5`}>{card.value}</p>
                      <p className="text-[10px] text-text-secondary font-medium">{card.desc}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* GRAPHS AND CHARTS */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 border-border/50">
                  <CardHeader>
                    <CardTitle className="text-base">Xu hướng tiền hoàn tích lũy</CardTitle>
                    <CardDescription>Biểu đồ hiển thị số tiền nhận lại trong các tháng gần nhất (VND)</CardDescription>
                  </CardHeader>
                  <CardContent className="h-64 pl-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                        <XAxis dataKey="name" stroke="#6B7280" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis stroke="#6B7280" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `${val / 1000}k`} />
                        <Tooltip formatter={(value) => [`${Number(value).toLocaleString('vi-VN')}đ`, 'Tiền hoàn']} labelStyle={{ fontSize: 12, fontWeight: 'bold' }} contentStyle={{ borderRadius: 12, border: '1px solid #ECECEC' }} />
                        <Bar dataKey="cashback" fill="#FF5A1F" radius={[6, 6, 0, 0]} barSize={25} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle className="text-base">Thống kê trạng thái đơn</CardTitle>
                    <CardDescription>Tỷ lệ các trạng thái đơn hàng của bạn</CardDescription>
                  </CardHeader>
                  <CardContent className="h-64 flex flex-col items-center justify-center">
                    {statusData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={statusData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {statusData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(val) => [`${val} đơn`, 'Số lượng']} />
                          <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontWeight: 'bold' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="text-center text-xs text-text-secondary">
                        <Package className="h-8 w-8 text-border/80 mx-auto mb-2" />
                        Chưa có dữ liệu thống kê đơn hàng.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* RECENT ORDERS TABLE */}
              <Card className="border-border/50">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <div>
                    <CardTitle className="text-base">Đơn hàng mới ghi nhận</CardTitle>
                    <CardDescription>Theo dõi các đơn mua sắm vừa thực hiện qua link của bạn</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setActiveTab('orders')} className="text-xs border-border flex items-center gap-1">
                    Xem tất cả <ChevronRight className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  {userOrders.length > 0 ? (
                    <TableContainer>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Mã Đơn</TableHead>
                          <TableHead>Tên Sản Phẩm</TableHead>
                          <TableHead className="text-right">Giá Trị</TableHead>
                          <TableHead className="text-right">Ước Tính Hoàn</TableHead>
                          <TableHead>Trạng Thái</TableHead>
                          <TableHead>Thời Gian</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {userOrders.slice(0, 4).map((order) => (
                          <TableRow key={order.id} onClick={() => setSelectedOrder(order)}>
                            <TableCell className="font-bold text-primary">{order.id}</TableCell>
                            <TableCell className="max-w-[200px] truncate font-semibold">{order.productName}</TableCell>
                            <TableCell className="text-right font-semibold">{Math.round(order.orderAmount).toLocaleString('vi-VN')}đ</TableCell>
                            <TableCell className="text-right font-bold text-primary">
                              {Math.round(order.estimatedCashback).toLocaleString('vi-VN')}đ
                            </TableCell>
                            <TableCell>{getStatusBadge(order.status)}</TableCell>
                            <TableCell className="text-xs text-text-secondary font-medium">{order.createdTime}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </TableContainer>
                  ) : (
                    <div className="text-center py-10 text-xs text-text-secondary">
                      Chưa ghi nhận đơn hàng nào. Dán link mua sắm để tạo tiền hoàn!
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>
          )}

          {/* TAB 2: ORDER MANAGEMENT */}
          {activeTab === 'orders' && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-2xl font-black text-text">Quản lý đơn hàng hoàn tiền</h2>
                <p className="text-xs text-text-secondary mt-1">
                  Nhấn vào từng đơn hàng để xem chi tiết timeline đối soát, thông tin chi tiết và gửi ảnh chụp màn hình đơn hàng để xác minh nhanh.
                </p>
              </div>

              <Card className="border-border/50">
                <CardContent className="p-0">
                  {userOrders.length > 0 ? (
                    <TableContainer>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Mã Đơn</TableHead>
                          <TableHead>Sản Phẩm</TableHead>
                          <TableHead className="text-right">Số Tiền Đơn</TableHead>
                          <TableHead className="text-right">Tiền Hoàn Dự Kiến</TableHead>
                          <TableHead className="text-right">Thực Nhận</TableHead>
                          <TableHead>Trạng Thái</TableHead>
                          <TableHead>Thời Gian</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {userOrders.map((order) => (
                          <TableRow key={order.id} onClick={() => setSelectedOrder(order)}>
                            <TableCell className="font-bold text-primary">{order.id}</TableCell>
                            <TableCell className="max-w-[240px] truncate font-semibold">
                              <span className="truncate">{order.productName}</span>
                            </TableCell>
                            <TableCell className="text-right font-semibold">{Math.round(order.orderAmount).toLocaleString('vi-VN')}đ</TableCell>
                            <TableCell className="text-right font-bold text-primary">{Math.round(order.estimatedCashback).toLocaleString('vi-VN')}đ</TableCell>
                            <TableCell className="text-right font-bold text-success">
                              {order.realCashback ? `${Math.round(order.realCashback).toLocaleString('vi-VN')}đ` : '-'}
                            </TableCell>
                            <TableCell>{getStatusBadge(order.status)}</TableCell>
                            <TableCell className="text-xs text-text-secondary font-medium">{order.createdTime}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </TableContainer>
                  ) : (
                    <div className="text-center py-16 text-xs text-text-secondary">
                      <ShoppingCart className="h-10 w-10 text-border/80 mx-auto mb-2" />
                      Không tìm thấy đơn hàng nào.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 3: WALLET INFO */}
          {activeTab === 'wallet' && (
            <div className="flex flex-col gap-8">
              <div>
                <h2 className="text-2xl font-black text-text">Ví tiền tích lũy hoàn tiền</h2>
                <p className="text-xs text-text-secondary mt-1">Quản lý các nguồn hoa hồng tích lũy và theo dõi lịch sử rút tiền của bạn.</p>
              </div>

              {/* Wallet Summary Blocks */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="bg-gradient-to-br from-orange-500 to-orange-400 text-white border-none shadow-lg shadow-orange-500/15">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-white/80 font-bold uppercase tracking-wider text-[10px]">Số dư khả dụng rút</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-black mb-3">{availableBalance.toLocaleString('vi-VN')}đ</p>
                    <div className="flex justify-between items-center text-[10px] text-white/90">
                      <span>Rút tối thiểu: 50.000đ</span>
                      <button
                        type="button"
                        onClick={() => setActiveTab('withdraw')}
                        className="bg-white text-primary px-3.5 py-1.5 font-bold rounded-[8px] hover:bg-orange-50 transition-all flex items-center gap-1 active:scale-95"
                      >
                        Rút ngay <ArrowUpRight className="h-3 w-3" />
                      </button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/50">
                  <CardHeader className="pb-2">
                    <CardDescription className="font-bold text-text-secondary uppercase tracking-wider text-[10px]">Đang chờ Shopee duyệt</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-black text-info mb-3">{pendingCashback.toLocaleString('vi-VN')}đ</p>
                    <p className="text-[10px] text-text-secondary leading-relaxed font-medium">
                      Tiền tạm tính đang nằm trong quá trình đối soát của các đơn hàng. Sẽ cộng vào số dư khả dụng ngay khi được duyệt.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border/50">
                  <CardHeader className="pb-2">
                    <CardDescription className="font-bold text-text-secondary uppercase tracking-wider text-[10px]">Đã thanh toán về bank</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-black text-success mb-3">
                      {userWithdrawals.filter(w => w.status === 'approved').reduce((sum, w) => sum + w.amount, 0).toLocaleString('vi-VN')}đ
                    </p>
                    <p className="text-[10px] text-text-secondary leading-relaxed font-medium">
                      Tổng số tiền đã chuyển khoản thành công vào tài khoản ngân hàng của bạn kể từ khi kích hoạt ví.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border/50">
                  <CardHeader className="pb-2">
                    <CardDescription className="font-bold text-text-secondary uppercase tracking-wider text-[10px]">Hoa hồng giới thiệu</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-black text-primary mb-3">{(currentUser.referralEarnings || 0).toLocaleString('vi-VN')}đ</p>
                    <div className="mt-2 bg-border/20 p-2 rounded-md flex items-center justify-between gap-2 border border-border/50">
                      <div className="overflow-hidden">
                        <p className="text-[10px] text-text-secondary font-medium">Link giới thiệu của bạn:</p>
                        <p className="text-xs font-bold text-text font-mono mt-0.5 select-all truncate">{window.location.origin}/auth?mode=register&ref={currentUser.id}</p>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/auth?mode=register&ref=${currentUser.id}`);
                          toast.success('Đã sao chép link giới thiệu!');
                        }}
                        className="p-1.5 bg-white text-primary rounded-md shadow-sm border border-border/50 hover:bg-orange-50"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* TRANSACTION HISTORY */}
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-base">Lịch sử rút tiền</CardTitle>
                  <CardDescription>Các giao dịch gửi yêu cầu rút tiền về tài khoản ngân hàng của bạn</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {userWithdrawals.length > 0 ? (
                    <TableContainer>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Mã Yêu Cầu</TableHead>
                          <TableHead className="text-right">Số Tiền Rút</TableHead>
                          <TableHead>Ngân Hàng Nhận</TableHead>
                          <TableHead>Số Tài Khoản</TableHead>
                          <TableHead>Chủ Tài Khoản</TableHead>
                          <TableHead>Thời Gian Yêu Cầu</TableHead>
                          <TableHead>Trạng Thái</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {userWithdrawals.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-bold text-primary">{item.id}</TableCell>
                            <TableCell className="text-right font-bold text-text">{item.amount.toLocaleString('vi-VN')}đ</TableCell>
                            <TableCell className="font-semibold">{item.bankName}</TableCell>
                            <TableCell className="font-mono">{item.accountNumber}</TableCell>
                            <TableCell className="font-semibold text-xs">{item.accountHolder}</TableCell>
                            <TableCell className="text-xs text-text-secondary font-medium">{item.requestDate}</TableCell>
                            <TableCell>
                              {item.status === 'pending' && <Badge variant="info">Chờ duyệt</Badge>}
                              {item.status === 'approved' && <Badge variant="success">Đã chuyển tiền</Badge>}
                              {item.status === 'rejected' && <Badge variant="danger">Bị từ chối</Badge>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </TableContainer>
                  ) : (
                    <div className="text-center py-12 text-xs text-text-secondary">
                      Bạn chưa tạo yêu cầu rút tiền nào. Hãy tích lũy số dư để tạo rút tiền.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 4: WITHDRAW REQUEST FORM */}
          {activeTab === 'withdraw' && (
            <div className="max-w-2xl mx-auto flex flex-col gap-6">
              <div>
                <h2 className="text-2xl font-black text-text">Tạo yêu cầu rút tiền</h2>
                <p className="text-xs text-text-secondary mt-1">Rút số dư tích lũy khả dụng về tài khoản ngân hàng của bạn.</p>
              </div>

              <Card className="border-border/50">
                <CardContent className="p-6 flex flex-col gap-6">

                  {/* Balance Widget */}
                  <div className="bg-bg border border-border/80 p-5 rounded-input flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-text-secondary">Số dư khả dụng hiện tại</p>
                      <p className="text-2xl font-black text-primary mt-1">{availableBalance.toLocaleString('vi-VN')}đ</p>
                    </div>
                    <Badge variant="success" className="py-1 px-3">Khả dụng</Badge>
                  </div>

                  <form onSubmit={handleWithdrawSubmit} className="flex flex-col gap-4">
                    <Input
                      label="Số tiền rút (VND)"
                      placeholder="Nhập số tiền muốn rút (tối thiểu 50,000đ)"
                      type="number"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      required
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input
                        label="Tên Ngân Hàng"
                        placeholder="Vietcombank, Techcombank..."
                        value={withdrawBank}
                        onChange={(e) => setWithdrawBank(e.target.value)}
                        required
                      />
                      <Input
                        label="Số Tài Khoản"
                        placeholder="Nhập số tài khoản"
                        value={withdrawAccount}
                        onChange={(e) => setWithdrawAccount(e.target.value)}
                        required
                      />
                    </div>

                    <Input
                      label="Tên Chủ Tài Khoản (Viết hoa không dấu)"
                      placeholder="NGUYEN VAN A"
                      value={withdrawHolder}
                      onChange={(e) => setWithdrawHolder(e.target.value)}
                      required
                    />

                    <div className="flex items-start gap-2.5 text-xs text-text-secondary bg-orange-50/50 p-4 border border-orange-100 rounded-input">
                      <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <p className="leading-relaxed">
                        Yêu cầu rút tiền sẽ được xử lý thủ công bởi Admin trong vòng 24 giờ làm việc. Vui lòng kiểm tra kỹ thông tin ngân hàng trước khi xác nhận để tránh chuyển khoản sai lệch.
                      </p>
                    </div>

                    <Button type="submit" className="w-full py-3 font-bold mt-2">
                      Gửi Yêu Cầu Rút Tiền
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 5: FAVORITES */}
          {activeTab === 'favorites' && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-2xl font-black text-text">Sản phẩm yêu thích của tôi</h2>
                <p className="text-xs text-text-secondary mt-1">Danh sách các link sản phẩm Shopee bạn đã lưu để theo dõi hoặc mua sắm lại sau này.</p>
              </div>

              {favorites.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {orders
                    .filter(o => favorites.includes(o.id) || favorites.includes(o.productName)) // simple binding logic for mock
                    .map((item, idx) => (
                      <Card key={idx} className="flex flex-col border-border/40 hover:shadow-md transition-all">
                        <div className="h-44 bg-border/20 relative">
                          <img src={item.productImage} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                          <button
                            onClick={() => { toggleFavorite(item.id); toast.success('Đã xóa khỏi danh sách yêu thích'); }}
                            className="absolute top-3 right-3 p-1.5 bg-white text-danger border border-danger/10 shadow-sm rounded-full"
                          >
                            <Heart className="h-4 w-4 fill-current" />
                          </button>
                        </div>
                        <CardContent className="p-4 flex-1 flex flex-col justify-between">
                          <div>
                            <h4 className="font-bold text-sm text-text line-clamp-2 leading-snug mb-2">{item.productName}</h4>
                            <p className="text-xs text-text-secondary font-semibold">Ước tính hoàn: <span className="text-primary font-bold">{Math.round(item.estimatedCashback).toLocaleString('vi-VN')}đ</span></p>
                          </div>
                          <Button
                            size="sm"
                            className="w-full mt-4 font-bold"
                            onClick={() => {
                              navigator.clipboard.writeText(`https://shope.ee/aff?p=${encodeURIComponent(item.productName)}&sub_id=${currentUser.id}`);
                              toast.success('Đã tạo và sao chép link hoàn tiền thành công!');
                            }}
                          >
                            Tạo Link Mua Hàng
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  {/* Fallback to show mock favorites items if binding misses */}
                  {favorites.length > 0 && orders.filter(o => favorites.includes(o.id)).length === 0 && (
                    <div className="sm:col-span-2 lg:col-span-3 text-center py-10 bg-white border border-border/50 rounded-card text-xs text-text-secondary">
                      <Heart className="h-8 w-8 text-danger mx-auto mb-2 fill-current" />
                      Bạn có các link yêu thích từ Trang chủ. Vui lòng bấm dán link trang chủ để mua hàng hoàn tiền ngay.
                    </div>
                  )}
                </div>
              ) : (
                <Card className="border-border/50 text-center py-16">
                  <CardContent className="flex flex-col items-center">
                    <Heart className="h-10 w-10 text-border/80 mb-3" />
                    <p className="text-sm font-semibold text-text mb-1">Chưa có sản phẩm yêu thích</p>
                    <p className="text-xs text-text-secondary max-w-sm mb-4">
                      Bấm vào biểu tượng trái tim ở kết quả tìm kiếm sản phẩm tại trang chủ để lưu các món hàng tại đây.
                    </p>
                    <Button variant="outline" size="sm" onClick={() => navigate('/')} className="border-border text-xs font-bold">Quay lại Trang chủ</Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* TAB 6: NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="max-w-3xl mx-auto flex flex-col gap-6">
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-2xl font-black text-text">Thông báo của tôi</h2>
                  <p className="text-xs text-text-secondary mt-1">Cập nhật trạng thái đơn hàng, giao dịch rút tiền và thông tin hệ thống.</p>
                </div>
                {notifications.some(n => !n.read) && (
                  <button
                    onClick={() => { markAllNotificationsAsRead(); toast.success('Đã đọc tất cả thông báo'); }}
                    className="text-xs text-primary font-bold hover:underline"
                  >
                    Đánh dấu đã đọc tất cả
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-3">
                {notifications.length > 0 ? (
                  notifications.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => markNotificationAsRead(item.id)}
                      className={`p-5 rounded-card border transition-all flex items-start gap-4 cursor-pointer hover:border-primary/20 ${item.read ? 'bg-white border-border/50 opacity-75' : 'bg-orange-50/20 border-primary/20 shadow-[0_4px_20px_rgba(255,90,31,0.02)]'}`}
                    >
                      <div className={`p-2.5 rounded-[12px] shrink-0 ${item.read ? 'bg-border/30 text-text-secondary' : 'bg-primary/10 text-primary'}`}>
                        {item.type === 'order' && <ShoppingCart className="h-4.5 w-4.5" />}
                        {item.type === 'wallet' && <Wallet className="h-4.5 w-4.5" />}
                        {item.type === 'system' && <Package className="h-4.5 w-4.5" />}
                      </div>
                      <div className="flex-1 text-left">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h4 className={`text-sm font-bold text-text ${!item.read && 'text-primary'}`}>{item.title}</h4>
                          <span className="text-[10px] text-text-secondary font-medium shrink-0">{item.time}</span>
                        </div>
                        <p className="text-xs text-text-secondary leading-relaxed">{item.content}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <Card className="border-border/50 text-center py-16">
                    <CardContent>
                      <Bell className="h-10 w-10 text-border/80 mx-auto mb-3" />
                      <p className="text-xs text-text-secondary">Chưa có thông báo nào gửi đến bạn.</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}

          {/* TAB 7: SUPPORT WIDGET */}
          {activeTab === 'support' && (
            <div className="max-w-2xl mx-auto flex flex-col gap-6">
              <div>
                <h2 className="text-2xl font-black text-text">Hỗ trợ & Khiếu nại đơn</h2>
                <p className="text-xs text-text-secondary mt-1">Liên hệ với bộ phận kỹ thuật để được xử lý khi gặp sự cố đối soát đơn hàng hoặc lỗi thanh toán.</p>
              </div>

              <Card className="border-border/50">
                <CardContent className="p-6 flex flex-col gap-6">
                  <div className="flex flex-col gap-1">
                    <h3 className="font-bold text-text text-sm">Gửi yêu cầu hỗ trợ nhanh</h3>
                    <p className="text-xs text-text-secondary leading-relaxed">Admin sẽ trả lời thắc mắc của bạn qua email hoặc tài khoản Telegram liên kết.</p>
                  </div>

                  <form onSubmit={(e) => { e.preventDefault(); toast.success('Yêu cầu đã được gửi! Chúng tôi sẽ phản hồi sớm nhất.'); }} className="flex flex-col gap-4">
                    <Input label="Tiêu đề yêu cầu" placeholder="Ví dụ: Lỗi không nhận hoa hồng đơn hàng Shopee..." required />

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-text/80">Nội dung chi tiết</label>
                      <textarea
                        rows={5}
                        placeholder="Nhập chi tiết vấn đề bạn đang gặp phải, bao gồm mã đơn hàng Shopee (nếu có)..."
                        className="w-full px-4 py-3 bg-white border border-border text-sm rounded-input outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all resize-none"
                        required
                      />
                    </div>

                    <Button type="submit" className="w-full py-3 font-bold mt-2">
                      Gửi Yêu Cầu Hỗ Trợ
                    </Button>
                  </form>

                  <div className="flex flex-col gap-3 pt-6 border-t border-border/40">
                    <p className="text-xs font-bold text-text">Các kênh hỗ trợ trực tiếp khác:</p>
                    <div className="grid grid-cols-2 gap-4">
                      <a href="#" className="flex items-center gap-3 p-3 border border-border rounded-input hover:bg-orange-50/50 hover:border-primary/25 transition-all">
                        <div className="bg-primary/10 text-primary p-2 rounded-[10px]">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-bold text-text leading-none mb-1">Kênh Telegram</p>
                          <p className="text-[10px] text-text-secondary">@support_hoantien</p>
                        </div>
                      </a>
                      <a href="#" className="flex items-center gap-3 p-3 border border-border rounded-input hover:bg-orange-50/50 hover:border-primary/25 transition-all">
                        <div className="bg-success/10 text-success p-2 rounded-[10px]">
                          <Landmark className="h-4 w-4" />
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-bold text-text leading-none mb-1">Fanpage hỗ trợ</p>
                          <p className="text-[10px] text-text-secondary">Hoàn Tiền Mua Sắm</p>
                        </div>
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 8: PROFILE AND SETTINGS */}
          {activeTab === 'settings' && (
            <div className="max-w-2xl mx-auto flex flex-col gap-6">
              <div>
                <h2 className="text-2xl font-black text-text">Cài đặt tài khoản cá nhân</h2>
                <p className="text-xs text-text-secondary mt-1">Cập nhật thông tin thanh toán, bảo mật mật khẩu và thiết lập kênh nhận thông báo tự động.</p>
              </div>

              {/* Personal Information */}
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-base">Thông tin cá nhân & Ngân hàng</CardTitle>
                  <CardDescription>Cung cấp chính xác thông tin ngân hàng để nhận chuyển khoản hoa hồng đối soát.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleUpdateProfile} className="flex flex-col gap-4">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xl">
                        {currentUser.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-text leading-none mb-1.5">{currentUser.name}</p>
                        <p className="text-[10px] text-text-secondary mb-2">{currentUser.email}</p>
                        <Badge variant="outline" className="text-[9px] py-0 px-2 uppercase font-bold bg-bg">Mã ID: {currentUser.id}</Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input label="Họ và tên thành viên" value={profileName} onChange={(e) => setProfileName(e.target.value)} required />
                      <Input label="Số điện thoại liên lạc" value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input label="Ngân hàng thụ hưởng" value={profileBank} onChange={(e) => setProfileBank(e.target.value)} placeholder="Vietcombank, Agribank..." required />
                      <Input label="Số tài khoản ngân hàng" value={profileNumber} onChange={(e) => setProfileNumber(e.target.value)} placeholder="Nhập số tài khoản" required />
                    </div>

                    <Input label="Tên chủ tài khoản ngân hàng (Viết hoa không dấu)" value={profileHolder} onChange={(e) => setProfileHolder(e.target.value.toUpperCase())} placeholder="NGUYEN VAN A" required />

                    <Input label="Telegram Chat ID (Nhận tin nhắn báo đơn)" value={profileTelegram} onChange={(e) => setProfileTelegram(e.target.value)} placeholder="Ví dụ: @telegram_chat_id" />

                    {/* Notifications settings */}
                    <div className="flex flex-col gap-3 py-3 border-t border-border/40 mt-2">
                      <p className="text-xs font-bold text-text">Kênh nhận thông báo tự động:</p>

                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="notifyEmail"
                          checked={emailNotify}
                          onChange={(e) => setEmailNotify(e.target.checked)}
                          className="rounded-sm border-border text-primary focus:ring-primary h-4 w-4"
                        />
                        <label htmlFor="notifyEmail" className="text-xs text-text-secondary font-semibold leading-none cursor-pointer">
                          Nhận email thông báo khi đơn hàng được ghi nhận hoặc thay đổi trạng thái
                        </label>
                      </div>

                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="notifyTele"
                          checked={telegramNotify}
                          onChange={(e) => setTelegramNotify(e.target.checked)}
                          className="rounded-sm border-border text-primary focus:ring-primary h-4 w-4"
                        />
                        <label htmlFor="notifyTele" className="text-xs text-text-secondary font-semibold leading-none cursor-pointer">
                          Nhận tin nhắn Telegram bot khi có giao dịch phát sinh
                        </label>
                      </div>
                    </div>

                    <Button type="submit" className="w-full py-3 font-bold mt-2">
                      Lưu Thay Đổi
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Change Password */}
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-base">Đổi mật khẩu tài khoản</CardTitle>
                  <CardDescription>Bảo vệ tài khoản bằng cách thay đổi mật khẩu định kỳ.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handlePasswordChange} className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input label="Mật khẩu cũ" type="password" value={passwordOld} onChange={(e) => setPasswordOld(e.target.value)} required />
                      <Input label="Mật khẩu mới" type="password" value={passwordNew} onChange={(e) => setPasswordNew(e.target.value)} required />
                    </div>
                    <Button type="submit" className="w-full py-3 font-bold mt-2">
                      Đổi Mật Khẩu
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 8: REFERRAL (TIẾP THỊ LIÊN KẾT) */}
          {activeTab === 'referral' && (
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><Link2 className="h-4.5 w-4.5 text-danger" /> Đường dẫn giới thiệu của bạn</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-2 border border-border/80 p-1.5 pl-4 rounded-md bg-bg overflow-hidden">
                      <span className="text-xs font-mono text-text truncate">{window.location.origin}/auth?mode=register&ref={currentUser.id}</span>
                      <Button onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/auth?mode=register&ref=${currentUser.id}`);
                        toast.success('Đã sao chép link giới thiệu!');
                      }}
                        variant="danger" className="shrink-0 h-8 px-4 rounded font-bold text-xs bg-red-500 hover:bg-red-600 text-white border-none flex items-center gap-1.5"
                      >
                        <Copy className="h-3.5 w-3.5" /> Sao chép
                      </Button>
                    </div>

                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-xs font-bold text-text-secondary">Chia sẻ:</span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => {
                          const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.origin + '/auth?mode=register&ref=' + currentUser.id)}`;
                          const win = window.open(shareUrl, '_blank');
                          if (!win || win.closed || typeof win.closed === 'undefined') window.location.href = shareUrl;
                        }} className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white hover:opacity-80">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
                        </button>
                        <button onClick={() => {
                          const shareUrl = `https://zalo.me/share?url=${encodeURIComponent(window.location.origin + '/auth?mode=register&ref=' + currentUser.id)}`;
                          const win = window.open(shareUrl, '_blank');
                          if (!win || win.closed || typeof win.closed === 'undefined') window.location.href = shareUrl;
                        }} className="w-8 h-8 rounded-full bg-sky-500 flex items-center justify-center text-white hover:opacity-80"><Send className="h-4 w-4" /></button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-gradient-to-br from-white to-orange-50/30">
                <CardHeader>
                  <CardDescription className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Mức hoa hồng nhận</CardDescription>
                </CardHeader>
                <CardContent className="flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-text mb-1 text-sm">Tầng 1 (F1)</h4>
                    <p className="text-4xl font-black text-danger">20%</p>
                  </div>
                  <div>
                    <img src="https://cdn-icons-png.flaticon.com/512/879/879757.png" className="w-24 opacity-90 drop-shadow-sm" alt="commission" />
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="border-border/50">
                  <CardContent className="p-4 flex flex-col gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 shrink-0"><MousePointerClick className="h-4 w-4" /></div>
                    <div>
                      <p className="text-[9px] font-bold text-text-secondary uppercase">Lượt click</p>
                      <p className="text-xl font-black mt-1 text-text">{refStats.clicks}</p>
                      <p className="text-[9px] text-text-secondary mt-1 line-clamp-1">Tổng lượt truy cập</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border/50">
                  <CardContent className="p-4 flex flex-col gap-3">
                    <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-500 shrink-0"><UserPlus className="h-4 w-4" /></div>
                    <div>
                      <p className="text-[9px] font-bold text-text-secondary uppercase">Giới thiệu F1</p>
                      <p className="text-xl font-black mt-1 text-text">{refStats.f1Count}</p>
                      <p className="text-[9px] text-text-secondary mt-1 line-clamp-1">Đăng ký trực tiếp</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border/50">
                  <CardContent className="p-4 flex flex-col gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 shrink-0"><Clock className="h-4 w-4" /></div>
                    <div>
                      <p className="text-[9px] font-bold text-text-secondary uppercase">Chờ duyệt</p>
                      <p className="text-xl font-black mt-1 text-text">{refStats.pendingCommission.toLocaleString('vi-VN')}đ</p>
                      <p className="text-[9px] text-text-secondary mt-1 line-clamp-1">Đơn gốc đang duyệt</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border/50">
                  <CardContent className="p-4 flex flex-col gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 shrink-0"><Wallet className="h-4 w-4" /></div>
                    <div>
                      <p className="text-[9px] font-bold text-text-secondary uppercase">Đã nhận</p>
                      <p className="text-xl font-black mt-1 text-text">{refStats.approvedCommission.toLocaleString('vi-VN')}đ</p>
                      <p className="text-[9px] text-text-secondary mt-1 line-clamp-1">Đã cộng vào tài khoản</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Referral History Tabs */}
              <Card className="border-border/50 mt-2">
                <CardContent className="p-0">
                  <div className="flex border-b border-border/50 overflow-x-auto scrollbar-hide">
                    <button className="px-6 py-4 text-sm font-bold text-danger border-b-2 border-danger whitespace-nowrap">
                      Lịch sử hoa hồng
                    </button>
                    <button className="px-6 py-4 text-sm font-bold text-text-secondary hover:text-text whitespace-nowrap transition-colors">
                      Đơn hàng thành viên (0)
                    </button>
                    <button className="px-6 py-4 text-sm font-bold text-text-secondary hover:text-text whitespace-nowrap transition-colors">
                      Mạng lưới thành viên (0)
                    </button>
                  </div>

                  <div className="p-6">
                    <div className="flex flex-wrap items-center gap-6 mb-6">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">CẤP:</span>
                        <select className="px-3 py-1.5 border border-border/80 rounded-[8px] text-xs font-semibold outline-none focus:border-primary bg-bg/50">
                          <option value="all">Tất cả</option>
                          <option value="f1">F1</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">TRẠNG THÁI:</span>
                        <select className="px-3 py-1.5 border border-border/80 rounded-[8px] text-xs font-semibold outline-none focus:border-primary bg-bg/50">
                          <option value="all">Tất cả</option>
                          <option value="pending">Chờ duyệt</option>
                          <option value="approved">Đã nhận</option>
                        </select>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse min-w-[800px]">
                        <thead>
                          <tr className="border-b border-border/60 text-text-secondary text-[10px] uppercase tracking-wider font-bold">
                            <th className="py-4 px-2">THÀNH VIÊN F1</th>
                            <th className="py-4 px-2 text-center">CẤP HOA HỒNG</th>
                            <th className="py-4 px-2 text-right">HOA HỒNG GỐC</th>
                            <th className="py-4 px-2 text-right">TIỀN THƯỞNG NHẬN</th>
                            <th className="py-4 px-2 text-center">TRẠNG THÁI</th>
                            <th className="py-4 px-2 text-right">THỜI GIAN</th>
                          </tr>
                        </thead>
                        <tbody>
                          {refLoading ? (
                            <tr>
                              <td colSpan={6} className="text-center py-10">Đang tải dữ liệu...</td>
                            </tr>
                          ) : refHistory.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="text-center py-20 text-text-secondary/60">
                                <div className="flex flex-col items-center gap-3">
                                  <div className="w-16 h-16 bg-bg rounded-full flex items-center justify-center mb-2">
                                    <Users className="h-8 w-8 opacity-40 text-text-secondary" />
                                  </div>
                                  <p className="font-semibold text-sm">Bạn chưa nhận được khoản hoa hồng giới thiệu nào. Hãy chia sẻ link giới thiệu!</p>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            refHistory.map(item => (
                              <tr key={item.id} className="border-b border-border/30 hover:bg-bg/30">
                                <td className="py-3 px-2 font-medium">{item.f1Name}</td>
                                <td className="py-3 px-2 text-center">
                                  <span className="px-2 py-1 rounded bg-blue-50 text-blue-600 font-bold text-[10px]">F1</span>
                                </td>
                                <td className="py-3 px-2 text-right">{item.baseCashback.toLocaleString('vi-VN')}đ</td>
                                <td className="py-3 px-2 text-right font-bold text-primary">+{item.bonus.toLocaleString('vi-VN')}đ</td>
                                <td className="py-3 px-2 text-center">
                                  {item.status === 'approved' ? (
                                    <span className="text-emerald-500 font-bold text-xs bg-emerald-50 px-2 py-1 rounded">Đã nhận</span>
                                  ) : (
                                    <span className="text-amber-500 font-bold text-xs bg-amber-50 px-2 py-1 rounded">Chờ duyệt</span>
                                  )}
                                </td>
                                <td className="py-3 px-2 text-right text-text-secondary">{new Date(item.createdAt).toLocaleDateString('vi-VN')}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}


        </main>
      </div>

      {/* POPUP DETAIL VIEW FOR SELECTED ORDER */}
      <Dialog isOpen={selectedOrder !== null} onClose={() => setSelectedOrder(null)}>
        {selectedOrder && (
          <>
            <DialogHeader>
              <div className="flex justify-between items-center pr-6">
                <div>
                  <DialogTitle>Chi tiết đơn hàng {selectedOrder.id}</DialogTitle>
                  <p className="text-[10px] text-text-secondary font-medium">Khởi tạo lúc: {selectedOrder.createdTime}</p>
                </div>
                {getStatusBadge(selectedOrder.status)}
              </div>
            </DialogHeader>

            <DialogContent className="flex flex-col gap-6">

              {/* Product Metadata info */}
              <div className="bg-bg border border-border/60 p-4 rounded-input text-left">
                <div>
                  <h4 className="text-xs font-bold text-text leading-snug line-clamp-2 mb-1.5">{selectedOrder.productName}</h4>
                  <p className="text-[10px] text-text-secondary">Ngành hàng liên kết: Điện Tử / Gia dụng</p>
                  <p className="text-xs font-bold text-text mt-1">Đơn giá: {Math.round(selectedOrder.orderAmount).toLocaleString('vi-VN')}đ</p>
                </div>
              </div>

              {/* TIMELINE PROGRESS STATUS */}
              <div className="flex flex-col gap-3">
                <p className="text-xs font-bold text-text uppercase tracking-wider">Tiến độ đối soát từ sàn Shopee</p>

                {selectedOrder.status === 'rejected' || selectedOrder.status === 'returned' ? (
                  <div className="bg-red-50 border border-red-200 text-danger p-4 rounded-input text-xs text-left flex items-start gap-2.5">
                    <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">{selectedOrder.status === 'returned' ? 'Đơn hàng đã hoàn hàng' : 'Đơn hàng đã hủy'}</p>
                      <p className="text-[11px] text-danger/80 mt-1">Lý do: {selectedOrder.notes || (selectedOrder.status === 'returned' ? 'Hệ thống Shopee ghi nhận đơn hàng bị hoàn hàng/trả hàng.' : 'Hệ thống Shopee ghi nhận đơn hàng bị huỷ.')}</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2 relative py-4">
                    {[
                      { step: 0, label: "Đã tạo" },
                      { step: 1, label: "Đang chờ xử lý" },
                      { step: 2, label: "Hoàn thành" },
                      { step: 3, label: "Đã thanh toán" }
                    ].map((stepObj) => {
                      const currentIndex = getTimelineStepIndex(selectedOrder.status);
                      const isCompleted = stepObj.step <= currentIndex;
                      const isCurrent = stepObj.step === currentIndex;

                      return (
                        <div key={stepObj.step} className="flex flex-col items-center text-center relative z-10">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-sm border transition-all ${isCompleted
                              ? 'bg-success border-success text-white'
                              : 'bg-white border-border text-text-secondary'
                            }`}>
                            {isCompleted ? <Check className="h-4.5 w-4.5" /> : stepObj.step + 1}
                          </div>
                          <span className={`text-[10px] font-bold mt-2 ${isCurrent ? 'text-primary' : isCompleted ? 'text-text' : 'text-text-secondary'}`}>{stepObj.label}</span>
                        </div>
                      );
                    })}

                    {/* Background Progress bar in timeline */}
                    <div className="absolute top-[28px] left-[12%] right-[12%] h-0.5 bg-border -z-1">
                      <div
                        className="h-full bg-success transition-all duration-300"
                        style={{ width: `${(getTimelineStepIndex(selectedOrder.status) / 3) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* CASHBACK METRICS */}
              <div className="grid grid-cols-2 gap-4 bg-white border border-border p-4 rounded-input text-left">
                <div>
                  <p className="text-[10px] font-semibold text-text-secondary">Mức hoa hồng dự kiến (7%)</p>
                  <p className="text-sm font-bold text-text mt-0.5">{Math.round(selectedOrder.estimatedCashback).toLocaleString('vi-VN')}đ</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-success">Số tiền thực nhận</p>
                  <p className="text-sm font-black text-success mt-0.5">
                    {selectedOrder.realCashback ? `${Math.round(selectedOrder.realCashback).toLocaleString('vi-VN')}đ` : 'Đang xử lý...'}
                  </p>
                </div>
              </div>

              {/* UPLOAD SCREENSHOT OPTION */}
              <div className="flex flex-col gap-3 border-t border-border/40 pt-4">
                <p className="text-xs font-bold text-text uppercase tracking-wider">Xác minh đơn hàng thủ công</p>
                <p className="text-[10px] text-text-secondary leading-relaxed">
                  Tải lên ảnh chụp màn hình lịch sử đặt hàng Shopee có hiện mã vận đơn và tên sản phẩm để Admin đối soát nhanh chóng hơn trong trường hợp đơn hàng bị trễ ghi nhận.
                </p>

                {selectedOrder.screenshot ? (
                  <div className="flex items-center gap-4 bg-border/20 p-3 rounded-input border border-border">
                    <img src={selectedOrder.screenshot} className="w-14 h-14 object-cover rounded-sm border border-border" />
                    <div className="text-left">
                      <p className="text-xs font-bold text-success flex items-center gap-1.5">
                        <Check className="h-4 w-4" /> Đã tải ảnh lên
                      </p>
                      <p className="text-[10px] text-text-secondary mt-0.5">Chúng tôi đã nhận và đang xử lý đối chứng đơn này.</p>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full flex items-center justify-center gap-2 border-dashed border-primary/40 hover:bg-primary/5 hover:border-primary/60 text-primary py-4 font-bold"
                    onClick={() => handleUploadScreenshotSimulation(selectedOrder.id)}
                    disabled={uploadingOrderId === selectedOrder.id}
                  >
                    {uploadingOrderId === selectedOrder.id ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Đang xử lý tệp tin...
                      </span>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Tải ảnh chụp đơn hàng (PNG, JPG)
                      </>
                    )}
                  </Button>
                )}
              </div>

              <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border/40">
                <Button variant="ghost" onClick={() => setSelectedOrder(null)} className="font-bold">Đóng lại</Button>
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(`https://shope.ee/mock-affiliate-${selectedOrder.id}`);
                    toast.success('Đã sao chép link mua hàng hoàn tiền!');
                  }}
                  className="font-bold"
                >
                  Mua lại sản phẩm này
                </Button>
              </div>
            </DialogContent>
          </>
        )}
      </Dialog>
    </div>
  );
}
