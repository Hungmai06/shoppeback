import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';
import type { Withdrawal } from '../../store/appStore';
import { 
  Lock, Wallet, Landmark, Search
} from 'lucide-react';
import { Button, Card, CardContent, Badge } from '../../components/ui/core';
import { toast } from 'sonner';

export default function WalletPage() {
  const navigate = useNavigate();
  const { currentUser, withdrawals, orders, userStats, addWithdrawalRequest, updateProfile } = useAppStore();
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

  // Search & Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Auto-fill bank info from current user profile
  useEffect(() => {
    if (currentUser) {
      if (currentUser.bankName) setBankName(currentUser.bankName);
      if (currentUser.accountNumber) setAccountNumber(currentUser.accountNumber);
      if (currentUser.accountHolder) setAccountHolder(currentUser.accountHolder);
      if (currentUser.phone) setWalletPhone(currentUser.phone);
    }
  }, [currentUser]);

  // Orders and withdrawals for current user
  const userOrders = isLoggedIn
    ? orders.filter(o => o.userId === currentUser.id)
    : [];

  const activeWithdrawals = isLoggedIn
    ? withdrawals.filter(w => w.userId === currentUser.id)
    : [];

  const pendingCashback = isLoggedIn 
    ? (userStats?.pendingCashback ?? userOrders.filter(o => o.status === 'pending').reduce((sum, o) => sum + (o.estimatedCashback || 0), 0))
    : 0;

  const approvedCashback = isLoggedIn
    ? (userStats?.approvedCashback ?? userOrders.filter(o => o.status === 'approved' || o.status === 'paid').reduce((sum, o) => sum + (o.realCashback || o.estimatedCashback || 0), 0))
    : 0;

  const totalApprovedCashback100 = approvedCashback * 2;

  const paidWithdrawals = isLoggedIn
    ? (userStats?.paidWithdrawals ?? withdrawals.filter(w => w.userId === currentUser.id && w.status === 'approved').reduce((sum, w) => sum + w.amount, 0))
    : 0;

  const pendingWithdrawals = isLoggedIn
    ? (userStats?.pendingWithdrawals ?? withdrawals.filter(w => w.userId === currentUser.id && w.status === 'pending').reduce((sum, w) => sum + w.amount, 0))
    : 0;

  // Available to withdraw: Approved cashback + Referral earnings - (Approved withdrawals + Pending withdrawals)
  const availableBalance = isLoggedIn
    ? (userStats?.availableBalance ?? Math.max(0, (approvedCashback + (currentUser.referralEarnings || 0)) - (paidWithdrawals + pendingWithdrawals)))
    : 0;

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
      toast.error(`Số tiền rút (${amountNum.toLocaleString('vi-VN')}đ) vượt quá số dư khả dụng (${availableBalance.toLocaleString('vi-VN')}đ)`);
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

    const res = await addWithdrawalRequest(
      amountNum, 
      finalBankName, 
      finalAccountNumber, 
      finalAccountHolder
    );

    if (res.success) {
      toast.success(res.message || 'Gửi yêu cầu rút tiền thành công! Vui lòng chờ đối soát.');
      setWithdrawAmount('');
    } else {
      toast.error(res.message || 'Không thể tạo yêu cầu rút tiền. Vui lòng kiểm tra lại số dư.');
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
                {/* Amount field with Live validation and Quick Fill Buttons */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">SỐ TIỀN CẦN RÚT (VND)</label>
                    <span className="text-xs font-bold text-primary">
                      Khả dụng: {availableBalance.toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="Ví dụ: 50000"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      className={`w-full px-4 py-3 bg-white border text-sm rounded-input outline-none transition-all font-semibold ${
                        withdrawAmount && Number(withdrawAmount) > availableBalance
                          ? 'border-red-500 ring-2 ring-red-100 text-red-600'
                          : 'border-border focus:border-primary focus:ring-2 focus:ring-primary/10'
                      }`}
                      required
                    />
                    {availableBalance > 0 && (
                      <button
                        type="button"
                        onClick={() => setWithdrawAmount(String(availableBalance))}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1 text-[11px] font-bold bg-primary/10 hover:bg-primary/20 text-primary rounded-md transition-colors"
                      >
                        Rút hết
                      </button>
                    )}
                  </div>

                  {/* Realtime Alert if Amount > Available Balance */}
                  {withdrawAmount && Number(withdrawAmount) > availableBalance && (
                    <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-start gap-1.5 mt-1">
                      <span>⚠️</span>
                      <span>
                        Số tiền nhập (<strong>{Number(withdrawAmount).toLocaleString('vi-VN')}đ</strong>) vượt quá số dư khả dụng (<strong>{availableBalance.toLocaleString('vi-VN')}đ</strong>). Vui lòng điều chỉnh lại.
                      </span>
                    </div>
                  )}

                  {withdrawAmount && Number(withdrawAmount) > 0 && Number(withdrawAmount) < 50000 && (
                    <p className="text-xs font-medium text-amber-600 mt-1">
                      ⚠️ Số tiền rút tối thiểu là 50.000đ.
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2 mt-2">
                    {[50000, 100000, 200000, 500000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setWithdrawAmount(String(amt))}
                        disabled={amt > availableBalance}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-md border transition-all ${
                          amt > availableBalance
                            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                            : 'bg-white hover:bg-primary/5 text-text hover:text-primary border-border hover:border-primary/40'
                        }`}
                      >
                        {amt.toLocaleString('vi-VN')}đ
                      </button>
                    ))}
                  </div>

                  <p className="text-[10px] text-text-secondary font-medium mt-1">
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
                <span className="font-bold text-emerald-400">{totalApprovedCashback100.toLocaleString('vi-VN')}đ</span>
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

      {/* BOTTOM SECTION: HISTORY TABLE */}
      <div className="mt-12 text-left">
        <Card className="border border-border/50 bg-white shadow-soft rounded-2xl">
          <CardContent className="p-6 md:p-8">
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

            {/* Table */}
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
                        <td className="py-4 px-4 font-black text-text text-sm">{item.amount.toLocaleString('vi-VN')}đ</td>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
