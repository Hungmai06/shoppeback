import React from 'react';
import { useAppStore } from '../../store/appStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Button } from '../../components/ui/core';
import { Users, Copy, Link2, MousePointerClick, UserPlus, Clock, Wallet, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

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

export default function ReferralPage() {
  const { currentUser } = useAppStore();
  const navigate = useNavigate();
  const [stats, setStats] = React.useState<ReferralStats>({
    clicks: 0, f1Count: 0, pendingCommission: 0, approvedCommission: 0
  });
  const [history, setHistory] = React.useState<ReferralHistory[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (currentUser) {
      const fetchReferralData = async () => {
        try {
          const token = localStorage.getItem('token');
          const [statsRes, historyRes] = await Promise.all([
            fetch('http://localhost:5000/api/referrals/stats', { headers: { Authorization: `Bearer ${token}` } }),
            fetch('http://localhost:5000/api/referrals/history', { headers: { Authorization: `Bearer ${token}` } })
          ]);
          
          if (statsRes.ok) {
            const statsData = await statsRes.json();
            setStats(statsData);
          }
          if (historyRes.ok) {
            const historyData = await historyRes.json();
            setHistory(historyData);
          }
        } catch (error) {
          console.error("Failed to load referral data", error);
        } finally {
          setLoading(false);
        }
      };
      fetchReferralData();
    } else {
      setLoading(false);
    }
  }, [currentUser]);

  return (
    <div className="py-12 md:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col gap-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* REFERRAL PROMO HEADER (Premium Design) */}
      <div className="w-full bg-white rounded-3xl p-8 md:p-12 relative overflow-hidden border border-orange-100 shadow-soft">
        {/* Abstract Glowing Background Elements */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-orange-100/60 to-amber-50/30 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/4 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-gradient-to-tr from-rose-50/50 to-orange-50/30 rounded-full blur-[60px] translate-y-1/3 -translate-x-1/3 pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-12">
          {/* Left Text Content */}
          <div className="max-w-xl text-left flex-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-primary rounded-full text-xs font-bold uppercase tracking-wider mb-6 border border-orange-100 shadow-sm">
              <Users className="h-4 w-4" /> Chương trình đối tác
            </div>
            <h2 className="text-3xl md:text-5xl font-black text-text mb-5 leading-[1.15] tracking-tight">
              Mời bạn bè, nhận <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-primary">20% hoa hồng</span> trọn đời
            </h2>
            <p className="text-text-secondary text-sm md:text-base leading-relaxed mb-8 font-medium">
              Xây dựng nguồn thu nhập thụ động bền vững. Bất cứ khi nào người bạn giới thiệu mua sắm và nhận được tiền hoàn, bạn sẽ tự động được cộng thêm 20% vào ví.
            </p>
            <Button onClick={() => {
                if (!currentUser) {
                  navigate('/auth?mode=register');
                  return;
                }
                navigator.clipboard.writeText(`${window.location.origin}/auth?mode=register&ref=${currentUser.id}`);
                toast.success('Đã sao chép link giới thiệu!');
              }} 
              className="bg-primary hover:bg-primary/90 text-white font-bold px-8 py-3.5 rounded-full shadow-lg shadow-primary/30 flex items-center gap-2.5 transition-all hover:scale-105 active:scale-95"
            >
              <Copy className="h-5 w-5" /> Lấy Link Giới Thiệu Ngay
            </Button>
          </div>
          
          {/* Right Floating Card */}
          <div className="flex-shrink-0 relative">
            {/* Glowing shadow behind card */}
            <div className="absolute inset-0 bg-gradient-to-tr from-orange-400 to-primary rounded-3xl blur-2xl opacity-20 animate-pulse"></div>
            <div className="bg-white p-8 md:p-10 rounded-3xl border border-orange-100 shadow-xl relative z-10 flex flex-col items-center justify-center min-w-[220px] min-h-[220px]">
              <div className="absolute -top-4 -right-4 bg-yellow-400 text-yellow-900 text-[10px] font-black uppercase px-4 py-2 rounded-full shadow-md transform rotate-12">
                Không giới hạn
              </div>
              <div className="w-20 h-20 bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl flex items-center justify-center mb-4 border border-orange-100 text-primary shadow-inner">
                <Wallet className="h-10 w-10" />
              </div>
              <h3 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-orange-500 to-red-600 mb-1">+20%</h3>
              <p className="font-bold text-text-secondary text-sm mt-1">Hoa hồng F1</p>
            </div>
          </div>
        </div>
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Link2 className="h-4.5 w-4.5 text-danger" /> Đường dẫn giới thiệu của bạn</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2 border border-border/80 p-1.5 pl-4 rounded-md bg-bg overflow-hidden">
              <span className="text-xs font-mono text-text truncate">
                {currentUser ? `${window.location.origin}/auth?mode=register&ref=${currentUser.id}` : 'Vui lòng đăng nhập để nhận link giới thiệu của bạn...'}
              </span>
              <Button onClick={() => {
                  if (!currentUser) {
                    navigate('/auth');
                    return;
                  }
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
                  if(!currentUser) { navigate('/auth'); return; }
                  window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.origin + '/auth?mode=register&ref=' + currentUser.id)}`, '_blank')
                }} className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white hover:opacity-80">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
                </button>
                <button onClick={() => {
                  if(!currentUser) { navigate('/auth'); return; }
                  window.open(`https://zalo.me/share?url=${encodeURIComponent(window.location.origin + '/auth?mode=register&ref=' + currentUser.id)}`, '_blank')
                }} className="w-8 h-8 rounded-full bg-sky-500 flex items-center justify-center text-white hover:opacity-80"><Send className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardDescription className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Mức hoa hồng nhận</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-between items-center">
          <div>
            <h4 className="font-bold text-text mb-1">Tầng 1 (F1)</h4>
            <p className="text-4xl font-black text-danger">20%</p>
          </div>
          <div className="text-danger opacity-20">
            <Users className="w-16 h-16" />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/50">
          <CardContent className="p-4 flex gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 shrink-0"><MousePointerClick className="h-4 w-4" /></div>
            <div>
              <p className="text-[9px] font-bold text-text-secondary uppercase">Lượt click</p>
              <p className="text-xl font-black mt-1">{stats.clicks}</p>
              <p className="text-[10px] text-text-secondary mt-1">Tổng lượt truy cập</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 flex gap-3">
            <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-500 shrink-0"><UserPlus className="h-4 w-4" /></div>
            <div>
              <p className="text-[9px] font-bold text-text-secondary uppercase">Giới thiệu F1</p>
              <p className="text-xl font-black mt-1">{stats.f1Count}</p>
              <p className="text-[10px] text-text-secondary mt-1">Đăng ký trực tiếp</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 flex gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 shrink-0"><Clock className="h-4 w-4" /></div>
            <div>
              <p className="text-[9px] font-bold text-text-secondary uppercase">Chờ duyệt</p>
              <p className="text-xl font-black mt-1">{stats.pendingCommission.toLocaleString('vi-VN')}đ</p>
              <p className="text-[10px] text-text-secondary mt-1">Đơn gốc đang duyệt</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 flex gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 shrink-0"><Wallet className="h-4 w-4" /></div>
            <div>
              <p className="text-[9px] font-bold text-text-secondary uppercase">Đã nhận</p>
              <p className="text-xl font-black mt-1">{stats.approvedCommission.toLocaleString('vi-VN')}đ</p>
              <p className="text-[10px] text-text-secondary mt-1">Đã cộng vào tài khoản</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Referral History Tabs */}
      <Card className="border-border/50">
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
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10">Đang tải dữ liệu...</td>
                    </tr>
                  ) : history.length === 0 ? (
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
                    history.map(item => (
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
  );
}
