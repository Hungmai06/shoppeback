import { useState } from 'react';
import { Outlet, Link, NavLink, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';
import { ShoppingBag, Menu, X } from 'lucide-react';
import { Button } from '../ui/core';
import { toast } from 'sonner';

export default function PublicLayout() {
  const navigate = useNavigate();
  const { currentUser, logout, settings, openAuthModal } = useAppStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    toast.info('Đã đăng xuất thành công');
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col font-poppins relative overflow-x-hidden">
      {/* BACKGROUND DECORATIONS */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-orange-100/40 rounded-full blur-[120px] -z-10 pointer-events-none" />
      <div className="absolute top-[800px] left-0 w-[400px] h-[400px] bg-amber-100/40 rounded-full blur-[100px] -z-10 pointer-events-none" />

      {/* HEADER / NAVBAR */}
      <header className="sticky top-0 z-40 glass-panel shadow-sm w-full transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="gradient-bg p-2.5 rounded-[14px] text-white shadow-md shadow-primary/20">
              <ShoppingBag className="h-6 w-6" />
            </div>
            <span className="text-xl font-bold tracking-tight text-text">
              {settings.websiteName || "Hoàn Tiền Mua Sắm"}
            </span>
          </Link>

          {/* Desktop Menu */}
          <nav className="hidden md:flex items-center gap-8">
            <NavLink
              to="/"
              end
              className={({ isActive }) => `text-sm font-bold transition-colors ${isActive ? 'text-primary' : 'text-text-secondary hover:text-primary'}`}
            >
              Trang chủ
            </NavLink>
            <NavLink
              to="/tracking"
              className={({ isActive }) => `text-sm font-bold transition-colors ${isActive ? 'text-primary' : 'text-text-secondary hover:text-primary'}`}
            >
              Tra cứu đơn hàng
            </NavLink>
            <NavLink
              to="/wallet"
              className={({ isActive }) => `text-sm font-bold transition-colors ${isActive ? 'text-primary' : 'text-text-secondary hover:text-primary'}`}
            >
              Ví & Rút tiền
            </NavLink>
            <NavLink
              to="/support"
              className={({ isActive }) => `text-sm font-bold transition-colors ${isActive ? 'text-primary' : 'text-text-secondary hover:text-primary'}`}
            >
              Hỏi đáp & Hỗ trợ
            </NavLink>
            <NavLink
              to="/referral"
              className={({ isActive }) => `text-sm font-bold transition-colors ${isActive ? 'text-primary' : 'text-text-secondary hover:text-primary'}`}
            >
              Giới thiệu
            </NavLink>
          </nav>

          <div className="hidden md:flex items-center gap-4">
            {currentUser ? (
              <div className="flex items-center gap-4">
                {currentUser.role === 'admin' && (
                  <Button
                    variant="outline"
                    onClick={() => navigate('/admin')}
                    className="flex items-center gap-2 border-primary/20 text-primary hover:bg-primary/5 font-bold"
                  >
                    Dashboard
                  </Button>
                )}
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-base">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-text leading-tight">{currentUser.name}</p>
                    <button
                      onClick={handleLogout}
                      className="text-[10px] text-danger hover:underline font-semibold block"
                    >
                      Đăng xuất
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <button onClick={() => openAuthModal('login')} className="text-sm font-bold text-text hover:text-primary transition-colors cursor-pointer">Đăng nhập</button>
                <Button onClick={() => openAuthModal('register')}>Đăng ký ngay</Button>
              </>
            )}
          </div>

          {/* Mobile menu toggle */}
          <div className="md:hidden flex items-center gap-3">
            {currentUser && (
              <div
                className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm cursor-pointer"
                onClick={() => currentUser.role === 'admin' && navigate('/admin')}
              >
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-button hover:bg-border/30 text-text"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu panel */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-border px-4 py-6 flex flex-col gap-4 shadow-lg">
            <NavLink
              to="/"
              end
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) => `text-base font-bold p-2 rounded-[10px] transition-colors ${isActive ? 'bg-primary/5 text-primary' : 'text-text hover:bg-primary/5'}`}
            >
              Trang chủ
            </NavLink>
            <NavLink
              to="/tracking"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) => `text-base font-bold p-2 rounded-[10px] transition-colors ${isActive ? 'bg-primary/5 text-primary' : 'text-text hover:bg-primary/5'}`}
            >
              Tra cứu đơn hàng
            </NavLink>
            <NavLink
              to="/wallet"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) => `text-base font-bold p-2 rounded-[10px] transition-colors ${isActive ? 'bg-primary/5 text-primary' : 'text-text hover:bg-primary/5'}`}
            >
              Ví & Rút tiền
            </NavLink>
            <NavLink
              to="/support"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) => `text-base font-bold p-2 rounded-[10px] transition-colors ${isActive ? 'bg-primary/5 text-primary' : 'text-text hover:bg-primary/5'}`}
            >
              Hỏi đáp & Hỗ trợ
            </NavLink>
            <NavLink
              to="/referral"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) => `text-base font-bold p-2 rounded-[10px] transition-colors ${isActive ? 'bg-primary/5 text-primary' : 'text-text hover:bg-primary/5'}`}
            >
              Giới thiệu
            </NavLink>
            <hr className="border-border my-2" />
            {currentUser ? (
              <div className="flex flex-col gap-3">
                {currentUser.role === 'admin' && (
                  <Button onClick={() => { navigate('/admin'); setMobileMenuOpen(false); }}>Vào Dashboard</Button>
                )}
                <Button variant="outline" className="border-danger text-danger hover:bg-danger/5" onClick={() => { handleLogout(); setMobileMenuOpen(false); }}>Đăng xuất</Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" onClick={() => { openAuthModal('login'); setMobileMenuOpen(false); }}>Đăng nhập</Button>
                <Button onClick={() => { openAuthModal('register'); setMobileMenuOpen(false); }}>Đăng ký</Button>
              </div>
            )}
          </div>
        )}
      </header>

      {/* PAGE BODY */}
      <main className="flex-grow">
        <Outlet />
      </main>

      {/* FOOTER */}
      <footer className="bg-text text-white/90 pt-16 pb-12 border-t border-white/10 mt-auto">
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
              Giải pháp tiết kiệm thông minh cho mọi đơn hàng mua sắm trực tuyến. Dán link sản phẩm, nhận tiền hoàn tự động nhanh chóng và minh bạch.
            </p>
          </div>

          <div className="text-left">
            <h4 className="font-bold text-white text-sm uppercase tracking-wider mb-4">Về chúng tôi</h4>
            <ul className="flex flex-col gap-2.5 text-xs text-white/70">
              <li><Link to="/" className="hover:text-primary transition-colors">Trang chủ</Link></li>
              <li><span className="text-white/40 cursor-not-allowed">Chính sách bảo mật (không liên kết URL)</span></li>
            </ul>
          </div>

          <div className="text-left">
            <h4 className="font-bold text-white text-sm uppercase tracking-wider mb-4">Hướng dẫn & Tra cứu</h4>
            <ul className="flex flex-col gap-2.5 text-xs text-white/70">
              <li><Link to="/tracking" className="hover:text-primary transition-colors">Tra cứu tích lũy</Link></li>
              <li><Link to="/wallet" className="hover:text-primary transition-colors">Ví & Rút tiền</Link></li>
              <li><Link to="/support" className="hover:text-primary transition-colors">Hỏi đáp & Trợ giúp</Link></li>
            </ul>
          </div>

          <div className="text-left">
            <h4 className="font-bold text-white text-sm uppercase tracking-wider mb-4">Hỗ trợ khách hàng</h4>
            <ul className="flex flex-col gap-2.5 text-xs text-white/70">
              <li><span>Thời gian làm việc: 8:00 - 22:00</span></li>
              <li><span>Hotline: <a href={`tel:${settings.supportPhone}`} className="hover:text-primary transition-colors">{settings.supportPhone || "0988.888.888"}</a></span></li>
              <li><span>Facebook: <a href={settings.supportFacebook} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Fanpage Hỗ trợ</a></span></li>
              <li><span>Zalo: <a href={settings.supportZalo} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Nhóm Zalo hỗ trợ</a></span></li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between text-xs text-white/40 gap-4">
          <p>© 2026 {settings.websiteName || "Hoàn Tiền Mua Sắm"}. Tất cả quyền được bảo lưu. (Bản quyền thuộc về sản phẩm)</p>
          <div className="flex gap-6">
            <span>Không chứa bất kỳ liên kết miền thực tế nào.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
