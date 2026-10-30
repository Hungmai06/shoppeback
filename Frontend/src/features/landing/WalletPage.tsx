import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';
import type { Withdrawal } from '../../store/appStore';
import { 
  Lock, Wallet, Landmark, Search, ArrowDownLeft, ArrowUpRight,
  ShoppingBag, Users, Gift, Sparkles, CheckCircle2
} from 'lucide-react';
import { Button, Card, CardContent, Badge } from '../../components/ui/core';
import { toast } from 'sonner';

interface ReferralCreditItem {
  id: string;
  orderId: string;
  f1Id: string;
  f1Name: string;
  f1Email?: string;
  productName: string;
  productImage?: string;
  platform: 'shopee' | 'tiktok';
  orderAmount: number;
  tier: string;
  baseCashback: number;
  bonus: number;
  status: string;
  isCompleted: boolean;
  statusLabel: string;
  createdAt: string;
}

interface CreditTransaction {
  id: string;
  amount: number;
  sourceType: 'shopee' | 'tiktok' | 'referral' | 'promo';
  sourceLabel: string;
  title: string;
  subtitle: string;
  status: 'credited';
  createdAt: string;
}

export default function WalletPage() {
  const navigate = useNavigate();
  const {
    currentUser,
    withdrawals,
    orders,
    addWithdrawalRequest,
    updateProfile,
    fetchUserOrders,
    fetchUserWithdrawals
  } = useAppStore();
  const isLoggedIn = !!currentUser;

  // Form states
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'bank' | 'wallet'>('bank');
  
  // Bank fields
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');

  // Wallet fields
  const [walletName, setWalletName] = useState('MoMo');
  const [walletPhone, setWalletPhone] = useState('');
  const [walletHolder, setWalletHolder] = useState('');

  // History Tab State ('withdrawals' | 'credits')
  const [historyTab, setHistoryTab] = useState<'withdrawals' | 'credits'>('credits');

  // Search & Filter states for Withdrawals
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Search & Filter states for Credits (Lịch sử cộng tiền)
  const [creditSearchTerm, setCreditSearchTerm] = useState('');
  const [creditSourceFilter, setCreditSourceFilter] = useState<'all' | 'shopee' | 'tiktok' | 'referral' | 'promo'>('all');
  const [referralHistory, setReferralHistory] = useState<ReferralCreditItem[]>([]);

  // Fetch latest orders, withdrawals, and referral history when logged in
  useEffect(() => {
    if (!isLoggedIn) {
      setReferralHistory([]);
      return;
    }

    fetchUserOrders();
    fetchUserWithdrawals();

    const loadReferralHistory = async () => {
      try {
        const token = localStorage.getItem('token');
        const apiBase = import.meta.env.VITE_API_BASE || '/api';
        const res = await fetch(`${apiBase}/referrals/history`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setReferralHistory(data);
          }
        }
      } catch {
        // Ignore network error quietly
      }
    };

    loadReferralHistory();
  }, [isLoggedIn, fetchUserOrders, fetchUserWithdrawals]);

  // Load profile data into form fields on mount or user change
  useEffect(() => {
    if (currentUser) {
      const isWallet = ['MoMo', 'ZaloPay', 'Viettel Money', 'ShopeePay'].includes(currentUser.bankName || '');
      if (isWallet) {
        setPaymentMethod('wallet');
        setWalletName(currentUser.bankName || 'MoMo');
        setWalletPhone(currentUser.accountNumber || '');
        setWalletHolder(currentUser.accountHolder || '');
      } else {
        setPaymentMethod('bank');
        setBankName(currentUser.bankName || '');
        setAccountNumber(currentUser.accountNumber || '');
        setAccountHolder(currentUser.accountHolder || '');
      }
    }
  }, [currentUser]);

  // Orders and withdrawals for current user
  const userOrders = isLoggedIn
    ? orders.filter(o => o.userId === currentUser.id)
    : [];

  const activeWithdrawals = isLoggedIn
    ? withdrawals.filter(w => w.userId === currentUser.id)
    : [];

  const pendingReferralBonus = isLoggedIn
    ? referralHistory
        .filter(r => !r.isCompleted && r.status !== 'rejected' && r.status !== 'cancelled')
        .reduce((sum, r) => sum + Math.floor(r.bonus || 0), 0)
    : 0;

  const approvedReferralBonus = isLoggedIn
    ? (currentUser.referralEarnings && currentUser.referralEarnings > 0
        ? Math.floor(currentUser.referralEarnings)
        : referralHistory.filter(r => r.isCompleted).reduce((sum, r) => sum + Math.floor(r.bonus || 0), 0))
    : 0;

  const pendingCashback = isLoggedIn 
    ? userOrders.filter(o => o.status === 'pending').reduce((sum, o) => sum + o.estimatedCashback, 0) + pendingReferralBonus
    : 0;

  const approvedOrderCashback = isLoggedIn
    ? userOrders.filter(o => o.status === 'approved' || o.status === 'paid').reduce((sum, o) => sum + (o.realCashback || o.estimatedCashback), 0)
    : 0;

  const approvedCashback = isLoggedIn
    ? approvedOrderCashback + approvedReferralBonus
    : 0;

  const paidWithdrawals = isLoggedIn
    ? withdrawals.filter(w => w.userId === currentUser.id && w.status === 'approved').reduce((sum, w) => sum + w.amount, 0)
    : 0;

  // Available to withdraw: Authoritative balance from user profile / DB
  const availableBalance = isLoggedIn
    ? Math.max(0, currentUser.balance || 0)
    : 0;

  // Build unified list of Credit Transactions (Lịch sử cộng tiền - CHỈ TÍNH ĐƠN ĐÃ HOÀN THÀNH)
  const creditTransactions = useMemo<CreditTransaction[]>(() => {
    if (!isLoggedIn) return [];

    const items: CreditTransaction[] = [];

    // 1. Hoàn tiền mua sắm từ đơn Shopee & TikTok Shop ĐÃ HOÀN THÀNH (approved / paid)
    userOrders
      .filter(o => o.status === 'approved' || o.status === 'paid')
      .forEach(o => {
        const isTikTok = (o as any).platform === 'tiktok' || String(o.id).startsWith('TT');
        const isBonusOrPromo = Boolean(
          o.notes && /(ưu đãi|thưởng|khuyến mãi|bonus|promo|event|sự kiện)/i.test(o.notes)
        );
        const amount = Math.floor(
          o.realCashback !== undefined && o.realCashback !== null ? o.realCashback : (o.estimatedCashback || 0)
        );

        if (isBonusOrPromo) {
          items.push({
            id: `ORD-PROMO-${o.id}`,
            amount,
            sourceType: 'promo',
            sourceLabel: 'Chương trình ưu đãi',
            title: o.productName || 'Thưởng chương trình ưu đãi',
            subtitle: `Mã tham chiếu: #${o.id}${o.notes ? ` • ${o.notes}` : ''}`,
            status: 'credited',
            createdAt: o.createdTime || ''
          });
        } else {
          items.push({
            id: `ORD-${o.id}`,
            amount,
            sourceType: isTikTok ? 'tiktok' : 'shopee',
            sourceLabel: isTikTok ? 'Hoàn tiền TikTok Shop' : 'Hoàn tiền Shopee',
            title: o.productName || (isTikTok ? 'Đơn hàng TikTok Shop' : 'Đơn hàng Shopee'),
            subtitle: `Mã đơn: #${o.id} • Giá trị đơn: ${Math.floor(o.orderAmount || 0).toLocaleString('vi-VN')}đ`,
            status: 'credited',
            createdAt: o.createdTime || ''
          });
        }
      });

    // 2. Hoa hồng từ đơn giới thiệu bạn bè (F1 +20%) ĐÃ HOÀN THÀNH
    referralHistory
      .filter(r => r.isCompleted || r.status === 'approved' || r.status === 'paid')
      .forEach(r => {
        const amount = Math.floor(r.bonus || 0);
        const platformName = r.platform === 'tiktok' ? 'TikTok Shop' : 'Shopee';
        items.push({
          id: `REF-${r.id}-${r.orderId}`,
          amount,
          sourceType: 'referral',
          sourceLabel: 'Đơn giới thiệu F1 (+20%)',
          title: `Hoa hồng giới thiệu từ ${r.f1Name || 'Thành viên F1'}`,
          subtitle: `Đơn ${platformName} #${r.orderId}: ${r.productName || 'Sản phẩm mua sắm'} • Hoàn gốc F1: ${Math.floor(r.baseCashback || 0).toLocaleString('vi-VN')}đ`,
          status: 'credited',
          createdAt: r.createdAt || ''
        });
      });

    // 3. Hoàn lại tiền vào ví khi lệnh rút bị từ chối hoặc chương trình hoàn ví
    activeWithdrawals
      .filter(w => w.status === 'rejected')
      .forEach(w => {
        items.push({
          id: `REFUND-WD-${w.id}`,
          amount: Math.floor(w.amount || 0),
          sourceType: 'promo',
          sourceLabel: 'Hoàn lại số dư ví',
          title: `Hoàn lại tiền vào ví từ lệnh rút #${w.id}`,
          subtitle: `${w.bankName} (${w.accountNumber})${w.notes ? ` • Lý do: ${w.notes}` : ' • Đã cộng trả lại vào số dư ví'}`,
          status: 'credited',
          createdAt: w.processedDate || w.requestDate || ''
        });
      });

    return items.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
    });
  }, [isLoggedIn, userOrders, referralHistory, activeWithdrawals]);

  const filteredCredits = useMemo(() => {
    return creditTransactions.filter(tx => {
      if (creditSourceFilter !== 'all' && tx.sourceType !== creditSourceFilter) return false;

      if (creditSearchTerm.trim() !== '') {
        const q = creditSearchTerm.toLowerCase();
        const matchTitle = tx.title.toLowerCase().includes(q);
        const matchSub = tx.subtitle.toLowerCase().includes(q);
        const matchSource = tx.sourceLabel.toLowerCase().includes(q);
        if (!matchTitle && !matchSub && !matchSource) return false;
      }

      return true;
    });
  }, [creditTransactions, creditSourceFilter, creditSearchTerm]);

  const getCreditSourceBadge = (sourceType: CreditTransaction['sourceType'], label: string) => {
    switch (sourceType) {
      case 'shopee':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-orange-50 text-[#EE4D2D] border border-orange-200/80">
            <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
            {label}
          </span>
        );
      case 'tiktok':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-900 text-white border border-slate-800">
            <Sparkles className="w-3.5 h-3.5 text-[#00F2FE] shrink-0" />
            {label}
          </span>
        );
      case 'referral':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <Users className="w-3.5 h-3.5 shrink-0" />
            {label}
          </span>
        );
      case 'promo':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Gift className="w-3.5 h-3.5 shrink-0" />
            {label}
          </span>
        );
    }
  };

  const getCreditStatusBadge = () => (
    <Badge className="bg-emerald-500 text-white border-none text-[10px] py-0.5 px-2.5 font-bold inline-flex items-center gap-1">
      <CheckCircle2 className="w-3 h-3" />
      Đã cộng vào ví
    </Badge>
  );

  const handleWithdrawalRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseInt(withdrawAmount);
    
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Vui lòng nhập số tiền rút hợp lệ');
      return;
    }

    if (amountNum < 50000) {
      toast.error('Số tiền rút tối thiểu là 50.000đ');
      return;
    }

    if (amountNum > availableBalance) {
      toast.error('Số tiền rút vượt quá số dư khả dụng');
      return;
    }

    const finalBankName = paymentMethod === 'bank' ? bankName : walletName;
    const finalAccountNumber = paymentMethod === 'bank' ? accountNumber : walletPhone;
    const finalAccountHolder = (paymentMethod === 'bank' ? accountHolder : walletHolder).toUpperCase();

    if (!finalBankName.trim() || !finalAccountNumber.trim() || !finalAccountHolder.trim()) {
      toast.error('Vui lòng nhập đầy đủ thông tin thanh toán');
      return;
    }

    // Auto-update profile with current withdrawal destination details
    updateProfile({
      bankName: finalBankName,
      accountNumber: finalAccountNumber,
      accountHolder: finalAccountHolder
    });

    const success = await addWithdrawalRequest(
      amountNum, 
      finalBankName, 
      finalAccountNumber, 
      finalAccountHolder
    );

    if (success) {
      toast.success('Gửi yêu cầu rút tiền thành công! Vui lòng chờ đối soát.');
      setWithdrawAmount('');
    } else {
      toast.error('Không thể tạo yêu cầu rút tiền. Vui lòng kiểm tra lại số dư.');
    }
  };

  const getWithdrawalBadge = (status: Withdrawal['status']) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-amber-500 text-white border-none text-[10px] py-0.5 px-2 font-bold">Đang xử lý</Badge>;
      case 'approved':
        return <Badge className="bg-emerald-500 text-white border-none text-[10px] py-0.5 px-2 font-bold">Thành công</Badge>;
      case 'rejected':
        return <Badge className="bg-rose-500 text-white border-none text-[10px] py-0.5 px-2 font-bold">Bị từ chối</Badge>;
      default:
        return null;
    }
  };

  // Filtered withdrawals list
  const filteredWithdrawals = activeWithdrawals.filter(w => {
    const matchesSearch = searchTerm.trim() === '' || 
      w.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (w.bankName && w.bankName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (w.accountNumber && w.accountNumber.includes(searchTerm)) ||
      (w.accountHolder && w.accountHolder.toLowerCase().includes(searchTerm.toLowerCase()));
      
    const matchesStatus = statusFilter === 'all' || w.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative">
      {/* PAGE HEADER */}
      <div className="text-center max-w-3xl mx-auto mb-12">
        <span className="px-3.5 py-1.5 bg-primary/10 text-primary font-bold text-xs uppercase tracking-wider rounded-full mb-4 inline-block">
          Ví & Rút tiền
        </span>
        <h1 className="text-3xl md:text-5xl font-black text-text mb-4 leading-tight">
          Quản Lý <span className="gradient-text">Ví & Số Dư Hoàn Tiền</span>
        </h1>
        <p className="text-sm md:text-base text-text-secondary">
          Liên kết tài khoản ngân hàng hoặc ví điện tử để thực hiện rút tiền mặt về nhanh chóng, an toàn.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative">
        {/* LEFT COLUMN: WITHDRAWAL FORM */}
        <div className="lg:col-span-7 flex flex-col gap-8 relative">
          
          {/* GUEST BLUR GATING */}
          {!isLoggedIn && (
            <div className="absolute inset-0 bg-white/45 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-6 text-center rounded-2xl">
              <div className="max-w-md bg-white p-8 rounded-card shadow-soft border border-primary/10 flex flex-col items-center animate-fade-in">
                <div className="bg-primary/10 p-4 rounded-full text-primary mb-5">
                  <Lock className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-black text-text mb-3 leading-tight">Đăng nhập để rút tiền</h3>
                <p className="text-xs text-text-secondary leading-relaxed mb-6">
                  Bạn cần đăng nhập tài khoản thành viên để thực hiện liên kết ngân hàng và tạo yêu cầu thanh toán.
                </p>
                <div className="flex gap-4 w-full justify-center">
                  <Button onClick={() => navigate('/auth')} className="px-6 font-bold py-2.5">Đăng nhập ngay</Button>
                  <Button variant="outline" onClick={() => navigate('/auth')} className="px-6 font-bold py-2.5 border-border">Đăng ký</Button>
                </div>
              </div>
            </div>
          )}

          {/* REQUEST FORM CARD */}
          <Card className="border border-border/50 bg-white shadow-soft text-left rounded-2xl">
            <CardContent className="p-6 md:p-8">
              <h3 className="text-lg font-black text-text mb-6">Tạo lệnh rút tiền</h3>
              
              <form onSubmit={handleWithdrawalRequest} className="space-y-5">
                {/* Amount field */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">SỐ TIỀN CẦN RÚT (VND)</label>
                  <input
                    type="number"
                    placeholder="Ví dụ: 50000"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-border text-sm rounded-input outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-semibold"
                    required
                  />
                  <p className="text-[10px] text-text-secondary font-medium">
                    Rút tối thiểu: <span className="font-bold text-text">50.000đ</span>. Phí rút: <span className="font-bold text-success">Miễn phí</span>
                  </p>
                </div>

                {/* Payment Method Selector */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">HÌNH THỨC NHẬN TIỀN</label>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Bank Option */}
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('bank')}
                      className={`flex items-center justify-center gap-3 p-3.5 border rounded-input transition-all ${
                        paymentMethod === 'bank' 
                          ? 'border-primary bg-primary/5 text-primary ring-2 ring-primary/10 font-bold' 
                          : 'border-border bg-white text-text-secondary font-semibold hover:bg-bg/50'
                      }`}
                    >
                      <Landmark className="h-4.5 w-4.5" />
                      <span className="text-xs md:text-sm">Ngân hàng</span>
                    </button>

                    {/* E-wallet Option */}
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('wallet')}
                      className={`flex items-center justify-center gap-3 p-3.5 border rounded-input transition-all ${
                        paymentMethod === 'wallet' 
                          ? 'border-primary bg-primary/5 text-primary ring-2 ring-primary/10 font-bold' 
                          : 'border-border bg-white text-text-secondary font-semibold hover:bg-bg/50'
                      }`}
                    >
                      <Wallet className="h-4.5 w-4.5" />
                      <span className="text-xs md:text-sm">Ví điện tử</span>
                    </button>
                  </div>
                </div>

                {/* Conditional Form Fields */}
                {paymentMethod === 'bank' ? (
                  <>
                    {/* Bank Destination Selection */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">TÊN NGÂN HÀNG NHẬN</label>
                      <select
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-border text-sm rounded-input outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-semibold"
                        required
                      >
                        <option value="">-- Chọn ngân hàng nhận --</option>
                        <option value="Vietcombank">Vietcombank</option>
                        <option value="Techcombank">Techcombank</option>
                        <option value="VietinBank">VietinBank</option>
                        <option value="BIDV">BIDV</option>
                        <option value="MB Bank">MB Bank</option>
                        <option value="Agribank">Agribank</option>
                        <option value="VPBank">VPBank</option>
                        <option value="ACB">ACB</option>
                        <option value="TPBank">TPBank</option>
                        <option value="Sacombank">Sacombank</option>
                      </select>
                    </div>

                    {/* Bank Account Number */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">SỐ TÀI KHOẢN NGÂN HÀNG</label>
                      <input
                        type="text"
                        placeholder="Nhập số tài khoản/số điện thoại nhận tiền..."
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-border text-sm rounded-input outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-semibold"
                        required
                      />
                    </div>

                    {/* Account Holder Name */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">HỌ TÊN CHỦ TÀI KHOẢN</label>
                      <input
                        type="text"
                        placeholder="VIET HOA KHONG DAU (VÍ DỤ: NGUYEN VAN A)..."
                        value={accountHolder}
                        onChange={(e) => setAccountHolder(e.target.value.toUpperCase())}
                        className="w-full px-4 py-3 bg-white border border-border text-sm rounded-input outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-semibold"
                        required
                      />
                    </div>
                  </>
                ) : (
                  <>
                    {/* E-wallet Destination Selection */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">TÊN VÍ ĐIỆN TỬ</label>
                      <select
                        value={walletName}
                        onChange={(e) => setWalletName(e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-border text-sm rounded-input outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-semibold"
                        required
                      >
                        <option value="MoMo">MoMo</option>
                        <option value="ZaloPay">ZaloPay</option>
                        <option value="Viettel Money">Viettel Money</option>
                        <option value="ShopeePay">ShopeePay</option>
                      </select>
                    </div>

                    {/* E-wallet Phone Number */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">SỐ ĐIỆN THOẠI ĐĂNG KÝ VÍ</label>
                      <input
                        type="text"
                        placeholder="Nhập số điện thoại đăng ký ví..."
                        value={walletPhone}
                        onChange={(e) => setWalletPhone(e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-border text-sm rounded-input outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-semibold"
                        required
                      />
                    </div>

                    {/* E-wallet Account Holder */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">HỌ TÊN CHỦ TÀI KHOẢN VÍ</label>
                      <input
                        type="text"
                        placeholder="VIET HOA KHONG DAU (VÍ DỤ: NGUYEN VAN A)..."
                        value={walletHolder}
                        onChange={(e) => setWalletHolder(e.target.value.toUpperCase())}
                        className="w-full px-4 py-3 bg-white border border-border text-sm rounded-input outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-semibold"
                        required
                      />
                    </div>
                  </>
                )}

                <button 
                  type="submit" 
                  className="w-full bg-primary text-white hover:bg-primary/90 font-bold py-3.5 rounded-input transition-all duration-200 mt-2 shadow-sm text-sm"
                  disabled={availableBalance < 10000}
                >
                  Gửi yêu cầu rút tiền
                </button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: WALLET BALANCE & RULES */}
        <div className="lg:col-span-5 flex flex-col gap-6 text-left">
          {/* Current Balance Card */}
          <div className="bg-[#0f172a] text-white rounded-2xl p-6 md:p-8 shadow-xl border border-slate-800 relative overflow-hidden flex flex-col">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
            
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">SỐ DƯ VÍ HIỆN TẠI</p>
            <h2 className="text-4xl md:text-5xl font-black mb-6 flex items-baseline">
              {availableBalance.toLocaleString('vi-VN')}
              <span className="text-lg font-bold underline ml-1">đ</span>
            </h2>
            
            <div className="space-y-4 pt-6 border-t border-slate-800 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">Đã tích lũy:</span>
                <span className="font-bold text-emerald-400">{approvedCashback.toLocaleString('vi-VN')}đ</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">Đã giải ngân:</span>
                <span className="font-bold text-blue-400">{paidWithdrawals.toLocaleString('vi-VN')}đ</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">Đang chờ đối soát:</span>
                <span className="font-bold text-amber-400">{pendingCashback.toLocaleString('vi-VN')}đ</span>
              </div>
            </div>
          </div>

          {/* Rules Card */}
          <div className="bg-white border border-border/80 rounded-2xl p-6 shadow-soft">
            <h4 className="font-bold text-text mb-4 flex items-center gap-2 text-sm">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">i</span>
              Quy định rút tiền
            </h4>
            <ul className="space-y-3.5 text-xs text-text-secondary leading-relaxed">
              <li className="flex gap-2">
                <span className="text-primary font-bold shrink-0">•</span>
                <span>Vui lòng điền đúng thông tin số tài khoản và viết hoa tên chủ tài khoản không dấu. Hệ thống không chịu trách nhiệm nếu chuyển khoản sai thông tin do người dùng cung cấp.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary font-bold shrink-0">•</span>
                <span>Các yêu cầu rút tiền được duyệt thủ công bởi Admin trong vòng 1-24h làm việc.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary font-bold shrink-0">•</span>
                <span>Tài khoản vi phạm, cố tình gian lận điểm danh hoặc tạo đơn Shopee, Tiktok ảo sẽ bị khoá vĩnh viễn và huỷ số dư ví.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* BOTTOM SECTION: DUAL-TAB WALLET HISTORY (LỊCH SỬ CỘNG TIỀN & LỊCH SỬ RÚT TIỀN) */}
      <div className="mt-12 text-left">
        <Card className="border border-border/50 bg-white shadow-soft rounded-2xl overflow-hidden">
          <CardContent className="p-6 md:p-8">
            {/* TOP TABS SWITCHER - LUÔN TRÊN 1 HÀNG */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 mb-6 border-b border-border/70">
              <div className="inline-flex items-center gap-1.5 p-1.5 bg-slate-100/90 border border-slate-200/80 rounded-xl w-fit max-w-full overflow-x-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setHistoryTab('credits')}
                  className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-black whitespace-nowrap shrink-0 transition-all ${
                    historyTab === 'credits'
                      ? 'bg-white text-emerald-600 shadow-sm ring-1 ring-emerald-500/20'
                      : 'text-text-secondary hover:text-text'
                  }`}
                >
                  <ArrowDownLeft className={`w-4 h-4 shrink-0 ${historyTab === 'credits' ? 'text-emerald-600' : 'text-text-secondary'}`} />
                  <span>Lịch Sử Cộng Tiền</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                    historyTab === 'credits'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-200 text-slate-600'
                  }`}>
                    {creditTransactions.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setHistoryTab('withdrawals')}
                  className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-black whitespace-nowrap shrink-0 transition-all ${
                    historyTab === 'withdrawals'
                      ? 'bg-white text-primary shadow-sm ring-1 ring-primary/20'
                      : 'text-text-secondary hover:text-text'
                  }`}
                >
                  <ArrowUpRight className={`w-4 h-4 shrink-0 ${historyTab === 'withdrawals' ? 'text-primary' : 'text-text-secondary'}`} />
                  <span>Lịch Sử Rút Tiền</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                    historyTab === 'withdrawals'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-slate-200 text-slate-600'
                  }`}>
                    {activeWithdrawals.length}
                  </span>
                </button>
              </div>

              {/* Dynamic Subtitle */}
              <p className="text-xs text-text-secondary font-medium">
                {historyTab === 'credits'
                  ? 'Chỉ những đơn hàng đã hoàn thành mới được ghi nhận cộng tiền vào ví.'
                  : 'Theo dõi trạng thái xử lý và giải ngân các lệnh rút tiền về Ngân hàng / Ví điện tử.'}
              </p>
            </div>

            {historyTab === 'credits' ? (
              <>
                {/* BREAKDOWN PILLS BY SOURCE */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-6">
                  <div className="p-3.5 rounded-xl border border-orange-200/70 bg-gradient-to-br from-orange-50/60 to-white flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold text-text-secondary uppercase tracking-wide">Hoàn tiền mua sắm (Shopee/TikTok)</p>
                      <p className="text-base sm:text-lg font-black text-primary mt-0.5">
                        +{approvedOrderCashback.toLocaleString('vi-VN')}đ
                      </p>
                      <span className="text-[10px] text-text-secondary font-medium">
                        Đơn hoàn thành ({userOrders.filter(o => o.status === 'approved' || o.status === 'paid').length} đơn)
                      </span>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-orange-100/80 text-primary flex items-center justify-center shrink-0">
                      <ShoppingBag className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-purple-200/70 bg-gradient-to-br from-purple-50/60 to-white flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold text-text-secondary uppercase tracking-wide">Hoa hồng đơn giới thiệu (F1 +20%)</p>
                      <p className="text-base sm:text-lg font-black text-purple-700 mt-0.5">
                        +{approvedReferralBonus.toLocaleString('vi-VN')}đ
                      </p>
                      <span className="text-[10px] text-text-secondary font-medium">
                        Đơn F1 hoàn thành ({referralHistory.filter(r => r.isCompleted || r.status === 'approved' || r.status === 'paid').length} đơn)
                      </span>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-purple-100/80 text-purple-700 flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50/60 to-white flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold text-text-secondary uppercase tracking-wide">Tổng tiền đã cộng vào ví</p>
                      <p className="text-base sm:text-lg font-black text-emerald-700 mt-0.5">
                        +{approvedCashback.toLocaleString('vi-VN')}đ
                      </p>
                      <span className="text-[10px] text-text-secondary font-medium">
                        Tổng các khoản đã hoàn thành ({creditTransactions.length} khoản)
                      </span>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-100/80 text-emerald-700 flex items-center justify-center shrink-0">
                      <Gift className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                {/* CREDITS HEADER & FILTERS */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <h3 className="text-lg font-black text-text flex items-center gap-2">
                    <span>Lịch Sử Cộng Tiền</span>
                  </h3>

                  <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto flex-wrap">
                    {/* Search box */}
                    <div className="relative w-full sm:w-64">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <Search className="h-4 w-4 text-text-secondary" />
                      </span>
                      <input
                        type="text"
                        placeholder="Tìm mã đơn, sản phẩm, người giới thiệu..."
                        value={creditSearchTerm}
                        onChange={(e) => setCreditSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-border text-xs rounded-input bg-bg focus:ring-1 focus:ring-primary focus:border-transparent outline-none"
                      />
                    </div>

                    {/* Source filter dropdown */}
                    <select
                      value={creditSourceFilter}
                      onChange={(e) => setCreditSourceFilter(e.target.value as any)}
                      className="w-full sm:w-auto px-3.5 py-2 border border-border text-xs rounded-input bg-white font-semibold"
                    >
                      <option value="all">Tất cả nguồn cộng tiền</option>
                      <option value="shopee">Hoàn tiền đơn Shopee</option>
                      <option value="tiktok">Hoàn tiền đơn TikTok Shop</option>
                      <option value="referral">Đơn giới thiệu bạn bè (F1 +20%)</option>
                      <option value="promo">Chương trình ưu đãi / Hoàn ví</option>
                    </select>
                  </div>
                </div>

                {/* CREDITS TABLE */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-bg/50 font-bold text-text-secondary text-[11px] uppercase tracking-wider">
                        <th className="py-4 px-4 rounded-l-input">Số tiền cộng</th>
                        <th className="py-4 px-4">Nguồn / Chương trình</th>
                        <th className="py-4 px-4">Chi tiết giao dịch</th>
                        <th className="py-4 px-4">Trạng thái</th>
                        <th className="py-4 px-4 rounded-r-input">Thời gian</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCredits.length > 0 ? (
                        filteredCredits.map((tx) => (
                          <tr key={tx.id} className="border-b border-border hover:bg-emerald-50/30 transition-colors">
                            <td className="py-4 px-4 whitespace-nowrap">
                              <span className="font-black text-sm text-emerald-600">
                                +{tx.amount.toLocaleString('vi-VN')}đ
                              </span>
                            </td>
                            <td className="py-4 px-4 whitespace-nowrap">
                              {getCreditSourceBadge(tx.sourceType, tx.sourceLabel)}
                            </td>
                            <td className="py-4 px-4 max-w-md">
                              <p className="font-bold text-text line-clamp-1">{tx.title}</p>
                              <p className="text-[11px] text-text-secondary mt-0.5 line-clamp-1">{tx.subtitle}</p>
                            </td>
                            <td className="py-4 px-4 whitespace-nowrap">
                              {getCreditStatusBadge()}
                            </td>
                            <td className="py-4 px-4 text-text-secondary font-medium whitespace-nowrap">
                              {tx.createdAt || '—'}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="text-center py-16 text-text-secondary/60 font-semibold text-sm">
                            Chưa có khoản cộng tiền hoàn thành nào được ghi nhận vào ví.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <>
                {/* WITHDRAWALS HEADER & FILTERS */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <h3 className="text-lg font-black text-text">Lịch Sử Rút Tiền</h3>
                  
                  {/* Table search & filters */}
                  <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                    {/* Search box */}
                    <div className="relative w-full sm:w-64">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <Search className="h-4 w-4 text-text-secondary" />
                      </span>
                      <input
                        type="text"
                        placeholder="Tìm tên tài khoản, STK, ngân hàng..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-border text-xs rounded-input bg-bg focus:ring-1 focus:ring-primary focus:border-transparent outline-none"
                      />
                    </div>

                    {/* Status dropdown */}
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full sm:w-auto px-4 py-2 border border-border text-xs rounded-input bg-white font-semibold"
                    >
                      <option value="all">Tất cả trạng thái</option>
                      <option value="pending">Đang xử lý</option>
                      <option value="approved">Thành công</option>
                      <option value="rejected">Bị từ chối</option>
                    </select>

                    {/* Search Button */}
                    <button
                      type="button"
                      className="w-full sm:w-auto bg-primary text-white hover:bg-primary/90 text-xs font-bold py-2 px-5 rounded-input flex items-center justify-center gap-2.5 transition-all shadow-sm"
                    >
                      <Search className="h-3.5 w-3.5" />
                      Tìm kiếm
                    </button>
                  </div>
                </div>

                {/* WITHDRAWALS TABLE */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-bg/50 font-bold text-text-secondary text-[11px] uppercase tracking-wider">
                        <th className="py-4 px-4 rounded-l-input">Số tiền rút</th>
                        <th className="py-4 px-4">Phương thức</th>
                        <th className="py-4 px-4">Thông tin tài khoản</th>
                        <th className="py-4 px-4">Trạng thái</th>
                        <th className="py-4 px-4 rounded-r-input">Ngày tạo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredWithdrawals.length > 0 ? (
                        filteredWithdrawals.map((item) => (
                          <tr key={item.id} className="border-b border-border hover:bg-primary/5 transition-colors">
                            <td className="py-4 px-4 font-black text-rose-600 text-sm">-{item.amount.toLocaleString('vi-VN')}đ</td>
                            <td className="py-4 px-4 font-bold text-text-secondary">
                              {['MoMo', 'ZaloPay', 'Viettel Money', 'ShopeePay'].includes(item.bankName) ? 'Ví điện tử' : 'Ngân hàng'}
                            </td>
                            <td className="py-4 px-4 space-y-1">
                              <p className="font-bold text-text">{item.bankName}</p>
                              <p className="font-mono text-text-secondary text-[10px]">STK: {item.accountNumber}</p>
                              <p className="text-[10px] text-text-secondary/80 font-bold uppercase">{item.accountHolder}</p>
                            </td>
                            <td className="py-4 px-4">{getWithdrawalBadge(item.status)}</td>
                            <td className="py-4 px-4 text-text-secondary font-medium">{item.requestDate}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="text-center py-16 text-text-secondary/60 font-semibold text-sm">
                            Bạn chưa thực hiện lệnh rút tiền nào.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
