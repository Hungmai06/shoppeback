import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, Users, ShoppingBag, Wallet,
  LogOut, RefreshCw, Plus, Search,
  Filter, Check, X, Lock, Unlock, Trash2, Edit2, Download,
  Upload, BarChart3, FileSpreadsheet,
  Settings2, Activity, Eye
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
    currentUser, isAuthLoading, logout, orders, totalAdminOrders, withdrawals, users, settings,
    updateOrderStatus, deleteOrderAdmin, updateWithdrawalStatus, updateSettings,
    reconciliationHistory, uploadReconciliationCSV, applyReconciliationCSV,
    updateAdminUser, adminStats, fetchAdminOrders, fetchAdminStats, fetchAdminWithdrawals, fetchAdminUsers, fetchReconciliationLogs, exportOrdersCSV,
    createAdminUser, deleteAdminUser, resetUserPassword, toggleUserStatus
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'orders' | 'withdrawals' | 'reconciliation' | 'settings'>('dashboard');

  // Search & Filter States
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [statsRange, setStatsRange] = useState<'all' | 'today' | '7days' | '30days' | 'this_month'>('all');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('');

  // Order Pagination & Loading states
  const [orderPage, setOrderPage] = useState(1);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const ordersPerPage = 10;
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setOrderPage(1);
  }, [orderSearch, orderStatusFilter]);

  // Fetch paginated and filtered orders & active tab data from backend
  React.useEffect(() => {
    if (currentUser?.role === 'admin') {
      if (activeTab === 'dashboard') {
        fetchAdminStats(statsRange, selectedMonthFilter);
      } else if (activeTab === 'users') {
        fetchAdminUsers();
      } else if (activeTab === 'orders') {
        if (users.length === 0) fetchAdminUsers();
        setIsLoadingOrders(true);
        const delay = setTimeout(async () => {
          await fetchAdminOrders(orderPage, ordersPerPage, orderSearch, orderStatusFilter);
          setIsLoadingOrders(false);
        }, 300);
        return () => clearTimeout(delay);
      } else if (activeTab === 'withdrawals') {
        fetchAdminWithdrawals();
      } else if (activeTab === 'reconciliation') {
        fetchReconciliationLogs();
      }
    }
  }, [activeTab, orderPage, orderSearch, orderStatusFilter, statsRange, selectedMonthFilter, currentUser]);

  // Selected items for Modals
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<Order | null>(null);

  // Withdrawal Rejection states
  const [rejectingWithdrawalId, setRejectingWithdrawalId] = useState<string | null>(null);
  const [withdrawalRejectNotes, setWithdrawalRejectNotes] = useState<string>('');

  // Order Edit & Delete states
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editOrderStatus, setEditOrderStatus] = useState<Order['status']>('pending');
  const [editOrderRealCashback, setEditOrderRealCashback] = useState<string>('');
  const [editOrderNotes, setEditOrderNotes] = useState<string>('');
  const [editOrderUserId, setEditOrderUserId] = useState<string>('');
  const [deletingOrder, setDeletingOrder] = useState<Order | null>(null);

  // Reconciliation states for Orders Tab
  const [reconcileModalData, setReconcileModalData] = useState<any>(null);
  const [isImportReconcileModalOpen, setIsImportReconcileModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isApplyingReconcile, setIsApplyingReconcile] = useState(false);

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
  const [editUserBalance, setEditUserBalance] = useState('');

  // User orders viewer modal state
  const [viewingUserOrders, setViewingUserOrders] = useState<UserProfile | null>(null);
  const [userOrdersList, setUserOrdersList] = useState<any[]>([]);
  const [isLoadingUserOrders, setIsLoadingUserOrders] = useState(false);

  const openUserOrdersModal = async (user: UserProfile) => {
    setViewingUserOrders(user);
    setIsLoadingUserOrders(true);
    setUserOrdersList([]);
    try {
      const token = localStorage.getItem('token');
      const apiBase = import.meta.env.VITE_API_BASE || '/api';
      const res = await fetch(`${apiBase}/orders/admin?search=${encodeURIComponent(user.id)}&limit=100`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      if (res.ok) {
        const data = await res.json();
        const mapped = (data.orders || []).map((o: any) => ({
          id: o.id,
          productName: o.product_name,
          orderAmount: o.order_amount,
          estimatedCashback: o.estimated_cashback,
          realCashback: o.real_cashback !== null && o.real_cashback !== undefined ? o.real_cashback : o.estimated_cashback,
          status: o.status,
          createdTime: o.created_at
        }));
        setUserOrdersList(mapped);
      }
    } catch (err) {
      console.error('Fetch user orders error:', err);
    } finally {
      setIsLoadingUserOrders(false);
    }
  };
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
  const [sysCommissionPercentage, setSysCommissionPercentage] = useState<number>(settings.commissionPercentage ?? 10);
  const [sysCashbackPercentage, setSysCashbackPercentage] = useState<number>(settings.cashbackPercentage ?? 50);
  const [sysShopeeAffiliateId, setSysShopeeAffiliateId] = useState(settings.shopeeAffiliateId || "173401900099");
  const [sysShopeeCookieUrl, setSysShopeeCookieUrl] = useState(settings.shopeeCookieUrl || "https://s.shopee.vn/an_redir");
  const [sysLazadaAffiliateId, setSysLazadaAffiliateId] = useState(settings.lazadaAffiliateId || "");
  const [sysLazadaCookieUrl, setSysLazadaCookieUrl] = useState(settings.lazadaCookieUrl || "https://s.lazada.vn/s.an_redir");
  const [sysTiktokAffiliateId, setSysTiktokAffiliateId] = useState(settings.tiktokAffiliateId || "");
  const [sysTiktokCookieUrl, setSysTiktokCookieUrl] = useState(settings.tiktokCookieUrl || "https://vt.tiktok.com/an_redir");
  const [sysTikiAffiliateId, setSysTikiAffiliateId] = useState(settings.tikiAffiliateId || "");
  const [sysTikiCookieUrl, setSysTikiCookieUrl] = useState(settings.tikiCookieUrl || "https://tiki.vn/an_redir");
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
      setSysCommissionPercentage(settings.commissionPercentage ?? 10);
      setSysCashbackPercentage(settings.cashbackPercentage ?? 50);
      setSysShopeeAffiliateId(settings.shopeeAffiliateId || "173401900099");
      setSysShopeeCookieUrl(settings.shopeeCookieUrl || "https://s.shopee.vn/an_redir");
      setSysLazadaAffiliateId(settings.lazadaAffiliateId || "");
      setSysLazadaCookieUrl(settings.lazadaCookieUrl || "https://s.lazada.vn/s.an_redir");
      setSysTiktokAffiliateId(settings.tiktokAffiliateId || "");
      setSysTiktokCookieUrl(settings.tiktokCookieUrl || "https://vt.tiktok.com/an_redir");
      setSysTikiAffiliateId(settings.tikiAffiliateId || "");
      setSysTikiCookieUrl(settings.tikiCookieUrl || "https://tiki.vn/an_redir");
      setSysTeleNotify(settings.telegramNotification);
      setSysEmailNotify(settings.emailNotification);
      setSysMaintMode(settings.maintenanceMode);
    }
  }, [settings]);

  // Redirect if not admin
  React.useEffect(() => {
    if (isAuthLoading) return;

    if (!currentUser) {
      navigate('/auth/login');
    } else if (currentUser.role !== 'admin') {
      toast.error('Bạn không có quyền truy cập khu vực Quản trị');
      navigate('/');
    }
  }, [currentUser, isAuthLoading, navigate]);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm font-bold text-text-secondary">Đang kiểm tra quyền Quản trị hệ thống...</p>
        </div>
      </div>
    );
  }

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
      await updateOrderStatus(editingOrder.id, editOrderStatus, cashbackVal, editOrderNotes, editOrderUserId);
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

    setIsApplyingReconcile(true);
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
    } finally {
      setIsApplyingReconcile(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSettings({
      websiteName: sysWebsiteName,
      supportPhone: sysSupportPhone,
      supportZalo: sysSupportZalo,
      supportFacebook: sysSupportFacebook,
      commissionPercentage: Number(sysCommissionPercentage) || 10,
      cashbackPercentage: Number(sysCashbackPercentage) || 50,
      shopeeAffiliateId: sysShopeeAffiliateId,
      shopeeCookieUrl: sysShopeeCookieUrl,
      lazadaAffiliateId: sysLazadaAffiliateId,
      lazadaCookieUrl: sysLazadaCookieUrl,
      tiktokAffiliateId: sysTiktokAffiliateId,
      tiktokCookieUrl: sysTiktokCookieUrl,
      tikiAffiliateId: sysTikiAffiliateId,
      tikiCookieUrl: sysTikiCookieUrl,
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
      setEditUserBalance(String(user.balance || 0));
      setEditUserPassword('');
    } else {
      setEditUserName('');
      setEditUserEmail('');
      setEditUserRole('user');
      setEditUserBank('');
      setEditUserAccount('');
      setEditUserHolder('');
      setEditUserPhone('');
      setEditUserBalance('0');
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
        phone: editUserPhone,
        balance: parseFloat(editUserBalance) || 0
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
      const hasData = adminStats.monthlyAnalytics.some(a => a.revenue > 0 || a.cashback > 0 || a.profit > 0);
      if (hasData) {
        return adminStats.monthlyAnalytics.map(a => ({
          month: a.name,
          DoanhThu: a.revenue,
          HoaHongChi: a.cashback,
          LoiNhuan: a.profit
        }));
      }
    }

    const monthlyMap: Record<string, { month: string; DoanhThu: number; HoaHongChi: number; LoiNhuan: number }> = {};
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

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

    const extractMonthKey = (val: string) => {
      if (!val) return '';
      const str = String(val).trim();
      const matchIso = str.match(/^(\d{4})[\/\-](\d{1,2})/);
      if (matchIso) return `${matchIso[1]}-${String(matchIso[2]).padStart(2, '0')}`;
      const matchVn = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
      if (matchVn) return `${matchVn[3]}-${String(matchVn[2]).padStart(2, '0')}`;
      const num = Number(str);
      if (!isNaN(num) && num > 20000 && num < 100000) {
        const d = new Date((num - 25569) * 86400 * 1000);
        if (!isNaN(d.getTime())) return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      }
      return '';
    };

    orders.forEach(o => {
      const cb = o.realCashback !== undefined && o.realCashback !== null ? o.realCashback : (o.estimatedCashback || 0);
      const comm = (o as any).shopeeCommission || (cb * 2);
      const mKey = extractMonthKey(o.createdTime) || currentMonthKey;
      
      if (monthlyMap[mKey]) {
        monthlyMap[mKey].DoanhThu += comm;
        monthlyMap[mKey].HoaHongChi += cb;
        monthlyMap[mKey].LoiNhuan += Math.max(0, comm - cb);
      } else if (monthlyMap[currentMonthKey]) {
        monthlyMap[currentMonthKey].DoanhThu += comm;
        monthlyMap[currentMonthKey].HoaHongChi += cb;
        monthlyMap[currentMonthKey].LoiNhuan += Math.max(0, comm - cb);
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

              {/* TIME RANGE FILTER HEADER */}
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white p-4 rounded-input border border-border">
                <div>
                  <h2 className="text-xl font-black text-text">Báo cáo & Thống kê tổng quan</h2>
                  <p className="text-xs text-text-secondary mt-0.5">Theo dõi hiệu suất doanh thu, hoa hồng và các chỉ số hoạt động hệ thống.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-text-secondary">Khoảng thời gian:</span>
                  <select
                    value={statsRange}
                    onChange={(e) => setStatsRange(e.target.value as any)}
                    className="bg-bg border border-border text-xs rounded-input py-2 px-3 font-semibold outline-none focus:border-primary"
                  >
                    <option value="all">Tất cả thời gian</option>
                    <option value="today">Hôm nay</option>
                    <option value="7days">7 ngày qua</option>
                    <option value="30days">30 ngày qua</option>
                    <option value="this_month">Tháng này</option>
                  </select>
                </div>
              </div>

              {/* TOP WIDGETS CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                  { title: "Tổng thành viên", value: totalUsersCount, desc: "Tài khoản người dùng", color: "text-text", icon: <Users className="h-5 w-5 text-text-secondary" />, tab: 'users' },
                  { title: "Tổng đơn hàng", value: totalOrdersCount, desc: "Phát sinh trên hệ thống", color: "text-text", icon: <ShoppingBag className="h-5 w-5 text-text-secondary" />, tab: 'orders' },
                  { title: "Tổng hoa hồng sàn (100%)", value: `${(adminStats?.summary?.platformTotalRevenue || 0).toLocaleString('vi-VN')}đ`, desc: "Tổng hoa hồng nhận từ sàn", color: "text-blue-600", icon: <Activity className="h-5 w-5 text-blue-600" /> },
                  { title: "Số tiền còn lại (Lợi nhuận)", value: `${Math.round(adminStats?.summary?.remainingAfterPayout !== undefined ? adminStats.summary.remainingAfterPayout : Math.max(0, (adminStats?.summary?.platformTotalRevenue || 0) - (totalCashbackPaid || 0))).toLocaleString('vi-VN')}đ`, desc: "Sau khi trừ số tiền đã chi trả cho khách", color: "text-success", icon: <ShieldCheck className="h-5 w-5 text-success" /> },
                  { title: "Tiền đã & chờ chi", value: `${(totalCashbackPaid).toLocaleString('vi-VN')}đ`, desc: `Chờ duyệt: ${(adminStats?.summary?.pendingWithdrawalsTotal || 0).toLocaleString('vi-VN')}đ`, color: "text-warning", icon: <Wallet className="h-5 w-5 text-warning" />, tab: 'withdrawals' }
                ].map((card, idx) => (
                  <Card 
                    key={idx} 
                    onClick={() => card.tab && setActiveTab(card.tab as any)}
                    className={`border-border/50 relative overflow-hidden transition-all ${card.tab ? 'cursor-pointer hover:border-primary/50 hover:shadow-md' : ''}`}
                  >
                    <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between">
                      <CardDescription className="font-bold text-text-secondary uppercase tracking-wider text-[9px]">{card.title}</CardDescription>
                      {card.icon}
                    </CardHeader>
                    <CardContent className="p-4 pt-1">
                      <p className="text-xl font-black text-text mb-0.5">{card.value}</p>
                      <p className="text-[10px] text-text-secondary font-medium">{card.desc}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* GRAPHS AND CHARTS */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 border-border/50">
                  <CardHeader>
                    <CardTitle className="text-base">Biểu đồ Hoa hồng & Lợi nhuận Admin</CardTitle>
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
                        <Area type="monotone" dataKey="DoanhThu" name="Tổng hoa hồng sàn" stroke="#3B82F6" fillOpacity={1} fill="url(#colorDoanhThu)" strokeWidth={2.5} />
                        <Area type="monotone" dataKey="LoiNhuan" name="Hoa hồng giữ lại (Lợi nhuận)" stroke="#22C55E" fillOpacity={1} fill="url(#colorLoiNhuan)" strokeWidth={2.5} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="border-border/50 flex flex-col justify-between">
                  <CardHeader>
                    <CardTitle className="text-base">Tỷ lệ trạng thái đơn</CardTitle>
                    <CardDescription>Thống kê số lượng đơn hàng theo từng trạng thái</CardDescription>
                  </CardHeader>
                  <CardContent className="h-60 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[
                        { name: 'Chờ đối soát', value: pendingOrdersCount, fill: '#3B82F6' },
                        { name: 'Đã duyệt', value: approvedOrdersCount, fill: '#22C55E' },
                        { name: 'Đã thanh toán', value: cashbackPaidCount, fill: '#F59E0B' },
                        { name: 'Hủy/Hoàn', value: rejectedOrdersCount, fill: '#EF4444' }
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

              {/* DAILY ANALYTICS & MONTHLY SELECTION SECTION */}
              <div className="flex flex-col gap-6">
                <Card className="border-border/50">
                  <CardHeader className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Activity className="h-4.5 w-4.5 text-primary" />
                        Báo cáo Doanh thu & Lợi nhuận Chi tiết Theo Ngày trong Tháng
                      </CardTitle>
                      <CardDescription>
                        Theo dõi biến động chi tiết từng ngày trong tháng được chọn (từ ngày 01 đến cuối tháng)
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <span className="text-xs font-bold text-text-secondary whitespace-nowrap">Chọn tháng xem báo cáo:</span>
                      <select
                        value={selectedMonthFilter || adminStats?.selectedMonth || ''}
                        onChange={(e) => setSelectedMonthFilter(e.target.value)}
                        className="bg-white border border-border text-xs rounded-input py-2 px-3 font-bold text-primary outline-none focus:ring-2 focus:ring-primary/10 cursor-pointer shadow-sm"
                      >
                        {(adminStats?.availableMonths || []).map((m: any) => (
                          <option key={m.key} value={m.key}>{m.label}</option>
                        ))}
                      </select>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Daily Area Chart */}
                    <div className="h-72 pl-0 border border-border/40 rounded-input p-2 bg-bg/30">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={(adminStats?.dailyAnalytics || []).map((d: any) => ({
                            date: d.dayLabel,
                            DoanhThu: d.revenue,
                            HoanTien: d.cashback,
                            LoiNhuan: d.profit,
                            DonHang: d.orderCount
                          }))}
                          margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="colorDailyRevenue" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorDailyProfit" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="date" stroke="#6B7280" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis stroke="#6B7280" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val} />
                          <Tooltip
                            formatter={(val: any, name: any) => [
                              name === 'Số đơn hàng' ? `${val} đơn` : `${Number(val).toLocaleString('vi-VN')}đ`,
                              name
                            ]}
                            contentStyle={{ borderRadius: 12, border: '1px solid #ECECEC', fontSize: '12px' }}
                          />
                          <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 11, fontWeight: 'bold' }} />
                          <Area type="monotone" dataKey="DoanhThu" name="Hoa hồng Shopee (100%)" stroke="#3B82F6" fillOpacity={1} fill="url(#colorDailyRevenue)" strokeWidth={2} />
                          <Area type="monotone" dataKey="LoiNhuan" name="Lợi nhuận Admin" stroke="#22C55E" fillOpacity={1} fill="url(#colorDailyProfit)" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Daily Detail Data Table */}
                    <div className="border border-border/50 rounded-input overflow-hidden shadow-sm">
                      <div className="bg-bg/80 px-4 py-2.5 border-b border-border text-xs font-bold text-text flex justify-between items-center">
                        <span>Bảng Thống Kê Chi Tiết Từng Ngày ({adminStats?.selectedMonth ? `Tháng ${adminStats.selectedMonth.substring(5)}/${adminStats.selectedMonth.substring(0, 4)}` : ''})</span>
                        <span className="text-text-secondary text-[11px]">Tổng số: {(adminStats?.dailyAnalytics || []).length} ngày</span>
                      </div>
                      <div className="max-h-[300px] overflow-y-auto">
                        <TableContainer>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Ngày</TableHead>
                              <TableHead className="text-center">Số Đơn Hàng</TableHead>
                              <TableHead className="text-right">Hoa Hồng Shopee (100%)</TableHead>
                              <TableHead className="text-right">Hoàn Tiền Khách</TableHead>
                              <TableHead className="text-right">Lợi Nhuận Giữ Lại</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {adminStats?.dailyAnalytics && adminStats.dailyAnalytics.length > 0 ? (
                              adminStats.dailyAnalytics.map((dayItem: any) => (
                                <TableRow key={dayItem.date} className={dayItem.orderCount > 0 ? 'bg-blue-50/20 font-semibold' : ''}>
                                  <TableCell className="font-bold text-text text-xs">{dayItem.dayLabel}</TableCell>
                                  <TableCell className="text-center font-bold text-xs">
                                    {dayItem.orderCount > 0 ? (
                                      <Badge variant="info">{dayItem.orderCount} đơn</Badge>
                                    ) : (
                                      <span className="text-text-secondary font-normal">0</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right font-bold text-xs text-blue-600">
                                    {Math.round(dayItem.revenue).toLocaleString('vi-VN')}đ
                                  </TableCell>
                                  <TableCell className="text-right font-bold text-xs text-primary">
                                    {Math.round(dayItem.cashback).toLocaleString('vi-VN')}đ
                                  </TableCell>
                                  <TableCell className="text-right font-bold text-xs text-success">
                                    {Math.round(dayItem.profit).toLocaleString('vi-VN')}đ
                                  </TableCell>
                                </TableRow>
                              ))
                            ) : (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center py-6 text-xs text-text-secondary">
                                  Không có dữ liệu cho tháng được chọn
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </TableContainer>
                      </div>

                      {/* Summary Row */}
                      {adminStats?.dailyAnalytics && adminStats.dailyAnalytics.length > 0 && (
                        <div className="bg-bg/90 p-3 border-t border-border flex flex-wrap justify-between items-center text-xs font-black text-text gap-2">
                          <span>Tổng cộng trong tháng:</span>
                          <div className="flex gap-4">
                            <span>Đơn hàng: <span className="text-primary font-mono">{adminStats.dailyAnalytics.reduce((acc: number, d: any) => acc + (d.orderCount || 0), 0)}</span></span>
                            <span>Hoa hồng sàn: <span className="text-blue-600 font-mono">{Math.round(adminStats.dailyAnalytics.reduce((acc: number, d: any) => acc + (d.revenue || 0), 0)).toLocaleString('vi-VN')}đ</span></span>
                            <span>Hoàn tiền khách: <span className="text-primary font-mono">{Math.round(adminStats.dailyAnalytics.reduce((acc: number, d: any) => acc + (d.cashback || 0), 0)).toLocaleString('vi-VN')}đ</span></span>
                            <span>Lợi nhuận Admin: <span className="text-success font-mono">{Math.round(adminStats.dailyAnalytics.reduce((acc: number, d: any) => acc + (d.profit || 0), 0)).toLocaleString('vi-VN')}đ</span></span>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* LEADERBOARDS & TOP PERFORMERS SECTION */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* TOP 5 USERS */}
                <Card className="border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-4.5 w-4.5 text-primary" /> Top 5 Thành Viên Hoa Hồng Cao Nhất
                    </CardTitle>
                    <CardDescription>Xếp hạng người dùng tích lũy tiền hoàn trả nhiều nhất</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {adminStats?.topUsers && adminStats.topUsers.length > 0 ? (
                      <TableContainer>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Thành Viên</TableHead>
                            <TableHead className="text-center">Số Đơn Hoàn Thành</TableHead>
                            <TableHead className="text-right">Tổng Tiền Nhận</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {adminStats.topUsers.map((u, i) => (
                            <TableRow key={u.userId}>
                              <TableCell className="font-semibold text-xs flex items-center gap-2">
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-200 text-slate-700' : i === 2 ? 'bg-amber-700/10 text-amber-800' : 'bg-bg text-text-secondary'}`}>
                                  {i + 1}
                                </span>
                                <div>
                                  <p className="font-bold text-text">{u.userName}</p>
                                  <span className="text-[10px] text-text-secondary font-mono">{u.userId}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center font-bold text-xs">{u.orderCount} đơn</TableCell>
                              <TableCell className="text-right font-black text-xs text-primary">{Math.round(u.earnings).toLocaleString('vi-VN')}đ</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </TableContainer>
                    ) : (
                      <div className="p-6 text-center text-xs text-text-secondary">Chưa có dữ liệu thành viên tích lũy hoa hồng</div>
                    )}
                  </CardContent>
                </Card>

                {/* TOP 5 PRODUCTS */}
                <Card className="border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ShoppingBag className="h-4.5 w-4.5 text-success" /> Top Sản Phẩm Bán Chạy Nhất
                    </CardTitle>
                    <CardDescription>Danh mục sản phẩm được mua nhiều nhất trên sàn</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {adminStats?.topProducts && adminStats.topProducts.length > 0 ? (
                      <TableContainer>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Tên Sản Phẩm</TableHead>
                            <TableHead className="text-center">Số Đơn Mua</TableHead>
                            <TableHead className="text-right">Tổng Giá Trị Đơn</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {adminStats.topProducts.map((p, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-semibold text-xs max-w-[200px] truncate">
                                <span title={p.name}>{p.name}</span>
                              </TableCell>
                              <TableCell className="text-center font-bold text-xs">{p.count} lượt</TableCell>
                              <TableCell className="text-right font-bold text-xs text-text">{Math.round(p.totalAmount).toLocaleString('vi-VN')}đ</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </TableContainer>
                    ) : (
                      <div className="p-6 text-center text-xs text-text-secondary">Chưa có dữ liệu sản phẩm phát sinh đơn hàng</div>
                    )}
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
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => openUserOrdersModal(u)}
                                className="p-1.5 rounded-full hover:bg-blue-50 text-blue-600 hover:text-blue-700 transition-colors"
                                title="Xem danh sách đơn hàng của người này"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
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
                    accept=".csv,.xlsx,.xls"
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
                      exportOrdersCSV();
                      toast.success('Đã tải xuống file báo cáo đơn hàng CSV!');
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
                    <option value="unassigned">⚠️ Đơn chưa xác định (chưa gán User)</option>
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
                        <TableHead className="text-right">Hoa Hồng Shopee (100%)</TableHead>
                        <TableHead className="text-right">Hoàn Tiền Khách</TableHead>
                        <TableHead>Ngày Đặt</TableHead>
                        <TableHead>Trạng Thái</TableHead>
                        <TableHead className="text-center">Thao Tác</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingOrders ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-16 text-xs text-text-secondary font-medium">
                            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                            Đang tải danh sách đơn hàng...
                          </TableCell>
                        </TableRow>
                      ) : paginatedOrders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-16 text-xs text-text-secondary font-medium">
                            Chưa có đơn hàng nào phát sinh hoặc không tìm thấy đơn hàng phù hợp với từ khóa tìm kiếm.
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedOrders.map((o) => {
                          const userCashback = o.realCashback !== undefined ? o.realCashback : o.estimatedCashback;
                          const shopeeComm = o.shopeeCommission !== undefined && o.shopeeCommission !== null ? o.shopeeCommission : userCashback * 2;
                          return (
                            <TableRow key={o.id}>
                              <TableCell className="font-bold text-primary">{o.id}</TableCell>
                              <TableCell className="font-semibold text-xs text-text-secondary">
                                {o.userId ? (
                                  <div className="flex flex-col">
                                    <span className="font-bold text-text">{o.userName || o.userId}</span>
                                    {o.userName && <span className="text-[10px] text-text-secondary font-mono">{o.userId} {o.userEmail ? `(${o.userEmail})` : ''}</span>}
                                  </div>
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
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => setSelectedOrderDetail(o)}
                                    className="px-2.5 py-1.5 text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 rounded-button transition-all flex items-center justify-center gap-1"
                                    title="Xem minh chứng & Chi tiết"
                                  >
                                    <Activity className="h-3.5 w-3.5" />
                                    Minh chứng
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingOrder(o);
                                      setEditOrderStatus(o.status);
                                      setEditOrderRealCashback(o.realCashback !== undefined ? o.realCashback.toString() : o.estimatedCashback.toString());
                                      setEditOrderNotes(o.notes || '');
                                      setEditOrderUserId(o.userId || '');
                                    }}
                                    className="px-2.5 py-1.5 text-xs font-bold border border-border text-text hover:bg-bg/50 rounded-button transition-all flex items-center justify-center gap-1"
                                    title="Chỉnh sửa đơn hàng"
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                    Sửa
                                  </button>
                                  <button
                                    onClick={() => setDeletingOrder(o)}
                                    className="px-2.5 py-1.5 text-xs font-bold border border-red-200 text-danger hover:bg-red-50 rounded-button transition-all flex items-center justify-center gap-1"
                                    title="Xóa đơn hàng khỏi CSDL"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Xóa
                                  </button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
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
                                      setRejectingWithdrawalId(w.id);
                                      setWithdrawalRejectNotes('');
                                    }}
                                    className="p-1 bg-danger/10 text-danger hover:bg-danger hover:text-white rounded-button transition-all"
                                    title="Từ chối lệnh rút tiền"
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
                        <label className="text-xs font-bold text-text/80">% Hoa hồng tiếp thị tiêu chuẩn (%)</label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={sysCommissionPercentage}
                          onChange={(e) => setSysCommissionPercentage(Number(e.target.value))}
                          className="w-full px-4 py-3 bg-white border border-border text-sm rounded-input outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-semibold"
                          required
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-text/80">% Tiền hoàn trả cho thành viên (%)</label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={sysCashbackPercentage}
                          onChange={(e) => setSysCashbackPercentage(Number(e.target.value))}
                          className="w-full px-4 py-3 bg-white border border-border text-sm rounded-input outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-semibold text-primary font-bold"
                          required
                        />
                        <p className="text-[10px] text-text-secondary">Ví dụ: 50% có nghĩa là hệ thống chia 50% tiền hoa hồng nhận được cho khách hàng.</p>
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

                      <div className="sm:col-span-2 pt-4 border-t border-border/40">
                        <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-3">🟠 Tiếp thị liên kết Shopee</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-text/80">Shopee Affiliate ID</label>
                            <input
                              type="text"
                              value={sysShopeeAffiliateId}
                              onChange={(e) => setSysShopeeAffiliateId(e.target.value)}
                              className="w-full px-4 py-3 bg-white border border-border text-sm rounded-input outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-semibold font-mono"
                              placeholder="173401900099"
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-text/80">Link Cookie 7 ngày (Deeplink Shopee)</label>
                            <input
                              type="text"
                              value={sysShopeeCookieUrl}
                              onChange={(e) => setSysShopeeCookieUrl(e.target.value)}
                              placeholder="https://s.shopee.vn/an_redir"
                              className="w-full px-4 py-3 bg-white border border-border text-sm rounded-input outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-semibold font-mono"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="sm:col-span-2 pt-4 border-t border-border/40">
                        <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3">🟦 Tiếp thị liên kết Lazada</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-text/80">Lazada Affiliate ID</label>
                            <input
                              type="text"
                              value={sysLazadaAffiliateId}
                              onChange={(e) => setSysLazadaAffiliateId(e.target.value)}
                              className="w-full px-4 py-3 bg-white border border-border text-sm rounded-input outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-semibold font-mono"
                              placeholder="Nhập mã LazAffiliate..."
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-text/80">Link Cookie / Deeplink Lazada</label>
                            <input
                              type="text"
                              value={sysLazadaCookieUrl}
                              onChange={(e) => setSysLazadaCookieUrl(e.target.value)}
                              placeholder="https://s.lazada.vn/s.an_redir"
                              className="w-full px-4 py-3 bg-white border border-border text-sm rounded-input outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-semibold font-mono"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="sm:col-span-2 pt-4 border-t border-border/40">
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">🎵 Tiếp thị liên kết TikTok Shop</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-text/80">TikTok Shop Affiliate ID</label>
                            <input
                              type="text"
                              value={sysTiktokAffiliateId}
                              onChange={(e) => setSysTiktokAffiliateId(e.target.value)}
                              className="w-full px-4 py-3 bg-white border border-border text-sm rounded-input outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-semibold font-mono"
                              placeholder="Nhập mã TikTok Affiliate..."
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-text/80">Link Cookie / Deeplink TikTok Shop</label>
                            <input
                              type="text"
                              value={sysTiktokCookieUrl}
                              onChange={(e) => setSysTiktokCookieUrl(e.target.value)}
                              placeholder="https://vt.tiktok.com/an_redir"
                              className="w-full px-4 py-3 bg-white border border-border text-sm rounded-input outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-semibold font-mono"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="sm:col-span-2 pt-4 border-t border-border/40">
                        <h3 className="text-xs font-bold text-sky-500 uppercase tracking-wider mb-3">🌐 Tiếp thị liên kết Tiki</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-text/80">Tiki Affiliate ID</label>
                            <input
                              type="text"
                              value={sysTikiAffiliateId}
                              onChange={(e) => setSysTikiAffiliateId(e.target.value)}
                              className="w-full px-4 py-3 bg-white border border-border text-sm rounded-input outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-semibold font-mono"
                              placeholder="Nhập mã Tiki Affiliate..."
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-text/80">Link Cookie / Deeplink Tiki</label>
                            <input
                              type="text"
                              value={sysTikiCookieUrl}
                              onChange={(e) => setSysTikiCookieUrl(e.target.value)}
                              placeholder="https://tiki.vn/an_redir"
                              className="w-full px-4 py-3 bg-white border border-border text-sm rounded-input outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-semibold font-mono"
                            />
                          </div>
                        </div>
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
                <Input
                  label="Số dư khả dụng hiện tại (₫)"
                  type="number"
                  value={editUserBalance}
                  onChange={(e) => setEditUserBalance(e.target.value)}
                  placeholder="0"
                />
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
              <p><span className="text-text-secondary">Thành viên hiện tại:</span> <span className="text-text font-bold font-mono">{editingOrder?.userId || <span className="text-warning font-semibold italic">(Chưa xác định thành viên)</span>}</span></p>
              <p><span className="text-text-secondary">Giá trị đơn:</span> <span className="text-text font-bold">{editingOrder?.orderAmount.toLocaleString('vi-VN')}đ</span></p>
              <p><span className="text-text-secondary">Hoa hồng Shopee ước tính:</span> <span className="text-text font-bold">{editingOrder?.estimatedCashback.toLocaleString('vi-VN')}đ</span></p>
              {editingOrder?.createdTime && (
                <p><span className="text-text-secondary">Thời gian đặt hàng:</span> <span className="text-text font-bold">{editingOrder.createdTime}</span></p>
              )}
            </div>

            <div className="flex flex-col gap-1.5 relative">
              <label className="text-xs font-semibold text-text/80">
                Gán cho thành viên (Nhập mã User ID hoặc Email)
              </label>
              <input
                type="text"
                value={editOrderUserId}
                onChange={(e) => setEditOrderUserId(e.target.value)}
                placeholder="Gõ hoặc dán Mã User ID (vd: USR101, USR102) hoặc Email/Tên..."
                className="w-full px-4 py-3 bg-white border border-border text-sm rounded-input outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-semibold font-mono"
              />

              {/* Dynamic Suggestions List as Admin types */}
              {users && users.length > 0 && editOrderUserId.trim().length > 0 && (
                <div className="bg-white border border-border rounded-input shadow-lg max-h-[160px] overflow-y-auto p-1 text-xs space-y-1 z-10">
                  {users
                    .filter(u => 
                      u.id.toLowerCase().includes(editOrderUserId.toLowerCase()) ||
                      u.name.toLowerCase().includes(editOrderUserId.toLowerCase()) ||
                      (u.email && u.email.toLowerCase().includes(editOrderUserId.toLowerCase()))
                    )
                    .slice(0, 5)
                    .map((u) => (
                      <div
                        key={u.id}
                        onClick={() => setEditOrderUserId(u.id)}
                        className="px-3 py-2 hover:bg-primary/10 rounded cursor-pointer flex justify-between items-center transition-all"
                      >
                        <div>
                          <span className="font-bold text-text">{u.name}</span>
                          <span className="text-text-secondary text-[11px] ml-2">({u.email || 'No email'})</span>
                        </div>
                        <span className="font-mono text-primary font-bold bg-primary/10 px-2 py-0.5 rounded text-[11px]">
                          {u.id}
                        </span>
                      </div>
                    ))}
                </div>
              )}

              <p className="text-[11px] text-text-secondary font-medium">
                💡 <b>Mẹo:</b> Nhập trực tiếp mã <b>User ID</b> (vd: <code>USR101</code>) hoặc <b>Email</b>. Nhấp vào kết quả gợi ý bên dưới nếu cần.
              </p>
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

      {/* DELETE ORDER DIALOG */}
      <Dialog isOpen={deletingOrder !== null} onClose={() => setDeletingOrder(null)}>
        <DialogHeader>
          <DialogTitle>Xóa đơn hàng {deletingOrder?.id}</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <div className="flex flex-col gap-4 text-left font-sans">
            <p className="text-sm text-text">
              Bạn có chắc chắn muốn xóa vĩnh viễn đơn hàng <span className="font-bold text-danger">{deletingOrder?.id}</span> ({deletingOrder?.productName}) khỏi hệ thống?
            </p>
            <p className="text-xs text-text-secondary bg-red-50 border border-red-100 p-3 rounded-input font-medium">
              ⚠️ Hành động này sẽ xóa vĩnh viễn đơn hàng khỏi CSDL và không thể hoàn tác.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setDeletingOrder(null)} className="font-bold">Hủy bỏ</Button>
              <Button
                type="button"
                onClick={async () => {
                  if (deletingOrder) {
                    const success = await deleteOrderAdmin(deletingOrder.id);
                    if (success) {
                      toast.success(`Đã xóa đơn hàng ${deletingOrder.id} thành công!`);
                    } else {
                      toast.error('Xóa đơn hàng thất bại');
                    }
                    setDeletingOrder(null);
                  }
                }}
                className="font-bold bg-danger hover:bg-danger/90 text-white border-none"
              >
                Xóa đơn hàng
              </Button>
            </div>
          </div>
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
                  disabled={isApplyingReconcile}
                  className="font-bold bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {isApplyingReconcile ? (
                    <span className="flex items-center gap-1.5">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Đang áp dụng...
                    </span>
                  ) : (
                    'Xác nhận áp dụng'
                  )}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* WITHDRAWAL REJECTION REASON DIALOG */}
      <Dialog isOpen={rejectingWithdrawalId !== null} onClose={() => setRejectingWithdrawalId(null)}>
        <DialogHeader>
          <DialogTitle>Từ chối lệnh rút tiền {rejectingWithdrawalId}</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <div className="flex flex-col gap-4 text-left">
            <p className="text-xs text-text-secondary">
              Vui lòng nhập lý do từ chối để thông báo cho người dùng (Ví dụ: "Số tài khoản không chính xác", "Tên chủ tài khoản không trùng khớp"):
            </p>
            <textarea
              value={withdrawalRejectNotes}
              onChange={(e) => setWithdrawalRejectNotes(e.target.value)}
              placeholder="Nhập lý do từ chối..."
              className="w-full p-3 border border-border rounded-input text-xs outline-none focus:border-primary min-h-[90px]"
            />
            <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
              <Button type="button" variant="ghost" onClick={() => setRejectingWithdrawalId(null)} className="font-bold">Hủy bỏ</Button>
              <Button
                type="button"
                className="font-bold bg-danger text-white hover:bg-danger/90 border-none"
                onClick={async () => {
                  if (rejectingWithdrawalId) {
                    await updateWithdrawalStatus(rejectingWithdrawalId, 'rejected');
                    toast.error(`Đã từ chối lệnh rút tiền ${rejectingWithdrawalId}`);
                    setRejectingWithdrawalId(null);
                    setWithdrawalRejectNotes('');
                  }
                }}
              >
                Xác nhận từ chối
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* USER ORDERS LIST POPUP MODAL */}
      <Dialog isOpen={viewingUserOrders !== null} onClose={() => setViewingUserOrders(null)} className="max-w-4xl">
        <DialogHeader>
          <div className="flex justify-between items-center pr-6">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-primary" />
                Danh sách đơn hàng: {viewingUserOrders?.name}
              </DialogTitle>
              <p className="text-xs text-text-secondary font-mono mt-0.5">
                Mã User ID: <span className="font-bold text-text">{viewingUserOrders?.id}</span> | Email: <span className="font-bold text-text">{viewingUserOrders?.email}</span>
              </p>
            </div>
            {viewingUserOrders && (
              <Badge variant={viewingUserOrders.role === 'admin' ? 'danger' : 'outline'} className="text-xs">
                {viewingUserOrders.role === 'admin' ? 'ADMIN' : 'THÀNH VIÊN'}
              </Badge>
            )}
          </div>
        </DialogHeader>
        <DialogContent className="flex flex-col gap-4 text-left font-sans">
          {/* Quick Summary Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-bg p-3.5 rounded-input border border-border/50 text-xs font-semibold">
            <div>
              <span className="text-text-secondary">Tổng số đơn hàng:</span>{' '}
              <span className="text-text font-bold">{userOrdersList.length} đơn</span>
            </div>
            <div>
              <span className="text-text-secondary">Tổng giá trị mua hàng:</span>{' '}
              <span className="text-blue-600 font-bold">
                {userOrdersList.reduce((acc, o) => acc + (o.orderAmount || 0), 0).toLocaleString('vi-VN')}đ
              </span>
            </div>
            <div>
              <span className="text-text-secondary">Tổng tiền hoàn tích lũy:</span>{' '}
              <span className="text-primary font-bold">
                {userOrdersList
                  .filter(o => o.status === 'approved' || o.status === 'paid')
                  .reduce((acc, o) => acc + (o.realCashback || o.estimatedCashback || 0), 0)
                  .toLocaleString('vi-VN')}đ
              </span>
            </div>
          </div>

          {/* Orders Table */}
          <div className="max-h-[380px] overflow-y-auto border border-border rounded-input">
            <TableContainer>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã Đơn</TableHead>
                  <TableHead>Sản Phẩm</TableHead>
                  <TableHead className="text-right">Giá Trị</TableHead>
                  <TableHead className="text-right">Hoàn Tiền Khách</TableHead>
                  <TableHead>Ngày Đặt</TableHead>
                  <TableHead>Trạng Thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingUserOrders ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-xs text-text-secondary">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                      Đang tải danh sách đơn hàng của thành viên...
                    </TableCell>
                  </TableRow>
                ) : userOrdersList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-xs text-text-secondary font-medium">
                      Thành viên này chưa có đơn hàng nào phát sinh trên hệ thống.
                    </TableCell>
                  </TableRow>
                ) : (
                  userOrdersList.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-bold text-primary text-xs font-mono">{o.id}</TableCell>
                      <TableCell className="max-w-[200px] truncate font-semibold text-xs">
                        <span title={o.productName}>{o.productName}</span>
                      </TableCell>
                      <TableCell className="text-right font-bold text-xs">
                        {Math.round(o.orderAmount || 0).toLocaleString('vi-VN')}đ
                      </TableCell>
                      <TableCell className="text-right font-bold text-xs text-primary">
                        {Math.round(o.realCashback || o.estimatedCashback || 0).toLocaleString('vi-VN')}đ
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-text-secondary whitespace-nowrap">
                        {o.createdTime ? o.createdTime.substring(0, 16) : '-'}
                      </TableCell>
                      <TableCell>
                        {o.status === 'pending' && <Badge variant="info">Đang chờ xử lý</Badge>}
                        {o.status === 'approved' && <Badge variant="success">Hoàn thành</Badge>}
                        {o.status === 'rejected' && <Badge variant="danger">Hủy</Badge>}
                        {o.status === 'returned' && <Badge variant="warning" className="bg-orange-50 text-orange-600 border-orange-200">Hoàn hàng</Badge>}
                        {o.status === 'paid' && <Badge variant="warning">Đã thanh toán</Badge>}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </TableContainer>
          </div>

          <div className="flex justify-end pt-3 border-t border-border/40">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setViewingUserOrders(null)}
              className="font-bold"
            >
              Đóng cửa sổ
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
