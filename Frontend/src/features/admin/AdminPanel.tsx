import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, Users, ShoppingBag, Wallet,
  LogOut, RefreshCw, Plus, Search,
  Filter, Check, X, Lock, Unlock, Trash2, Edit2, Download,
  Upload, BarChart3, FileSpreadsheet, HelpCircle,
  Settings2, Activity, Eye, EyeOff, Key, ExternalLink
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

export default function AdminPanel() {
  const navigate = useNavigate();
  const {
    currentUser, isAuthLoading, logout, orders, totalAdminOrders, withdrawals, users, settings,
    updateOrderStatus, deleteOrderAdmin, updateWithdrawalStatus, updateSettings,
    reconciliationHistory, uploadReconciliationCSV, applyReconciliationCSV,
    updateAdminUser, adminStats, fetchAdminOrders, fetchAdminStats, fetchAdminWithdrawals, fetchAdminUsers, fetchReconciliationLogs, exportOrdersCSV,
    createAdminUser, deleteAdminUser, resetUserPassword, toggleUserStatus, syncAdminUserBalances, createAdminOrder,
    tiktokOrders, totalAdminTikTokOrders, tiktokStats, fetchAdminTikTokOrders, updateTikTokOrderStatus,
    createAdminTikTokOrder, deleteTikTokOrderAdmin, syncTikTokOrdersAdmin, fetchRiohubLiveOrders, clearAllTikTokOrdersAdmin
  } = useAppStore();

  const [isSyncingBalances, setIsSyncingBalances] = useState(false);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'orders' | 'tiktok-orders' | 'tiktok-clicks' | 'withdrawals' | 'reconciliation' | 'settings'>('dashboard');

  // TikTok Clicks (click_logs) States
  const [tiktokClicks, setTiktokClicks] = useState<any[]>([]);
  const [tiktokClicksTotal, setTiktokClicksTotal] = useState(0);
  const [tiktokClicksStats, setTiktokClicksStats] = useState({ totalClicks: 0, convertedClicks: 0, anonymousClicks: 0 });
  const [tiktokClickSearch, setTiktokClickSearch] = useState('');
  const [tiktokClickConverted, setTiktokClickConverted] = useState('all');
  const [tiktokClickPage, setTiktokClickPage] = useState(1);
  const [isLoadingTikTokClicks, setIsLoadingTikTokClicks] = useState(false);
  const tiktokClicksPerPage = 10;

  React.useEffect(() => {
    setTiktokClickPage(1);
  }, [tiktokClickSearch, tiktokClickConverted]);

  React.useEffect(() => {
    if (currentUser?.role !== 'admin' || activeTab !== 'tiktok-clicks') return;
    setIsLoadingTikTokClicks(true);
    const delay = setTimeout(async () => {
      try {
        const apiBase = import.meta.env.VITE_API_BASE || '/api';
        const token = localStorage.getItem('token');
        const qs = new URLSearchParams({
          page: String(tiktokClickPage),
          limit: String(tiktokClicksPerPage),
          search: tiktokClickSearch,
          converted: tiktokClickConverted
        });
        const res = await fetch(`${apiBase}/tiktok/admin/clicks?${qs.toString()}`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        const data = await res.json();
        if (res.ok) {
          setTiktokClicks(data.clicks || []);
          setTiktokClicksTotal(data.total || 0);
          if (data.stats) setTiktokClicksStats(data.stats);
        } else {
          toast.error(data.message || 'Lỗi tải danh sách click TikTok');
        }
      } catch {
        toast.error('Lỗi kết nối khi tải click TikTok');
      } finally {
        setIsLoadingTikTokClicks(false);
      }
    }, 300);
    return () => clearTimeout(delay);
  }, [activeTab, tiktokClickPage, tiktokClickSearch, tiktokClickConverted, currentUser]);

  // Search & Filter States
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [statsRange, setStatsRange] = useState<'all' | 'today' | '7days' | '30days' | 'this_month'>('all');
  const [statsPlatform, setStatsPlatform] = useState<'all' | 'shopee' | 'tiktok'>('all');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('');

  // Order Pagination & Loading states
  const [isInitialAdminLoading, setIsInitialAdminLoading] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [orderPage, setOrderPage] = useState(1);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const ordersPerPage = 10;
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // TikTok Orders States
  const [tiktokSearch, setTiktokSearch] = useState('');
  const [tiktokStatusFilter, setTiktokStatusFilter] = useState('all');
  const [tiktokPage, setTiktokPage] = useState(1);
  const [isLoadingTikTokOrders, setIsLoadingTikTokOrders] = useState(false);
  const [editingTikTokOrder, setEditingTikTokOrder] = useState<Order | null>(null);
  const [editTikTokStatus, setEditTikTokStatus] = useState<Order['status']>('pending');
  const [editTikTokRealCashback, setEditTikTokRealCashback] = useState('');
  const [editTikTokNotes, setEditTikTokNotes] = useState('');
  const [editTikTokUserId, setEditTikTokUserId] = useState('');
  const [deletingTikTokOrder, setDeletingTikTokOrder] = useState<Order | null>(null);
  const [isCreateTikTokModalOpen, setIsCreateTikTokModalOpen] = useState(false);
  const [isSubmittingTikTokOrder, setIsSubmittingTikTokOrder] = useState(false);
  const [newTikTokForm, setNewTikTokForm] = useState({
    id: '',
    userId: '',
    productName: '',
    productImage: '',
    orderAmount: '',
    estimatedCashback: '',
    realCashback: '',
    tiktokCommission: '',
    status: 'pending' as Order['status'],
    notes: ''
  });
  const [isClearTikTokModalOpen, setIsClearTikTokModalOpen] = useState(false);
  const [isClearUnassignedTikTokModalOpen, setIsClearUnassignedTikTokModalOpen] = useState(false);

  // RioHub Live Reconciliation States
  const [isRiohubReconcileModalOpen, setIsRiohubReconcileModalOpen] = useState(false);
  const [isQueryingRiohub, setIsQueryingRiohub] = useState(false);
  const [isReconcilingRiohub, setIsReconcilingRiohub] = useState(false);
  const [riohubFilters, setRiohubFilters] = useState({
    creator_username: '',
    order_id: '',
    time_start: '',
    time_end: '',
    update_time_start: '',
    update_time_end: '',
    status: '',
    settlement_status: '',
    content_type: '',
    page_size: '50'
  });
  const [riohubOrdersResult, setRiohubOrdersResult] = useState<{
    creator_username?: string;
    page?: number;
    page_size?: number;
    total?: number;
    orders: any[];
  } | null>(null);
  const [selectedRiohubOrderIds, setSelectedRiohubOrderIds] = useState<string[]>([]);

  React.useEffect(() => {
    setOrderPage(1);
  }, [orderSearch, orderStatusFilter]);

  React.useEffect(() => {
    setTiktokPage(1);
  }, [tiktokSearch, tiktokStatusFilter]);

  // Initial full load when entering /admin so numbers are 100% accurate before rendering
  React.useEffect(() => {
    if (isAuthLoading || currentUser?.role !== 'admin') return;
    let cancelled = false;

    const initAdminDashboard = async () => {
      setIsInitialAdminLoading(true);
      try {
        await Promise.all([
          fetchAdminStats(statsRange, selectedMonthFilter, statsPlatform),
          fetchAdminUsers(),
          fetchAdminWithdrawals(),
          fetchAdminOrders(1, ordersPerPage, '', 'all'),
          fetchAdminTikTokOrders(1, 10, '', 'all')
        ]);
      } finally {
        if (!cancelled) {
          setIsInitialAdminLoading(false);
        }
      }
    };

    initAdminDashboard();
    return () => {
      cancelled = true;
    };
  }, [isAuthLoading, currentUser?.id, currentUser?.role]);

  // Fetch paginated and filtered orders & active tab data from backend after initial load
  React.useEffect(() => {
    if (isInitialAdminLoading || currentUser?.role !== 'admin') return;

    if (activeTab === 'dashboard') {
      let cancelled = false;
      setIsLoadingStats(true);
      fetchAdminStats(statsRange, selectedMonthFilter, statsPlatform).finally(() => {
        if (!cancelled) setIsLoadingStats(false);
      });
      return () => { cancelled = true; };
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
    } else if (activeTab === 'tiktok-orders') {
      if (users.length === 0) fetchAdminUsers();
      setIsLoadingTikTokOrders(true);
      const delay = setTimeout(async () => {
        await fetchAdminTikTokOrders(tiktokPage, 10, tiktokSearch, tiktokStatusFilter);
        setIsLoadingTikTokOrders(false);
      }, 300);
      return () => clearTimeout(delay);
    } else if (activeTab === 'withdrawals') {
      fetchAdminWithdrawals();
    } else if (activeTab === 'reconciliation') {
      fetchReconciliationLogs();
    }
  }, [isInitialAdminLoading, activeTab, orderPage, orderSearch, orderStatusFilter, tiktokPage, tiktokSearch, tiktokStatusFilter, statsRange, selectedMonthFilter, statsPlatform, currentUser]);

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

  // Create Order states
  const [isCreateOrderModalOpen, setIsCreateOrderModalOpen] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [newOrderForm, setNewOrderForm] = useState({
    id: '',
    userId: '',
    productName: '',
    productImage: '',
    productUrl: '',
    orderAmount: '',
    shopeeCommission: '',
    realCashback: '',
    estimatedCashback: '',
    status: 'pending' as Order['status'],
    notes: '',
    shopId: '',
    itemId: ''
  });

  // Reconciliation & Clear Database states for Orders Tab
  const [reconcileModalData, setReconcileModalData] = useState<any>(null);
  const [isImportReconcileModalOpen, setIsImportReconcileModalOpen] = useState(false);
  const [isCSVHelpModalOpen, setIsCSVHelpModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isApplyingReconcile, setIsApplyingReconcile] = useState(false);
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
  const [isClearUnassignedModalOpen, setIsClearUnassignedModalOpen] = useState(false);
  const [isClearingOrders, setIsClearingOrders] = useState(false);

  const handleClearAllOrders = async () => {
    setIsClearingOrders(true);
    try {
      const token = localStorage.getItem('token');
      const apiBase = import.meta.env.VITE_API_BASE || '/api';
      const res = await fetch(`${apiBase}/orders/admin/clear-all`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || 'Đã xóa sạch toàn bộ dữ liệu đơn hàng và reset ví thành viên!');
        setIsClearAllModalOpen(false);
        fetchAdminOrders(1, ordersPerPage, orderSearch, orderStatusFilter);
        fetchAdminStats(statsRange, selectedMonthFilter);
      } else {
        const err = await res.json();
        toast.error(err.message || 'Có lỗi xảy ra khi xóa toàn bộ đơn hàng');
      }
    } catch {
      toast.error('Lỗi khi gửi yêu cầu xóa đơn hàng');
    } finally {
      setIsClearingOrders(false);
    }
  };

  const handleClearUnassignedOrders = async () => {
    setIsClearingOrders(true);
    try {
      const token = localStorage.getItem('token');
      const apiBase = import.meta.env.VITE_API_BASE || '/api';
      const res = await fetch(`${apiBase}/orders/admin/clear-all?type=unassigned`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || 'Đã xóa tất cả đơn hàng chưa xác định thành công!');
        setIsClearUnassignedModalOpen(false);
        fetchAdminOrders(1, ordersPerPage, orderSearch, orderStatusFilter);
        fetchAdminStats(statsRange, selectedMonthFilter);
      } else {
        const err = await res.json();
        toast.error(err.message || 'Có lỗi xảy ra khi xóa đơn hàng chưa gán');
      }
    } catch {
      toast.error('Lỗi khi gửi yêu cầu xóa đơn hàng chưa gán');
    } finally {
      setIsClearingOrders(false);
    }
  };

  const downloadSampleReconciliationCSV = () => {
    const csvContent =
      "ID đơn hàng,Sub_id1,Tên Item,Giá trị đơn hàng (₫),Hoa hồng ròng tiếp thị liên kết(₫),Trạng thái đặt hàng,Thời Gian Đặt Hàng,Thời gian Click,ID Shop,ID Item\n" +
      "240917SP88123,USR101,Áo thun Polo Nam Cotton Cao Cấp Shopee Mall,250000,25000,Hoàn thành,17/09/2026 14:30:00,17/09/2026 14:15:00,987654321,123456789\n" +
      "240917SP88124,USR102,Giày Sneaker Thể Thao Nam Nữ Unisex,450000,45000,Hoàn thành,17/09/2026 15:10:00,17/09/2026 14:50:00,987654321,987654321\n" +
      "240917SP88125,,Nước hoa nam Bleu De Chanel EDP 100ml,1200000,120000,Giao thành công,17/09/2026 16:00:00,17/09/2026 15:30:00,888777666,555444333\n";

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'shopee_reconciliation_sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Đã tải xuống file CSV đối soát mẫu thành công!');
  };

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
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };

      const [shopeeRes, tiktokRes] = await Promise.all([
        fetch(`${apiBase}/orders/admin?search=${encodeURIComponent(user.id)}&limit=100`, { headers }).catch(() => null),
        fetch(`${apiBase}/tiktok/admin/orders?search=${encodeURIComponent(user.id)}&limit=100`, { headers }).catch(() => null)
      ]);

      const combined: any[] = [];

      if (shopeeRes && shopeeRes.ok) {
        const sData = await shopeeRes.json();
        (sData.orders || []).forEach((o: any) => {
          combined.push({
            id: o.id,
            platform: 'shopee',
            productName: o.product_name,
            orderAmount: Number(o.order_amount) || 0,
            estimatedCashback: Number(o.estimated_cashback) || 0,
            realCashback: o.real_cashback !== null && o.real_cashback !== undefined ? Number(o.real_cashback) : Number(o.estimated_cashback || 0),
            status: o.status,
            createdTime: o.created_at
          });
        });
      }

      if (tiktokRes && tiktokRes.ok) {
        const tData = await tiktokRes.json();
        (tData.orders || []).forEach((o: any) => {
          combined.push({
            id: o.id,
            platform: 'tiktok',
            productName: o.product_name,
            orderAmount: Number(o.order_amount) || 0,
            estimatedCashback: Number(o.estimated_cashback) || 0,
            realCashback: o.real_cashback !== null && o.real_cashback !== undefined ? Number(o.real_cashback) : Number(o.estimated_cashback || 0),
            status: o.status,
            createdTime: o.created_at
          });
        });
      }

      combined.sort((a, b) => new Date(b.createdTime || 0).getTime() - new Date(a.createdTime || 0).getTime());
      setUserOrdersList(combined);
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
  const [sysAddlivetagApiKey, setSysAddlivetagApiKey] = useState(settings.addlivetagApiKey || "");
  const [showAddLiveKey, setShowAddLiveKey] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [sysLazadaAffiliateId, setSysLazadaAffiliateId] = useState(settings.lazadaAffiliateId || "");
  const [sysLazadaCookieUrl, setSysLazadaCookieUrl] = useState(settings.lazadaCookieUrl || "https://s.lazada.vn/s.an_redir");
  const [sysTiktokAffiliateId, setSysTiktokAffiliateId] = useState(settings.tiktokAffiliateId || "");
  const [sysTiktokCookieUrl, setSysTiktokCookieUrl] = useState(settings.tiktokCookieUrl || "https://vt.tiktok.com/an_redir");
  const [sysRiohubApiKey, setSysRiohubApiKey] = useState(settings.riohubApiKey || "");
  const [sysRiohubCreatorUsername, setSysRiohubCreatorUsername] = useState(settings.riohubCreatorUsername || "");
  const [sysRiohubWebhookSecret, setSysRiohubWebhookSecret] = useState(settings.riohubWebhookSecret || "");
  const [showRiohubKey, setShowRiohubKey] = useState(false);
  const [isSyncingTiktokOrders, setIsSyncingTiktokOrders] = useState(false);
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
      setSysAddlivetagApiKey(settings.addlivetagApiKey || "");
      setSysLazadaAffiliateId(settings.lazadaAffiliateId || "");
      setSysLazadaCookieUrl(settings.lazadaCookieUrl || "https://s.lazada.vn/s.an_redir");
      setSysTiktokAffiliateId(settings.tiktokAffiliateId || "");
      setSysTiktokCookieUrl(settings.tiktokCookieUrl || "https://vt.tiktok.com/an_redir");
      setSysRiohubApiKey(settings.riohubApiKey || "");
      setSysRiohubCreatorUsername(settings.riohubCreatorUsername || "");
      setSysRiohubWebhookSecret(settings.riohubWebhookSecret || "");
      setSysTeleNotify(settings.telegramNotification);
      setSysEmailNotify(settings.emailNotification);
      setSysMaintMode(settings.maintenanceMode);
    }
  }, [settings]);

  // Redirect if not admin
  React.useEffect(() => {
    if (isAuthLoading) return;

    if (!currentUser || currentUser.role !== 'admin') {
      toast.error('Bạn không có quyền truy cập khu vực Quản trị');
      navigate('/', { replace: true });
    }
  }, [currentUser, isAuthLoading, navigate]);

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
      const matchIso = str.match(/^(\d{4})[/-](\d{1,2})/);
      if (matchIso) return `${matchIso[1]}-${String(matchIso[2]).padStart(2, '0')}`;
      const matchVn = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
      if (matchVn) return `${matchVn[3]}-${String(matchVn[2]).padStart(2, '0')}`;
      const num = Number(str);
      if (!isNaN(num) && num > 20000 && num < 100000) {
        const d = new Date((num - 25569) * 86400 * 1000);
        if (!isNaN(d.getTime())) return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      }
      return '';
    };

    orders.forEach(o => {
      const cb = Math.floor(o.realCashback !== undefined && o.realCashback !== null ? o.realCashback : (o.estimatedCashback || 0));
      const comm = Math.floor((o as any).shopeeCommission !== undefined && (o as any).shopeeCommission !== null ? (o as any).shopeeCommission : (cb * 2));
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

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm font-bold text-text-secondary">Đang chuyển hướng về trang chủ...</p>
        </div>
      </div>
    );
  }

  if (isInitialAdminLoading || !adminStats) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm font-bold text-text-secondary">Đang tải dữ liệu thống kê hệ thống...</p>
        </div>
      </div>
    );
  }

  // Statistics calculation
  const totalUsersCount = adminStats?.summary?.totalUsers ?? users.length;
  const totalOrdersCount = adminStats?.summary?.totalOrders ?? 0;
  const pendingOrdersCount = adminStats?.statusDistribution?.find(s => s.name === 'Đang chờ xử lý')?.value || 0;
  const pendingShopeeOrdersCount = adminStats?.platformBreakdown?.shopee?.pendingCount ?? 0;
  const pendingTikTokOrdersCount = adminStats?.platformBreakdown?.tiktok?.pendingCount ?? tiktokOrders.filter(o => o.status === 'pending').length;
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
    } catch {
      toast.error('Lỗi khi cập nhật đơn hàng');
    }
  };

  const handleCreateOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrderForm.userId.trim()) {
      toast.error('Vui lòng chọn hoặc nhập User ID của thành viên sở hữu đơn hàng');
      return;
    }
    if (!newOrderForm.productName.trim()) {
      toast.error('Vui lòng nhập tên sản phẩm');
      return;
    }
    const orderAmountVal = parseFloat(newOrderForm.orderAmount);
    if (isNaN(orderAmountVal) || orderAmountVal < 0) {
      toast.error('Vui lòng nhập giá trị đơn hàng hợp lệ');
      return;
    }

    const shopeeCommVal = parseFloat(newOrderForm.shopeeCommission) || 0;
    const estCashbackVal = parseFloat(newOrderForm.estimatedCashback) || Math.floor(shopeeCommVal * ((settings?.cashbackPercentage ?? 50) / 100));
    const realCashbackVal = newOrderForm.realCashback ? parseFloat(newOrderForm.realCashback) : estCashbackVal;

    setIsSubmittingOrder(true);
    try {
      await createAdminOrder({
        id: newOrderForm.id.trim() || undefined,
        userId: newOrderForm.userId.trim(),
        productName: newOrderForm.productName.trim(),
        productImage: newOrderForm.productImage.trim() || undefined,
        productUrl: newOrderForm.productUrl.trim() || undefined,
        orderAmount: orderAmountVal,
        shopeeCommission: shopeeCommVal,
        estimatedCashback: estCashbackVal,
        realCashback: realCashbackVal,
        status: newOrderForm.status,
        notes: newOrderForm.notes.trim() || undefined,
        shopId: newOrderForm.shopId.trim() || undefined,
        itemId: newOrderForm.itemId.trim() || undefined
      });
      toast.success('Đã tạo đơn hàng mới thành công!');
      setIsCreateOrderModalOpen(false);
      setNewOrderForm({
        id: '',
        userId: '',
        productName: '',
        productImage: '',
        productUrl: '',
        orderAmount: '',
        shopeeCommission: '',
        realCashback: '',
        estimatedCashback: '',
        status: 'pending',
        notes: '',
        shopId: '',
        itemId: ''
      });
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi tạo đơn hàng mới');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const handleUpdateTikTokStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTikTokOrder) return;
    try {
      await updateTikTokOrderStatus(
        editingTikTokOrder.id,
        editTikTokStatus,
        editTikTokRealCashback ? Number(editTikTokRealCashback) : undefined,
        editTikTokNotes,
        editTikTokUserId
      );
      toast.success(`Đã cập nhật đơn hàng TikTok ${editingTikTokOrder.id} thành công!`);
      setEditingTikTokOrder(null);
    } catch {
      toast.error('Lỗi khi cập nhật đơn hàng TikTok');
    }
  };

  const handleCreateTikTokOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTikTokForm.productName.trim()) {
      toast.error('Vui lòng nhập tên sản phẩm TikTok');
      return;
    }
    const orderAmountVal = parseFloat(newTikTokForm.orderAmount);
    if (isNaN(orderAmountVal) || orderAmountVal < 0) {
      toast.error('Vui lòng nhập giá trị đơn hàng hợp lệ');
      return;
    }
    const commVal = parseFloat(newTikTokForm.tiktokCommission) || 0;
    const estCashbackVal = parseFloat(newTikTokForm.estimatedCashback) || Math.floor(commVal * ((settings?.cashbackPercentage ?? 50) / 100));
    const realCashbackVal = newTikTokForm.realCashback ? parseFloat(newTikTokForm.realCashback) : (newTikTokForm.status === 'approved' ? estCashbackVal : 0);

    setIsSubmittingTikTokOrder(true);
    try {
      await createAdminTikTokOrder({
        id: newTikTokForm.id.trim() || undefined,
        userId: newTikTokForm.userId.trim() || undefined,
        productName: newTikTokForm.productName.trim(),
        productImage: newTikTokForm.productImage.trim() || undefined,
        orderAmount: orderAmountVal,
        tiktokCommission: commVal,
        estimatedCashback: estCashbackVal,
        realCashback: realCashbackVal,
        status: newTikTokForm.status,
        notes: newTikTokForm.notes.trim() || undefined
      });
      toast.success('Đã tạo đơn hàng TikTok mới thành công!');
      setIsCreateTikTokModalOpen(false);
      setNewTikTokForm({
        id: '',
        userId: '',
        productName: '',
        productImage: '',
        orderAmount: '',
        estimatedCashback: '',
        realCashback: '',
        tiktokCommission: '',
        status: 'pending',
        notes: ''
      });
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi tạo đơn hàng TikTok');
    } finally {
      setIsSubmittingTikTokOrder(false);
    }
  };

  const handleDeleteTikTokOrder = async (id: string) => {
    const ok = await deleteTikTokOrderAdmin(id);
    if (ok) {
      toast.success('Đã xóa đơn hàng TikTok thành công!');
      setDeletingTikTokOrder(null);
    } else {
      toast.error('Lỗi khi xóa đơn hàng TikTok');
    }
  };

  const handleClearAllTikTokOrders = async () => {
    const ok = await clearAllTikTokOrdersAdmin(false);
    if (ok) {
      toast.success('Đã xóa toàn bộ đơn hàng TikTok và đồng bộ lại ví!');
      setIsClearTikTokModalOpen(false);
    } else {
      toast.error('Lỗi khi xóa đơn hàng TikTok');
    }
  };

  const handleClearUnassignedTikTokOrders = async () => {
    const ok = await clearAllTikTokOrdersAdmin(true);
    if (ok) {
      toast.success('Đã xóa các đơn hàng TikTok chưa gán User!');
      setIsClearUnassignedTikTokModalOpen(false);
    } else {
      toast.error('Lỗi khi xóa đơn hàng TikTok');
    }
  };

  const handleQueryRiohubOrders = async () => {
    setIsQueryingRiohub(true);
    try {
      const res = await fetchRiohubLiveOrders({
        creator_username: riohubFilters.creator_username || (settings as any)?.riohubCreatorUsername || '',
        order_id: riohubFilters.order_id,
        time_start: riohubFilters.time_start,
        time_end: riohubFilters.time_end,
        update_time_start: riohubFilters.update_time_start,
        update_time_end: riohubFilters.update_time_end,
        status: riohubFilters.status,
        settlement_status: riohubFilters.settlement_status,
        content_type: riohubFilters.content_type,
        page_size: riohubFilters.page_size
      });

      if (res.success) {
        setRiohubOrdersResult({
          creator_username: res.creator_username,
          page: res.page,
          page_size: res.page_size,
          total: res.total,
          orders: res.orders || []
        });
        setSelectedRiohubOrderIds((res.orders || []).map((o: any) => o.order_id));
        toast.success(`Đã tải ${res.orders?.length || 0} đơn hàng TikTok (Tổng số: ${res.total || 0})`);
      } else {
        toast.error(res.message || 'Lỗi truy vấn đơn hàng TikTok');
      }
    } catch (err: any) {
      toast.error('Lỗi kết nối máy chủ: ' + err.message);
    } finally {
      setIsQueryingRiohub(false);
    }
  };

  const handleApplyRiohubReconciliation = async (onlySelected = true) => {
    if (!riohubOrdersResult || riohubOrdersResult.orders.length === 0) {
      toast.error('Chưa có đơn hàng nào để đối soát');
      return;
    }

    const ordersToSync = onlySelected
      ? riohubOrdersResult.orders.filter((o: any) => selectedRiohubOrderIds.includes(o.order_id))
      : riohubOrdersResult.orders;

    if (ordersToSync.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 đơn hàng để đối soát');
      return;
    }

    setIsReconcilingRiohub(true);
    try {
      const res = await syncTikTokOrdersAdmin({ orders: ordersToSync });
      if (res.success) {
        toast.success(res.message);
        // Refresh lại danh sách xem trước
        await handleQueryRiohubOrders();
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error('Lỗi khi thực hiện đối soát: ' + err.message);
    } finally {
      setIsReconcilingRiohub(false);
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
      addlivetagApiKey: sysAddlivetagApiKey.trim(),
      lazadaAffiliateId: sysLazadaAffiliateId,
      lazadaCookieUrl: sysLazadaCookieUrl,
      tiktokAffiliateId: sysTiktokAffiliateId,
      tiktokCookieUrl: sysTiktokCookieUrl,
      riohubApiKey: sysRiohubApiKey.trim(),
      riohubCreatorUsername: sysRiohubCreatorUsername.trim(),
      riohubWebhookSecret: sysRiohubWebhookSecret.trim(),
      telegramNotification: sysTeleNotify,
      emailNotification: sysEmailNotify,
      maintenanceMode: sysMaintMode
    });
    toast.success('Đã lưu cấu hình hệ thống thành công!');
  };

  const handleSyncTiktokOrders = async () => {
    setIsSyncingTiktokOrders(true);
    try {
      const apiBase = import.meta.env.VITE_API_BASE || '/api';
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/tiktok/sync-orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ page_size: 100 })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Đồng bộ đơn hàng TikTok từ RioHub thành công!');
        fetchAdminOrders();
        fetchAdminStats();
      } else {
        toast.error(data.message || 'Đồng bộ đơn hàng TikTok thất bại');
      }
    } catch (err: any) {
      toast.error('Lỗi kết nối khi đồng bộ đơn hàng TikTok: ' + err.message);
    } finally {
      setIsSyncingTiktokOrders(false);
    }
  };

  const handleTestAddLiveKey = async () => {
    const keyToTest = sysAddlivetagApiKey.trim();
    if (!keyToTest) {
      toast.error('Vui lòng nhập API Key AddLiveTag trước khi kiểm tra');
      return;
    }
    setIsTestingKey(true);
    try {
      const apiBase = import.meta.env.VITE_API_BASE || '/api';
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/settings/admin/test-addlivetag-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ apiKey: keyToTest })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Kết nối API Key thành công! Key hợp lệ.');
      } else {
        toast.error(data.message || 'API Key không hợp lệ hoặc đã hết hạn.');
      }
    } catch (err: any) {
      toast.error(`Lỗi kiểm tra API Key: ${err.message}`);
    } finally {
      setIsTestingKey(false);
    }
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
        balance: Math.floor(parseFloat(editUserBalance) || 0)
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

  const handleSyncBalances = async () => {
    setIsSyncingBalances(true);
    const success = await syncAdminUserBalances();
    if (success) {
      toast.success('Đã đồng bộ lại số dư theo các đơn hoàn thành và tiền đã rút thành công!');
    } else {
      toast.error('Đồng bộ số dư thất bại');
    }
    setIsSyncingBalances(false);
  };

  const handleToggleStatus = async (u: UserProfile) => {
    const newStatus = await toggleUserStatus(u.id);
    if (newStatus) {
      toast.success(newStatus === 'locked' ? `Đã khóa tài khoản ${u.name}` : `Đã mở khóa tài khoản ${u.name}`);
    } else {
      toast.error('Cập nhật trạng thái thất bại');
    }
  };

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
            { id: 'orders', icon: <ShoppingBag className="h-4.5 w-4.5 text-[#EE4D2D]" />, label: 'Đơn hàng Shopee' },
            { id: 'tiktok-orders', icon: <TikTokIcon className="h-4.5 w-4.5 text-slate-900" />, label: 'Đơn hàng TikTok' },
            { id: 'tiktok-clicks', icon: <Activity className="h-4.5 w-4.5 text-slate-900" />, label: 'Click TikTok' },
            { id: 'withdrawals', icon: <Wallet className="h-4.5 w-4.5" />, label: 'Quản lý rút tiền' },
            { id: 'reconciliation', icon: <FileSpreadsheet className="h-4.5 w-4.5" />, label: 'Đối soát file Shopee' },
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
              {tab.id === 'orders' && pendingShopeeOrdersCount > 0 && (
                <Badge variant="info" className="py-0 px-2 text-[10px] bg-orange-50 text-[#EE4D2D] border border-orange-200">{pendingShopeeOrdersCount}</Badge>
              )}
              {tab.id === 'tiktok-orders' && pendingTikTokOrdersCount > 0 && (
                <Badge variant="warning" className="py-0 px-2 text-[10px] bg-slate-900 text-white border-none">{pendingTikTokOrdersCount}</Badge>
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

              {/* TIME RANGE & PLATFORM FILTER HEADER */}
              <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 bg-white p-4 rounded-input border border-border shadow-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black text-text">Báo cáo & Thống kê tổng quan</h2>
                    {isLoadingStats && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                        <RefreshCw className="w-3 h-3 animate-spin" /> Đang cập nhật...
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary mt-0.5">Theo dõi hiệu suất doanh thu, hoa hồng và các chỉ số hoạt động hệ thống.</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                  {/* PLATFORM SELECTOR TABS */}
                  <div className="flex items-center gap-1 bg-bg p-1 rounded-input border border-border">
                    <button
                      type="button"
                      onClick={() => setStatsPlatform('all')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${statsPlatform === 'all' ? 'bg-primary text-white shadow-xs' : 'text-text-secondary hover:text-text'}`}
                    >
                      Tất cả sàn
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatsPlatform('shopee')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${statsPlatform === 'shopee' ? 'bg-[#EE4D2D] text-white shadow-xs' : 'text-text-secondary hover:text-text'}`}
                    >
                      <ShopeeIcon className="w-3.5 h-3.5" /> Shopee
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatsPlatform('tiktok')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${statsPlatform === 'tiktok' ? 'bg-slate-900 text-white shadow-xs' : 'text-text-secondary hover:text-text'}`}
                    >
                      <TikTokIcon className="w-3.5 h-3.5" /> TikTok Shop
                    </button>
                  </div>

                  {/* TIME RANGE SELECT */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-text-secondary whitespace-nowrap">Thời gian:</span>
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
              </div>

              {/* TOP WIDGETS CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                  { title: "Tổng thành viên", value: totalUsersCount, desc: "Tài khoản người dùng", color: "text-text", icon: <Users className="h-5 w-5 text-text-secondary" />, tab: 'users' },
                  { title: statsPlatform === 'tiktok' ? "Đơn TikTok Shop" : statsPlatform === 'shopee' ? "Đơn Shopee" : "Tổng đơn hàng", value: totalOrdersCount, desc: statsPlatform === 'tiktok' ? "Đơn TikTok Shop" : statsPlatform === 'shopee' ? "Đơn sàn Shopee" : "Phát sinh trên hệ thống", color: "text-text", icon: <ShoppingBag className="h-5 w-5 text-text-secondary" />, tab: statsPlatform === 'tiktok' ? 'tiktok-orders' : 'orders' },
                  { title: statsPlatform === 'tiktok' ? "Hoa hồng TikTok (100%)" : statsPlatform === 'shopee' ? "Hoa hồng Shopee (100%)" : "Tổng hoa hồng sàn (100%)", value: `${(adminStats?.summary?.platformTotalRevenue || 0).toLocaleString('vi-VN')}đ`, desc: "Tổng hoa hồng nhận từ sàn", color: "text-blue-600", icon: <Activity className="h-5 w-5 text-blue-600" /> },
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

              {/* PLATFORM BREAKDOWN SECTION (SHOPEE vs TIKTOK SHOP) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Shopee Card */}
                <Card 
                  onClick={() => setStatsPlatform(statsPlatform === 'shopee' ? 'all' : 'shopee')}
                  className={`border-border/60 transition-all cursor-pointer hover:shadow-md ${statsPlatform === 'shopee' ? 'ring-2 ring-[#EE4D2D] bg-orange-50/20' : 'bg-white'}`}
                >
                  <CardContent className="p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="p-2 bg-orange-100 text-[#EE4D2D] rounded-xl">
                          <ShopeeIcon className="w-5 h-5" />
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-bold text-sm text-text">Sàn Shopee</h4>
                            {statsPlatform === 'shopee' && <Badge className="bg-[#EE4D2D] text-white text-[9px] py-0 px-1.5">Đang lọc</Badge>}
                          </div>
                          <p className="text-[10px] text-text-secondary font-medium">Đối soát file Excel / CSV định kỳ</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="border-orange-200 text-[#EE4D2D] bg-orange-50 font-black text-xs px-2.5 py-1">
                        {adminStats?.platformBreakdown?.shopee?.totalOrders || 0} đơn
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50 text-center">
                      <div className="bg-bg/60 p-2 rounded-lg">
                        <span className="text-[10px] text-text-secondary font-bold block">Hoa hồng sàn</span>
                        <span className="text-xs font-black text-blue-600">
                          {((adminStats?.platformBreakdown?.shopee?.revenue || 0)).toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                      <div className="bg-bg/60 p-2 rounded-lg">
                        <span className="text-[10px] text-text-secondary font-bold block">Hoàn trả khách (50%)</span>
                        <span className="text-xs font-black text-[#EE4D2D]">
                          {((adminStats?.platformBreakdown?.shopee?.cashback || 0)).toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                      <div className="bg-bg/60 p-2 rounded-lg">
                        <span className="text-[10px] text-text-secondary font-bold block">Lợi nhuận giữ lại</span>
                        <span className="text-xs font-black text-success">
                          {((adminStats?.platformBreakdown?.shopee?.profit || 0)).toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* TikTok Shop Card */}
                <Card 
                  onClick={() => setStatsPlatform(statsPlatform === 'tiktok' ? 'all' : 'tiktok')}
                  className={`border-border/60 transition-all cursor-pointer hover:shadow-md ${statsPlatform === 'tiktok' ? 'ring-2 ring-slate-900 bg-slate-50/50' : 'bg-white'}`}
                >
                  <CardContent className="p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="p-2 bg-slate-900 text-white rounded-xl">
                          <TikTokIcon className="w-5 h-5" />
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-bold text-sm text-text">Sàn TikTok Shop</h4>
                            {statsPlatform === 'tiktok' && <Badge className="bg-slate-900 text-white text-[9px] py-0 px-1.5">Đang lọc</Badge>}
                          </div>
                          <p className="text-[10px] text-text-secondary font-medium">Đồng bộ tự động 100% qua API</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="border-slate-300 text-slate-900 bg-slate-100 font-black text-xs px-2.5 py-1">
                        {adminStats?.platformBreakdown?.tiktok?.totalOrders || 0} đơn
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50 text-center">
                      <div className="bg-bg/60 p-2 rounded-lg">
                        <span className="text-[10px] text-text-secondary font-bold block">Hoa hồng sàn</span>
                        <span className="text-xs font-black text-blue-600">
                          {((adminStats?.platformBreakdown?.tiktok?.revenue || 0)).toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                      <div className="bg-bg/60 p-2 rounded-lg">
                        <span className="text-[10px] text-text-secondary font-bold block">Hoàn trả khách (50%)</span>
                        <span className="text-xs font-black text-[#EE4D2D]">
                          {((adminStats?.platformBreakdown?.tiktok?.cashback || 0)).toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                      <div className="bg-bg/60 p-2 rounded-lg">
                        <span className="text-[10px] text-text-secondary font-bold block">Lợi nhuận giữ lại</span>
                        <span className="text-xs font-black text-success">
                          {((adminStats?.platformBreakdown?.tiktok?.profit || 0)).toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
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
                          <Area type="monotone" dataKey="DoanhThu" name={statsPlatform === 'tiktok' ? 'Hoa hồng TikTok (100%)' : statsPlatform === 'shopee' ? 'Hoa hồng Shopee (100%)' : 'Hoa hồng sàn (100%)'} stroke="#3B82F6" fillOpacity={1} fill="url(#colorDailyRevenue)" strokeWidth={2} />
                          <Area type="monotone" dataKey="LoiNhuan" name="Lợi nhuận Admin" stroke="#22C55E" fillOpacity={1} fill="url(#colorDailyProfit)" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Daily Detail Data Table */}
                    <div className="border border-border/50 rounded-input overflow-hidden shadow-sm">
                      <div className="bg-bg/80 px-4 py-2.5 border-b border-border text-xs font-bold text-text flex justify-between items-center">
                        <span>Bảng Thống Kê Chi Tiết Từng Ngày ({adminStats?.selectedMonth ? `Tháng ${adminStats.selectedMonth.substring(5)}/${adminStats.selectedMonth.substring(0, 4)}` : ''}) - {statsPlatform === 'tiktok' ? 'TikTok Shop' : statsPlatform === 'shopee' ? 'Shopee' : 'Tất cả sàn'}</span>
                        <span className="text-text-secondary text-[11px]">Tổng số: {(adminStats?.dailyAnalytics || []).length} ngày</span>
                      </div>
                      <div className="max-h-[300px] overflow-y-auto">
                        <TableContainer>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Ngày</TableHead>
                              <TableHead className="text-center">Số Đơn Hàng</TableHead>
                              <TableHead className="text-right">{statsPlatform === 'tiktok' ? 'Hoa Hồng TikTok (100%)' : statsPlatform === 'shopee' ? 'Hoa Hồng Shopee (100%)' : 'Hoa Hồng Sàn (100%)'}</TableHead>
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

              {/* LEADERBOARD: TOP 5 USERS */}
              <div>
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

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSyncBalances}
                  disabled={isSyncingBalances}
                  className="flex items-center gap-1.5 text-xs font-bold border-primary/30 text-primary hover:bg-primary/5 py-2.5 px-3 h-auto shrink-0"
                  title="Đồng bộ số dư: (Tổng đơn hoàn thành + Hoa hồng giới thiệu) - Tiền đã rút"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isSyncingBalances ? 'animate-spin' : ''}`} />
                  Đồng bộ số dư chuẩn
                </Button>
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
                        <TableHead>Số Dư Ví</TableHead>
                        <TableHead>Đã Rút</TableHead>
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
                          <TableCell className="text-xs font-bold text-emerald-600">
                            {(u.totalWithdrawn || 0).toLocaleString('vi-VN')}đ
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
                  <h2 className="text-2xl font-black text-text">Quản lý đối soát đơn hàng Shopee</h2>
                  <p className="text-xs text-text-secondary mt-1">Phê duyệt, từ chối đối soát đơn hàng Shopee thủ công hoặc cập nhật doanh thu thực nhận bằng file CSV.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    onClick={() => {
                      setNewOrderForm({
                        id: '',
                        userId: '',
                        productName: '',
                        productImage: '',
                        productUrl: '',
                        orderAmount: '',
                        shopeeCommission: '',
                        realCashback: '',
                        estimatedCashback: '',
                        status: 'pending',
                        notes: '',
                        shopId: '',
                        itemId: ''
                      });
                      setIsCreateOrderModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 shadow-sm"
                  >
                    <Plus className="h-4 w-4" /> Tạo đơn mới
                  </Button>
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
                    onClick={downloadSampleReconciliationCSV}
                    className="flex items-center gap-1.5 border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 font-bold text-xs"
                    title="Tải file đối soát CSV ví dụ đúng định dạng"
                  >
                    <Download className="h-4 w-4 text-primary" /> Tải mẫu CSV đối soát
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setIsCSVHelpModalOpen(true)}
                    className="flex items-center gap-1.5 border-border font-bold text-xs hover:bg-bg"
                    title="Xem ví dụ & Quy tắc đối soát CSV"
                  >
                    <HelpCircle className="h-4 w-4 text-amber-500" /> Hướng dẫn & Ví dụ
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
                  <Button
                    variant="outline"
                    onClick={() => setIsClearUnassignedModalOpen(true)}
                    className="flex items-center gap-1.5 border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 font-bold text-xs"
                    title="Xóa tất cả các đơn hàng chưa xác định thành viên (user_id = null)"
                  >
                    <Trash2 className="h-4 w-4 text-amber-600" /> Xóa đơn chưa gán
                  </Button>
                  <Button
                    onClick={() => setIsClearAllModalOpen(true)}
                    className="flex items-center gap-1.5 bg-red-600 text-white hover:bg-red-700 font-bold text-xs shadow-sm"
                    title="Xóa sạch toàn bộ đơn hàng, lượt click, rút tiền và reset ví thành viên về 0đ"
                  >
                    <Trash2 className="h-4 w-4" /> Xóa tất cả đơn hàng & Reset ví
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
                          const userCashback = Math.floor(o.realCashback !== undefined ? o.realCashback : o.estimatedCashback);
                          const shopeeComm = Math.floor(o.shopeeCommission !== undefined && o.shopeeCommission !== null ? o.shopeeCommission : userCashback * 2);
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
                              <TableCell className="text-right font-semibold">{Math.floor(o.orderAmount).toLocaleString('vi-VN')}đ</TableCell>
                              <TableCell className="text-right font-semibold text-text-secondary">{Math.floor(shopeeComm).toLocaleString('vi-VN')}đ</TableCell>
                              <TableCell className="text-right font-bold text-primary">{Math.floor(userCashback).toLocaleString('vi-VN')}đ</TableCell>
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

          {/* TAB 3B: TIKTOK ORDER MANAGEMENT */}
          {activeTab === 'tiktok-orders' && (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="p-2 bg-slate-900 text-white rounded-xl shadow-xs">
                      <TikTokIcon className="h-5 w-5" />
                    </span>
                    <h2 className="text-2xl font-black text-text">Quản lý đơn hàng TikTok Shop</h2>
                  </div>
                  <p className="text-xs text-text-secondary mt-1">
                    Theo dõi, đối soát và tự động đồng bộ đơn hàng hoàn tiền từ TikTok Shop.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    onClick={() => {
                      setNewTikTokForm({
                        id: '',
                        userId: '',
                        productName: '',
                        productImage: '',
                        orderAmount: '',
                        estimatedCashback: '',
                        realCashback: '',
                        tiktokCommission: '',
                        status: 'pending',
                        notes: ''
                      });
                      setIsCreateTikTokModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 shadow-sm"
                  >
                    <Plus className="h-4 w-4" /> Tạo đơn TikTok mới
                  </Button>
                </div>
              </div>

              {/* STAT WIDGETS FOR TIKTOK */}
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <Card className="border-border/60 shadow-xs">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold text-text-secondary">Tổng đơn TikTok</p>
                      <h3 className="text-xl font-black text-text mt-0.5">{tiktokStats?.totalOrders || totalAdminTikTokOrders}</h3>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-800">
                      <ShoppingBag className="w-5 h-5" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border/60 shadow-xs">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold text-text-secondary">Đơn hoàn thành</p>
                      <h3 className="text-xl font-black text-emerald-600 mt-0.5">{tiktokStats?.approvedOrders || 0}</h3>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                      <Check className="w-5 h-5" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border/60 shadow-xs">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold text-text-secondary">Doanh số GMV</p>
                      <h3 className="text-lg font-black text-text mt-0.5">{((tiktokStats?.totalRevenue || 0)).toLocaleString('vi-VN')}đ</h3>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                      <BarChart3 className="w-5 h-5" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border/60 shadow-xs">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold text-text-secondary">Hoa hồng sàn (100%)</p>
                      <h3 className="text-lg font-black text-blue-600 mt-0.5">{((tiktokStats?.totalCommission || 0)).toLocaleString('vi-VN')}đ</h3>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                      <Activity className="w-5 h-5" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border/60 shadow-xs">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold text-text-secondary">Hoàn tiền khách</p>
                      <h3 className="text-lg font-black text-[#EE4D2D] mt-0.5">{((tiktokStats?.totalCashback || 0)).toLocaleString('vi-VN')}đ</h3>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-[#EE4D2D]">
                      <Wallet className="w-5 h-5" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* SEARCH & FILTER FOR TIKTOK ORDERS */}
              <div className="bg-white border border-border p-4 rounded-input flex flex-col sm:flex-row gap-4 items-center shadow-xs">
                <div className="flex-1 w-full flex items-center px-3 border border-border rounded-input bg-bg gap-2">
                  <Search className="h-4.5 w-4.5 text-text-secondary shrink-0" />
                  <input
                    type="text"
                    placeholder="Tìm theo Mã đơn TikTok, tên sản phẩm, SubID hoặc người dùng..."
                    value={tiktokSearch}
                    onChange={(e) => setTiktokSearch(e.target.value)}
                    className="w-full bg-transparent border-none py-2.5 outline-none text-xs"
                  />
                </div>
                <div className="w-full sm:w-48 flex items-center gap-2">
                  <Filter className="h-4 w-4 text-text-secondary shrink-0" />
                  <select
                    value={tiktokStatusFilter}
                    onChange={(e) => setTiktokStatusFilter(e.target.value)}
                    className="w-full bg-white border border-border text-xs rounded-input py-2.5 px-3"
                  >
                    <option value="all">Tất cả trạng thái</option>
                    <option value="unassigned">⚠️ Đơn chưa gán User</option>
                    <option value="pending">Đang chờ xử lý</option>
                    <option value="approved">Hoàn thành</option>
                    <option value="rejected">Hủy</option>
                    <option value="returned">Hoàn hàng</option>
                    <option value="paid">Đã thanh toán</option>
                  </select>
                </div>
              </div>

              {/* TIKTOK ORDERS LIST TABLE */}
              <Card className="border-border/50">
                <CardContent className="p-0">
                  <TableContainer>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mã Đơn TikTok</TableHead>
                        <TableHead>Thành Viên</TableHead>
                        <TableHead>Sản Phẩm</TableHead>
                        <TableHead className="text-right">Giá Trị Đơn</TableHead>
                        <TableHead className="text-right">Hoa Hồng Sàn (100%)</TableHead>
                        <TableHead className="text-right">Hoàn Tiền Khách</TableHead>
                        <TableHead>Ngày Đặt</TableHead>
                        <TableHead>Trạng Thái</TableHead>
                        <TableHead className="text-center">Thao Tác</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingTikTokOrders ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-16 text-xs text-text-secondary font-medium">
                            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                            Đang tải danh sách đơn hàng TikTok...
                          </TableCell>
                        </TableRow>
                      ) : (tiktokOrders || []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-16 text-xs text-text-secondary font-medium">
                            Chưa có đơn hàng TikTok nào hoặc không tìm thấy đơn phù hợp. Nhấn "Đồng bộ nhanh" để tải đơn về!
                          </TableCell>
                        </TableRow>
                      ) : (
                        (tiktokOrders || []).map((order) => {
                          const orderUser = users.find(u => u.id === order.userId);
                          const userDisplayName = order.userName || orderUser?.name || 'Chưa xác định';
                          const userDisplayEmail = order.userEmail || orderUser?.email || '';

                          return (
                            <TableRow key={order.id} className="hover:bg-bg/40">
                              <TableCell className="font-bold text-slate-900 dark:text-white">
                                <div className="flex items-center gap-1.5">
                                  <span className="p-1 bg-slate-900 text-white rounded-md shrink-0">
                                    <TikTokIcon className="h-3 w-3" />
                                  </span>
                                  <span className="font-mono text-xs">{order.id}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                {order.userId ? (
                                  <div>
                                    <p className="font-bold text-xs text-text">{userDisplayName}</p>
                                    <p className="text-[10px] text-text-secondary">{userDisplayEmail || order.userId}</p>
                                  </div>
                                ) : (
                                  <Badge variant="warning" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                                    ⚠️ Chưa gán
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="max-w-[220px]">
                                <div className="flex items-center gap-2">
                                  {order.productImage ? (
                                    <img src={order.productImage} alt="" className="w-8 h-8 rounded-md object-cover border border-border shrink-0" />
                                  ) : (
                                    <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                                      <TikTokIcon className="w-4 h-4" />
                                    </div>
                                  )}
                                  <div className="truncate">
                                    <p className="font-semibold text-xs text-text truncate" title={order.productName}>{order.productName}</p>
                                    {order.subId && <p className="text-[10px] font-mono text-text-secondary truncate">SubID: {order.subId}</p>}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-semibold text-xs">
                                {Math.floor(order.orderAmount).toLocaleString('vi-VN')}đ
                              </TableCell>
                              <TableCell className="text-right font-bold text-xs text-blue-600">
                                {Math.floor(order.tiktokCommission || order.shopeeCommission || (order.estimatedCashback * 2)).toLocaleString('vi-VN')}đ
                              </TableCell>
                              <TableCell className="text-right font-bold text-xs text-[#EE4D2D]">
                                {order.realCashback ? `${Math.floor(order.realCashback).toLocaleString('vi-VN')}đ` : `${Math.floor(order.estimatedCashback).toLocaleString('vi-VN')}đ (DK)`}
                              </TableCell>
                              <TableCell className="text-xs text-text-secondary font-medium whitespace-nowrap">
                                {order.createdTime ? String(order.createdTime).substring(0, 16) : '-'}
                              </TableCell>
                              <TableCell>
                                {order.status === 'approved' && <Badge variant="success">Hoàn thành</Badge>}
                                {order.status === 'pending' && <Badge variant="info">Chờ xử lý</Badge>}
                                {order.status === 'rejected' && <Badge variant="danger">Hủy</Badge>}
                                {order.status === 'returned' && <Badge variant="warning" className="bg-orange-50 text-orange-600 border-orange-200">Hoàn hàng</Badge>}
                                {order.status === 'paid' && <Badge variant="warning">Đã thanh toán</Badge>}
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {order.status === 'pending' && (
                                    <>
                                      <Button
                                        size="sm"
                                        onClick={() => updateTikTokOrderStatus(order.id, 'approved', Math.floor(order.estimatedCashback), order.notes, order.userId)}
                                        className="h-7 w-7 p-0 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-md"
                                        title="Duyệt hoàn thành"
                                      >
                                        <Check className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={() => updateTikTokOrderStatus(order.id, 'rejected', 0, order.notes, order.userId)}
                                        className="h-7 w-7 p-0 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-md"
                                        title="Từ chối/Hủy"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </Button>
                                    </>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingTikTokOrder(order);
                                      setEditTikTokStatus(order.status);
                                      setEditTikTokRealCashback(order.realCashback !== undefined ? String(order.realCashback) : String(order.estimatedCashback));
                                      setEditTikTokNotes(order.notes || '');
                                      setEditTikTokUserId(order.userId || '');
                                    }}
                                    className="h-7 w-7 p-0 border-border text-text-secondary hover:text-primary rounded-md"
                                    title="Sửa / Gán User"
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setDeletingTikTokOrder(order)}
                                    className="h-7 w-7 p-0 border-border text-text-secondary hover:text-danger rounded-md"
                                    title="Xóa đơn"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </TableContainer>

                  {/* TIKTOK PAGINATION */}
                  {Math.ceil(totalAdminTikTokOrders / 10) > 1 && (
                    <div className="p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold text-text-secondary">
                      <p>Hiển thị trang {tiktokPage} trên tổng số {Math.ceil(totalAdminTikTokOrders / 10)} trang ({totalAdminTikTokOrders} đơn TikTok)</p>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setTiktokPage(p => Math.max(1, p - 1))}
                          disabled={tiktokPage === 1}
                          className="px-3 py-1.5 border border-border rounded-[8px] bg-white hover:bg-bg disabled:opacity-50 transition-all"
                        >
                          Trước
                        </button>
                        {getPageNumbers(tiktokPage, Math.ceil(totalAdminTikTokOrders / 10)).map((page, idx) => (
                          <button
                            key={idx}
                            onClick={() => typeof page === 'number' && setTiktokPage(page)}
                            disabled={typeof page !== 'number'}
                            className={`px-3 py-1.5 border rounded-[8px] transition-all ${tiktokPage === page
                                ? 'bg-slate-900 text-white border-slate-900 font-bold'
                                : 'bg-white hover:bg-bg border-border text-text-secondary'
                              }`}
                          >
                            {page}
                          </button>
                        ))}
                        <button
                          onClick={() => setTiktokPage(p => Math.min(Math.ceil(totalAdminTikTokOrders / 10), p + 1))}
                          disabled={tiktokPage === Math.ceil(totalAdminTikTokOrders / 10)}
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

          {/* TAB: TIKTOK CLICKS (click_logs) */}
          {activeTab === 'tiktok-clicks' && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-2xl font-black text-text">Click TikTok Shop</h2>
                <p className="text-xs text-text-secondary mt-1">Lượt khách bấm tạo link mua hàng TikTok. Đơn hoàn tiền thật nằm ở tab "Đơn hàng TikTok" (từ API RioHub).</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Tổng lượt click', value: tiktokClicksStats.totalClicks, color: 'text-text' },
                  { label: 'Đã phát sinh đơn', value: tiktokClicksStats.convertedClicks, color: 'text-emerald-600' },
                  { label: 'Click khách vãng lai', value: tiktokClicksStats.anonymousClicks, color: 'text-amber-600' }
                ].map(s => (
                  <Card key={s.label} className="border-border/60 shadow-xs">
                    <CardContent className="p-4">
                      <p className="text-[11px] font-bold text-text-secondary">{s.label}</p>
                      <h3 className={`text-xl font-black mt-0.5 ${s.color}`}>{s.value}</h3>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="bg-white border border-border p-4 rounded-input flex flex-col sm:flex-row gap-4 items-center shadow-xs">
                <div className="flex-1 w-full flex items-center px-3 border border-border rounded-input bg-bg gap-2">
                  <Search className="h-4.5 w-4.5 text-text-secondary shrink-0" />
                  <input
                    type="text"
                    placeholder="Tìm theo mã click, link/sản phẩm, Product ID hoặc người dùng..."
                    value={tiktokClickSearch}
                    onChange={(e) => setTiktokClickSearch(e.target.value)}
                    className="w-full bg-transparent border-none py-2.5 outline-none text-xs"
                  />
                </div>
                <div className="w-full sm:w-52 flex items-center gap-2">
                  <Filter className="h-4 w-4 text-text-secondary shrink-0" />
                  <select
                    value={tiktokClickConverted}
                    onChange={(e) => setTiktokClickConverted(e.target.value)}
                    className="w-full bg-white border border-border text-xs rounded-input py-2.5 px-3"
                  >
                    <option value="all">Tất cả click</option>
                    <option value="yes">Đã phát sinh đơn</option>
                    <option value="no">Chưa có đơn</option>
                  </select>
                </div>
              </div>

              <Card className="border-border/50">
                <CardContent className="p-0">
                  <TableContainer>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mã Click</TableHead>
                        <TableHead>Thành Viên</TableHead>
                        <TableHead>Link / Sản Phẩm</TableHead>
                        <TableHead>Product ID</TableHead>
                        <TableHead>Thời Gian Click</TableHead>
                        <TableHead>Đơn Phát Sinh</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingTikTokClicks ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-16 text-xs text-text-secondary font-medium">
                            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                            Đang tải danh sách click TikTok...
                          </TableCell>
                        </TableRow>
                      ) : tiktokClicks.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-16 text-xs text-text-secondary font-medium">
                            Chưa có lượt click TikTok nào phù hợp.
                          </TableCell>
                        </TableRow>
                      ) : (
                        tiktokClicks.map((c) => (
                          <TableRow key={c.id} className="hover:bg-bg/40">
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <span className="p-1 bg-slate-900 text-white rounded-md shrink-0">
                                  <TikTokIcon className="h-3 w-3" />
                                </span>
                                <span className="font-mono text-xs font-bold">{c.id}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {c.user_id ? (
                                <div>
                                  <p className="font-bold text-xs text-text">{c.user_name || 'Chưa xác định'}</p>
                                  <p className="text-[10px] text-text-secondary">{c.user_email || c.user_id}</p>
                                </div>
                              ) : (
                                <Badge variant="warning" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">Khách vãng lai</Badge>
                              )}
                            </TableCell>
                            <TableCell className="max-w-[260px]">
                              <p className="text-xs text-text-secondary truncate" title={c.product_url}>{c.product_url || '-'}</p>
                            </TableCell>
                            <TableCell className="font-mono text-[11px] text-text-secondary">{c.item_id || '-'}</TableCell>
                            <TableCell className="text-xs text-text-secondary font-medium whitespace-nowrap">
                              {c.click_time ? String(c.click_time).substring(0, 16) : '-'}
                            </TableCell>
                            <TableCell>
                              {c.order_id ? (
                                <button
                                  onClick={() => { setTiktokSearch(String(c.order_id)); setActiveTab('tiktok-orders'); }}
                                  className="text-left"
                                  title="Xem đơn ở tab Đơn hàng TikTok"
                                >
                                  <Badge variant="success">{c.order_id}</Badge>
                                </button>
                              ) : (
                                <span className="text-[11px] text-text-secondary">Chưa có đơn</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </TableContainer>

                  {Math.ceil(tiktokClicksTotal / tiktokClicksPerPage) > 1 && (
                    <div className="p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold text-text-secondary">
                      <p>Trang {tiktokClickPage} / {Math.ceil(tiktokClicksTotal / tiktokClicksPerPage)} ({tiktokClicksTotal} click)</p>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setTiktokClickPage(p => Math.max(1, p - 1))}
                          disabled={tiktokClickPage === 1}
                          className="px-3 py-1.5 border border-border rounded-[8px] bg-white hover:bg-bg disabled:opacity-50 transition-all"
                        >
                          Trước
                        </button>
                        <button
                          onClick={() => setTiktokClickPage(p => Math.min(Math.ceil(tiktokClicksTotal / tiktokClicksPerPage), p + 1))}
                          disabled={tiktokClickPage >= Math.ceil(tiktokClicksTotal / tiktokClicksPerPage)}
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
                                <TableHead>Trạng Thái Hệ Thống</TableHead>
                                <TableHead>Chi Tiết</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {reconcileData.map((row, index) => (
                                <TableRow key={index}>
                                  <TableCell className="font-bold text-text-secondary">{row.id}</TableCell>
                                  <TableCell className="max-w-[200px] font-semibold text-xs">
                                    <div className="truncate" title={row.name}>{row.name}</div>
                                    {(row.shopId || row.itemId) && (
                                      <div className="flex flex-wrap gap-1 mt-0.5 text-[10px] text-text-secondary font-mono font-normal">
                                        {row.shopId && <span className="bg-gray-100 text-gray-700 px-1 py-0.5 rounded">Shop: {row.shopId}</span>}
                                        {row.itemId && <span className="bg-blue-50 text-blue-700 px-1 py-0.5 rounded">Item: {row.itemId}</span>}
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right font-semibold text-xs">{row.amount.toLocaleString('vi-VN')}đ</TableCell>
                                  <TableCell className="text-right font-bold text-primary text-xs">{row.cashback.toLocaleString('vi-VN')}đ</TableCell>
                                  <TableCell>
                                    {(row.status === 'matched' || row.status === 'duplicate') ? (
                                      <Badge className="bg-emerald-100 text-emerald-800 font-bold border border-emerald-300 text-[10px]">
                                        Tồn tại trong hệ thống
                                      </Badge>
                                    ) : row.status === 'invalid' ? (
                                      <Badge variant="danger" className="text-[10px] font-bold">Lỗi dữ liệu</Badge>
                                    ) : (
                                      <Badge className="bg-amber-50 text-amber-800 font-bold border border-amber-300 text-[10px]">
                                        Chưa có trong hệ thống
                                      </Badge>
                                    )}
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

                          <div className="sm:col-span-2 flex flex-col gap-2 p-4 bg-orange-50/60 rounded-xl border border-orange-200/80 mt-1">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                              <label className="text-xs font-bold text-text/90 flex items-center gap-1.5">
                                <Key className="w-3.5 h-3.5 text-orange-600" />
                                <span>AddLiveTag API Key (Tra cứu dữ liệu sản phẩm & hoa hồng Shopee)</span>
                                <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold uppercase">Bắt buộc mới</span>
                              </label>
                              <a
                                href="https://data.addlivetag.com/"
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-primary hover:underline font-semibold flex items-center gap-1 w-fit"
                              >
                                Lấy Key tại addlivetag.com <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>

                            <div className="flex gap-2">
                              <div className="relative flex-1">
                                <input
                                  type={showAddLiveKey ? "text" : "password"}
                                  value={sysAddlivetagApiKey}
                                  onChange={(e) => setSysAddlivetagApiKey(e.target.value)}
                                  placeholder="Nhập API Key từ addlivetag.com (Ví dụ: alt_live_xxxx...)"
                                  className="w-full px-4 py-2.5 pr-10 bg-white border border-border text-sm rounded-input outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-mono"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowAddLiveKey(!showAddLiveKey)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-text p-1 cursor-pointer"
                                  title={showAddLiveKey ? "Ẩn Key" : "Hiện Key"}
                                >
                                  {showAddLiveKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={handleTestAddLiveKey}
                                disabled={isTestingKey || !sysAddlivetagApiKey.trim()}
                                className="px-3.5 py-2.5 bg-white border border-border hover:bg-slate-50 text-text text-xs font-bold rounded-input transition-all disabled:opacity-50 whitespace-nowrap flex items-center gap-1.5 shadow-sm hover:border-primary cursor-pointer"
                              >
                                {isTestingKey ? (
                                  <>
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    <span>Đang test...</span>
                                  </>
                                ) : (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Kiểm tra Key</span>
                                  </>
                                )}
                              </button>
                            </div>

                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                              Đăng nhập <strong>addlivetag.com</strong> → chọn menu <strong>API Key</strong> → bấm <strong>Tạo Key</strong>. Hệ thống dùng API này để tự động cào tên, ảnh đại diện, giá tiền và tỷ lệ hoa hồng Shopee khi người dùng tra cứu link.
                            </p>
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
                        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                            <span>🎵 Tiếp thị liên kết TikTok Shop qua RioHub</span>
                            {settings.hasRiohubApiKey && (
                              <Badge className="bg-emerald-500 text-white text-[9px] py-0 px-2 font-bold">API Hoạt Động</Badge>
                            )}
                          </h3>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isSyncingTiktokOrders}
                            onClick={handleSyncTiktokOrders}
                            className="text-xs font-bold py-1.5 px-3 border-slate-300"
                          >
                            {isSyncingTiktokOrders ? 'Đang đồng bộ...' : '🔄 Đồng bộ đơn RioHub'}
                          </Button>
                        </div>

                        {/* RIOHUB API CONFIGURATION */}
                        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 sm:p-5 mb-4">
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <div className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-[#00F2FE]" />
                              <span>Cấu hình RioHub TikTok Affiliate API</span>
                              <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">Chuẩn V1</span>
                            </div>
                            <a
                              href="https://riohub.vn/"
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
                            >
                              Mở riohub.vn <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5 sm:col-span-2">
                              <label className="text-xs font-bold text-text/80 flex items-center gap-1.5">
                                <Key className="w-3.5 h-3.5 text-cyan-600" />
                                <span>RioHub API Key (Header: X-Riohub-Api-Key)</span>
                                <span className="text-[10px] bg-cyan-100 text-cyan-800 px-1.5 py-0.5 rounded font-bold uppercase">Bắt buộc</span>
                              </label>

                              <div className="relative">
                                <input
                                  type={showRiohubKey ? "text" : "password"}
                                  value={sysRiohubApiKey}
                                  onChange={(e) => setSysRiohubApiKey(e.target.value)}
                                  className="w-full px-4 py-2.5 pr-10 bg-white border border-border text-xs rounded-input outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-mono"
                                  placeholder={settings.hasRiohubApiKey ? "•••••••• (Đã lưu key)" : "Nhập API Key từ RioHub mục Developer (X-Riohub-Api-Key)..."}
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowRiohubKey(!showRiohubKey)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-text p-1 cursor-pointer"
                                  title={showRiohubKey ? "Ẩn Key" : "Hiện Key"}
                                >
                                  {showRiohubKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                Hệ thống tự động đính kèm Header <code>X-Riohub-Api-Key</code> và tham số <code>creator_username</code> vào các API khi gọi đến RioHub (không cần test key tại trang admin).
                              </p>
                            </div>

                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-bold text-text/80 flex items-center justify-between">
                                <span>Creator Username (Tài khoản TikTok Shop đã kết nối)</span>
                                <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold uppercase">Bắt buộc</span>
                              </label>
                              <input
                                type="text"
                                value={sysRiohubCreatorUsername}
                                onChange={(e) => setSysRiohubCreatorUsername(e.target.value.replace(/^@/, '').trim())}
                                className="w-full px-4 py-2.5 bg-white border border-border text-xs rounded-input outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-mono font-semibold"
                                placeholder="vd: hungrevieweverything"
                              />
                              <span className="text-[10px] text-slate-500">
                                Nhập username đã kết nối với tài khoản RioHub (ví dụ: <strong>hungrevieweverything</strong>). Key tạo ở tài khoản nào chỉ gọi được cho creator đã kết nối ở tài khoản đó.
                              </span>
                            </div>

                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-bold text-text/80">
                                Webhook Secret <span className="text-slate-400 font-normal">(Xác thực X-Riohub-Signature)</span>
                              </label>
                              <input
                                type="text"
                                value={sysRiohubWebhookSecret}
                                onChange={(e) => setSysRiohubWebhookSecret(e.target.value)}
                                className="w-full px-4 py-2.5 bg-white border border-border text-xs rounded-input outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-mono"
                                placeholder="Khóa bảo mật webhook (tùy chọn)..."
                              />
                              <span className="text-[10px] text-slate-500">Dùng để chống giả mạo request thông báo đơn từ RioHub.</span>
                            </div>

                            <div className="flex flex-col gap-1.5 sm:col-span-2">
                              <label className="text-xs font-bold text-text/80">
                                Webhook / Postback URL để cài đặt trên RioHub
                              </label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  readOnly
                                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/tiktok/webhook`}
                                  className="w-full px-3 py-2 bg-slate-100 border border-border text-xs rounded-input text-slate-600 font-mono select-all"
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    navigator.clipboard.writeText(`${window.location.origin}/api/tiktok/webhook`);
                                    toast.success('Đã sao chép link Webhook!');
                                  }}
                                  className="text-xs px-3 shrink-0"
                                >
                                  Sao chép
                                </Button>
                              </div>
                              <span className="text-[10px] text-slate-500">Cài đặt URL này vào mục Webhook/Postback trên RioHub để hệ thống tự động nhận đơn hàng (order.created, order.updated, order.refunded).</span>
                            </div>
                          </div>
                        </div>

                        {/* FALLBACK COOKIE CONFIGURATION */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-text/80">TikTok Shop Affiliate ID (Dự phòng)</label>
                            <input
                              type="text"
                              value={sysTiktokAffiliateId}
                              onChange={(e) => setSysTiktokAffiliateId(e.target.value)}
                              className="w-full px-4 py-3 bg-white border border-border text-sm rounded-input outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-semibold font-mono"
                              placeholder="Nhập mã TikTok Affiliate..."
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-text/80">Link Cookie / Deeplink TikTok Shop (Dự phòng)</label>
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
                  <DialogTitle>
                    {selectedOrderDetail.screenshot ? `Minh chứng đơn ${selectedOrderDetail.id}` : `Chi tiết đơn ${selectedOrderDetail.id}`}
                  </DialogTitle>
                  <p className="text-[10px] text-text-secondary">Thành viên: {selectedOrderDetail.userId || 'Chưa gán'}</p>
                </div>
                {selectedOrderDetail.screenshot ? (
                  <Badge variant="info">Chờ duyệt ảnh</Badge>
                ) : (
                  <Badge variant="success" className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold">
                    Tồn tại trong hệ thống
                  </Badge>
                )}
              </div>
            </DialogHeader>
            <DialogContent className="flex flex-col gap-4 text-left">
              {selectedOrderDetail.screenshot ? (
                <>
                  <p className="text-xs text-text font-bold">Hình ảnh chụp màn hình gửi đối soát:</p>
                  <img
                    src={selectedOrderDetail.screenshot}
                    alt="Shopee screenshot"
                    className="w-full h-auto object-contain border border-border rounded-input max-h-[300px]"
                  />
                </>
              ) : (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-semibold flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Đơn hàng đã tồn tại trong hệ thống (Được đồng bộ đối soát tự động)</span>
                </div>
              )}

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
                <div className="grid grid-cols-2 gap-3 p-3 bg-bg/60 border border-border rounded-input text-xs">
                  <div>
                    <span className="text-text-secondary block font-medium">Tổng tiền đã rút:</span>
                    <span className="font-bold text-emerald-600 text-sm">{(selectedUser.totalWithdrawn || 0).toLocaleString('vi-VN')}đ</span>
                  </div>
                  <div>
                    <span className="text-text-secondary block font-medium">Hoàn tiền đơn hoàn thành:</span>
                    <span className="font-bold text-primary text-sm">{(selectedUser.completedOrderCashback || selectedUser.totalCashback || 0).toLocaleString('vi-VN')}đ</span>
                  </div>
                </div>
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
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-text/80">
                  Gán cho thành viên (Nhập mã User ID hoặc Email)
                </label>
                {editOrderUserId && (
                  <button
                    type="button"
                    onClick={() => setEditOrderUserId('')}
                    className="text-xs font-bold text-danger hover:underline flex items-center gap-1"
                    title="Bỏ gán thành viên cho đơn hàng này"
                  >
                    <X className="w-3.5 h-3.5" /> Xóa gán thành viên
                  </button>
                )}
              </div>
              <input
                type="text"
                value={editOrderUserId}
                onChange={(e) => setEditOrderUserId(e.target.value)}
                placeholder="Gõ mã User ID (vd: USR101, USR102) hoặc Email... Để trống nếu muốn HỦY GÁN."
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
                💡 <b>Mẹo:</b> Nhập <b>User ID</b> (vd: <code>USR101</code>) hoặc <b>Email</b>. Để trống ô này hoặc nhấp <b>Xóa gán thành viên</b> để chuyển đơn về trạng thái chưa xác định.
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
                * Khách sẽ được nhận hoàn tiền: <span className="text-primary font-bold">{Math.floor(((parseFloat(editOrderRealCashback) || 0) * (settings?.cashbackPercentage ?? 50) / 100)).toLocaleString('vi-VN')}đ</span> ({settings?.cashbackPercentage ?? 50}% hoa hồng).
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
                      <TableHead>Trạng Thái Hệ Thống</TableHead>
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
                        <TableCell className="max-w-[180px] font-medium text-xs">
                          <div className="truncate font-semibold" title={row.name}>{row.name || '-'}</div>
                          {(row.shopId || row.itemId) && (
                            <div className="flex flex-wrap gap-1 mt-0.5 text-[10px] text-text-secondary font-mono">
                              {row.shopId && <span className="bg-gray-100 text-gray-700 px-1 py-0.5 rounded" title={`Shop ID: ${row.shopId}`}>Shop: {row.shopId}</span>}
                              {row.itemId && <span className="bg-blue-50 text-blue-700 px-1 py-0.5 rounded" title={`Item ID: ${row.itemId}`}>Item: {row.itemId}</span>}
                            </div>
                          )}
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
                          {(row.status === 'matched' || row.status === 'duplicate') ? (
                            <Badge className="bg-emerald-100 text-emerald-800 font-bold border border-emerald-300 text-[10px]">
                              Tồn tại trong hệ thống
                            </Badge>
                          ) : row.status === 'invalid' ? (
                            <Badge variant="danger" className="text-[10px] font-bold">Lỗi dữ liệu</Badge>
                          ) : (
                            <Badge className="bg-amber-50 text-amber-800 font-bold border border-amber-300 text-[10px]">
                              Chưa có trong hệ thống
                            </Badge>
                          )}
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
                  <TableHead>Sàn</TableHead>
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
                    <TableCell colSpan={7} className="text-center py-12 text-xs text-text-secondary">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                      Đang tải danh sách đơn hàng của thành viên...
                    </TableCell>
                  </TableRow>
                ) : userOrdersList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-xs text-text-secondary font-medium">
                      Thành viên này chưa có đơn hàng nào phát sinh trên hệ thống.
                    </TableCell>
                  </TableRow>
                ) : (
                  userOrdersList.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>
                        {o.platform === 'tiktok' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-slate-900 text-white shadow-xs">
                            <TikTokIcon className="h-3 w-3" /> TikTok
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-orange-50 text-[#EE4D2D] border border-orange-200 shadow-xs">
                            <ShopeeIcon className="h-3 w-3" /> Shopee
                          </span>
                        )}
                      </TableCell>
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

      {/* CSV RECONCILIATION HELP & SAMPLE MODAL */}
      <Dialog isOpen={isCSVHelpModalOpen} onClose={() => setIsCSVHelpModalOpen(false)} className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-amber-500" />
            Hướng Dẫn & Ví Dụ Mẫu File CSV Đối Soát Shopee
          </DialogTitle>
        </DialogHeader>
        <DialogContent className="flex flex-col gap-4 text-left font-sans text-xs">
          <div className="bg-amber-50/70 border border-amber-200 p-3.5 rounded-input space-y-2 text-amber-900 font-medium">
            <p className="font-bold text-amber-950 text-sm flex items-center gap-1.5">
              📌 Quy tắc đối soát tự động & Giá chuẩn từ CSV:
            </p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li><b>Giá đơn hàng & Hoa hồng chuẩn:</b> Sau khi đối soát, số tiền đơn hàng và tiền hoàn thành viên sẽ được cập nhật <b>100% theo giá trị thực tế trong file CSV</b> (thay thế cho mọi giá trị tra cứu ước tính trước đó).</li>
              <li><b>Khớp theo Sub ID:</b> Cột <code>Sub_id1</code> chứa mã User ID duy nhất (ví dụ <code>USR101</code>) của thành viên.</li>
              <li><b>Đối soát thông minh dự phòng (Cùng ngày & Sản phẩm):</b> Nếu đơn hàng trong file đối soát không có Sub ID (do Shopee không lưu sub), hệ thống sẽ tự động tra khớp theo <b>Thời gian đặt cùng ngày</b> và <b>Thông tin sản phẩm/giá tiền</b> với các đơn chờ trong hệ thống, tự động tính đơn cho thành viên và cập nhật lại Mã Đơn theo ID đơn hàng từ file đối soát.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-bold text-text text-xs">Cấu trúc ví dụ các cột chuẩn trong file CSV đối soát:</span>
              <Button
                size="sm"
                onClick={downloadSampleReconciliationCSV}
                className="text-xs font-bold bg-primary text-white hover:bg-primary/90 flex items-center gap-1 py-1"
              >
                <Download className="w-3.5 h-3.5" /> Tải file mẫu .CSV
              </Button>
            </div>

            <div className="border border-border rounded-input overflow-x-auto">
              <table className="w-full text-left text-[11px] font-sans">
                <thead className="bg-bg border-b border-border font-bold text-text">
                  <tr>
                    <th className="p-2 whitespace-nowrap">ID đơn hàng</th>
                    <th className="p-2 whitespace-nowrap">Sub_id1</th>
                    <th className="p-2 whitespace-nowrap">Tên Item</th>
                    <th className="p-2 whitespace-nowrap text-right">Giá trị đơn (₫)</th>
                    <th className="p-2 whitespace-nowrap text-right">Hoa hồng ròng (₫)</th>
                    <th className="p-2 whitespace-nowrap">Trạng thái đặt hàng</th>
                    <th className="p-2 whitespace-nowrap">Thời gian đặt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  <tr className="bg-white">
                    <td className="p-2 font-bold text-primary">240917SP88123</td>
                    <td className="p-2 text-text font-bold">USR101</td>
                    <td className="p-2 font-sans font-medium max-w-[150px] truncate">Áo thun Polo Nam Cotton Cao Cấp Shopee Mall</td>
                    <td className="p-2 text-right font-bold font-sans">250.000đ</td>
                    <td className="p-2 text-right font-bold text-success font-sans">25.000đ</td>
                    <td className="p-2 font-sans"><Badge variant="success">Hoàn thành</Badge></td>
                    <td className="p-2 text-text-secondary whitespace-nowrap font-sans">17/09/2026 14:30</td>
                  </tr>
                  <tr className="bg-bg/20">
                    <td className="p-2 font-bold text-primary">240917SP88124</td>
                    <td className="p-2 text-text font-bold">USR102</td>
                    <td className="p-2 font-sans font-medium max-w-[150px] truncate">Giày Sneaker Thể Thao Nam Nữ Unisex</td>
                    <td className="p-2 text-right font-bold font-sans">450.000đ</td>
                    <td className="p-2 text-right font-bold text-success font-sans">45.000đ</td>
                    <td className="p-2 font-sans"><Badge variant="success">Hoàn thành</Badge></td>
                    <td className="p-2 text-text-secondary whitespace-nowrap font-sans">17/09/2026 15:10</td>
                  </tr>
                  <tr className="bg-white">
                    <td className="p-2 font-bold text-primary">240917SP88125</td>
                    <td className="p-2 text-danger italic font-semibold font-sans">(Trống - Khớp thông minh)</td>
                    <td className="p-2 font-sans font-medium max-w-[150px] truncate">Nước hoa nam Bleu De Chanel EDP 100ml</td>
                    <td className="p-2 text-right font-bold font-sans">1.200.000đ</td>
                    <td className="p-2 text-right font-bold text-success font-sans">120.000đ</td>
                    <td className="p-2 font-sans"><Badge variant="success">Giao thành công</Badge></td>
                    <td className="p-2 text-text-secondary whitespace-nowrap font-sans">17/09/2026 16:00</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-border/40">
            <Button type="button" variant="ghost" onClick={() => setIsCSVHelpModalOpen(false)} className="font-bold">
              Đóng hướng dẫn
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* CONFIRMATION MODAL: CLEAR ALL ORDERS & RESET BALANCES */}
      <Dialog isOpen={isClearAllModalOpen} onClose={() => setIsClearAllModalOpen(false)} className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <Trash2 className="w-5 h-5 text-red-600" />
            Xác Nhận Xóa Toàn Bộ Dữ Liệu Hệ Thống
          </DialogTitle>
        </DialogHeader>
        <DialogContent className="space-y-4 text-left font-sans text-xs">
          <div className="bg-red-50 border border-red-200 p-3.5 rounded-input space-y-2 text-red-900 font-medium">
            <p className="font-bold text-red-950 text-sm">⚠️ Cảnh báo hành động nguy hiểm:</p>
            <ul className="list-disc list-inside space-y-1 text-xs text-red-800">
              <li>Xóa toàn bộ <b>tất cả đơn hàng (orders)</b> trong hệ thống.</li>
              <li>Xóa lịch sử <b>lượt click (click_logs)</b> và <b>lịch sử rút tiền (withdrawals)</b>.</li>
              <li>Xóa nhật ký đối soát <b>reconciliation_logs</b> và <b>thông báo (notifications)</b>.</li>
              <li>Đưa số dư <b>ví thành viên (balance & total_cashback) của toàn bộ user về 0đ</b>.</li>
              <li>Chỉ giữ lại danh sách tài khoản <b>Users</b> và cấu hình <b>System Settings</b>.</li>
            </ul>
          </div>
          <p className="font-bold text-text text-xs">Bạn có chắc chắn muốn tiến hành xóa sạch dữ liệu để đối soát lại từ đầu?</p>
          <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
            <Button type="button" variant="ghost" onClick={() => setIsClearAllModalOpen(false)} disabled={isClearingOrders} className="font-bold">
              Hủy bỏ
            </Button>
            <Button type="button" onClick={handleClearAllOrders} disabled={isClearingOrders} className="bg-red-600 text-white hover:bg-red-700 font-bold flex items-center gap-1.5">
              {isClearingOrders ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Đồng ý Xóa Toàn Bộ & Reset Ví
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* CONFIRMATION MODAL: CLEAR UNASSIGNED ORDERS */}
      <Dialog isOpen={isClearUnassignedModalOpen} onClose={() => setIsClearUnassignedModalOpen(false)} className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <Trash2 className="w-5 h-5 text-amber-600" />
            Xóa Đơn Hàng Chưa Xác Định (Chưa gán User)
          </DialogTitle>
        </DialogHeader>
        <DialogContent className="space-y-4 text-left font-sans text-xs">
          <p className="text-text-secondary">
            Hành động này sẽ xóa tất cả các đơn hàng chưa có thành viên sở hữu (<code>user_id = null</code>). Các đơn hàng đã gán cho thành viên sẽ được giữ nguyên.
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
            <Button type="button" variant="ghost" onClick={() => setIsClearUnassignedModalOpen(false)} disabled={isClearingOrders} className="font-bold">
              Hủy bỏ
            </Button>
            <Button type="button" onClick={handleClearUnassignedOrders} disabled={isClearingOrders} className="bg-amber-600 text-white hover:bg-amber-700 font-bold flex items-center gap-1.5">
              {isClearingOrders ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Xác Nhận Xóa Đơn Chưa Gán
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* CREATE ORDER DIALOG */}
      <Dialog isOpen={isCreateOrderModalOpen} onClose={() => setIsCreateOrderModalOpen(false)} className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-emerald-700">
            <ShoppingBag className="w-5 h-5 text-emerald-600" />
            Tạo đơn hàng mới thủ công
          </DialogTitle>
        </DialogHeader>
        <DialogContent>
          <form onSubmit={handleCreateOrderSubmit} className="flex flex-col gap-4 text-left font-sans text-xs">
            {/* User Selection */}
            <div className="flex flex-col gap-1.5 relative">
              <label className="text-xs font-semibold text-text/80">
                Gán cho thành viên sở hữu đơn hàng <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newOrderForm.userId}
                onChange={(e) => setNewOrderForm(prev => ({ ...prev, userId: e.target.value }))}
                placeholder="Gõ User ID (vd: USR101, USR102) hoặc Email, Tên để tìm kiếm..."
                className="w-full px-4 py-2.5 bg-white border border-border text-xs rounded-input outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-semibold font-mono"
                required
              />

              {/* Dynamic Suggestions List */}
              {users && users.length > 0 && newOrderForm.userId.trim().length > 0 && (
                <div className="bg-white border border-border rounded-input shadow-lg max-h-[140px] overflow-y-auto p-1 text-xs space-y-1 z-10">
                  {users
                    .filter(u => 
                      u.id.toLowerCase().includes(newOrderForm.userId.toLowerCase()) ||
                      u.name.toLowerCase().includes(newOrderForm.userId.toLowerCase()) ||
                      (u.email && u.email.toLowerCase().includes(newOrderForm.userId.toLowerCase()))
                    )
                    .slice(0, 5)
                    .map((u) => (
                      <div
                        key={u.id}
                        onClick={() => setNewOrderForm(prev => ({ ...prev, userId: u.id }))}
                        className="px-3 py-1.5 hover:bg-emerald-50 rounded cursor-pointer flex justify-between items-center transition-all"
                      >
                        <div>
                          <span className="font-bold text-text">{u.name}</span>
                          <span className="text-text-secondary text-[11px] ml-2">({u.email || 'No email'})</span>
                        </div>
                        <span className="font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded text-[11px]">
                          {u.id}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Grid 2 cols for Order ID and Product Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text/80">
                  Mã đơn hàng (Order ID)
                </label>
                <input
                  type="text"
                  value={newOrderForm.id}
                  onChange={(e) => setNewOrderForm(prev => ({ ...prev, id: e.target.value }))}
                  placeholder="Để trống để tự sinh mã đơn"
                  className="w-full px-3 py-2 bg-white border border-border text-xs rounded-input outline-none focus:border-primary font-mono"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text/80">
                  Trạng thái ban đầu
                </label>
                <select
                  value={newOrderForm.status}
                  onChange={(e) => setNewOrderForm(prev => ({ ...prev, status: e.target.value as any }))}
                  className="w-full px-3 py-2 bg-white border border-border text-xs rounded-input outline-none focus:border-primary font-semibold"
                >
                  <option value="pending">Đang chờ xử lý (Pending)</option>
                  <option value="approved">Hoàn thành (Cộng tiền ví)</option>
                  <option value="rejected">Hủy (Rejected)</option>
                  <option value="returned">Hoàn hàng (Returned)</option>
                  <option value="paid">Đã thanh toán (Paid)</option>
                </select>
              </div>
            </div>

            {/* Product Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text/80">
                Tên sản phẩm <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newOrderForm.productName}
                onChange={(e) => setNewOrderForm(prev => ({ ...prev, productName: e.target.value }))}
                placeholder="Nhập tên sản phẩm..."
                className="w-full px-3 py-2 bg-white border border-border text-xs rounded-input outline-none focus:border-primary font-semibold"
                required
              />
            </div>

            {/* Shop ID & Item ID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text/80">
                  Shop ID Shopee (Tùy chọn)
                </label>
                <input
                  type="text"
                  value={newOrderForm.shopId}
                  onChange={(e) => setNewOrderForm(prev => ({ ...prev, shopId: e.target.value }))}
                  placeholder="vd: 12345678"
                  className="w-full px-3 py-2 bg-white border border-border text-xs rounded-input outline-none focus:border-primary font-mono"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text/80">
                  Item ID Shopee (Tùy chọn - Phục vụ đối soát)
                </label>
                <input
                  type="text"
                  value={newOrderForm.itemId}
                  onChange={(e) => setNewOrderForm(prev => ({ ...prev, itemId: e.target.value }))}
                  placeholder="vd: 9876543210"
                  className="w-full px-3 py-2 bg-white border border-border text-xs rounded-input outline-none focus:border-primary font-mono"
                />
              </div>
            </div>

            {/* Amounts: Order Amount, Shopee Commission, Cashback */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text/80">
                  Giá trị đơn (₫) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={newOrderForm.orderAmount}
                  onChange={(e) => setNewOrderForm(prev => ({ ...prev, orderAmount: e.target.value }))}
                  placeholder="vd: 250000"
                  className="w-full px-3 py-2 bg-white border border-border text-xs rounded-input outline-none focus:border-primary font-semibold"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text/80">
                  Hoa hồng Shopee (₫)
                </label>
                <input
                  type="number"
                  value={newOrderForm.shopeeCommission}
                  onChange={(e) => {
                    const comm = e.target.value;
                    const commNum = parseFloat(comm) || 0;
                    const autoCb = Math.floor(commNum * ((settings?.cashbackPercentage ?? 50) / 100));
                    setNewOrderForm(prev => ({
                      ...prev,
                      shopeeCommission: comm,
                      estimatedCashback: comm ? String(autoCb) : '',
                      realCashback: comm ? String(autoCb) : ''
                    }));
                  }}
                  placeholder="vd: 20000"
                  className="w-full px-3 py-2 bg-white border border-border text-xs rounded-input outline-none focus:border-primary font-semibold"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text/80">
                  Hoàn tiền cho khách (₫)
                </label>
                <input
                  type="number"
                  value={newOrderForm.realCashback || newOrderForm.estimatedCashback}
                  onChange={(e) => setNewOrderForm(prev => ({
                    ...prev,
                    realCashback: e.target.value,
                    estimatedCashback: e.target.value
                  }))}
                  placeholder="Tự tính hoặc nhập tay"
                  className="w-full px-3 py-2 bg-white border border-border text-xs rounded-input outline-none focus:border-primary font-semibold text-emerald-700"
                />
              </div>
            </div>
            <p className="text-[11px] text-text-secondary">
              💡 Tỉ lệ hoàn tiền hệ thống hiện tại là <b>{settings?.cashbackPercentage ?? 50}%</b> hoa hồng Shopee.
            </p>

            {/* Notes */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text/80">Ghi chú (Tùy chọn)</label>
              <textarea
                value={newOrderForm.notes}
                onChange={(e) => setNewOrderForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Ghi chú đối soát hoặc thông tin thêm về đơn hàng..."
                className="w-full px-3 py-2 bg-white border border-border text-xs rounded-input outline-none focus:border-primary min-h-[60px]"
              />
            </div>

            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border/40">
              <Button type="button" variant="ghost" onClick={() => setIsCreateOrderModalOpen(false)} disabled={isSubmittingOrder} className="font-bold">
                Hủy bỏ
              </Button>
              <Button type="submit" disabled={isSubmittingOrder} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5">
                {isSubmittingOrder ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Tạo đơn hàng
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* CREATE TIKTOK ORDER DIALOG */}
      <Dialog isOpen={isCreateTikTokModalOpen} onClose={() => setIsCreateTikTokModalOpen(false)} className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <span className="p-1 bg-slate-900 text-white rounded-md">
              <TikTokIcon className="w-4 h-4" />
            </span>
            Tạo đơn hàng TikTok Shop mới thủ công
          </DialogTitle>
        </DialogHeader>
        <DialogContent>
          <form onSubmit={handleCreateTikTokOrderSubmit} className="flex flex-col gap-4 text-left font-sans text-xs">
            {/* User Selection */}
            <div className="flex flex-col gap-1.5 relative">
              <label className="text-xs font-semibold text-text/80">
                Gán cho thành viên sở hữu đơn hàng (Tùy chọn)
              </label>
              <input
                type="text"
                value={newTikTokForm.userId}
                onChange={(e) => setNewTikTokForm(prev => ({ ...prev, userId: e.target.value }))}
                placeholder="Gõ User ID (vd: USR101) hoặc Email... Để trống nếu chưa xác định"
                className="w-full px-4 py-2.5 bg-white border border-border text-xs rounded-input outline-none focus:border-primary font-semibold font-mono"
              />
              {users && users.length > 0 && newTikTokForm.userId.trim().length > 0 && (
                <div className="bg-white border border-border rounded-input shadow-lg max-h-[140px] overflow-y-auto p-1 text-xs space-y-1 z-10">
                  {users
                    .filter(u =>
                      u.id.toLowerCase().includes(newTikTokForm.userId.toLowerCase()) ||
                      u.name.toLowerCase().includes(newTikTokForm.userId.toLowerCase()) ||
                      (u.email && u.email.toLowerCase().includes(newTikTokForm.userId.toLowerCase()))
                    )
                    .slice(0, 5)
                    .map((u) => (
                      <div
                        key={u.id}
                        onClick={() => setNewTikTokForm(prev => ({ ...prev, userId: u.id }))}
                        className="px-3 py-1.5 hover:bg-primary/10 rounded cursor-pointer flex justify-between items-center transition-all"
                      >
                        <div>
                          <span className="font-bold text-text">{u.name}</span>
                          <span className="text-text-secondary text-[11px] ml-2">({u.email})</span>
                        </div>
                        <span className="font-mono text-primary font-bold bg-primary/10 px-2 py-0.5 rounded text-[10px]">
                          {u.id}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text/80">Mã đơn hàng TikTok (Order ID)</label>
                <input
                  type="text"
                  value={newTikTokForm.id}
                  onChange={(e) => setNewTikTokForm(prev => ({ ...prev, id: e.target.value }))}
                  placeholder="Để trống hệ thống sẽ tự sinh mã TT..."
                  className="w-full px-3 py-2 bg-white border border-border text-xs rounded-input outline-none focus:border-primary font-mono"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text/80">Trạng thái ban đầu</label>
                <select
                  value={newTikTokForm.status}
                  onChange={(e) => setNewTikTokForm(prev => ({ ...prev, status: e.target.value as any }))}
                  className="w-full px-3 py-2 bg-white border border-border text-xs rounded-input outline-none focus:border-primary font-semibold"
                >
                  <option value="pending">Đang chờ xử lý (Pending)</option>
                  <option value="approved">Hoàn thành (Approved)</option>
                  <option value="rejected">Hủy (Rejected)</option>
                  <option value="returned">Hoàn hàng (Returned)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text/80">
                Tên sản phẩm TikTok Shop <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newTikTokForm.productName}
                onChange={(e) => setNewTikTokForm(prev => ({ ...prev, productName: e.target.value }))}
                placeholder="Nhập tên sản phẩm..."
                className="w-full px-3 py-2 bg-white border border-border text-xs rounded-input outline-none focus:border-primary"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text/80">Link ảnh sản phẩm (Image URL)</label>
              <input
                type="text"
                value={newTikTokForm.productImage}
                onChange={(e) => setNewTikTokForm(prev => ({ ...prev, productImage: e.target.value }))}
                placeholder="https://..."
                className="w-full px-3 py-2 bg-white border border-border text-xs rounded-input outline-none focus:border-primary"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text/80">
                  Giá trị đơn hàng (₫) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={newTikTokForm.orderAmount}
                  onChange={(e) => {
                    const amount = e.target.value;
                    const comm = Math.floor((Number(amount) || 0) * 0.1);
                    const cb = Math.floor(comm * ((settings?.cashbackPercentage ?? 50) / 100));
                    setNewTikTokForm(prev => ({
                      ...prev,
                      orderAmount: amount,
                      tiktokCommission: String(comm),
                      estimatedCashback: String(cb),
                      realCashback: String(cb)
                    }));
                  }}
                  placeholder="Vd: 250000"
                  className="w-full px-3 py-2 bg-white border border-border text-xs rounded-input outline-none focus:border-primary font-semibold"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text/80">Hoa hồng sàn 100% (₫)</label>
                <input
                  type="number"
                  value={newTikTokForm.tiktokCommission}
                  onChange={(e) => {
                    const comm = e.target.value;
                    const cb = Math.floor((Number(comm) || 0) * ((settings?.cashbackPercentage ?? 50) / 100));
                    setNewTikTokForm(prev => ({
                      ...prev,
                      tiktokCommission: comm,
                      estimatedCashback: String(cb),
                      realCashback: String(cb)
                    }));
                  }}
                  placeholder="Vd: 25000"
                  className="w-full px-3 py-2 bg-white border border-border text-xs rounded-input outline-none focus:border-primary font-semibold text-blue-600"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text/80">Hoàn tiền khách (₫)</label>
                <input
                  type="number"
                  value={newTikTokForm.realCashback || newTikTokForm.estimatedCashback}
                  onChange={(e) => setNewTikTokForm(prev => ({
                    ...prev,
                    realCashback: e.target.value,
                    estimatedCashback: e.target.value
                  }))}
                  placeholder="Vd: 12500"
                  className="w-full px-3 py-2 bg-white border border-border text-xs rounded-input outline-none focus:border-primary font-semibold text-[#EE4D2D]"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text/80">Ghi chú đơn hàng (Tùy chọn)</label>
              <textarea
                value={newTikTokForm.notes}
                onChange={(e) => setNewTikTokForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Ghi chú SubID, mã chiến dịch..."
                className="w-full px-3 py-2 bg-white border border-border text-xs rounded-input outline-none focus:border-primary min-h-[60px]"
              />
            </div>

            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border/40">
              <Button type="button" variant="ghost" onClick={() => setIsCreateTikTokModalOpen(false)} disabled={isSubmittingTikTokOrder} className="font-bold">
                Hủy bỏ
              </Button>
              <Button type="submit" disabled={isSubmittingTikTokOrder} className="bg-slate-900 hover:bg-slate-800 text-white font-bold flex items-center gap-1.5">
                {isSubmittingTikTokOrder ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Tạo đơn TikTok
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT TIKTOK ORDER MODAL */}
      <Dialog isOpen={editingTikTokOrder !== null} onClose={() => setEditingTikTokOrder(null)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="p-1 bg-slate-900 text-white rounded-md">
              <TikTokIcon className="w-4 h-4" />
            </span>
            Chỉnh sửa đơn hàng TikTok {editingTikTokOrder?.id}
          </DialogTitle>
        </DialogHeader>
        <DialogContent>
          {editingTikTokOrder && (
            <form onSubmit={handleUpdateTikTokStatus} className="flex flex-col gap-4 text-left font-sans text-xs">
              <div className="bg-bg border border-border/60 p-3 rounded-input">
                <p className="font-bold text-text truncate">{editingTikTokOrder.productName}</p>
                <p className="text-[11px] text-text-secondary mt-0.5">
                  Giá trị đơn: <b>{Math.floor(editingTikTokOrder.orderAmount).toLocaleString('vi-VN')}đ</b> | Tiền hoàn dự kiến: <b>{Math.floor(editingTikTokOrder.estimatedCashback).toLocaleString('vi-VN')}đ</b>
                </p>
              </div>

              {/* Gán User */}
              <div className="flex flex-col gap-1.5 relative">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-text/80">Thành viên sở hữu (Gán User ID)</label>
                  {editTikTokUserId && (
                    <button
                      type="button"
                      onClick={() => setEditTikTokUserId('')}
                      className="text-[10px] text-red-500 hover:underline font-bold"
                    >
                      Xóa gán thành viên
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={editTikTokUserId}
                  onChange={(e) => setEditTikTokUserId(e.target.value)}
                  placeholder="Gõ mã User ID (vd: USR101) hoặc Email... Để trống nếu HỦY GÁN."
                  className="w-full px-3 py-2 bg-white border border-border text-xs rounded-input outline-none focus:border-primary font-mono font-semibold"
                />
                {users && users.length > 0 && editTikTokUserId.trim().length > 0 && (
                  <div className="bg-white border border-border rounded-input shadow-lg max-h-[140px] overflow-y-auto p-1 text-xs space-y-1 z-10">
                    {users
                      .filter(u =>
                        u.id.toLowerCase().includes(editTikTokUserId.toLowerCase()) ||
                        u.name.toLowerCase().includes(editTikTokUserId.toLowerCase()) ||
                        (u.email && u.email.toLowerCase().includes(editTikTokUserId.toLowerCase()))
                      )
                      .slice(0, 5)
                      .map((u) => (
                        <div
                          key={u.id}
                          onClick={() => setEditTikTokUserId(u.id)}
                          className="px-3 py-1.5 hover:bg-primary/10 rounded cursor-pointer flex justify-between items-center transition-all"
                        >
                          <div>
                            <span className="font-bold text-text">{u.name}</span>
                            <span className="text-text-secondary text-[11px] ml-2">({u.email})</span>
                          </div>
                          <span className="font-mono text-primary font-bold bg-primary/10 px-2 py-0.5 rounded text-[10px]">
                            {u.id}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text/80">Trạng thái đơn hàng</label>
                  <select
                    value={editTikTokStatus}
                    onChange={(e) => {
                      const newStat = e.target.value as Order['status'];
                      setEditTikTokStatus(newStat);
                      if (newStat === 'approved' || newStat === 'paid') {
                        if (!editTikTokRealCashback || editTikTokRealCashback === '0') {
                          setEditTikTokRealCashback(String(Math.floor(editingTikTokOrder.estimatedCashback)));
                        }
                      } else if (newStat === 'rejected' || newStat === 'returned') {
                        setEditTikTokRealCashback('0');
                      }
                    }}
                    className="w-full px-3 py-2 bg-white border border-border text-xs rounded-input outline-none focus:border-primary font-semibold"
                  >
                    <option value="pending">Chờ xử lý (Pending)</option>
                    <option value="approved">Hoàn thành (Approved)</option>
                    <option value="rejected">Hủy (Rejected)</option>
                    <option value="returned">Hoàn hàng (Returned)</option>
                    <option value="paid">Đã thanh toán (Paid)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text/80">Hoàn tiền thực nhận (₫)</label>
                  <input
                    type="number"
                    value={editTikTokRealCashback}
                    onChange={(e) => setEditTikTokRealCashback(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-border text-xs rounded-input outline-none focus:border-primary font-semibold text-[#EE4D2D]"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text/80">Ghi chú đối soát</label>
                <textarea
                  value={editTikTokNotes}
                  onChange={(e) => setEditTikTokNotes(e.target.value)}
                  placeholder="Ghi chú..."
                  className="w-full px-3 py-2 bg-white border border-border text-xs rounded-input outline-none focus:border-primary min-h-[60px]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
                <Button type="button" variant="ghost" onClick={() => setEditingTikTokOrder(null)} className="font-bold">
                  Hủy bỏ
                </Button>
                <Button type="submit" className="bg-slate-900 hover:bg-slate-800 text-white font-bold">
                  Lưu thay đổi
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* CONFIRMATION MODAL: DELETE TIKTOK ORDER */}
      <Dialog isOpen={deletingTikTokOrder !== null} onClose={() => setDeletingTikTokOrder(null)} className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-danger">
            <Trash2 className="w-5 h-5 text-danger" />
            Xóa đơn hàng TikTok {deletingTikTokOrder?.id}
          </DialogTitle>
        </DialogHeader>
        <DialogContent className="space-y-4 text-left font-sans text-xs">
          <p className="text-text-secondary">
            Bạn có chắc chắn muốn xóa đơn hàng TikTok <b>{deletingTikTokOrder?.id}</b> ({deletingTikTokOrder?.productName})? Nếu đơn đã được cộng tiền hoàn, số dư của thành viên sẽ được tự động tính toán lại.
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
            <Button type="button" variant="ghost" onClick={() => setDeletingTikTokOrder(null)} className="font-bold">
              Hủy bỏ
            </Button>
            <Button type="button" onClick={() => deletingTikTokOrder && handleDeleteTikTokOrder(deletingTikTokOrder.id)} className="bg-danger text-white hover:bg-danger/90 font-bold">
              Xác nhận xóa
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* CONFIRMATION MODAL: CLEAR ALL TIKTOK ORDERS */}
      <Dialog isOpen={isClearTikTokModalOpen} onClose={() => setIsClearTikTokModalOpen(false)} className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <Trash2 className="w-5 h-5 text-red-600" />
            Xác Nhận Xóa Toàn Bộ Đơn TikTok
          </DialogTitle>
        </DialogHeader>
        <DialogContent className="space-y-4 text-left font-sans text-xs">
          <p className="text-text-secondary">
            Hành động này sẽ xóa toàn bộ đơn hàng trong bảng <b>tiktok_orders</b> và tự động đồng bộ lại số dư ví cho các thành viên. Bảng đơn hàng Shopee sẽ không bị ảnh hưởng.
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
            <Button type="button" variant="ghost" onClick={() => setIsClearTikTokModalOpen(false)} className="font-bold">
              Hủy bỏ
            </Button>
            <Button type="button" onClick={handleClearAllTikTokOrders} className="bg-red-600 text-white hover:bg-red-700 font-bold">
              Đồng ý xóa toàn bộ TikTok
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* CONFIRMATION MODAL: CLEAR UNASSIGNED TIKTOK ORDERS */}
      <Dialog isOpen={isClearUnassignedTikTokModalOpen} onClose={() => setIsClearUnassignedTikTokModalOpen(false)} className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <Trash2 className="w-5 h-5 text-amber-600" />
            Xóa Đơn TikTok Chưa Gán User
          </DialogTitle>
        </DialogHeader>
        <DialogContent className="space-y-4 text-left font-sans text-xs">
          <p className="text-text-secondary">
            Hành động này sẽ xóa tất cả các đơn hàng TikTok chưa có thành viên sở hữu (<code>user_id = null</code>). Các đơn TikTok đã gán sẽ được giữ nguyên.
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
            <Button type="button" variant="ghost" onClick={() => setIsClearUnassignedTikTokModalOpen(false)} className="font-bold">
              Hủy bỏ
            </Button>
            <Button type="button" onClick={handleClearUnassignedTikTokOrders} className="bg-amber-600 text-white hover:bg-amber-700 font-bold">
              Xác nhận xóa
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* TIKTOK ORDERS RECONCILIATION MODAL */}
      <Dialog isOpen={isRiohubReconcileModalOpen} onClose={() => setIsRiohubReconcileModalOpen(false)} className="max-w-5xl w-full">
        <DialogHeader>
          <div className="flex items-center justify-between w-full">
            <div>
              <DialogTitle className="flex items-center gap-2 text-text font-black text-lg">
                <span className="p-1.5 bg-slate-900 text-white rounded-lg">
                  <TikTokIcon className="h-4 w-4" />
                </span>
                Đối Soát Đơn Hàng TikTok Shop
              </DialogTitle>
              <p className="text-xs text-text-secondary mt-1">
                Truy vấn dữ liệu và đối soát trạng thái đơn hàng TikTok Shop tự động vào hệ thống hoàn tiền.
              </p>
            </div>
          </div>
        </DialogHeader>
        <DialogContent className="space-y-5 text-left font-sans text-xs max-h-[82vh] overflow-y-auto pr-1">
          {/* 1. FILTER CONTROLS */}
          <div className="bg-slate-50 p-4 rounded-xl border border-border/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-text uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-primary" />
                Bộ lọc tìm kiếm đơn hàng TikTok
              </span>
              <span className="text-[10px] text-text-secondary">
                Tối đa 200 đơn / lần tra cứu
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="font-bold text-text/80 block mb-1">
                  Creator Username <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={riohubFilters.creator_username}
                  onChange={(e) => setRiohubFilters(prev => ({ ...prev, creator_username: e.target.value }))}
                  placeholder="hungrevieweverything..."
                  className="w-full px-2.5 py-1.5 bg-white border border-border rounded-input text-xs outline-none focus:border-primary font-semibold"
                />
              </div>

              <div>
                <label className="font-bold text-text/80 block mb-1">
                  Mã đơn hàng (order_id)
                </label>
                <input
                  type="text"
                  value={riohubFilters.order_id}
                  onChange={(e) => setRiohubFilters(prev => ({ ...prev, order_id: e.target.value }))}
                  placeholder="1 hoặc nhiều mã cách nhau dấu phẩy..."
                  className="w-full px-2.5 py-1.5 bg-white border border-border rounded-input text-xs font-mono outline-none focus:border-primary"
                  title="Tra cứu 1 hoặc danh sách đơn (tối đa 200) để verify postback"
                />
              </div>

              <div>
                <label className="font-bold text-text/80 block mb-1">
                  Trạng thái đơn (status)
                </label>
                <select
                  value={riohubFilters.status}
                  onChange={(e) => setRiohubFilters(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full px-2.5 py-1.5 bg-white border border-border rounded-input text-xs outline-none focus:border-primary font-semibold"
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="1">1: Đang chờ xử lý (Pending)</option>
                  <option value="2">2: Đã đối soát xong (Settled)</option>
                  <option value="3">3: Đã hủy / Hoàn tiền (Cancelled/Refunded)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-text/80 block mb-1">
                  Settlement Status
                </label>
                <select
                  value={riohubFilters.settlement_status}
                  onChange={(e) => setRiohubFilters(prev => ({ ...prev, settlement_status: e.target.value }))}
                  className="w-full px-2.5 py-1.5 bg-white border border-border rounded-input text-xs outline-none focus:border-primary font-semibold"
                >
                  <option value="">Tất cả</option>
                  <option value="SETTLED">SETTLED (Đã quyết toán)</option>
                  <option value="AWAITING PAYMENT">AWAITING PAYMENT (Chờ TT)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-text/80 block mb-1">
                  Ngày tạo từ (time_start)
                </label>
                <input
                  type="date"
                  value={riohubFilters.time_start}
                  onChange={(e) => setRiohubFilters(prev => ({ ...prev, time_start: e.target.value }))}
                  className="w-full px-2.5 py-1.5 bg-white border border-border rounded-input text-xs outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="font-bold text-text/80 block mb-1">
                  Ngày tạo đến (time_end)
                </label>
                <input
                  type="date"
                  value={riohubFilters.time_end}
                  onChange={(e) => setRiohubFilters(prev => ({ ...prev, time_end: e.target.value }))}
                  className="w-full px-2.5 py-1.5 bg-white border border-border rounded-input text-xs outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="font-bold text-text/80 block mb-1">
                  Cập nhật sau mốc (update_time_start)
                </label>
                <input
                  type="text"
                  value={riohubFilters.update_time_start}
                  onChange={(e) => setRiohubFilters(prev => ({ ...prev, update_time_start: e.target.value }))}
                  placeholder="Unix timestamp (sync tăng dần)..."
                  className="w-full px-2.5 py-1.5 bg-white border border-border rounded-input text-xs font-mono outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="font-bold text-text/80 block mb-1">
                    Số lượng (page_size)
                  </label>
                  <select
                    value={riohubFilters.page_size}
                    onChange={(e) => setRiohubFilters(prev => ({ ...prev, page_size: e.target.value }))}
                    className="w-full px-2 py-1.5 bg-white border border-border rounded-input text-xs outline-none focus:border-primary font-semibold"
                  >
                    <option value="20">20 đơn</option>
                    <option value="50">50 đơn</option>
                    <option value="100">100 đơn</option>
                    <option value="200">200 đơn</option>
                  </select>
                </div>
                <Button
                  onClick={handleQueryRiohubOrders}
                  disabled={isQueryingRiohub}
                  className="h-8.5 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm shrink-0"
                >
                  <Search className={`h-3.5 w-3.5 ${isQueryingRiohub ? 'animate-spin' : ''}`} />
                  {isQueryingRiohub ? 'Đang gọi...' : 'Truy vấn'}
                </Button>
              </div>
            </div>
          </div>

          {/* 2. PREVIEW & RESULTS */}
          {riohubOrdersResult && (
            <div className="space-y-3">
              {/* Summary Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-2.5 bg-white rounded-xl border border-border/60">
                  <span className="text-[10px] font-bold text-text-secondary block">Tổng đơn tải về</span>
                  <span className="text-base font-black text-text">
                    {riohubOrdersResult.orders.length} <span className="text-[11px] font-normal text-text-secondary">/ {riohubOrdersResult.total || 0}</span>
                  </span>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-border/60">
                  <span className="text-[10px] font-bold text-text-secondary block">Đơn đã Settled</span>
                  <span className="text-base font-black text-emerald-600">
                    {riohubOrdersResult.orders.filter((o: any) => o.status === 2 || String(o.settlement_status).toUpperCase() === 'SETTLED').length}
                  </span>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-border/60">
                  <span className="text-[10px] font-bold text-text-secondary block">Tổng GMV</span>
                  <span className="text-base font-black text-text">
                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
                      riohubOrdersResult.orders.reduce((sum: number, o: any) => sum + (Number(o.order_amount) || 0), 0)
                    )}
                  </span>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-border/60">
                  <span className="text-[10px] font-bold text-text-secondary block">Tổng hoa hồng sàn</span>
                  <span className="text-base font-black text-[#EE4D2D]">
                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
                      riohubOrdersResult.orders.reduce((sum: number, o: any) => sum + (Number(o.commission_amount) || 0), 0)
                    )}
                  </span>
                </div>
              </div>

              {/* Table of Orders from RioHub */}
              <div className="border border-border/60 rounded-xl overflow-hidden bg-white shadow-xs">
                <div className="p-2.5 bg-slate-100 border-b border-border/60 flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-text">
                    <input
                      type="checkbox"
                      checked={selectedRiohubOrderIds.length > 0 && selectedRiohubOrderIds.length === riohubOrdersResult.orders.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRiohubOrderIds(riohubOrdersResult.orders.map((o: any) => o.order_id));
                        } else {
                          setSelectedRiohubOrderIds([]);
                        }
                      }}
                      className="rounded border-border w-3.5 h-3.5 text-slate-900 cursor-pointer"
                    />
                    Chọn tất cả ({selectedRiohubOrderIds.length}/{riohubOrdersResult.orders.length})
                  </label>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => handleApplyRiohubReconciliation(true)}
                      disabled={isReconcilingRiohub || selectedRiohubOrderIds.length === 0}
                      className="h-7.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs"
                    >
                      <Check className={`h-3.5 w-3.5 ${isReconcilingRiohub ? 'animate-spin' : ''}`} />
                      {isReconcilingRiohub ? 'Đang đối soát...' : `Đối soát đơn đã chọn (${selectedRiohubOrderIds.length})`}
                    </Button>
                    <Button
                      onClick={() => handleApplyRiohubReconciliation(false)}
                      disabled={isReconcilingRiohub || riohubOrdersResult.orders.length === 0}
                      className="h-7.5 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1 shadow-xs"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isReconcilingRiohub ? 'animate-spin' : ''}`} />
                      Đối soát tất cả
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[340px]">
                  <TableContainer>
                    <TableHeader className="sticky top-0 bg-slate-50 z-10 text-[11px]">
                      <TableRow>
                        <TableHead className="w-8 text-center">#</TableHead>
                        <TableHead>Mã đơn</TableHead>
                        <TableHead>Sản phẩm & Shop</TableHead>
                        <TableHead className="text-right">GMV</TableHead>
                        <TableHead className="text-right">Hoa hồng sàn</TableHead>
                        <TableHead className="text-right">Hoàn tiền</TableHead>
                        <TableHead className="text-center">Trạng thái sàn</TableHead>
                        <TableHead>Thành viên khớp</TableHead>
                        <TableHead className="text-center">Trạng Thái Hệ Thống</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-xs">
                      {riohubOrdersResult.orders.map((o: any) => {
                        const isSelected = selectedRiohubOrderIds.includes(o.order_id);
                        const isSettled = o.status === 2 || String(o.settlement_status).toUpperCase() === 'SETTLED';
                        const isCancelled = o.status === 3 || o.fully_refunded === 1 || String(o.settlement_status).toUpperCase().includes('REFUND') || String(o.settlement_status).toUpperCase().includes('CANCEL');

                        return (
                          <TableRow key={o.order_id} className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-indigo-50/30' : ''}`}>
                            <TableCell className="text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedRiohubOrderIds(prev => [...prev, o.order_id]);
                                  } else {
                                    setSelectedRiohubOrderIds(prev => prev.filter(id => id !== o.order_id));
                                  }
                                }}
                                className="rounded border-border w-3.5 h-3.5 text-slate-900 cursor-pointer"
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col font-mono text-[11px]">
                                <span className="font-bold text-text">{o.order_id}</span>
                                <span className="text-[10px] text-text-secondary">{o.time_created || 'N/A'}</span>
                              </div>
                            </TableCell>
                            <TableCell className="max-w-[200px]">
                              <p className="font-bold text-text truncate text-xs" title={o.product_name}>
                                {o.product_name || 'Sản phẩm TikTok Shop'}
                              </p>
                              <div className="flex items-center gap-1.5 text-[10px] text-text-secondary mt-0.5">
                                <span>{o.shop_name || 'TikTok Shop'}</span>
                                {o.sub_id && (
                                  <span className="bg-slate-100 px-1 rounded font-mono truncate max-w-[90px]" title={o.sub_id}>
                                    {o.sub_id}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-bold text-text">
                              {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(o.order_amount || 0)}
                            </TableCell>
                            <TableCell className="text-right font-bold text-emerald-600">
                              {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(o.commission_amount || 0)}
                            </TableCell>
                            <TableCell className="text-right font-bold text-[#EE4D2D]">
                              {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(o.estimated_cashback || 0)}
                            </TableCell>
                            <TableCell className="text-center">
                              {isSettled ? (
                                <Badge className="bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                  SETTLED
                                </Badge>
                              ) : isCancelled ? (
                                <Badge className="bg-red-100 text-red-800 text-[10px] font-bold">
                                  HỦY / HOÀN
                                </Badge>
                              ) : (
                                <Badge className="bg-amber-100 text-amber-800 text-[10px] font-bold">
                                  {o.settlement_status || 'PENDING'}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {o.matched_user ? (
                                <div className="text-[11px]">
                                  <p className="font-bold text-text">{o.matched_user.name}</p>
                                  <p className="text-[10px] text-text-secondary truncate max-w-[120px]">{o.matched_user.email}</p>
                                </div>
                              ) : (
                                <span className="text-[10px] text-amber-600 font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                  Chưa gán User
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {o.is_imported ? (
                                <Badge className="text-[10px] bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
                                  Tồn tại trong hệ thống ({o.local_status || 'đã lưu'})
                                </Badge>
                              ) : (
                                <Badge className="text-[10px] bg-amber-50 text-amber-800 font-bold border border-amber-300">
                                  Chưa có trong hệ thống
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </TableContainer>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-border/40">
            <p className="text-[11px] text-text-secondary">
              * Đơn <b>SETTLED</b> sẽ tự động kích hoạt tính năng cộng tiền hoàn vào số dư khả dụng của thành viên.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsRiohubReconcileModalOpen(false)}
              className="font-bold text-xs"
            >
              Đóng
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
