import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';
import { 
  MessageSquare, Send, LifeBuoy, FileText 
} from 'lucide-react';
import { Button, Card, CardContent, Accordion, AccordionItem, Badge } from '../../components/ui/core';
import { toast } from 'sonner';

interface Ticket {
  id: string;
  category: string;
  subject: string;
  message: string;
  status: 'pending' | 'resolved';
  date: string;
}

export default function SupportPage() {
  const navigate = useNavigate();
  const { currentUser } = useAppStore();
  const isLoggedIn = !!currentUser;

  // Local state for submitted tickets (makes it functional)
  const [tickets, setTickets] = useState<Ticket[]>([
    {
      id: 'TK2938',
      category: 'Đối soát đơn hàng',
      subject: 'Đơn hàng iPhone 15 chưa thấy cập nhật tạm tính',
      message: 'Tôi đã đặt mua thành công qua link hoàn tiền được 3 tiếng nhưng chưa thấy đơn hiển thị trong lịch sử.',
      status: 'pending',
      date: '2026-07-05'
    },
    {
      id: 'TK1029',
      category: 'Rút tiền',
      subject: 'Yêu cầu rút 500k từ tuần trước chưa duyệt',
      message: 'Yêu cầu rút tiền ngày 10/06 của tôi đã được giải quyết nhanh chóng. Xin cảm ơn ban quản trị!',
      status: 'resolved',
      date: '2026-06-11'
    }
  ]);

  // Form states
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('order');
  const [message, setMessage] = useState('');

  const handleSubmitTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      toast.error('Vui lòng điền đầy đủ tiêu đề và nội dung yêu cầu');
      return;
    }

    const newTicket: Ticket = {
      id: `TK${Math.floor(1000 + Math.random() * 9000)}`,
      category: category === 'order' ? 'Đối soát đơn hàng' : category === 'wallet' ? 'Rút tiền' : category === 'link' ? 'Tạo link lỗi' : 'Hỗ trợ khác',
      subject,
      message,
      status: 'pending',
      date: new Date().toISOString().slice(0, 10)
    };

    setTickets([newTicket, ...tickets]);
    toast.success('Gửi yêu cầu hỗ trợ thành công! Admin sẽ phản hồi trong vòng 2 giờ.');
    setSubject('');
    setMessage('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* PAGE HEADER */}
      <div className="text-center max-w-3xl mx-auto mb-12">
        <span className="px-3.5 py-1.5 bg-primary/10 text-primary font-bold text-xs uppercase tracking-wider rounded-full mb-4 inline-block">
          Hỏi đáp & Trợ giúp
        </span>
        <h1 className="text-3xl md:text-5xl font-black text-text mb-4 leading-tight">
          Hỏi Đáp & <span className="gradient-text">Trung Tâm Trợ Giúp</span>
        </h1>
        <p className="text-sm md:text-base text-text-secondary">
          Tìm câu trả lời nhanh chóng cho các câu hỏi thường gặp hoặc gửi yêu cầu hỗ trợ trực tiếp đến ban điều hành.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* FAQS ACCORDION (LEFT COLUMN) */}
        <div className="lg:col-span-7 text-left">
          <Card className="border border-border/50 bg-white shadow-soft">
            <CardContent className="p-6">
              <h2 className="text-lg font-bold text-text mb-6 flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Câu hỏi thường gặp (FAQs)
              </h2>

              <Accordion>
                <AccordionItem title="Quy trình hoàn tiền hoạt động như thế nào?" isOpenDefault={true}>
                  Chúng tôi liên kết với Shopee qua chương trình Tiếp thị liên kết (Affiliate Marketing). Khi bạn tạo link hoàn tiền và mua sắm thông qua link đó, Shopee sẽ trả hoa hồng cho chúng tôi. Chúng tôi trích tới 50% số tiền hoa hồng nhận được để trả lại cho bạn dưới dạng Tiền Hoàn.
                </AccordionItem>
                <AccordionItem title="Tại sao đơn hàng đã hoàn thành nhưng tiền hoàn vẫn ở trạng thái Chờ đối soát?">
                  Sau khi bạn nhận hàng thành công, Shopee cần thời gian thông thường 7 ngày để đối soát, xác nhận không xảy ra trả hàng, hoàn tiền hoặc gian lận. Khi Shopee phê duyệt đơn hàng, hệ thống sẽ tự động cập nhật số dư khả dụng cho bạn rút tiền.
                </AccordionItem>
                <AccordionItem title="Số dư tối thiểu để rút tiền là bao nhiêu?">
                  Hạn mức rút tiền tối thiểu của ví hoàn tiền là 50,000đ. Bạn có thể gửi yêu cầu rút tiền bất cứ lúc nào khi số dư khả dụng đạt trên 50,000đ. Tiền sẽ được chuyển khoản trực tiếp vào tài khoản ngân hàng liên kết của bạn.
                </AccordionItem>
                <AccordionItem title="Tôi có cần tạo tài khoản để được nhận hoàn tiền không?">
                  Bạn có thể sử dụng công cụ kiểm tra tiền hoàn miễn phí mà không cần đăng nhập. Tuy nhiên, để tạo link mua hàng, tích lũy số dư và rút tiền về tài khoản ngân hàng, bạn bắt buộc phải đăng nhập/đăng ký tài khoản để hệ thống có thể ghi nhận đúng mã định danh của bạn.
                </AccordionItem>
                <AccordionItem title="Tôi có được hoàn tiền khi áp dụng mã giảm giá của Shopee không?">
                  Có! Bạn vẫn nhận được tiền hoàn bình thường dựa trên số tiền thanh toán thực tế (sau khi đã áp dụng Shopee Voucher, Shop Voucher và Shopee Xu).
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </div>

        {/* SUPPORT TICKETS SYSTEM (RIGHT COLUMN) */}
        <div className="lg:col-span-5 text-left flex flex-col gap-6">
          
          {/* TICKET SUBMISSION CARD */}
          <Card className="border border-border/50 bg-white shadow-soft">
            <CardContent className="p-6">
              <h2 className="text-lg font-bold text-text mb-4 flex items-center gap-2">
                <LifeBuoy className="h-5 w-5 text-primary" />
                Gửi yêu cầu trợ giúp
              </h2>

              {!isLoggedIn ? (
                <div className="py-8 text-center flex flex-col items-center gap-4">
                  <div className="bg-primary/10 p-4 rounded-full text-primary">
                    <MessageSquare className="h-6 w-6" />
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    Vui lòng đăng nhập tài khoản thành viên để gửi yêu cầu hỗ trợ trực tiếp 24/7 cho Admin.
                  </p>
                  <Button onClick={() => navigate('/auth')} className="w-full font-bold py-2.5">Đăng nhập ngay</Button>
                </div>
              ) : (
                <form onSubmit={handleSubmitTicket} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-text-secondary mb-1">Chủ đề hỗ trợ</label>
                    <input
                      type="text"
                      placeholder="VD: Không ghi nhận đơn hàng..."
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full px-3 py-2 border border-border text-xs rounded-input focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text-secondary mb-1">Danh mục</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-border text-xs rounded-input bg-white"
                    >
                      <option value="order">Đối soát đơn hàng</option>
                      <option value="wallet">Rút tiền chậm</option>
                      <option value="link">Tạo link lỗi</option>
                      <option value="other">Yêu cầu khác</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text-secondary mb-1">Nội dung chi tiết</label>
                    <textarea
                      rows={4}
                      placeholder="Nhập nội dung câu hỏi hoặc mã đơn hàng cần kiểm tra..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="w-full px-3 py-2 border border-border text-xs rounded-input focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none"
                    />
                  </div>
                  <Button type="submit" className="w-full font-bold flex items-center justify-center gap-2 py-2.5">
                    Gửi yêu cầu
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          {/* USER TICKET LIST (ONLY SHOWS IF LOGGED IN) */}
          {isLoggedIn && (
            <Card className="border border-border/50 bg-white shadow-soft">
              <CardContent className="p-6">
                <h3 className="text-sm font-bold text-text mb-4">Các yêu cầu bạn đã gửi</h3>
                
                <div className="space-y-3.5">
                  {tickets.map((t) => (
                    <div key={t.id} className="p-3 border border-border/60 rounded-input hover:bg-bg transition-colors flex justify-between items-start gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-text-secondary bg-bg px-2 py-0.5 rounded-[6px]">{t.category}</span>
                          <span className="text-[10px] text-text-secondary">{t.date}</span>
                        </div>
                        <p className="text-xs font-bold text-text line-clamp-1">{t.subject}</p>
                        <p className="text-[10px] text-text-secondary line-clamp-1">{t.message}</p>
                      </div>
                      
                      {t.status === 'pending' ? (
                        <Badge className="bg-amber-500 text-white border-none text-[9px] py-0.5 px-1.5 shrink-0">Đang chờ</Badge>
                      ) : (
                        <Badge className="bg-emerald-500 text-white border-none text-[9px] py-0.5 px-1.5 shrink-0">Đã trả lời</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
