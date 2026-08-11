export interface MockProduct {
  url: string;
  name: string;
  price: number;
  cashbackRate: number;
  image: string;
}

export const SAMPLE_SHOPEE_PRODUCTS: MockProduct[] = [
  {
    url: 'https://shopee.vn/tai-nghe-sony-wh-1000xm4',
    name: 'Tai nghe chụp tai Bluetooth Sony WH-1000XM4 Chống ồn chủ động',
    price: 6490000,
    cashbackRate: 0.07,
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=400'
  },
  {
    url: 'https://shopee.vn/iphone-15-pro-max',
    name: 'Điện thoại Apple iPhone 15 Pro Max 256GB - Chính hãng VNA',
    price: 29990000,
    cashbackRate: 0.07,
    image: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&q=80&w=400'
  },
  {
    url: 'https://shopee.vn/giay-nike-pegasus-40',
    name: 'Giày Chạy Bộ Nam Nike Pegasus 40 Kháng Nước - Đen Cam',
    price: 3200000,
    cashbackRate: 0.07,
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=400'
  },
  {
    url: 'https://shopee.vn/binh-giu-nhiet-lock-lock',
    name: 'Bình Giữ Nhiệt Lock&Lock Feather Light 450ml - Thép Không Gỉ',
    price: 350000,
    cashbackRate: 0.07,
    image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&q=80&w=400'
  },
  {
    url: 'https://shopee.vn/son-black-rouge-ver9',
    name: 'Son Kem Lì Black Rouge Air Fit Velvet Tint Ver 9 4.4g',
    price: 189000,
    cashbackRate: 0.07,
    image: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&q=80&w=400'
  }
];
