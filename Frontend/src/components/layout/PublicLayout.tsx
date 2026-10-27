import { useState } from 'react';
import { Outlet, Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';
import {
  ShoppingBag, Menu, X, Wallet, Search, HelpCircle,
  Users, LogOut, ShieldCheck, Sparkles, Phone, MessageSquare, Home
} from 'lucide-react';
import { Button } from '../ui/core';
import { toast } from 'sonner';

interface NavItem {
  name: string;
  path: string;
  altPaths?: string[];
  icon: React.ReactNode;
  badge?: string | null;
  badgeColor?: string;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

// Custom Shopee Brand Icon
function ShopeeBrandIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M6 3L3 7V20C3 20.5304 3.21071 21.0391 3.58579 21.4142C3.96086 21.7893 4.46957 22 5 22H19C19.5304 22 20.0391 21.7893 20.4142 21.4142C20.7893 21.0391 21 20.5304 21 20V7L18 3H6Z"
        fill="#EE4D2D"
      />
      <path d="M3 7H21" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M16 10C16 12.2091 14.2091 14 12 14C9.79086 14 8 12.2091 8 10"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M13.5 16.5C13.5 17.3 12.8 18 12 18C11.2 18 10.5 17.3 10.5 16.5"
        stroke="#FFB000"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Custom TikTok Brand Icon
function TikTokBrandIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg className="w-full h-full drop-shadow-xs" viewBox="0 0 24 24" fill="currentColor">
        <path
          d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.04-.1z"
          className="text-slate-900 group-hover:text-black transition-colors"
        />
      </svg>
      {/* Subtle Cyan/Pink Glow Dot */}
      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#00F2FE] border border-white" />
    </div>
  );
}

export default function PublicLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, logout, settings, openAuthModal, userStats } = useAppStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    toast.info('Đã đăng xuất thành công');
    navigate('/');
  };

  const navItems: NavGroup[] = [
    {
      group: 'NỀN TẢNG HOÀN TIỀN',
      items: [
        {
          name: 'Trang chủ',
          path: '/',
          altPaths: ['/shopee', '/tiktok'],
          icon: <Home className="w-5 h-5 text-primary shrink-0" />,
          badge: 'Shopee & TikTok',
          badgeColor: 'bg-gradient-to-r from-orange-500 via-rose-500 to-slate-900 text-white'
        }
      ]
    },
    {
      group: 'TIỆN ÍCH & VÍ TIỀN',
      items: [
        {
          name: 'Tra cứu đơn hàng',
          path: '/tracking',
          icon: <Search className="w-4.5 h-4.5 text-blue-500 shrink-0" />,
          badge: null
        },
        {
          name: 'Ví & Rút tiền',
          path: '/wallet',
          icon: <Wallet className="w-4.5 h-4.5 text-emerald-500 shrink-0" />,
          badge: currentUser && ((currentUser.balance ?? 0) > 0 || (userStats?.availableBalance ?? 0) > 0)
            ? `${(currentUser.balance || userStats?.availableBalance || 0).toLocaleString('vi-VN')} đ`
            : null,
          badgeColor: 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        },
        {
          name: 'Giới thiệu bạn bè',
          path: '/referral',
          icon: <Users className="w-4.5 h-4.5 text-purple-500 shrink-0" />,
          badge: 'Hoa hồng'
        },
        {
          name: 'Hỏi đáp & Hỗ trợ',
          path: '/support',
          icon: <HelpCircle className="w-4.5 h-4.5 text-amber-500 shrink-0" />,
          badge: null
        }
      ]
    }
  ];

  const isLinkActive = (path: string, altPaths?: string[]) => {
    if (path === '/') {
      return location.pathname === '/' || (altPaths && altPaths.includes(location.pathname));
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col font-poppins relative overflow-x-hidden">
      {/* AMBIENT BACKGROUND GLOWS (radial-gradient thay vì blur filter để Safari không bị lag khi cuộn) */}
      <div
        className="fixed top-0 right-0 w-[700px] h-[700px] -z-10 pointer-events-none"
        style={{ background: 'radial-gradient(closest-side, rgba(255,237,213,0.55), rgba(255,237,213,0))' }}
      />
      <div
        className="fixed bottom-0 left-64 w-[600px] h-[600px] -z-10 pointer-events-none"
        style={{ background: 'radial-gradient(closest-side, rgba(254,243,199,0.5), rgba(254,243,199,0))' }}
      />

      {/* ======================================================== */}
      {/* 1. DESKTOP LEFT SIDEBAR (THANH MENU LEFT)                */}
      {/* ======================================================== */}
      <aside className="hidden md:flex fixed top-0 bottom-0 left-0 w-64 bg-white/95 backdrop-blur-xl border-r border-border/70 z-40 flex-col justify-between shadow-xs transition-all duration-300">
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* BRAND HEADER */}
          <div className="p-5 border-b border-border/60">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="gradient-bg p-2.5 rounded-[14px] text-white shadow-md shadow-primary/20 group-hover:scale-105 transition-transform">
                <ShoppingBag className="h-6 w-6" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-base font-extrabold tracking-tight text-text leading-tight group-hover:text-primary transition-colors line-clamp-1">
                  {settings.websiteName || "Hoàn Tiền Mua Sắm"}
                </span>
                <span className="text-[10px] font-semibold text-text-secondary flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Tiết kiệm mỗi ngày
                </span>
              </div>
            </Link>
          </div>

          {/* NAVIGATION GROUPS */}
          <div className="px-3 py-4 flex flex-col gap-6">
            {navItems.map((group, gIdx) => (
              <div key={gIdx} className="flex flex-col gap-1">
                <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-text-secondary/70">
                  {group.group}
                </div>

                {group.items.map((item, iIdx) => {
                  const active = isLinkActive(item.path, item.altPaths);
                  return (
                    <NavLink
                      key={iIdx}
                      to={item.path}
                      className={`group relative flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                        active
                          ? 'bg-gradient-to-r from-orange-50 to-amber-50/30 text-primary border-l-4 border-primary shadow-xs pl-2.5'
                          : 'text-text/80 hover:text-text hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-1 rounded-lg transition-transform group-hover:scale-110 ${active ? 'scale-105' : ''}`}>
                          {item.icon}
                        </div>
                        <span className="text-sm font-bold tracking-tight">
                          {item.name}
                        </span>
                      </div>

                      {item.badge && (
                        <span
                          className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-2xs ${
                            item.badgeColor || 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* SIDEBAR FOOTER (USER STATUS / AUTH / ADMIN) */}
        <div className="p-3 border-t border-border/60 bg-slate-50/60">
          {currentUser ? (
            <div className="bg-white border border-border/80 rounded-xl p-3 shadow-xs flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black text-sm">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-left overflow-hidden">
                    <p className="text-xs font-bold text-text truncate max-w-[100px] leading-tight">
                      {currentUser.name}
                    </p>
                    <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">
                      Ví: {(currentUser.balance || userStats?.availableBalance || 0).toLocaleString('vi-VN')} đ
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  title="Đăng xuất"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-danger hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>

              {currentUser.role === 'admin' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/admin')}
                  className="w-full text-xs font-bold border-primary/25 text-primary hover:bg-primary/5 py-1.5 flex items-center justify-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Trang Quản Trị</span>
                </Button>
              )}
            </div>
          ) : (
            <div className="bg-gradient-to-br from-orange-500/10 to-amber-500/5 border border-primary/15 rounded-xl p-3 text-left">
              <div className="flex items-center gap-1.5 text-primary font-bold text-xs mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Hoàn tiền cực dễ</span>
              </div>
              <p className="text-[11px] text-text-secondary leading-snug mb-3">
                Đăng nhập để nhận hoa hồng và rút tiền về tài khoản ngân hàng.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openAuthModal('login')}
                  className="text-xs py-1.5 font-bold border-slate-300"
                >
                  Đăng nhập
                </Button>
                <Button
                  size="sm"
                  onClick={() => openAuthModal('register')}
                  className="text-xs py-1.5 font-bold"
                >
                  Đăng ký
                </Button>
              </div>
            </div>
          )}

          {/* Quick hotline notice */}
          {settings.supportPhone && (
            <div className="mt-2 text-center">
              <a
                href={`tel:${settings.supportPhone}`}
                className="text-[10px] text-text-secondary hover:text-primary transition-colors flex items-center justify-center gap-1"
              >
                <Phone className="w-3 h-3 text-primary" />
                <span>Hotline: {settings.supportPhone}</span>
              </a>
            </div>
          )}
        </div>
      </aside>

      {/* ======================================================== */}
      {/* 2. MOBILE TOPBAR & DRAWER (MÀN HÌNH NHỎ)                 */}
      {/* ======================================================== */}
      <header className="sticky top-0 z-30 md:hidden bg-white/95 backdrop-blur-md border-b border-border shadow-xs px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 -ml-2 rounded-xl text-text hover:bg-slate-100 transition-colors"
            aria-label="Mở Menu"
          >
            <Menu className="w-6 h-6" />
          </button>

          <Link to="/" className="flex items-center gap-2">
            <div className="gradient-bg p-1.5 rounded-[10px] text-white shadow-sm">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <span className="text-base font-extrabold tracking-tight text-text">
              {settings.websiteName || "Hoàn Tiền Mua Sắm"}
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {currentUser ? (
            <div
              onClick={() => navigate('/wallet')}
              className="flex items-center gap-1.5 bg-orange-50 border border-orange-200/60 px-2.5 py-1 rounded-full cursor-pointer"
            >
              <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs font-bold text-primary">
                {(currentUser.balance || userStats?.availableBalance || 0).toLocaleString('vi-VN')} đ
              </span>
            </div>
          ) : (
            <Button
              size="sm"
              onClick={() => openAuthModal('login')}
              className="text-xs px-3 py-1.5 font-bold"
            >
              Đăng nhập
            </Button>
          )}
        </div>
      </header>

      {/* MOBILE SLIDE-OVER DRAWER (THANH LEFT TRÊN MOBILE) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer content */}
          <div className="relative w-4/5 max-w-xs bg-white h-full shadow-2xl flex flex-col justify-between z-10 animate-in slide-in-from-left duration-200">
            <div className="flex flex-col flex-1 overflow-y-auto">
              {/* Drawer Top */}
              <div className="p-4 border-b border-border/80 flex items-center justify-between">
                <Link to="/" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2.5">
                  <div className="gradient-bg p-2 rounded-[12px] text-white">
                    <ShoppingBag className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-extrabold tracking-tight text-text">
                    {settings.websiteName || "Hoàn Tiền Mua Sắm"}
                  </span>
                </Link>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-text hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation Items in Drawer */}
              <div className="p-3 flex flex-col gap-5">
                {navItems.map((group, gIdx) => (
                  <div key={gIdx} className="flex flex-col gap-1">
                    <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-text-secondary/70">
                      {group.group}
                    </div>
                    {group.items.map((item, iIdx) => {
                      const active = isLinkActive(item.path, item.altPaths);
                      return (
                        <NavLink
                          key={iIdx}
                          to={item.path}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                            active
                              ? 'bg-orange-50 text-primary border-l-4 border-primary pl-2.5'
                              : 'text-text/80 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {item.icon}
                            <span className="text-sm font-bold">{item.name}</span>
                          </div>
                          {item.badge && (
                            <span
                              className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                                item.badgeColor || 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </NavLink>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile Drawer Bottom */}
            <div className="p-4 border-t border-border/80 bg-slate-50">
              {currentUser ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                        {currentUser.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-bold text-text truncate max-w-[130px]">{currentUser.name}</p>
                        <span className="text-[10px] text-emerald-600 font-bold block">
                          {(currentUser.balance || userStats?.availableBalance || 0).toLocaleString('vi-VN')} đ
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                      className="border-danger text-danger text-xs px-2 py-1"
                    >
                      Thoát
                    </Button>
                  </div>
                  {currentUser.role === 'admin' && (
                    <Button
                      size="sm"
                      onClick={() => { navigate('/admin'); setMobileMenuOpen(false); }}
                      className="w-full text-xs font-bold mt-1"
                    >
                      Vào Dashboard Quản Trị
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { openAuthModal('login'); setMobileMenuOpen(false); }}
                    className="text-xs font-bold"
                  >
                    Đăng nhập
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => { openAuthModal('register'); setMobileMenuOpen(false); }}
                    className="text-xs font-bold"
                  >
                    Đăng ký
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. MAIN CONTENT WRAPPER (RIGHT SIDE OF DESKTOP SIDEBAR) */}
      {/* ======================================================== */}
      <div className="md:pl-64 flex flex-col flex-1 min-w-0 w-full transition-all duration-300">
        {/* DESKTOP TOP BAR (THÔNG TIN NHANH & CHUYỂN ĐỔI) */}
        <header className="hidden md:flex sticky top-0 z-30 h-16 bg-white/80 backdrop-blur-md border-b border-border/60 px-8 items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100/80 rounded-full border border-slate-200/60 text-xs font-semibold text-slate-600">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Nền tảng hoàn tiền mua sắm tự động</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Hotline / Support Chip */}
            {settings.supportZalo && (
              <a
                href={settings.supportZalo}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden lg:flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-primary bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-full transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                <span>Zalo Hỗ Trợ</span>
              </a>
            )}

            {currentUser ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate('/wallet')}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-700 hover:bg-emerald-100/70 transition-colors shadow-2xs"
                >
                  <Wallet className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold">
                    {(currentUser.balance || userStats?.availableBalance || 0).toLocaleString('vi-VN')} đ
                  </span>
                </button>

                <div
                  onClick={() => navigate('/wallet')}
                  className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black text-sm cursor-pointer hover:scale-105 transition-transform"
                  title={currentUser.name}
                >
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openAuthModal('login')}
                  className="text-xs font-bold text-text hover:text-primary px-3 py-2 transition-colors cursor-pointer"
                >
                  Đăng nhập
                </button>
                <Button
                  size="sm"
                  onClick={() => openAuthModal('register')}
                  className="text-xs font-bold px-4 py-2"
                >
                  Đăng ký ngay
                </Button>
              </div>
            )}
          </div>
        </header>

        {/* PAGE BODY */}
        <main className="flex-grow">
          <Outlet />
        </main>

        {/* FOOTER */}
        <footer className="bg-slate-900 text-white/90 pt-16 pb-12 border-t border-white/10 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
            <div className="flex flex-col gap-4 text-left">
              <div className="flex items-center gap-2.5">
                <div className="gradient-bg p-2.5 rounded-[14px] text-white shadow-md shadow-primary/20">
                  <ShoppingBag className="h-6 w-6" />
                </div>
                <span className="text-xl font-bold tracking-tight text-white">
                  {settings.websiteName || "Hoàn Tiền Mua Sắm"}
                </span>
              </div>
              <p className="text-xs text-white/60 leading-relaxed">
                Giải pháp tiết kiệm thông minh cho mọi đơn hàng mua sắm qua Shopee & TikTok Shop. Dán link sản phẩm, nhận tiền hoàn tự động nhanh chóng và minh bạch.
              </p>
            </div>

            <div className="text-left">
              <h4 className="font-bold text-white text-sm uppercase tracking-wider mb-4">Nền tảng mua sắm</h4>
              <ul className="flex flex-col gap-2.5 text-xs text-white/70">
                <li><Link to="/" className="hover:text-primary transition-colors flex items-center gap-1.5"><ShopeeBrandIcon className="w-3.5 h-3.5" /> Shopee Hoàn Tiền</Link></li>
                <li><Link to="/tiktok" className="hover:text-primary transition-colors flex items-center gap-1.5"><TikTokBrandIcon className="w-3.5 h-3.5" /> TikTok Shop Hoàn Tiền</Link></li>
              </ul>
            </div>

            <div className="text-left">
              <h4 className="font-bold text-white text-sm uppercase tracking-wider mb-4">Hướng dẫn & Tra cứu</h4>
              <ul className="flex flex-col gap-2.5 text-xs text-white/70">
                <li><Link to="/tracking" className="hover:text-primary transition-colors">Tra cứu tích lũy đơn</Link></li>
                <li><Link to="/wallet" className="hover:text-primary transition-colors">Ví & Rút tiền</Link></li>
                <li><Link to="/referral" className="hover:text-primary transition-colors">Giới thiệu bạn bè</Link></li>
                <li><Link to="/support" className="hover:text-primary transition-colors">Hỏi đáp & Trợ giúp</Link></li>
              </ul>
            </div>

            <div className="text-left">
              <h4 className="font-bold text-white text-sm uppercase tracking-wider mb-4">Hỗ trợ khách hàng</h4>
              <ul className="flex flex-col gap-2.5 text-xs text-white/70">
                <li><span>Thời gian làm việc: 8:00 - 22:00</span></li>
                <li><span>Hotline: <a href={`tel:${settings.supportPhone}`} className="hover:text-primary transition-colors">{settings.supportPhone || "0988.888.888"}</a></span></li>
                {settings.supportFacebook && (
                  <li><span>Facebook: <a href={settings.supportFacebook} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Fanpage Hỗ trợ</a></span></li>
                )}
                {settings.supportZalo && (
                  <li><span>Zalo: <a href={settings.supportZalo} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Nhóm Zalo hỗ trợ</a></span></li>
                )}
              </ul>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between text-xs text-white/40 gap-4">
            <p>© 2026 {settings.websiteName || "Hoàn Tiền Mua Sắm"}. Tất cả quyền được bảo lưu.</p>
            <div className="flex gap-6">
              <span>Hệ thống đối soát đơn hàng hoàn tiền tự động 24/7.</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
