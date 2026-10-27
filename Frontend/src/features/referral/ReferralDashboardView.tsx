import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, Button } from '../../components/ui/core';
import { 
  Users, MousePointerClick, UserPlus, Clock, Wallet, 
  RefreshCw, CheckCircle2, AlertCircle, ShoppingBag, Search
} from 'lucide-react';
import { toast } from 'sonner';

export interface ReferralStats {
  clicks: number;
  f1Count: number;
  pendingCommission: number;
  approvedCommission: number;
  totalCommission?: number;
  pendingOrdersCount?: number;
  completedOrdersCount?: number;
  totalOrdersCount?: number;
}

export interface ReferralHistoryItem {
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

export interface ReferralMember {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  createdAt: string;
  ordersCount: number;
  completedOrdersCount: number;
  pendingOrdersCount: number;
  totalSpent: number;
  totalBonusEarned: number;
  pendingBonus: number;
  status: string;
}

interface ReferralDashboardViewProps {
  onCopyLink?: () => void;
}

export default function ReferralDashboardView({ onCopyLink }: ReferralDashboardViewProps) {
  const [activeTab, setActiveTab] = useState<'history' | 'orders' | 'members'>('history');
  const [stats, setStats] = useState<ReferralStats>({
    clicks: 0,
    f1Count: 0,
    pendingCommission: 0,
    approvedCommission: 0,
    totalCommission: 0,
    pendingOrdersCount: 0,
    completedOrdersCount: 0,
    totalOrdersCount: 0
  });
  const [history, setHistory] = useState<ReferralHistoryItem[]>([]);
  const [members, setMembers] = useState<ReferralMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [tierFilter, setTierFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [statsRes, historyRes, membersRes] = await Promise.all([
        fetch('/api/referrals/stats', { headers }),
        fetch('/api/referrals/history', { headers }),
        fetch('/api/referrals/members', { headers })
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setHistory(historyData);
      }
      if (membersRes.ok) {
        const membersData = await membersRes.json();
        setMembers(membersData);
      }

      if (isManualRefresh) {
        toast.success('Đã cập nhật dữ liệu hoa hồng mới nhất!');
      }
    } catch (error) {
      console.error('Lỗi khi tải dữ liệu giới thiệu:', error);
      if (isManualRefresh) {
        toast.error('Không thể làm mới dữ liệu. Vui lòng thử lại!');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter history items
  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      // Platform filter
      if (platformFilter !== 'all' && item.platform !== platformFilter) return false;

      // Status filter
      if (statusFilter === 'approved' && !item.isCompleted) return false;
      if (statusFilter === 'pending' && (item.isCompleted || item.status === 'rejected' || item.status === 'cancelled')) return false;
      if (statusFilter === 'rejected' && item.status !== 'rejected' && item.status !== 'cancelled') return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchId = (item.id || '').toLowerCase().includes(query);
        const matchName = (item.f1Name || '').toLowerCase().includes(query);
        const matchProduct = (item.productName || '').toLowerCase().includes(query);
        if (!matchId && !matchName && !matchProduct) return false;
      }

      return true;
    });
  }, [history, platformFilter, statusFilter, searchQuery]);

  // Filter members
  const filteredMembers = useMemo(() => {
    return members.filter(member => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchName = (member.name || '').toLowerCase().includes(query);
        const matchEmail = (member.email || '').toLowerCase().includes(query);
        const matchPhone = (member.phone || '').toLowerCase().includes(query);
        if (!matchName && !matchEmail && !matchPhone) return false;
      }
      return true;
    });
  }, [members, searchQuery]);

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* 4 TOP SUMMARY STATS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CARD 1: LƯỢT CLICK */}
        <Card className="border border-border/50 hover:border-emerald-200 transition-all shadow-sm">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">LƯỢT CLICK</span>
              <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
                <MousePointerClick className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-text tracking-tight">
                {stats.clicks.toLocaleString('vi-VN')}
              </div>
              <p className="text-[11px] text-text-secondary mt-0.5">Tổng lượt truy cập link</p>
            </div>
          </CardContent>
        </Card>

        {/* CARD 2: GIỚI THIỆU F1 */}
        <Card className="border border-border/50 hover:border-rose-200 transition-all shadow-sm">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">GIỚI THIỆU F1</span>
              <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center text-rose-500">
                <UserPlus className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-text tracking-tight">
                {stats.f1Count.toLocaleString('vi-VN')}
              </div>
              <p className="text-[11px] text-text-secondary mt-0.5">Thành viên đăng ký trực tiếp</p>
            </div>
          </CardContent>
        </Card>

        {/* CARD 3: CHỜ DUYỆT (ĐƠN CHƯA HOÀN THÀNH) */}
        <Card className="border border-amber-200/80 bg-gradient-to-br from-white to-amber-50/20 hover:border-amber-300 transition-all shadow-sm">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">CHỜ DUYỆT</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-amber-100 text-amber-800">
                  {stats.pendingOrdersCount || 0} đơn
                </span>
              </div>
              <div className="w-8 h-8 rounded-full bg-amber-100/70 flex items-center justify-center text-amber-600">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-amber-600 tracking-tight">
                {stats.pendingCommission.toLocaleString('vi-VN')}đ
              </div>
              <p className="text-[11px] text-amber-800/80 mt-0.5 font-medium">
                Đơn F1 chưa hoàn thành (đang duyệt)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* CARD 4: ĐÃ NHẬN (ĐƠN ĐÃ HOÀN THÀNH) */}
        <Card className="border border-emerald-200/80 bg-gradient-to-br from-white to-emerald-50/20 hover:border-emerald-300 transition-all shadow-sm">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">ĐÃ NHẬN</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-emerald-100 text-emerald-800">
                  {stats.completedOrdersCount || 0} đơn
                </span>
              </div>
              <div className="w-8 h-8 rounded-full bg-emerald-100/70 flex items-center justify-center text-emerald-600">
                <Wallet className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-emerald-600 tracking-tight">
                {stats.approvedCommission.toLocaleString('vi-VN')}đ
              </div>
              <p className="text-[11px] text-emerald-800/80 mt-0.5 font-medium">
                Đơn hoàn thành (đã cộng vào ví)
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* DETAIL TABS AND CONTROLS */}
      <Card className="border border-border/60 shadow-sm overflow-hidden">
        {/* TABS HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/60 bg-bg/40 px-4 py-2 gap-3">
          <div className="flex border-b sm:border-b-0 border-border/40 overflow-x-auto scrollbar-hide gap-1">
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-3 text-xs md:text-sm font-bold border-b-2 whitespace-nowrap transition-all flex items-center gap-2 ${
                activeTab === 'history'
                  ? 'border-primary text-primary bg-primary/5 rounded-t-lg'
                  : 'border-transparent text-text-secondary hover:text-text'
              }`}
            >
              <span>Lịch sử hoa hồng</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === 'history' ? 'bg-primary text-white' : 'bg-border/60 text-text-secondary'
              }`}>
                {history.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('orders')}
              className={`px-4 py-3 text-xs md:text-sm font-bold border-b-2 whitespace-nowrap transition-all flex items-center gap-2 ${
                activeTab === 'orders'
                  ? 'border-primary text-primary bg-primary/5 rounded-t-lg'
                  : 'border-transparent text-text-secondary hover:text-text'
              }`}
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              <span>Đơn hàng thành viên</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === 'orders' ? 'bg-primary text-white' : 'bg-border/60 text-text-secondary'
              }`}>
                {history.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('members')}
              className={`px-4 py-3 text-xs md:text-sm font-bold border-b-2 whitespace-nowrap transition-all flex items-center gap-2 ${
                activeTab === 'members'
                  ? 'border-primary text-primary bg-primary/5 rounded-t-lg'
                  : 'border-transparent text-text-secondary hover:text-text'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Mạng lưới thành viên</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === 'members' ? 'bg-primary text-white' : 'bg-border/60 text-text-secondary'
              }`}>
                {members.length}
              </span>
            </button>
          </div>

          <div className="flex items-center justify-end gap-2 shrink-0">
            <Button
              onClick={() => loadData(true)}
              disabled={refreshing}
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs flex items-center gap-1.5 border-border/80 hover:bg-bg"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-primary' : ''}`} />
              <span>Làm mới</span>
            </Button>
          </div>
        </div>

        {/* FILTER BAR */}
        <div className="p-4 bg-white border-b border-border/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Filter CẤP */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-text-secondary uppercase">CẤP:</span>
              <select
                value={tierFilter}
                onChange={e => setTierFilter(e.target.value)}
                className="px-2.5 py-1 border border-border rounded-md text-xs font-semibold outline-none focus:border-primary bg-bg/40 text-text"
              >
                <option value="all">Tất cả</option>
                <option value="f1">F1 (20%)</option>
              </select>
            </div>

            {/* Filter TRẠNG THÁI (Chỉ áp dụng cho tab history và orders) */}
            {activeTab !== 'members' && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-text-secondary uppercase">TRẠNG THÁI:</span>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="px-2.5 py-1 border border-border rounded-md text-xs font-semibold outline-none focus:border-primary bg-bg/40 text-text"
                >
                  <option value="all">Tất cả</option>
                  <option value="approved">Đã nhận (Đơn hoàn thành)</option>
                  <option value="pending">Chờ duyệt (Đang xử lý)</option>
                  <option value="rejected">Đã hủy</option>
                </select>
              </div>
            )}

            {/* Filter NỀN TẢNG */}
            {activeTab !== 'members' && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-text-secondary uppercase">SÀN:</span>
                <select
                  value={platformFilter}
                  onChange={e => setPlatformFilter(e.target.value)}
                  className="px-2.5 py-1 border border-border rounded-md text-xs font-semibold outline-none focus:border-primary bg-bg/40 text-text"
                >
                  <option value="all">Tất cả sàn</option>
                  <option value="shopee">Shopee</option>
                  <option value="tiktok">TikTok Shop</option>
                </select>
              </div>
            )}
          </div>

          {/* Search box */}
          <div className="relative w-full sm:w-64">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input
              type="text"
              placeholder={activeTab === 'members' ? 'Tìm thành viên...' : 'Tìm mã đơn, tên F1, sản phẩm...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1 text-xs border border-border rounded-md outline-none focus:border-primary bg-bg/30 text-text"
            />
          </div>
        </div>

        {/* CONTENT TABLES */}
        <CardContent className="p-0">
          {/* TAB 1: LỊCH SỬ HOA HỒNG */}
          {activeTab === 'history' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[760px]">
                <thead>
                  <tr className="border-b border-border/60 bg-bg/20 text-text-secondary text-[10px] uppercase tracking-wider font-bold">
                    <th className="py-3.5 px-4">THÀNH VIÊN F1</th>
                    <th className="py-3.5 px-2 text-center">CẤP</th>
                    <th className="py-3.5 px-2 text-center">NỀN TẢNG</th>
                    <th className="py-3.5 px-3 text-right">HOA HỒNG GỐC</th>
                    <th className="py-3.5 px-3 text-right font-black">TIỀN THƯỞNG NHẬN</th>
                    <th className="py-3.5 px-3 text-center">TRẠNG THÁI</th>
                    <th className="py-3.5 px-4 text-right">THỜI GIAN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-text-secondary">
                        <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                        Đang tải lịch sử hoa hồng...
                      </td>
                    </tr>
                  ) : filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-16 text-text-secondary/70">
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-12 h-12 bg-bg rounded-full flex items-center justify-center text-text-secondary">
                            <Wallet className="h-6 w-6 opacity-40" />
                          </div>
                          <p className="font-semibold text-sm text-text">Chưa có hoa hồng nào theo bộ lọc</p>
                          <p className="text-xs text-text-secondary max-w-sm">
                            Khi thành viên F1 mua hàng trên Shopee hoặc TikTok Shop, hoa hồng sẽ hiển thị ngay tại đây.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map(item => (
                      <tr key={item.id} className="hover:bg-bg/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-text">{item.f1Name}</div>
                          {item.f1Email && (
                            <div className="text-[10px] text-text-secondary truncate max-w-[150px]">
                              {item.f1Email}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-2 text-center">
                          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-600 font-bold text-[10px] border border-blue-100">
                            F1 (20%)
                          </span>
                        </td>
                        <td className="py-3.5 px-2 text-center">
                          {item.platform === 'tiktok' ? (
                            <span className="px-2 py-0.5 rounded bg-slate-900 text-cyan-400 font-bold text-[10px] inline-flex items-center gap-1">
                              TikTok
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-orange-50 text-orange-600 font-bold text-[10px] border border-orange-200">
                              Shopee
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-right text-text-secondary font-medium">
                          {item.baseCashback.toLocaleString('vi-VN')}đ
                        </td>
                        <td className="py-3.5 px-3 text-right font-black text-sm text-primary">
                          +{item.bonus.toLocaleString('vi-VN')}đ
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          {item.isCompleted ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                              <CheckCircle2 className="h-3 w-3" /> Đã nhận (Hoàn thành)
                            </span>
                          ) : item.status === 'rejected' || item.status === 'cancelled' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200">
                              <AlertCircle className="h-3 w-3" /> Đã hủy
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200">
                              <Clock className="h-3 w-3" /> Chờ duyệt (Chưa hoàn thành)
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right text-text-secondary whitespace-nowrap text-[11px]">
                          {new Date(item.createdAt).toLocaleDateString('vi-VN')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: ĐƠN HÀNG THÀNH VIÊN */}
          {activeTab === 'orders' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[850px]">
                <thead>
                  <tr className="border-b border-border/60 bg-bg/20 text-text-secondary text-[10px] uppercase tracking-wider font-bold">
                    <th className="py-3.5 px-4">MÃ ĐƠN & SÀN</th>
                    <th className="py-3.5 px-3">THÀNH VIÊN F1</th>
                    <th className="py-3.5 px-3">SẢN PHẨM</th>
                    <th className="py-3.5 px-3 text-right">GIÁ TRỊ ĐƠN</th>
                    <th className="py-3.5 px-3 text-right">TIỀN HOÀN F1</th>
                    <th className="py-3.5 px-3 text-right font-black">HOA HỒNG NHẬN</th>
                    <th className="py-3.5 px-3 text-center">TRẠNG THÁI</th>
                    <th className="py-3.5 px-4 text-right">NGÀY ĐẶT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-text-secondary">
                        <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                        Đang tải danh sách đơn hàng...
                      </td>
                    </tr>
                  ) : filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-16 text-text-secondary/70">
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-12 h-12 bg-bg rounded-full flex items-center justify-center text-text-secondary">
                            <ShoppingBag className="h-6 w-6 opacity-40" />
                          </div>
                          <p className="font-semibold text-sm text-text">Chưa có đơn hàng nào của thành viên</p>
                          <p className="text-xs text-text-secondary max-w-sm">
                            Các đơn hàng do thành viên trong mạng lưới của bạn thực hiện sẽ xuất hiện ở đây.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map(order => (
                      <tr key={order.id} className="hover:bg-bg/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-bold text-text truncate max-w-[130px]">
                            {order.id}
                          </div>
                          <div className="mt-0.5">
                            {order.platform === 'tiktok' ? (
                              <span className="px-1.5 py-0.2 rounded bg-slate-900 text-cyan-400 font-bold text-[9px]">
                                TikTok Shop
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 rounded bg-orange-100 text-orange-700 font-bold text-[9px]">
                                Shopee
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="font-semibold text-text">{order.f1Name}</div>
                          <div className="text-[10px] text-blue-600 font-medium">Tầng F1</div>
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-2 max-w-[200px]">
                            {order.productImage ? (
                              <img
                                src={order.productImage}
                                alt={order.productName}
                                className="w-8 h-8 rounded object-cover border border-border shrink-0"
                                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                              />
                            ) : (
                              <div className="w-8 h-8 rounded bg-bg flex items-center justify-center text-text-secondary shrink-0">
                                <ShoppingBag className="h-4 w-4" />
                              </div>
                            )}
                            <span className="line-clamp-2 text-[11px] font-medium text-text">
                              {order.productName}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-right font-medium text-text">
                          {order.orderAmount.toLocaleString('vi-VN')}đ
                        </td>
                        <td className="py-3.5 px-3 text-right font-medium text-text-secondary">
                          {order.baseCashback.toLocaleString('vi-VN')}đ
                        </td>
                        <td className="py-3.5 px-3 text-right font-black text-sm text-primary">
                          +{order.bonus.toLocaleString('vi-VN')}đ
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          {order.isCompleted ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                              <CheckCircle2 className="h-3 w-3" /> Hoàn thành
                            </span>
                          ) : order.status === 'rejected' || order.status === 'cancelled' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200">
                              <AlertCircle className="h-3 w-3" /> Đã hủy
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200">
                              <Clock className="h-3 w-3" /> Chờ duyệt
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right text-text-secondary text-[11px] whitespace-nowrap">
                          {new Date(order.createdAt).toLocaleDateString('vi-VN')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: MẠNG LƯỚI THÀNH VIÊN */}
          {activeTab === 'members' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-border/60 bg-bg/20 text-text-secondary text-[10px] uppercase tracking-wider font-bold">
                    <th className="py-3.5 px-4">THÀNH VIÊN</th>
                    <th className="py-3.5 px-2 text-center">CẤP ĐỘ</th>
                    <th className="py-3.5 px-3">NGÀY THAM GIA</th>
                    <th className="py-3.5 px-3 text-center">ĐƠN HÀNG</th>
                    <th className="py-3.5 px-3 text-right">TỔNG MUA SẮM</th>
                    <th className="py-3.5 px-4 text-right font-black">HOA HỒNG ĐÃ MANG LẠI</th>
                    <th className="py-3.5 px-3 text-center">TRẠNG THÁI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-text-secondary">
                        <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                        Đang tải danh sách thành viên...
                      </td>
                    </tr>
                  ) : filteredMembers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-16 text-text-secondary/70">
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-12 h-12 bg-bg rounded-full flex items-center justify-center text-text-secondary">
                            <Users className="h-6 w-6 opacity-40" />
                          </div>
                          <p className="font-semibold text-sm text-text">Chưa có thành viên nào tham gia</p>
                          <p className="text-xs text-text-secondary max-w-sm">
                            Hãy chia sẻ link giới thiệu của bạn với bạn bè để bắt đầu nhận 20% hoa hồng trọn đời.
                          </p>
                          {onCopyLink && (
                            <Button
                              onClick={onCopyLink}
                              className="mt-2 text-xs font-bold bg-primary text-white"
                              size="sm"
                            >
                              Sao chép Link giới thiệu
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredMembers.map(member => (
                      <tr key={member.id} className="hover:bg-bg/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-400 to-rose-400 text-white flex items-center justify-center font-bold text-xs shrink-0">
                              {member.name ? member.name.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <div>
                              <div className="font-semibold text-text">{member.name}</div>
                              <div className="text-[10px] text-text-secondary truncate max-w-[160px]">
                                {member.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-2 text-center">
                          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-600 font-bold text-[10px] border border-blue-100">
                            F1
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-text-secondary text-[11px]">
                          {new Date(member.createdAt).toLocaleDateString('vi-VN')}
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <div className="font-bold text-text">
                            {member.ordersCount} đơn
                          </div>
                          <div className="text-[10px] text-emerald-600">
                            ({member.completedOrdersCount} hoàn thành)
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-right text-text-secondary font-medium">
                          {member.totalSpent.toLocaleString('vi-VN')}đ
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="font-black text-sm text-emerald-600">
                            +{member.totalBonusEarned.toLocaleString('vi-VN')}đ
                          </div>
                          {member.pendingBonus > 0 && (
                            <div className="text-[10px] text-amber-600 font-medium">
                              +{member.pendingBonus.toLocaleString('vi-VN')}đ đang chờ
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                            Hoạt động
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
