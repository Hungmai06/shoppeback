import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShoppingBag, ArrowLeft } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, CardDescription, Input } from '../../components/ui/core';
import { useAppStore } from '../../store/appStore';
import { toast } from 'sonner';

export default function AuthPages() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') || 'login'; // login, register, forgot, reset

  const { login, register } = useAppStore();

  // Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [referralCode, setReferralCode] = useState(searchParams.get('ref') || '');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);


  const setMode = (newMode: string) => {
    navigate(`/auth?mode=${newMode}`);
  };



  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error('Vui lòng điền đầy đủ thông tin đăng nhập');
      return;
    }

    const result = await login(email, password);
    if (result) {
      const userRole = result.role;
      toast.success(`Chào mừng quay trở lại${userRole === 'admin' ? ', Quản trị viên' : ''}!`);
      navigate(userRole === 'admin' ? '/admin' : '/');
    } else {
      toast.error('Đăng nhập thất bại. Kiểm tra lại email hoặc mật khẩu.');
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

    const success = await register(name, email, password, referralCode);
    if (success) {
      toast.success('Đăng ký tài khoản thành công! Chào mừng bạn!');
      navigate('/');
    } else {
      toast.error('Email này đã được đăng ký trên hệ thống');
    }
  };

  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Vui lòng điền email của bạn');
      return;
    }
    toast.success('Hệ thống đã gửi mã OTP xác nhận về email của bạn');
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
    setMode(mode === 'forgot' || email ? 'reset' : 'login');
  };

  const handleOtpChange = (element: HTMLInputElement, index: number) => {
    if (isNaN(Number(element.value))) return;

    const newOtp = [...otp];
    newOtp[index] = element.value;
    setOtp(newOtp);

    // Auto-focus next input
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
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-4 relative font-poppins overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-orange-100/40 rounded-full blur-[100px] -z-10" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-amber-100/40 rounded-full blur-[100px] -z-10" />

      {/* Brand logo */}
      <div className="flex items-center gap-2.5 mb-8 cursor-pointer" onClick={() => navigate('/')}>
        <div className="gradient-bg p-2 rounded-[12px] text-white">
          <ShoppingBag className="h-5 w-5" />
        </div>
        <span className="text-lg font-bold tracking-tight text-text">
          Hoàn Tiền <span className="text-primary">Mua Sắm</span>
        </span>
      </div>

      <div className="w-full max-w-md">
        <Card className="border border-border/80 rounded-card bg-white shadow-soft">

          {/* LOGIN VIEW */}
          {mode === 'login' && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <CardHeader className="text-center">
                <CardTitle className="text-xl md:text-2xl">Đăng nhập tài khoản</CardTitle>
                <CardDescription>Chào mừng bạn trở lại! Nhập thông tin để tiếp tục.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="flex flex-col gap-4">
                  <Input
                    label="Địa chỉ Email"
                    placeholder="name@example.com"
                    type="email"
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
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-border text-sm rounded-input outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full py-3 font-bold mt-2">
                    Đăng Nhập
                  </Button>
                </form>

                <p className="text-center text-xs text-text-secondary font-medium mt-6">
                  Chưa có tài khoản?{' '}
                  <button onClick={() => setMode('register')} className="text-primary font-bold hover:underline">
                    Đăng ký miễn phí
                  </button>
                </p>
              </CardContent>
            </motion.div>
          )}

          {/* REGISTER VIEW */}
          {mode === 'register' && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <CardHeader className="text-center">
                <CardTitle className="text-xl md:text-2xl">Đăng ký thành viên</CardTitle>
                <CardDescription>Bắt đầu mua sắm thông minh và tích lũy tiền hoàn hôm nay.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRegister} className="flex flex-col gap-4">
                  <Input
                    label="Họ và tên"
                    placeholder="Nguyễn Văn A"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                  <Input
                    label="Địa chỉ Email"
                    placeholder="name@example.com"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <Input
                    label="Mật khẩu"
                    placeholder="Tối thiểu 6 ký tự"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <Input
                    label="Xác nhận mật khẩu"
                    placeholder="Nhập lại mật khẩu"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />

                  <Input
                    label="Mã giới thiệu (Không bắt buộc)"
                    placeholder="Nhập mã giới thiệu nếu có"
                    type="text"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value)}
                  />

                  <div className="flex items-start gap-2.5 text-xs text-text-secondary mt-1">
                    <input type="checkbox" id="terms" className="mt-0.5 rounded-sm border-border text-primary focus:ring-primary" required />
                    <label htmlFor="terms" className="leading-snug cursor-pointer select-none">
                      Tôi đồng ý với các chính sách bảo mật và điều khoản sử dụng của ứng dụng.
                    </label>
                  </div>

                  <Button type="submit" className="w-full py-3 font-bold mt-2">
                    Đăng Ký Ngay
                  </Button>
                </form>

                <p className="text-center text-xs text-text-secondary font-medium mt-6">
                  Đã có tài khoản?{' '}
                  <button onClick={() => setMode('login')} className="text-primary font-bold hover:underline">
                    Đăng nhập
                  </button>
                </p>
              </CardContent>
            </motion.div>
          )}

          {/* FORGOT PASSWORD VIEW */}
          {mode === 'forgot' && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <CardHeader>
                <button onClick={() => setMode('login')} className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text mb-3 font-semibold transition-colors">
                  <ArrowLeft className="h-3.5 w-3.5" /> Quay lại
                </button>
                <CardTitle className="text-xl">Khôi phục mật khẩu</CardTitle>
                <CardDescription>Nhập email liên kết với tài khoản để nhận mã OTP xác thực khôi phục.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleForgotPassword} className="flex flex-col gap-4">
                  <Input
                    label="Email tài khoản"
                    placeholder="name@example.com"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <Button type="submit" className="w-full py-3 font-bold mt-2">
                    Gửi Mã Xác Thực
                  </Button>
                </form>
              </CardContent>
            </motion.div>
          )}

          {/* OTP VERIFICATION VIEW */}
          {mode === 'otp' && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <CardHeader className="text-center">
                <CardTitle className="text-xl md:text-2xl">Xác thực OTP</CardTitle>
                <CardDescription>
                  Mã OTP 6 chữ số đã được gửi đến email của bạn. Vui lòng nhập mã để hoàn tất.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleOtpSubmit} className="flex flex-col gap-6">
                  <div className="flex gap-2 justify-center">
                    {otp.map((data, index) => (
                      <input
                        key={index}
                        type="text"
                        name="otp"
                        maxLength={1}
                        value={data}
                        onChange={(e) => handleOtpChange(e.target, index)}
                        onFocus={(e) => e.target.select()}
                        className="w-12 h-12 border border-border text-center text-lg font-bold rounded-input outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all bg-white"
                      />
                    ))}
                  </div>

                  <Button type="submit" className="w-full py-3 font-bold">
                    Xác Nhận OTP
                  </Button>
                </form>

                <div className="text-center mt-6 flex flex-col gap-2">
                  <p className="text-xs text-text-secondary font-medium">
                    Chưa nhận được mã?{' '}
                    <button type="button" onClick={() => toast.success('Đã gửi lại OTP mới')} className="text-primary font-bold hover:underline">
                      Gửi lại mã
                    </button>
                  </p>
                  <button onClick={() => setMode('login')} className="text-xs text-text-secondary hover:text-text font-bold block mx-auto underline mt-2">
                    Thay đổi thông tin
                  </button>
                </div>
              </CardContent>
            </motion.div>
          )}

          {/* RESET PASSWORD VIEW */}
          {mode === 'reset' && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <CardHeader>
                <CardTitle className="text-xl">Đặt lại mật khẩu</CardTitle>
                <CardDescription>Thiết lập mật khẩu mới cho tài khoản của bạn.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
                  <Input
                    label="Mật khẩu mới"
                    placeholder="Tối thiểu 6 ký tự"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <Input
                    label="Nhập lại mật khẩu mới"
                    placeholder="Trùng khớp mật khẩu trên"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  <Button type="submit" className="w-full py-3 font-bold mt-2">
                    Hoàn Tất Đặt Lại
                  </Button>
                </form>
              </CardContent>
            </motion.div>
          )}

        </Card>
      </div>
    </div>
  );
}
