import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, Users, ShoppingBag, Wallet,
  LogOut, RefreshCw, Plus, Search,
  Filter, Check, X, Lock, Unlock, Trash2, Edit2, Download,
  Upload, BarChart3, FileSpreadsheet,
  Settings2, Activity
} from 'lucide-react';
import {
  Button, Card, CardContent, CardHeader, CardTitle, CardDescription,
  Badge, TableContainer, TableHeader, TableBody, TableRow,
  TableHead, TableCell, Input, Dialog, DialogHeader, DialogTitle, DialogContent
} from '../../components/ui/core';
import { useAppStore } from '../../store/appStore';
import type { Order, UserProfile } from '../../store/appStore';
import { toast } from 'sonner';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  BarChart, Bar, Legend, Cell
} from 'recharts';

const getPageNumbers = (currentPage: number, totalPages: number) => {
  const delta = 2;
  const range = [];
  const rangeWithDots = [];
  let l;

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
      range.push(i);
    }
  }

  for (let i of range) {
    if (l) {
      if (i - l === 2) {
        rangeWithDots.push(l + 1);
      } else if (i - l > 2) {
        rangeWithDots.push('...');
      }
    }
    rangeWithDots.push(i);
    l = i;
  }

  return rangeWithDots;
};

export default function AdminPanel() {
  const navigate = useNavigate();
  const {
    currentUser, logout, orders, totalAdminOrders, withdrawals, users, settings,
    updateOrderStatus, updateWithdrawalStatus, updateSettings,
    reconciliationHistory, uploadReconciliationCSV, applyReconciliationCSV,
    updateAdminUser, adminStats, fetchAdminOrders, fetchAdminStats,
    createAdminUser, deleteAdminUser, resetUserPassword, toggleUserStatus
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'orders' | 'withdrawals' | 'reconciliation' | 'settings'>('dashboard');

  // Search & Filter States
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');

  // Order Pagination states
  const [orderPage, setOrderPage] = useState(1);
  const ordersPerPage = 10;
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setOrderPage(1);
  }, [orderSearch, orderStatusFilter]);

  // Fetch paginated and filtered orders from backend
  React.useEffect(() => {
    if (activeTab === 'orders' && currentUser?.role === 'admin') {
      const delay = setTimeout(() => {
        fetchAdminOrders(orderPage, ordersPerPage, orderSearch, orderStatusFilter);
      }, 300); // Debounce search
      return () => clearTimeout(delay);
    }
  }, [activeTab, orderPage, orderSearch, orderStatusFilter, currentUser]);

  // Selected items for Modals
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<Order | null>(null);

  // Order Edit states
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editOrderStatus, setEditOrderStatus] = useState<Order['status']>('pending');
  const [editOrderRealCashback, setEditOrderRealCashback] = useState<string>('');
  const [editOrderNotes, setEditOrderNotes] = useState<string>('');

  // Reconciliation states for Orders Tab
  const [reconcileModalData, setReconcileModalData] = useState<any>(null);
  const [isImportReconcileModalOpen, setIsImportReconcileModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // User CRUD states
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserRole, setEditUserRole] = useState<'user' | 'admin'>('user');
  const [editUserBank, setEditUserBank] = useState('');
  const [editUserAccount, setEditUserAccount] = useState('');
  const [editUserHolder, setEditUserHolder] = useState('');
  const [editUserPhone, setEditUserPhone] = useState('');
  const [editUserPassword, setEditUserPassword] = useState('');
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [userToReset, setUserToReset] = useState<UserProfile | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('123456');

  // Reconciliation states
  const [_isReconciling, setIsReconciling] = useState(false);
  const [reconcileData, setReconcileData] = useState<any[] | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [tempFileName, setTempFileName] = useState('');
  const [_selectedFile, setSelectedFile] = useState<File | null>(null);

  // Settings local state
  const [sysWebsiteName, setSysWebsiteName] = useState(settings.websiteName || "Hoàn Tiền Mua Sắm");
  const [sysSupportPhone, setSysSupportPhone] = useState(settings.supportPhone || "0988.888.888");
  const [sysSupportZalo, setSysSupportZalo] = useState(settings.supportZalo || "https://zalo.me/g/hoantienmuasam");
  const [sysSupportFacebook, setSysSupportFacebook] = useState(settings.supportFacebook || "https://facebook.com/hoantienmuasam");
  const [sysShopeeAffiliateId, setSysShopeeAffiliateId] = useState(settings.shopeeAffiliateId || "173401900099");
  const [sysTeleNotify, setSysTeleNotify] = useState(settings.telegramNotification);
  const [sysEmailNotify, setSysEmailNotify] = useState(settings.emailNotification);
  const [sysMaintMode, setSysMaintMode] = useState(settings.maintenanceMode);

  // Sync settings local states when they load from backend
  React.useEffect(() => {
    if (settings) {
      setSysWebsiteName(settings.websiteName || "Hoàn Tiền Mua Sắm");
      setSysSupportPhone(settings.supportPhone || "0988.888.888");
      setSysSupportZalo(settings.supportZalo || "https://zalo.me/g/hoantienmuasam");
      setSysSupportFacebook(settings.supportFacebook || "https://facebook.com/hoantienmuasam");
      setSysShopeeAffiliateId(settings.shopeeAffiliateId || "173401900099");
      setSysTeleNotify(settings.telegramNotification);
      setSysEmailNotify(settings.emailNotification);
      setSysMaintMode(settings.maintenanceMode);
    }
  }, [settings]);

  // Redirect if not admin
  React.useEffect(() => {
    if (!currentUser) {
      navigate('/auth/login');
    } else if (currentUser.role !== 'admin') {
      toast.error('Bạn không có quyền truy cập khu vực Quản trị');
      navigate('/');
    }
  }, [currentUser, navigate]);

  if (!currentUser || currentUser.role !== 'admin') return null;

  // Statistics calculation
  const totalUsersCount = adminStats?.summary?.totalUsers ?? users.length;
  const totalOrdersCount = adminStats?.summary?.totalOrders ?? 0;
  const pendingOrdersCount = adminStats?.statusDistribution?.find(s => s.name === 'Đang chờ xử lý')?.value || 0;
  const approvedOrdersCount = adminStats?.statusDistribution?.find(s => s.name === 'Hoàn thành')?.value || 0;
  const rejectedOrdersCount = adminStats?.statusDistribution?.find(s => s.name === 'Hủy' || s.name === 'Hoàn hàng')?.value || 0;
  const cashbackPaidCount = adminStats?.statusDistribution?.find(s => s.name === 'Đã thanh toán')?.value || 0;

  const totalCashbackPaid = adminStats?.summary?.totalPaidWithdrawals ?? withdrawals
    .filter(w => w.status === 'approved')
    .reduce((sum, w) => sum + w.amount, 0);

  const totalEstimatedRevenue = adminStats?.summary?.netProfit ?? orders
    .filter(o => o.status === 'approved' || o.status === 'paid')
    .reduce((sum, o) => {
      const totalComm = o.orderAmount * (settings.commissionPercentage / 100);
      const userCash = (o.realCashback || o.estimatedCashback) * 0.5;
      return sum + Math.max(0, totalComm - userCash);
    }, 0);


  // Filtered lists
  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase()) || u.id.toLowerCase().includes(userSearch.toLowerCase());
    const matchesRole = userRoleFilter === 'all' ? true : u.role === userRoleFilter;
    return matchesSearch && matchesRole;
  });

  // Orders are already paginated and filtered from the backend
  const totalPages = Math.ceil(totalAdminOrders / ordersPerPage) || 1;
  const paginatedOrders = orders;

  // Action handlers
  const handleApproveOrder = (orderId: string, realCash?: number) => {
    updateOrderStatus(orderId, 'approved', realCash);
    toast.success(`Đã duyệt đơn hàng ${orderId}`);
    setSelectedOrderDetail(null);
  };

  const handleRejectOrder = (orderId: string, _notes?: string) => {
    updateOrderStatus(orderId, 'rejected');
    toast.error(`Đã từ chối đơn hàng ${orderId}`);
    setSelectedOrderDetail(null);
  };

  /*
  const handlePayOrder = (orderId: string) => {
    updateOrderStatus(orderId, 'paid');
    toast.success(`Đã đánh dấu đã thanh toán đơn hàng ${orderId}`);
    setSelectedOrderDetail(null);
  };
  */

  const handleSaveOrderDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;

    const cashbackVal = parseFloat(editOrderRealCashback);
    if (isNaN(cashbackVal) || cashbackVal < 0) {
      toast.error('Số tiền hoàn thực tế không hợp lệ');
      return;
    }

    try {
      await updateOrderStatus(editingOrder.id, editOrderStatus, cashbackVal, editOrderNotes);
      toast.success(`Đã cập nhật đơn hàng ${editingOrder.id} thành công!`);
      setEditingOrder(null);
    } catch (err: any) {
      toast.error('Lỗi khi cập nhật đơn hàng');
    }
  };

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setIsImporting(true);
    try {
      const data = await uploadReconciliationCSV(file);
      setReconcileModalData(data);
      setIsImportReconcileModalOpen(true);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi phân tích file CSV đối soát');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleApplyImportReconciliation = async () => {
    if (!reconcileModalData || !reconcileModalData.tempFileName) return;

    try {
      const res = await applyReconciliationCSV(reconcileModalData.tempFileName);
      toast.success(res.message || `Đã đối soát tự động phê duyệt và cộng tiền thành công!`);
      setIsImportReconcileModalOpen(false);
      setReconcileModalData(null);
      await fetchAdminOrders();
      await fetchAdminStats();
      setOrderPage(1);
      setOrderStatusFilter('all');
      setActiveTab('orders');
    } catch (err: any) {
      toast.error(err.message || 'Thất bại khi áp dụng đối soát');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSettings({
      websiteName: sysWebsiteName,
      supportPhone: sysSupportPhone,
      supportZalo: sysSupportZalo,
      supportFacebook: sysSupportFacebook,
      shopeeAffiliateId: sysShopeeAffiliateId,
      telegramNotification: sysTeleNotify,
      emailNotification: sysEmailNotify,
      maintenanceMode: sysMaintMode
    });
    toast.success('Đã lưu cấu hình hệ thống thành công!');
  };

  // Real Reconciliation handlers using backend API
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setUploadedFileName(file.name);
    setSelectedFile(file);

    setIsReconciling(true);
    setReconcileData(null);

    try {
      const data = await uploadReconciliationCSV(file);
      setReconcileData(data.details || []);
      setTempFileName(data.tempFileName);
      toast.info('Quét đối soát hoàn thành. Vui lòng xem bảng thống kê kết quả bên dưới.');
    } catch (err: any) {
      toast.error(err.message || 'Lỗi phân tích file CSV đối soát');
      setUploadedFileName('');
    } finally {
      setIsReconciling(false);
    }
  };

  const handleApplyReconciliation = async () => {
    if (!tempFileName) return;

    try {
      const res = await applyReconciliationCSV(tempFileName);
      toast.success(res.message || `Đã tự động phê duyệt và cộng tiền thành công!`);
      setReconcileData(null);
      setUploadedFileName('');
      setTempFileName('');
      await fetchAdminOrders();
      await fetchAdminStats();
      setOrderPage(1);
      setOrderStatusFilter('all');
      setActiveTab('orders');
    } catch (err: any) {
      toast.error(err.message || 'Thất bại khi áp dụng đối soát');
    }
  };

  const openUserEditModal = (user: UserProfile | null) => {
    setSelectedUser(user);
    if (user) {
      setEditUserName(user.name);
      setEditUserEmail(user.email);
      setEditUserRole(user.role);
      setEditUserBank(user.bankName || '');
      setEditUserAccount(user.accountNumber || '');
      setEditUserHolder(user.accountHolder || '');
      setEditUserPhone(user.phone || '');
      setEditUserPassword('');
    } else {
      setEditUserName('');
      setEditUserEmail('');
      setEditUserRole('user');
      setEditUserBank('');
      setEditUserAccount('');
      setEditUserHolder('');
      setEditUserPhone('');
      setEditUserPassword('');
    }
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUserName || !editUserEmail) {
      toast.error('Vui lòng điền đủ tên và email');
      return;
    }

    if (selectedUser) {
      // Edit existing user
      const success = await updateAdminUser(selectedUser.id, {
        name: editUserName,
        email: editUserEmail,
        role: editUserRole,
        bankName: editUserBank,
        accountNumber: editUserAccount,
        accountHolder: editUserHolder,
        phone: editUserPhone
      });
      if (success) {
        toast.success('Cập nhật thông tin thành viên thành công!');
      } else {
        toast.error('Cập nhật thông tin thành viên thất bại');
      }
    } else {
      // Create new user
      if (!editUserPassword) {
        toast.error('Vui lòng nhập mật khẩu cho tài khoản mới');
        return;
      }
      const success = await createAdminUser({
        name: editUserName,
        email: editUserEmail,
        password: editUserPassword,
        role: editUserRole,
        phone: editUserPhone
      });
      if (success) {
        toast.success(`Tạo tài khoản ${editUserEmail} thành công!`);
      } else {
        toast.error('Email đã được sử dụng hoặc lỗi tạo tài khoản');
        return;
      }
    }
    setIsUserModalOpen(false);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    const success = await deleteAdminUser(userToDelete.id);
    if (success) {
      toast.success(`Đã xóa tài khoản ${userToDelete.name}`);
    } else {
      toast.error('Xóa tài khoản thất bại');
    }
    setIsDeleteConfirmOpen(false);
    setUserToDelete(null);
  };

  const handleResetPassword = async () => {
    if (!userToReset) return;
    const success = await resetUserPassword(userToReset.id, resetPasswordValue);
    if (success) {
      toast.success(`Đặt lại mật khẩu ${userToReset.name} thành: ${resetPasswordValue}`);
    } else {
      toast.error('Đặt lại mật khẩu thất bại');
    }
    setIsResetPasswordOpen(false);
    setUserToReset(null);
    setResetPasswordValue('123456');
  };

  const handleToggleStatus = async (u: UserProfile) => {
    const newStatus = await toggleUserStatus(u.id);
    if (newStatus) {
      toast.success(newStatus === 'locked' ? `Đã khóa tài khoản ${u.name}` : `Đã mở khóa tài khoản ${u.name}`);
    } else {
      toast.error('Cập nhật trạng thái thất bại');
    }
  };

  // Chart Monthly Analytics computed dynamically from real database/orders
  const revenueChartData = useMemo(() => {
    if (adminStats && adminStats.monthlyAnalytics && adminStats.monthlyAnalytics.length > 0) {
      return adminStats.monthlyAnalytics.map(a => ({
        month: a.name,
        DoanhThu: a.revenue,
        HoaHongChi: a.cashback,
        LoiNhuan: a.profit
      }));
    }

    const monthlyMap: Record<string, { month: string; DoanhThu: number; HoaHongChi: number; LoiNhuan: number }> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap[key] = {
        month: `T${d.getMonth() + 1}`,
        DoanhThu: 0,
        HoaHongChi: 0,
        LoiNhuan: 0
      };
    }

    orders.forEach(o => {
      const cb = o.realCashback !== undefined && o.realCashback !== null ? o.realCashback : (o.estimatedCashback || 0);
      const comm = (o as any).shopeeCommission || (cb * 2);
      const dateStr = o.createdTime || '';
      if (dateStr.length >= 7) {
        const key = dateStr.substring(0, 7);
        if (monthlyMap[key]) {
          monthlyMap[key].DoanhThu += comm;
          monthlyMap[key].HoaHongChi += cb;
          monthlyMap[key].LoiNhuan += (comm - cb);
        }
      }
    });

    return Object.values(monthlyMap);
  }, [adminStats, orders]);
  return (
    <div className="min-h-screen bg-bg flex flex-col font-poppins">

      {/* HEADER NAVBAR */}
      <header className="sticky top-0 z-30 glass-panel shadow-sm w-full py-4 px-6 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-3">
          <div className="gradient-bg p-2 rounded-[12px] text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <span className="font-bold text-text hidden sm:inline">Quản Trị Hệ Thống</span>
          <Badge className="bg-red-500 text-white border-none py-0.5 px-2.5 text-[10px]">Admin Panel</Badge>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <div className="text-left hidden md:block">
              <p className="text-xs font-bold text-text leading-none">{currentUser.name}</p>
              <span className="text-[10px] text-text-secondary font-medium block mt-0.5">Quyền hạn: Admin</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-border items-center ml-2"
              onClick={() => { logout(); toast.info('Đã đăng xuất'); navigate('/'); }}
            >
              <LogOut className="h-3.5 w-3.5" />
              Thoát
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col md:flex-row relative">

        {/* SIDEBAR NAVIGATION */}
        <aside className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-border p-4 flex flex-col gap-1 md:h-[calc(100vh-73px)] sticky top-[73px] z-20 overflow-y-auto">
          {[
            { id: 'dashboard', icon: <BarChart3 className="h-4.5 w-4.5" />, label: 'Báo cáo thống kê' },
            { id: 'users', icon: <Users className="h-4.5 w-4.5" />, label: 'Quản lý tài khoản' },
            { id: 'orders', icon: <ShoppingBag className="h-4.5 w-4.5" />, label: 'Quản lý đơn hàng' },
            { id: 'withdrawals', icon: <Wallet className="h-4.5 w-4.5" />, label: 'Quản lý rút tiền' },
            { id: 'reconciliation', icon: <FileSpreadsheet className="h-4.5 w-4.5" />, label: 'Đối soát file dữ liệu' },
            { id: 'settings', icon: <Settings2 className="h-4.5 w-4.5" />, label: 'Cài đặt hệ thống' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-3.5 px-4 py-3 text-sm font-semibold rounded-[12px] transition-all text-left ${activeTab === tab.id ? 'bg-primary/5 text-primary' : 'text-text-secondary hover:text-text hover:bg-border/20'}`}
            >
              {tab.icon}
              <span className="flex-1">{tab.label}</span>
              {tab.id === 'withdrawals' && withdrawals.filter(w => w.status === 'pending').length > 0 && (
                <Badge variant="danger" className="py-0 px-2 text-[10px]">{withdrawals.filter(w => w.status === 'pending').length}</Badge>
              )}
              {tab.id === 'orders' && pendingOrdersCount > 0 && (
                <Badge variant="info" className="py-0 px-2 text-[10px]">{pendingOrdersCount}</Badge>
              )}
            </button>
          ))}

          <div className="mt-auto pt-6 border-t border-border/40 hidden md:block">
            <button
              onClick={() => navigate('/')}
              className="flex w-full items-center gap-3 px-4 py-3 text-xs font-bold text-text-secondary rounded-[12px] hover:bg-border/20 transition-all text-left"
            >
              <ShoppingBag className="h-4 w-4" />
              Xem Trang Landing
            </button>
          </div>
        </aside>

        {/* DASHBOARD CONTENT BODY */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl">

          {/* TAB 1: DASHBOARD STATS */}
          {activeTab === 'dashboard' && (
            <div className="flex flex-col gap-8">

              {/* TOP WIDGETS CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { title: "Tổng số thành viên", value: totalUsersCount, desc: "Đã đăng ký tài khoản", color: "text-text", icon: <Users className="h-5 w-5 text-text-secondary" /> },
                  { title: "Tổng số đơn hàng", value: totalOrdersCount, desc: "Đã phát sinh trên hệ thống", color: "text-text", icon: <ShoppingBag className="h-5 w-5 text-text-secondary" /> },
                  { title: "Tổng hoa hồng đã chi", value: `${totalCashbackPaid.toLocaleString('vi-VN')}đ`, desc: "Người dùng đã nhận thực tế", color: "text-success", icon: <Wallet className="h-5 w-5 text-success" /> },
                  { title: "Doanh thu ước tính", value: `${Math.round(totalEstimatedRevenue).toLocaleString('vi-VN')}đ`, desc: "Sau khi khấu trừ hoàn tiền", color: "text-primary", icon: <Activity className="h-5 w-5 text-primary" /> }
                ].map((card, idx) => (
                  <Card key={idx} className="border-border/50 relative overflow-hidden">
                    <CardHeader className="p-5 pb-2 flex flex-row items-center justify-between">
                      <CardDescription className="font-bold text-text-secondary uppercase tracking-wider text-[10px]">{card.title}</CardDescription>
                      {card.icon}
                    </CardHeader>
                    <CardContent className="p-5 pt-0">
                      <p className="text-2xl font-black text-text mb-1">{card.value}</p>
                      <p className="text-[10px] text-text-secondary font-medium">{card.desc}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* GRAPHS AND CHARTS */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 border-border/50">
                  <CardHeader>
                    <CardTitle className="text-base">Báo cáo doanh thu & Lợi nhuận</CardTitle>
                    <CardDescription>Biến động tài chính của hệ thống trong 6 tháng qua (VND)</CardDescription>
                  </CardHeader>
                  <CardContent className="h-72 pl-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={revenueChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorDoanhThu" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorLoiNhuan" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22C55E" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="month" stroke="#6B7280" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis stroke="#6B7280" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val} />
                        <Tooltip formatter={(val) => [`${Number(val).toLocaleString('vi-VN')}đ`]} contentStyle={{ borderRadius: 12, border: '1px solid #ECECEC' }} />
                        <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 11, fontWeight: 'bold' }} />
                        <Area type="monotone" dataKey="DoanhThu" stroke="#3B82F6" fillOpacity={1} fill="url(#colorDoanhThu)" strokeWidth={2.5} />
                        <Area type="monotone" dataKey="LoiNhuan" stroke="#22C55E" fillOpacity={1} fill="url(#colorLoiNhuan)" strokeWidth={2.5} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="border-border/50 flex flex-col justify-between">
                  <CardHeader>
                    <CardTitle className="text-base">Số liệu tình trạng đơn</CardTitle>
                    <CardDescription>Thống kê số lượng đơn hàng theo từng trạng thái</CardDescription>
                  </CardHeader>
                  <CardContent className="h-60 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[
                        { name: 'Chờ đối soát', value: pendingOrdersCount, fill: '#3B82F6' },
                        { name: 'Đã duyệt', value: approvedOrdersCount, fill: '#22C55E' },
                        { name: 'Đã thanh toán', value: cashbackPaidCount, fill: '#F59E0B' },
                        { name: 'Bị huỷ / Từ chối', value: rejectedOrdersCount, fill: '#EF4444' }
                      ]} barSize={35}>
                        <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis tickLine={false} axisLine={false} fontSize={10} />
                        <Tooltip formatter={(v) => [`${v} đơn`]} />
                        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                          {[
                            { fill: '#3B82F6' },
                            { fill: '#22C55E' },
                            { fill: '#F59E0B' },
                            { fill: '#EF4444' }
                          ].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

            </div>
          )}

          {/* TAB 2: USER MANAGEMENT */}
          {activeTab === 'users' && (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4">
                <div>
                  <h2 className="text-2xl font-black text-text">Quản lý tài khoản thành viên</h2>
                  <p className="text-xs text-text-secondary mt-1">
                    Xem thông tin, thực hiện thêm/sửa, khoá/mở tài khoản và đổi mật khẩu thành viên.
                  </p>
                </div>
                <Button onClick={() => openUserEditModal(null)} className="flex items-center gap-1.5 font-bold">
                  <Plus className="h-4 w-4" /> Thêm thành viên
                </Button>
              </div>

              {/* SEARCH BAR & FILTERS */}
              <div className="bg-white border border-border p-4 rounded-input flex flex-col sm:flex-row gap-4 items-center shadow-[0_2px_10px_rgba(0,0,0,0.01)]">
                <div className="flex-1 w-full flex items-center px-3 border border-border rounded-input bg-bg gap-2">
                  <Search className="h-4.5 w-4.5 text-text-secondary shrink-0" />
                  <input
                    type="text"
                    placeholder="Tìm theo Tên, Email hoặc ID..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full bg-transparent border-none py-2.5 outline-none focus:outline-none focus:ring-0 text-xs"
                  />
                </div>
                <div className="w-full sm:w-48 flex items-center gap-2">
                  <Filter className="h-4 w-4 text-text-secondary shrink-0" />
                  <select
                    value={userRoleFilter}
                    onChange={(e) => setUserRoleFilter(e.target.value)}
                    className="w-full bg-white border border-border text-xs rounded-input py-2.5 px-3"
                  >
                    <option value="all">Tất cả vai trò</option>
                    <option value="user">Người dùng</option>
                    <option value="admin">Quản trị viên</option>
                  </select>
                </div>
              </div>

              <Card className="border-border/50">
                <CardContent className="p-0">
                  <TableContainer>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mã ID</TableHead>
                        <TableHead>Thành Viên</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Điện Thoại</TableHead>
                        <TableHead>Vai Trò</TableHead>
                        <TableHead>Số Dư</TableHead>
                        <TableHead>Mã Giới Thiệu</TableHead>
                        <TableHead>Ngân Hàng</TableHead>
                        <TableHead>Trạng Thái</TableHead>
                        <TableHead className="text-center">Thao Tác</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-bold text-text-secondary">{u.id}</TableCell>
                          <TableCell className="font-semibold">
                            {u.name}
                          </TableCell>
                          <TableCell className="font-medium text-xs">{u.email}</TableCell>
                          <TableCell className="text-xs text-text-secondary font-medium">{u.phone || '-'}</TableCell>
                          <TableCell>
                            <Badge variant={u.role === 'admin' ? 'danger' : 'outline'} className="text-[9px] font-bold">
                              {u.role === 'admin' ? 'ADMIN' : 'MEMBER'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-bold text-primary">
                            {(u.balance || 0).toLocaleString('vi-VN')}đ
                          </TableCell>
                          <TableCell className="text-xs font-mono font-semibold text-text-secondary">{u.referredBy || '-'}</TableCell>
                          <TableCell className="text-xs font-semibold">{u.bankName ? `${u.bankName} - ${u.accountNumber}` : '-'}</TableCell>
                          <TableCell>
                            {u.status === 'locked' ? (
                              <Badge variant="danger">Đã khóa</Badge>
                            ) : (
                              <Badge variant="success">Hoạt động</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => openUserEditModal(u)}
                                className="p-1.5 rounded-full hover:bg-border/30 text-text-secondary hover:text-text transition-colors"
                                title="Sửa tài khoản"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setUserToReset(u);
                                  setResetPasswordValue('123456');
                                  setIsResetPasswordOpen(true);
                                }}
                                className="p-1.5 rounded-full hover:bg-border/30 text-text-secondary hover:text-primary transition-colors"
                                title="Reset mật khẩu"
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleToggleStatus(u)}
                                className={`p-1.5 rounded-full hover:bg-border/30 transition-colors ${u.status === 'locked' ? 'text-success hover:text-success' : 'text-text-secondary hover:text-danger'}`}
                                title={u.status === 'locked' ? "Mở khóa tài khoản" : "Khóa tài khoản"}
                              >
                                {u.status === 'locked' ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                              </button>
                              <button
                                onClick={() => {
                                  setUserToDelete(u);
                                  setIsDeleteConfirmOpen(true);
                                }}
                                className="p-1.5 rounded-full hover:bg-border/30 text-text-secondary hover:text-danger transition-colors"
                                title="Xóa tài khoản"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </TableContainer>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 3: ORDER MANAGEMENT */}
          {activeTab === 'orders' && (
            <div className="flex flex-col gap-6">
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-2xl font-black text-text">Quản lý đối soát đơn hàng</h2>
                  <p className="text-xs text-text-secondary mt-1">Phê duyệt, từ chối đối soát đơn hàng thủ công hoặc cập nhật doanh thu thực nhận bằng file CSV.</p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Hidden Input for CSV Upload */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".csv"
                    onChange={handleCSVImport}
                    className="hidden"
                  />
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isImporting}
                    className="flex items-center gap-1.5 bg-primary text-white font-bold text-xs hover:bg-primary/90 shadow-sm"
                  >
                    {isImporting ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" /> Đang đối soát...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" /> Nhập file đối soát CSV
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      toast.success('Đang tải tệp Excel danh sách đơn hàng...');
                    }}
                    className="flex items-center gap-1.5 border-border font-bold text-xs"
                  >
                    <Download className="h-4 w-4" /> Xuất file báo cáo
                  </Button>
                </div>
              </div>

              {/* SEARCH & FILTER FOR ORDERS */}
              <div className="bg-white border border-border p-4 rounded-input flex flex-col sm:flex-row gap-4 items-center shadow-[0_2px_10px_rgba(0,0,0,0.01)]">
                <div className="flex-1 w-full flex items-center px-3 border border-border rounded-input bg-bg gap-2">
                  <Search className="h-4.5 w-4.5 text-text-secondary shrink-0" />
                  <input
                    type="text"
                    placeholder="Tìm theo Mã đơn, tên sản phẩm hoặc mã thành viên..."
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    className="w-full bg-transparent border-none py-2.5 outline-none focus:outline-none focus:ring-0 text-xs"
                  />
                </div>
                <div className="w-full sm:w-48 flex items-center gap-2">
                  <Filter className="h-4 w-4 text-text-secondary shrink-0" />
                  <select
                    value={orderStatusFilter}
                    onChange={(e) => setOrderStatusFilter(e.target.value)}
                    className="w-full bg-white border border-border text-xs rounded-input py-2.5 px-3"
                  >
                    <option value="all">Tất cả trạng thái</option>
                    <option value="pending">Đang chờ xử lý</option>
                    <option value="approved">Hoàn thành</option>
                    <option value="rejected">Hủy</option>
                    <option value="returned">Hoàn hàng</option>
                    <option value="paid">Đã thanh toán</option>
                  </select>
                </div>
              </div>

              {/* ORDERS LIST */}
              <Card className="border-border/50">
                <CardContent className="p-0">
                  <TableContainer>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mã Đơn</TableHead>
                        <TableHead>Thành Viên</TableHead>
                        <TableHead>Sản Phẩm</TableHead>
                        <TableHead className="text-right">Giá Trị Đơn</TableHead>
                        <TableHead className="text-right">Hoa Hồng Shopee</TableHead>
                        <TableHead className="text-right">Hoàn Tiền Khách</TableHead>
                        <TableHead>Ngày Đặt</TableHead>
                        <TableHead>Trạng Thái</TableHead>
                        <TableHead className="text-center">Thao Tác</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedOrders.map((o) => {
                        const shopeeComm = o.realCashback !== undefined ? o.realCashback : o.estimatedCashback;
                        const cashbackPercent = settings?.cashbackPercentage ?? 50;
                        const userCashback = shopeeComm * (cashbackPercent / 100);
                        return (
                          <TableRow key={o.id}>
                            <TableCell className="font-bold text-primary">{o.id}</TableCell>
                            <TableCell className="font-semibold text-xs text-text-secondary">
                              {o.userId ? (
                                <span className="font-mono">{o.userId}</span>
                              ) : (
                                <Badge variant="outline" className="text-warning border-warning/30 bg-yellow-50/50 text-[10px]">Chưa xác định</Badge>
                              )}
                            </TableCell>
                            <TableCell className="max-w-[180px] truncate font-semibold">
                              <span className="truncate" title={o.productName}>{o.productName}</span>
                            </TableCell>
                            <TableCell className="text-right font-semibold">{Math.round(o.orderAmount).toLocaleString('vi-VN')}đ</TableCell>
                            <TableCell className="text-right font-semibold text-text-secondary">{Math.round(shopeeComm).toLocaleString('vi-VN')}đ</TableCell>
                            <TableCell className="text-right font-bold text-primary">{Math.round(userCashback).toLocaleString('vi-VN')}đ</TableCell>
                            <TableCell className="text-xs font-semibold text-text-secondary">
                              {o.createdTime ? o.createdTime.substring(0, 16) : '-'}
                            </TableCell>
                            <TableCell>
                              {o.status === 'pending' && <Badge variant="info">Đang chờ xử lý</Badge>}
                              {o.status === 'approved' && <Badge variant="success">Hoàn thành</Badge>}
                              {o.status === 'rejected' && <Badge variant="danger">Hủy</Badge>}
                              {o.status === 'returned' && <Badge variant="warning" className="bg-orange-50 text-orange-600 border-orange-200">Hoàn hàng</Badge>}
                              {o.status === 'paid' && <Badge variant="warning">Đã thanh toán</Badge>}
                            </TableCell>
                            <TableCell className="text-center">
                              <button
                                onClick={() => {
                                  setEditingOrder(o);
                                  setEditOrderStatus(o.status);
                                  setEditOrderRealCashback(o.realCashback !== undefined ? o.realCashback.toString() : o.estimatedCashback.toString());
                                  setEditOrderNotes(o.notes || '');
                                }}
                                className="px-3 py-1.5 text-xs font-bold border border-border text-text hover:bg-bg/50 rounded-button transition-all flex items-center justify-center gap-1.5 mx-auto"
                                title="Chỉnh sửa đơn hàng"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                                Chỉnh sửa
                              </button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </TableContainer>

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between p-4 border-t border-border bg-bg/30 text-xs font-semibold">
                      <div className="text-text-secondary">
                        Hiển thị <span className="font-bold text-text">{(orderPage - 1) * ordersPerPage + 1}</span> - <span className="font-bold text-text">{Math.min(orderPage * ordersPerPage, totalAdminOrders)}</span> trong tổng số <span className="font-bold text-text">{totalAdminOrders}</span> đơn hàng
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setOrderPage(p => Math.max(1, p - 1))}
                          disabled={orderPage === 1}
                          className="px-3 py-1.5 border border-border rounded-[8px] bg-white hover:bg-bg disabled:opacity-50 transition-all"
                        >
                          Trước
                        </button>
                        {getPageNumbers(orderPage, totalPages).map((page, index) => {
                          if (page === '...') {
                            return (
                              <span key={`dots-${index}`} className="px-2.5 py-1.5 text-text-secondary select-none font-bold">
                                ...
                              </span>
                            );
                          }
                          return (
                            <button
                              key={page}
                              onClick={() => setOrderPage(Number(page))}
                              className={`px-3 py-1.5 border rounded-[8px] transition-all ${orderPage === page
                                  ? 'bg-primary text-white border-primary font-bold'
                                  : 'bg-white hover:bg-bg border-border text-text-secondary'
                                }`}
                            >
                              {page}
                            </button>
                          );
                        })}
                        <button
                          onClick={() => setOrderPage(p => Math.min(totalPages, p + 1))}
                          disabled={orderPage === totalPages}
                          className="px-3 py-1.5 border border-border rounded-[8px] bg-white hover:bg-bg disabled:opacity-50 transition-all"
                        >
                          Sau
                        </button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 4: WALLET & WITHDRAWALS APPROVAL */}
          {activeTab === 'withdrawals' && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-2xl font-black text-text">Duyệt yêu cầu rút tiền</h2>
                <p className="text-xs text-text-secondary mt-1">Xử lý các lệnh gửi tiền về tài khoản ngân hàng của thành viên.</p>
              </div>

              <Card className="border-border/50">
                <CardContent className="p-0">
                  {withdrawals.length > 0 ? (
                    <TableContainer>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Mã Lệnh</TableHead>
                          <TableHead>Mã Thành Viên</TableHead>
                          <TableHead className="text-right">Số Tiền Rút</TableHead>
                          <TableHead>Ngân Hàng Nhận</TableHead>
                          <TableHead>Số Tài Khoản</TableHead>
                          <TableHead>Chủ Tài Khoản</TableHead>
                          <TableHead>Ngày Gửi Lệnh</TableHead>
                          <TableHead>Trạng Trạng Thái</TableHead>
                          <TableHead className="text-center">Thao Tác</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {withdrawals.map((w) => (
                          <TableRow key={w.id}>
                            <TableCell className="font-bold text-primary">{w.id}</TableCell>
                            <TableCell className="font-bold text-xs text-text-secondary">{w.userId}</TableCell>
                            <TableCell className="text-right font-black text-text">{w.amount.toLocaleString('vi-VN')}đ</TableCell>
                            <TableCell className="font-semibold text-xs">{w.bankName}</TableCell>
                            <TableCell className="font-mono text-xs">{w.accountNumber}</TableCell>
                            <TableCell className="font-semibold text-xs">{w.accountHolder}</TableCell>
                            <TableCell className="text-xs text-text-secondary font-medium">{w.requestDate}</TableCell>
                            <TableCell>
                              {w.status === 'pending' && <Badge variant="info">Chờ duyệt</Badge>}
                              {w.status === 'approved' && <Badge variant="success">Thành công</Badge>}
                              {w.status === 'rejected' && <Badge variant="danger">Bị từ chối</Badge>}
                            </TableCell>
                            <TableCell className="text-center">
                              {w.status === 'pending' ? (
                                <div className="flex gap-2 justify-center">
                                  <button
                                    onClick={() => {
                                      updateWithdrawalStatus(w.id, 'approved');
                                      toast.success(`Đã phê duyệt lệnh rút tiền ${w.id}. Vui lòng chuyển khoản ${w.amount.toLocaleString('vi-VN')}đ.`);
                                    }}
                                    className="px-2 py-1 text-xs font-bold bg-success text-white hover:bg-success/90 rounded-button transition-all shadow-sm"
                                  >
                                    Duyệt & CK
                                  </button>
                                  <button
                                    onClick={() => {
                                      updateWithdrawalStatus(w.id, 'rejected');
                                      toast.error(`Đã từ chối lệnh rút tiền ${w.id}`);
                                    }}
                                    className="p-1 bg-danger/10 text-danger hover:bg-danger hover:text-white rounded-button transition-all"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[10px] text-text-secondary font-bold">Xử lý xong</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </TableContainer>
                  ) : (
                    <div className="text-center py-16 text-xs text-text-secondary">
                      Chưa phát sinh yêu cầu rút tiền nào từ thành viên.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 5: RECONCILIATION FILE UPLOAD */}
          {activeTab === 'reconciliation' && (
            <div className="flex flex-col gap-8">
              <div>
                <h2 className="text-2xl font-black text-text">Đối soát Excel / CSV hàng loạt</h2>
                <p className="text-xs text-text-secondary mt-1">
                  Nhập file xuất dữ liệu hoa hồng của sàn Shopee để đối khớp trạng thái đơn hàng tự động mà không cần phê duyệt thủ công từng đơn.
                </p>
              </div>

              {/* UPLOAD PANEL AREA */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                <Card className="lg:col-span-2 border-border/50">
                  <CardHeader>
                    <CardTitle className="text-base">Khu vực tải lên file đối soát</CardTitle>
                    <CardDescription>Hỗ trợ định dạng CSV, XLSX, XLS.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="border-2 border-dashed border-border/80 hover:border-primary/50 transition-all rounded-card bg-bg/50 p-8 flex flex-col items-center justify-center text-center relative cursor-pointer min-h-[220px]">
                      <input
                        type="file"
                        accept=".csv, .xlsx, .xls"
                        onChange={handleFileUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      <div className="bg-white p-4 rounded-full border border-border shadow-sm mb-4">
                        <Upload className="h-6 w-6 text-primary" />
                      </div>

                      {uploadedFileName ? (
                        <div>
                          <p className="text-xs font-bold text-text mb-1">{uploadedFileName}</p>
                          <p className="text-[10px] text-success font-semibold flex items-center justify-center gap-1.5">
                            <Check className="h-3.5 w-3.5" /> File tải lên sẵn sàng
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-xs font-bold text-text mb-1.5">Kéo thả file đối soát vào đây hoặc bấm để chọn tệp</p>
                          <p className="text-[10px] text-text-secondary">Định dạng file xuất chuẩn của Shopee Affiliate</p>
                        </div>
                      )}
                    </div>

                    {/* Pre-matched preview table */}
                    <AnimatePresence>
                      {reconcileData && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-6 flex flex-col gap-4"
                        >
                          <div className="flex justify-between items-center bg-orange-50 border border-orange-100 p-4 rounded-input text-left">
                            <div>
                              <p className="text-xs font-bold text-primary">Tóm tắt kết quả phân tích file</p>
                              <p className="text-[10px] text-text-secondary mt-1">
                                Trùng khớp:{' '}
                                <span className="font-bold text-success">
                                  {reconcileData.filter(r => r.status === 'matched').length}
                                </span>{' '}
                                | Trùng lặp:{' '}
                                <span className="font-bold text-warning">
                                  {reconcileData.filter(r => r.status === 'duplicate').length}
                                </span>{' '}
                                | Thiếu/Lỗi:{' '}
                                <span className="font-bold text-danger">
                                  {reconcileData.filter(r => r.status === 'invalid' || r.status === 'missing').length}
                                </span>
                              </p>
                            </div>
                            <Button onClick={handleApplyReconciliation} className="font-bold text-xs py-2">
                              Phê duyệt tự động
                            </Button>
                          </div>

                          <TableContainer>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Mã Đơn Sàn</TableHead>
                                <TableHead>Tên Sản Phẩm</TableHead>
                                <TableHead className="text-right">Số Tiền</TableHead>
                                <TableHead className="text-right">Hoàn Lại</TableHead>
                                <TableHead>Kết Quả Quét</TableHead>
                                <TableHead>Chi Tiết</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {reconcileData.map((row, index) => (
                                <TableRow key={index}>
                                  <TableCell className="font-bold text-text-secondary">{row.id}</TableCell>
                                  <TableCell className="max-w-[160px] truncate font-semibold text-xs">{row.name}</TableCell>
                                  <TableCell className="text-right font-semibold text-xs">{row.amount.toLocaleString('vi-VN')}đ</TableCell>
                                  <TableCell className="text-right font-bold text-primary text-xs">{row.cashback.toLocaleString('vi-VN')}đ</TableCell>
                                  <TableCell>
                                    {row.status === 'matched' && <Badge variant="success">Trùng khớp</Badge>}
                                    {row.status === 'duplicate' && <Badge variant="warning">Trùng lặp</Badge>}
                                    {row.status === 'invalid' && <Badge variant="danger">Lỗi dữ liệu</Badge>}
                                    {row.status === 'missing' && <Badge variant="outline" className="text-danger border-danger/30 bg-red-50/50">Chưa ghi nhận</Badge>}
                                  </TableCell>
                                  <TableCell className="text-[10px] text-text-secondary font-medium">{row.reason}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </TableContainer>
                        </motion.div>
                      )}
                    </AnimatePresence>

                  </CardContent>
                </Card>

                {/* HISTORICAL UPLOADS LIST */}
                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle className="text-base">Lịch sử nhập đối soát</CardTitle>
                    <CardDescription>Báo cáo các lượt nạp file đối soát thành công trước đó</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    {reconciliationHistory.map((item) => (
                      <div key={item.id} className="p-4 border border-border rounded-input text-left flex flex-col gap-2">
                        <div className="flex justify-between items-start gap-1">
                          <p className="text-xs font-bold text-text truncate max-w-[180px]">{item.fileName}</p>
                          <Badge variant="outline" className="text-[9px] py-0 px-2 font-bold uppercase">{item.id}</Badge>
                        </div>
                        <p className="text-[10px] text-text-secondary font-medium">Thời gian nạp: {item.uploadTime}</p>

                        <div className="grid grid-cols-2 gap-2 text-[10px] text-text-secondary pt-2 border-t border-border/40 font-semibold mt-1">
                          <div>
                            Dòng dữ liệu:{' '}
                            <span className="text-text font-bold">{item.totalRows}</span>
                          </div>
                          <div>
                            Khớp duyệt:{' '}
                            <span className="text-success font-bold">{item.matchedCount}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* TAB 6: SYSTEM CONFIGURATION */}
          {activeTab === 'settings' && (
            <div className="max-w-2xl mx-auto flex flex-col gap-6">
              <div>
                <h2 className="text-2xl font-black text-text">Cài đặt cấu hình hệ thống</h2>
                <p className="text-xs text-text-secondary mt-1">Cài đặt thông tin hiển thị của trang web, đường dẫn mạng xã hội hỗ trợ, mã liên kết Shopee và các thông số thông báo, bảo trì.</p>
              </div>

              <Card className="border-border/50">
                <CardContent className="p-6">
                  <form onSubmit={handleSaveSettings} className="flex flex-col gap-6">

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-text/80">Tên website</label>
                        <input
                          type="text"
                          value={sysWebsiteName}
                          onChange={(e) => setSysWebsiteName(e.target.value)}
                          className="w-full px-4 py-3 bg-white border border-border text-sm rounded-input outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-semibold"
                          required
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-text/80">Số điện thoại / Hotline hỗ trợ</label>
                        <input
                          type="text"
                          value={sysSupportPhone}
                          onChange={(e) => setSysSupportPhone(e.target.value)}
                          className="w-full px-4 py-3 bg-white border border-border text-sm rounded-input outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-semibold"
                          required
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-text/80">Đường dẫn Zalo hỗ trợ (Group/Chat)</label>
                        <input
                          type="text"
                          value={sysSupportZalo}
                          onChange={(e) => setSysSupportZalo(e.target.value)}
                          className="w-full px-4 py-3 bg-white border border-border text-sm rounded-input outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-semibold"
                          required
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-text/80">Đường dẫn Facebook hỗ trợ (Fanpage/Chat)</label>
                        <input
                          type="text"
                          value={sysSupportFacebook}
                          onChange={(e) => setSysSupportFacebook(e.target.value)}
                          className="w-full px-4 py-3 bg-white border border-border text-sm rounded-input outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-semibold"
                          required
                        />
                      </div>

                      <div className="flex flex-col gap-1.5 sm:col-span-2">
                        <label className="text-xs font-bold text-text/80">Shopee Affiliate ID mặc định</label>
                        <input
                          type="text"
                          value={sysShopeeAffiliateId}
                          onChange={(e) => setSysShopeeAffiliateId(e.target.value)}
                          className="w-full px-4 py-3 bg-white border border-border text-sm rounded-input outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-semibold font-mono"
                          required
                        />
                        <span className="text-[10px] text-text-secondary">Dùng để chèn mã tiếp thị liên kết tự động khi tạo link rút gọn</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 border-t border-border/40 pt-5">
                      <p className="text-xs font-bold text-text uppercase tracking-wider mb-1">Chế độ vận hành</p>

                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="sysMaint"
                          checked={sysMaintMode}
                          onChange={(e) => setSysMaintMode(e.target.checked)}
                          className="rounded-sm border-border text-primary focus:ring-primary h-4 w-4"
                        />
                        <label htmlFor="sysMaint" className="text-xs text-text-secondary font-semibold cursor-pointer">
                          Kích hoạt chế độ bảo trì hệ thống (Tạm thời khóa chức năng mua hàng tạo link)
                        </label>
                      </div>
                    </div>

                    <Button type="submit" className="w-full py-3 font-bold mt-2">
                      Lưu Cấu Hình Hệ Thống
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}

        </main>
      </div>

      {/* DETAILED VIEW DIALOG FOR SELECTED ORDER SCREENSHOT */}
      <Dialog isOpen={selectedOrderDetail !== null} onClose={() => setSelectedOrderDetail(null)}>
        {selectedOrderDetail && (
          <>
            <DialogHeader>
              <div className="flex justify-between items-center pr-6">
                <div>
                  <DialogTitle>Minh chứng đơn {selectedOrderDetail.id}</DialogTitle>
                  <p className="text-[10px] text-text-secondary">Thành viên gửi đối soát: {selectedOrderDetail.userId}</p>
                </div>
                <Badge variant="info">Chờ duyệt ảnh</Badge>
              </div>
            </DialogHeader>
            <DialogContent className="flex flex-col gap-4 text-left">
              <p className="text-xs text-text font-bold">Hình ảnh chụp màn hình gửi đối soát:</p>

              <img
                src={selectedOrderDetail.screenshot}
                alt="Shopee screenshot"
                className="w-full h-auto object-contain border border-border rounded-input max-h-[300px]"
              />

              <div className="bg-bg p-4 rounded-input border border-border/50 mt-2">
                <p className="text-xs font-bold text-text">Thông tin đơn hàng đối chiếu:</p>
                <p className="text-[10px] text-text-secondary leading-snug mt-1 font-semibold">{selectedOrderDetail.productName}</p>
                <p className="text-xs font-bold text-text mt-2">Giá trị đơn: {selectedOrderDetail.orderAmount.toLocaleString('vi-VN')}đ</p>
                <p className="text-xs font-bold text-primary">Tiền hoàn: {selectedOrderDetail.estimatedCashback.toLocaleString('vi-VN')}đ</p>
              </div>

              <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border/40">
                <Button
                  variant="outline"
                  className="border-danger text-danger hover:bg-danger/5 font-bold"
                  onClick={() => handleRejectOrder(selectedOrderDetail.id)}
                >
                  Từ chối đối soát
                </Button>
                <Button
                  className="font-bold"
                  onClick={() => handleApproveOrder(selectedOrderDetail.id)}
                >
                  Phê duyệt hoa hồng
                </Button>
              </div>
            </DialogContent>
          </>
        )}
      </Dialog>

      {/* USER CRUD MODAL */}
      <Dialog isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)}>
        <DialogHeader>
          <DialogTitle>{selectedUser ? `Chỉnh sửa: ${selectedUser.name}` : 'Thêm thành viên mới'}</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <form onSubmit={handleSaveUser} className="flex flex-col gap-4 text-left">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Họ và tên" value={editUserName} onChange={(e) => setEditUserName(e.target.value)} required />
              <Input label="Số điện thoại" value={editUserPhone} onChange={(e) => setEditUserPhone(e.target.value)} />
            </div>
            <Input label="Địa chỉ Email" type="email" value={editUserEmail} onChange={(e) => setEditUserEmail(e.target.value)} required />

            {!selectedUser && (
              <Input
                label="Mật khẩu *"
                type="password"
                placeholder="Tối thiểu 6 ký tự"
                value={editUserPassword}
                onChange={(e) => setEditUserPassword(e.target.value)}
                required
              />
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text/80">Vai trò</label>
              <select
                value={editUserRole}
                onChange={(e) => setEditUserRole(e.target.value as any)}
                className="w-full px-4 py-3 bg-white border border-border text-sm rounded-input outline-none focus:border-primary"
              >
                <option value="user">Người dùng mua sắm</option>
                <option value="admin">Quản trị viên</option>
              </select>
            </div>

            {selectedUser && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Ngân hàng" value={editUserBank} onChange={(e) => setEditUserBank(e.target.value)} />
                  <Input label="Số tài khoản" value={editUserAccount} onChange={(e) => setEditUserAccount(e.target.value)} />
                </div>
                <Input label="Chủ tài khoản (Không dấu)" value={editUserHolder} onChange={(e) => setEditUserHolder(e.target.value.toUpperCase())} />
              </>
            )}

            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border/40">
              <Button type="button" variant="ghost" onClick={() => setIsUserModalOpen(false)} className="font-bold">Hủy bỏ</Button>
              <Button type="submit" className="font-bold">{selectedUser ? 'Lưu thay đổi' : 'Tạo tài khoản'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRM DIALOG */}
      <Dialog isOpen={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)}>
        <DialogHeader>
          <DialogTitle>Xác nhận xóa tài khoản</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <div className="flex flex-col gap-4 text-left">
            <p className="text-sm text-text">
              Bạn có chắc chắn muốn xóa tài khoản của <span className="font-bold text-danger">{userToDelete?.name}</span> ({userToDelete?.email})?
            </p>
            <p className="text-xs text-text-secondary bg-red-50 border border-red-100 p-3 rounded-input">
              ⚠️ Hành động này không thể hoàn tác. Tất cả dữ liệu liên quan đến tài khoản này sẽ bị xóa.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsDeleteConfirmOpen(false)} className="font-bold">Hủy bỏ</Button>
              <Button
                type="button"
                onClick={handleDeleteUser}
                className="font-bold bg-danger hover:bg-danger/90 text-white border-none"
              >
                Xóa tài khoản
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* RESET PASSWORD DIALOG */}
      <Dialog isOpen={isResetPasswordOpen} onClose={() => setIsResetPasswordOpen(false)}>
        <DialogHeader>
          <DialogTitle>Đặt lại mật khẩu</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <div className="flex flex-col gap-4 text-left">
            <p className="text-sm text-text">
              Đặt lại mật khẩu cho: <span className="font-bold">{userToReset?.name}</span>
            </p>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text/80">Mật khẩu mới</label>
              <input
                type="text"
                value={resetPasswordValue}
                onChange={(e) => setResetPasswordValue(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-border text-sm rounded-input outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-semibold"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsResetPasswordOpen(false)} className="font-bold">Hủy bỏ</Button>
              <Button type="button" onClick={handleResetPassword} className="font-bold">Đặt lại mật khẩu</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* EDIT ORDER DIALOG */}
      <Dialog isOpen={editingOrder !== null} onClose={() => setEditingOrder(null)}>
        <DialogHeader>
          <DialogTitle>Chỉnh sửa đơn hàng {editingOrder?.id}</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <form onSubmit={handleSaveOrderDetails} className="flex flex-col gap-4 text-left font-sans">
            <div className="bg-bg p-4 rounded-input border border-border/50 font-semibold text-xs space-y-2">
              <p><span className="text-text-secondary">Sản phẩm:</span> <span className="text-text font-bold">{editingOrder?.productName}</span></p>
              <p><span className="text-text-secondary">Thành viên:</span> <span className="text-text font-bold font-mono">{editingOrder?.userId}</span></p>
              <p><span className="text-text-secondary">Giá trị đơn:</span> <span className="text-text font-bold">{editingOrder?.orderAmount.toLocaleString('vi-VN')}đ</span></p>
              <p><span className="text-text-secondary">Hoa hồng Shopee ước tính:</span> <span className="text-text font-bold">{editingOrder?.estimatedCashback.toLocaleString('vi-VN')}đ</span></p>
              {editingOrder?.createdTime && (
                <p><span className="text-text-secondary">Thời gian đặt hàng:</span> <span className="text-text font-bold">{editingOrder.createdTime}</span></p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text/80">Hoa hồng Shopee thực tế (₫)</label>
              <input
                type="number"
                value={editOrderRealCashback}
                onChange={(e) => setEditOrderRealCashback(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-border text-sm rounded-input outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-semibold"
                required
              />
              <p className="text-[11px] text-text-secondary font-medium">
                * Khách sẽ được nhận hoàn tiền: <span className="text-primary font-bold">{Math.round(((parseFloat(editOrderRealCashback) || 0) * (settings?.cashbackPercentage ?? 50) / 100)).toLocaleString('vi-VN')}đ</span> ({settings?.cashbackPercentage ?? 50}% hoa hồng).
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text/80">Trạng thái đơn hàng</label>
              <select
                value={editOrderStatus}
                onChange={(e) => setEditOrderStatus(e.target.value as any)}
                className="w-full px-4 py-3 bg-white border border-border text-sm rounded-input outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-semibold"
              >
                <option value="pending">Đang chờ xử lý</option>
                <option value="approved">Hoàn thành</option>
                <option value="rejected">Hủy</option>
                <option value="returned">Hoàn hàng</option>
                <option value="paid">Đã thanh toán</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text/80">Ghi chú đối soát</label>
              <textarea
                value={editOrderNotes}
                onChange={(e) => setEditOrderNotes(e.target.value)}
                placeholder="Nhập ghi chú hoặc lý do hủy đơn (nếu có)..."
                className="w-full px-4 py-3 bg-white border border-border text-sm rounded-input outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-semibold min-h-[80px]"
              />
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-border/40">
              <Button type="button" variant="ghost" onClick={() => setEditingOrder(null)} className="font-bold">Hủy bỏ</Button>
              <Button type="submit" className="font-bold">Lưu thay đổi</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog isOpen={isImportReconcileModalOpen} onClose={() => setIsImportReconcileModalOpen(false)} className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Xem trước kết quả đối soát CSV</DialogTitle>
        </DialogHeader>
        <DialogContent className="flex flex-col gap-4 text-left font-sans">
          {reconcileModalData && (
            <>
              <p className="text-xs text-text-secondary">
                File: <span className="font-bold text-text">{reconcileModalData.fileName}</span>
              </p>

              <div className="grid grid-cols-2 gap-4 bg-bg p-4 rounded-input border border-border/50 text-xs font-semibold">
                <div>Tổng số dòng: <span className="text-text font-bold">{reconcileModalData.totalRows}</span></div>
                <div>Trùng khớp (Thêm mới/Cập nhật): <span className="text-success font-bold">{reconcileModalData.matchedCount}</span></div>
                <div>Trùng lặp (Bỏ qua): <span className="text-warning font-bold">{reconcileModalData.duplicateCount}</span></div>
                <div>Lỗi / Thiếu thông tin: <span className="text-danger font-bold">{reconcileModalData.missingCount + reconcileModalData.invalidCount}</span></div>
              </div>

              <div className="max-h-[350px] overflow-y-auto border border-border rounded-input">
                <TableContainer>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mã Đơn</TableHead>
                      <TableHead>Thành Viên</TableHead>
                      <TableHead>Sản Phẩm</TableHead>
                      <TableHead className="text-right">Giá Trị</TableHead>
                      <TableHead className="text-right">Hoa Hồng</TableHead>
                      <TableHead>Trạng Thái Shopee</TableHead>
                      <TableHead>Phân Loại</TableHead>
                      <TableHead>Chi Tiết</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reconcileModalData.details && reconcileModalData.details.slice(0, 100).map((row: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="font-bold text-text text-xs">{row.id}</TableCell>
                        <TableCell className="font-semibold text-xs">
                          {row.subId ? (
                            <span className="text-text-secondary font-mono">{row.subId}</span>
                          ) : (
                            <span className="text-danger italic font-semibold">Trống</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate font-medium text-xs">
                          <span title={row.name}>{row.name || '-'}</span>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-xs">
                          {row.amount ? row.amount.toLocaleString('vi-VN') + 'đ' : '0đ'}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-xs text-text-secondary">
                          {row.cashback ? row.cashback.toLocaleString('vi-VN') + 'đ' : '0đ'}
                        </TableCell>
                        <TableCell>
                          {row.shopeeStatus === 'approved' && <Badge variant="success">Hoàn thành</Badge>}
                          {row.shopeeStatus === 'rejected' && <Badge variant="danger">Đã hủy</Badge>}
                          {row.shopeeStatus === 'pending' && <Badge variant="info">Chờ xử lý</Badge>}
                          {!row.shopeeStatus && <span className="text-xs text-text-secondary">-</span>}
                        </TableCell>
                        <TableCell>
                          {row.status === 'matched' && <Badge variant="success">Khớp</Badge>}
                          {row.status === 'duplicate' && <Badge variant="warning">Trùng</Badge>}
                          {row.status === 'invalid' && <Badge variant="danger">Lỗi</Badge>}
                          {row.status === 'missing' && <Badge variant="outline" className="text-danger border-danger/30 bg-red-50/50">Thiếu</Badge>}
                        </TableCell>
                        <TableCell className="text-[10px] text-text-secondary font-medium min-w-[150px]">{row.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </TableContainer>
              </div>

              {reconcileModalData.details && reconcileModalData.details.length > 50 && (
                <p className="text-[10px] text-text-secondary text-center italic">* Chỉ hiển thị tối đa 50 dòng kết quả đầu tiên</p>
              )}

              <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border/40">
                <Button type="button" variant="ghost" onClick={() => setIsImportReconcileModalOpen(false)} className="font-bold">Hủy bỏ</Button>
                <Button
                  type="button"
                  onClick={handleApplyImportReconciliation}
                  className="font-bold bg-primary text-white hover:bg-primary/90"
                >
                  Xác nhận áp dụng
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
