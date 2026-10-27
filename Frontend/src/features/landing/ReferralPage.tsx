import React from 'react';
import { useAppStore } from '../../store/appStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Button } from '../../components/ui/core';
import { Users, Copy, Link2, Wallet, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import ReferralDashboardView from '../referral/ReferralDashboardView';

export default function ReferralPage() {
  const { currentUser } = useAppStore();
  const navigate = useNavigate();

  const handleCopyLink = () => {
    if (!currentUser) {
      navigate('/auth?mode=register');
      return;
    }
    const link = `${window.location.origin}/auth?mode=register&ref=${currentUser.id}`;
    navigator.clipboard.writeText(link);
    toast.success('Đã sao chép link giới thiệu của bạn!');
  };

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
              Xây dựng nguồn thu nhập thụ động bền vững. Bất cứ khi nào người bạn giới thiệu mua sắm thành công và nhận được tiền hoàn trên Shopee hoặc TikTok Shop, bạn sẽ tự động được cộng thêm 20% hoa hồng vào ví.
            </p>
            <Button 
              onClick={handleCopyLink}
              className="bg-primary hover:bg-primary/90 text-white font-bold px-8 py-3.5 rounded-full shadow-lg shadow-primary/30 flex items-center gap-2.5 transition-all hover:scale-105 active:scale-95"
            >
              <Copy className="h-5 w-5" /> Lấy Link Giới Thiệu Ngay
            </Button>
          </div>
          
          {/* Right Floating Card */}
          <div className="flex-shrink-0 relative">
            <div className="absolute inset-0 bg-gradient-to-tr from-orange-400 to-primary rounded-3xl blur-2xl opacity-20 animate-pulse"></div>
            <div className="bg-white p-8 md:p-10 rounded-3xl border border-orange-100 shadow-xl relative z-10 flex flex-col items-center justify-center min-w-[220px] min-h-[220px]">
              <div className="absolute -top-4 -right-4 bg-yellow-400 text-yellow-900 text-[10px] font-black uppercase px-4 py-2 rounded-full shadow-md transform rotate-12">
                Không giới hạn
              </div>
              <div className="w-20 h-20 bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl flex items-center justify-center mb-4 border border-orange-100 text-primary shadow-inner">
                <Wallet className="h-10 w-10" />
              </div>
              <h3 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-orange-500 to-red-600 mb-1">+20%</h3>
              <p className="font-bold text-text-secondary text-sm mt-1">Hoa hồng F1 Trọn Đời</p>
            </div>
          </div>
        </div>
      </div>

      {/* REFERRAL LINK CARD */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="h-4.5 w-4.5 text-danger" /> Đường dẫn giới thiệu của bạn
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2 border border-border/80 p-1.5 pl-4 rounded-md bg-bg overflow-hidden">
              <span className="text-xs font-mono text-text truncate">
                {currentUser 
                  ? `${window.location.origin}/auth?mode=register&ref=${currentUser.id}` 
                  : 'Vui lòng đăng nhập để nhận link giới thiệu của bạn...'}
              </span>
              <Button 
                onClick={handleCopyLink}
                variant="danger" 
                className="shrink-0 h-8 px-4 rounded font-bold text-xs bg-red-500 hover:bg-red-600 text-white border-none flex items-center gap-1.5"
              >
                <Copy className="h-3.5 w-3.5" /> Sao chép
              </Button>
            </div>
            
            <div className="flex items-center gap-4 mt-2">
              <span className="text-xs font-bold text-text-secondary">Chia sẻ nhanh:</span>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    if (!currentUser) { navigate('/auth'); return; }
                    const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.origin + '/auth?mode=register&ref=' + currentUser.id)}`;
                    const win = window.open(shareUrl, '_blank');
                    if (!win || win.closed || typeof win.closed === 'undefined') window.location.href = shareUrl;
                  }} 
                  className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white hover:opacity-80 transition-opacity"
                  title="Chia sẻ lên Facebook"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
                </button>
                <button 
                  onClick={() => {
                    if (!currentUser) { navigate('/auth'); return; }
                    const shareUrl = `https://zalo.me/share?url=${encodeURIComponent(window.location.origin + '/auth?mode=register&ref=' + currentUser.id)}`;
                    const win = window.open(shareUrl, '_blank');
                    if (!win || win.closed || typeof win.closed === 'undefined') window.location.href = shareUrl;
                  }} 
                  className="w-8 h-8 rounded-full bg-sky-500 flex items-center justify-center text-white hover:opacity-80 transition-opacity"
                  title="Chia sẻ qua Zalo"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* DASHBOARD STATS, TABS & TABLES */}
      <ReferralDashboardView onCopyLink={handleCopyLink} />

    </div>
  );
}
