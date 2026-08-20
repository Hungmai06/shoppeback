import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingBag, UserCheck, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Button, Input } from '../ui/core';
import { useAppStore } from '../../store/appStore';
import { toast } from 'sonner';

export default function AuthModal() {
  const { isAuthModalOpen, authModalMode, closeAuthModal, login, register } = useAppStore();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'otp' | 'reset'>(authModalMode || 'login');

  // Sync internal mode with store mode on open
  useEffect(() => {
    if (isAuthModalOpen) {
      setMode(authModalMode || 'login');
    }
  }, [isAuthModalOpen, authModalMode]);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  if (!isAuthModalOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error('Vui lòng điền đầy đủ email và mật khẩu');
      return;
    }

    setLoading(true);
    const result = await login(email, password);
    setLoading(false);

    if (result) {
      toast.success(`Chào mừng quay trở lại${result.role === 'admin' ? ', Admin' : ''}!`);
      closeAuthModal();
      // Reset form
      setEmail('');
      setPassword('');
    } else {
      toast.error('Đăng nhập thất bại. Vui lòng kiểm tra lại email hoặc mật khẩu.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) {
      toast.error('Vui lòng điền đầy đủ thông tin đăng ký');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Mật khẩu nhập lại không trùng khớp');
      return;
    }

    setLoading(true);
    const success = await register(name, email, password, referralCode);
    setLoading(false);

    if (success) {
      toast.success('Đăng ký tài khoản thành công! Chào mừng bạn!');
      closeAuthModal();
      // Reset form
      setName('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setReferralCode('');
    } else {
      toast.error('Email này đã được đăng ký trên hệ thống');
    }
  };

  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Vui lòng nhập địa chỉ email');
      return;
    }
    toast.success('Mã xác nhận OTP đã được gửi về email của bạn');
    setMode('otp');
  };

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length < 6) {
      toast.error('Vui lòng nhập đầy đủ mã OTP 6 chữ số');
      return;
    }
    toast.success('Xác thực OTP thành công!');
    setMode('reset');
  };

  const handleOtpChange = (element: HTMLInputElement, index: number) => {
    if (isNaN(Number(element.value))) return;

    const newOtp = [...otp];
    newOtp[index] = element.value;
    setOtp(newOtp);

    // Auto focus next input
    if (element.nextElementSibling && element.value) {
      (element.nextElementSibling as HTMLInputElement).focus();
    }
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || password !== confirmPassword) {
      toast.error('Mật khẩu không trùng khớp');
      return;
    }
    toast.success('Đặt lại mật khẩu thành công! Hãy đăng nhập lại.');
    setMode('login');
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeAuthModal}
          className="fixed inset-0 bg-black/40 transition-opacity"
        />

        {/* Modal Window Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", duration: 0.4, bounce: 0.1 }}
          className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[24px] shadow-2xl border border-border/80 z-10 overflow-hidden text-left"
        >
          {/* Top Decorative Gradient */}
          <div className="h-2 w-full gradient-bg" />

          {/* Close Button */}
          <button
            onClick={closeAuthModal}
            className="absolute top-4 right-4 p-2 rounded-full text-text-secondary hover:text-text hover:bg-border/30 transition-colors z-20"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="p-6 sm:p-8">
            {/* Header Brand */}
            <div className="flex items-center gap-2.5 mb-6">
              <div className="gradient-bg p-2 rounded-[12px] text-white shadow-md shadow-primary/20">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <span className="text-lg font-bold tracking-tight text-text">
                Hoàn Tiền <span className="text-primary">Mua Sắm</span>
              </span>
            </div>

            {/* TAB SELECTOR (ONLY FOR LOGIN / REGISTER) */}
            {(mode === 'login' || mode === 'register') && (
              <div className="grid grid-cols-2 gap-1 p-1 bg-bg border border-border rounded-button mb-6">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className={`py-2.5 text-xs font-bold rounded-[10px] transition-all ${
                    mode === 'login'
                      ? 'bg-white text-primary shadow-sm'
                      : 'text-text-secondary hover:text-text'
                  }`}
                >
                  Đăng Nhập
                </button>
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className={`py-2.5 text-xs font-bold rounded-[10px] transition-all ${
                    mode === 'register'
                      ? 'bg-white text-primary shadow-sm'
                      : 'text-text-secondary hover:text-text'
                  }`}
                >
                  Đăng Ký
                </button>
              </div>
            )}

            {/* 1. LOGIN FORM */}
            {mode === 'login' && (
              <motion.form
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                onSubmit={handleLogin}
                className="flex flex-col gap-4"
              >
                <div>
                  <h3 className="text-xl font-bold text-text">Đăng nhập tài khoản</h3>
                  <p className="text-xs text-text-secondary mt-1 font-medium">
                    Nhập email và mật khẩu của bạn để mở khóa tính năng hoàn tiền.
                  </p>
                </div>

                <div className="flex flex-col gap-3 mt-2">
                  <Input
                    label="Địa chỉ Email"
                    placeholder="name@example.com"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />

                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold text-text/80">Mật khẩu</label>
                      <button
                        type="button"
                        onClick={() => setMode('forgot')}
                        className="text-xs text-primary font-bold hover:underline"
                      >
                        Quên mật khẩu?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-3 pr-11 bg-white border border-border text-sm rounded-input outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-semibold"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-secondary hover:text-primary transition-colors focus:outline-none"
                        tabIndex={-1}
                        title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 font-bold mt-2 flex items-center justify-center gap-2 shadow-md shadow-primary/20"
                >
                  {loading ? 'Đang xử lý...' : 'Đăng Nhập Ngay'}
                  <ArrowRight className="h-4 w-4" />
                </Button>

                <p className="text-center text-xs text-text-secondary font-medium mt-3">
                  Chưa có tài khoản?{' '}
                  <button
                    type="button"
                    onClick={() => setMode('register')}
                    className="text-primary font-bold hover:underline"
                  >
                    Đăng ký miễn phí
                  </button>
                </p>
              </motion.form>
            )}

            {/* 2. REGISTER FORM */}
            {mode === 'register' && (
              <motion.form
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                onSubmit={handleRegister}
                className="flex flex-col gap-3"
              >
                <div>
                  <h3 className="text-xl font-bold text-text">Tạo tài khoản mới</h3>
                  <p className="text-xs text-text-secondary mt-1 font-medium">
                    Nhận ngay 50% hoàn tiền hoa hồng Shopee trực tiếp về ví.
                  </p>
                </div>

                <div className="flex flex-col gap-3 mt-1">
                  <Input
                    label="Họ và tên"
                    placeholder="Nguyễn Văn A"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />

                  <Input
                    label="Địa chỉ Email"
                    placeholder="name@example.com"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-text/80">Mật khẩu</label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          autoComplete="new-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full px-3 py-2.5 pr-8 bg-white border border-border text-xs rounded-input outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 font-semibold"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-text-secondary hover:text-primary transition-colors focus:outline-none"
                          tabIndex={-1}
                          title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                        >
                          {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-text/80">Nhập lại MK</label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="••••••••"
                          autoComplete="new-password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full px-3 py-2.5 pr-8 bg-white border border-border text-xs rounded-input outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 font-semibold"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-text-secondary hover:text-primary transition-colors focus:outline-none"
                          tabIndex={-1}
                          title={showConfirmPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                        >
                          {showConfirmPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-text/80">Mã giới thiệu (Không bắt buộc)</label>
                    <input
                      type="text"
                      placeholder="VD: REF12345"
                      autoComplete="off"
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value)}
                      className="w-full px-3 py-2.5 bg-white border border-border text-xs rounded-input outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 font-semibold uppercase"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 font-bold mt-2 flex items-center justify-center gap-2 shadow-md shadow-primary/20"
                >
                  {loading ? 'Đang xử lý...' : 'Đăng Ký Tài Khoản'}
                  <UserCheck className="h-4 w-4" />
                </Button>

                <p className="text-center text-xs text-text-secondary font-medium mt-2">
                  Đã có tài khoản?{' '}
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="text-primary font-bold hover:underline"
                  >
                    Đăng nhập tại đây
                  </button>
                </p>
              </motion.form>
            )}

            {/* 3. FORGOT PASSWORD FORM */}
            {mode === 'forgot' && (
              <motion.form
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                onSubmit={handleForgotPassword}
                className="flex flex-col gap-4"
              >
                <div>
                  <h3 className="text-xl font-bold text-text">Quên mật khẩu?</h3>
                  <p className="text-xs text-text-secondary mt-1 font-medium">
                    Nhập email đã đăng ký. Chúng tôi sẽ gửi mã xác minh 6 chữ số để bạn đặt lại mật khẩu.
                  </p>
                </div>

                <Input
                  label="Email của bạn"
                  placeholder="name@example.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />

                <div className="flex gap-3 mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setMode('login')}
                    className="w-1/2 py-3 font-bold"
                  >
                    Quay lại
                  </Button>
                  <Button type="submit" className="w-1/2 py-3 font-bold">
                    Gửi Mã OTP
                  </Button>
                </div>
              </motion.form>
            )}

            {/* 4. OTP FORM */}
            {mode === 'otp' && (
              <motion.form
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                onSubmit={handleOtpSubmit}
                className="flex flex-col gap-4 text-center"
              >
                <div>
                  <h3 className="text-xl font-bold text-text">Nhập mã xác minh OTP</h3>
                  <p className="text-xs text-text-secondary mt-1 font-medium">
                    Mã 6 chữ số đã được gửi tới email <span className="font-bold text-text">{email}</span>.
                  </p>
                </div>

                <div className="flex justify-center gap-2 my-2">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      type="text"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(e.target, index)}
                      className="w-10 h-12 text-center text-lg font-bold border border-border rounded-input focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                  ))}
                </div>

                <div className="flex gap-3 mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setMode('forgot')}
                    className="w-1/2 py-3 font-bold"
                  >
                    Quay lại
                  </Button>
                  <Button type="submit" className="w-1/2 py-3 font-bold">
                    Xác Nhận
                  </Button>
                </div>
              </motion.form>
            )}

            {/* 5. RESET PASSWORD FORM */}
            {mode === 'reset' && (
              <motion.form
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                onSubmit={handleResetPassword}
                className="flex flex-col gap-4"
              >
                <div>
                  <h3 className="text-xl font-bold text-text">Đặt lại mật khẩu mới</h3>
                  <p className="text-xs text-text-secondary mt-1 font-medium">
                    Tạo mật khẩu mới cho tài khoản của bạn.
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text/80">Mật khẩu mới</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 pr-11 bg-white border border-border text-sm rounded-input outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-semibold"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-secondary hover:text-primary transition-colors focus:outline-none"
                      tabIndex={-1}
                      title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text/80">Xác nhận mật khẩu mới</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-3 pr-11 bg-white border border-border text-sm rounded-input outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-semibold"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-secondary hover:text-primary transition-colors focus:outline-none"
                      tabIndex={-1}
                      title={showConfirmPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" className="w-full py-3.5 font-bold mt-2">
                  Cập Nhật Mật Khẩu
                </Button>
              </motion.form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
