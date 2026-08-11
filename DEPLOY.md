# 🚀 Hướng Dẫn Đóng Gói & Deploy Máy Chủ (Git & Docker)

Tài liệu này hướng dẫn chi tiết từng bước để đẩy mã nguồn dự án **Hũ Tài Lộc (Shopee Cashback Affiliate)** lên Git và triển khai tự động bằng Docker & Docker Compose trên máy chủ VPS/Cloud Server.

---

## 🛠️ Kiến Trúc Hệ Thống Trong Docker

Dự án đã được đóng gói tối ưu thành 2 Container độc lập kết nối qua Mạng Docker nội bộ:
1. **Frontend Container (`hoantien_frontend`)**: Chạy ứng dụng React (Vite) đã build tối ưu kết hợp web server Nginx (Cổng `80`). Nginx tự động điều hướng ứng dụng SPA và Reverse Proxy tất cả yêu cầu `/api/` về Backend.
2. **Backend Container (`hoantien_backend`)**: Chạy ứng dụng Node.js Express (Cổng `5000`) xử lý logic tính tiền hoàn, đối soát file Excel và kết nối CSDL (SQLite/MySQL).

---

## 📝 BƯỚC 1: Đóng Gói & Đẩy Mã Nguồn Lên Git (Máy Local)

Mở Terminal trên máy tính cá nhân của bạn và thực hiện các lệnh sau:

### 1.1 Khởi tạo Git & Kiểm tra trạng thái:
```bash
git init
git status
```

### 1.2 Thêm toàn bộ mã nguồn vào Git:
```bash
git add .
```

### 1.3 Tạo Commit lưu thay đổi:
```bash
git commit -m "Initial commit: Fullstack Shopee Cashback system with Docker support"
```

### 1.4 Đẩy mã nguồn lên GitHub / GitLab:
*(Thay `https://github.com/username/repository.git` bằng URL kho lưu trữ Git của bạn)*
```bash
git remote add origin https://github.com/username/repository.git
git branch -M main
git push -u origin main
```

---

## 💻 BƯỚC 2: Chuẩn Bị Máy Chủ VPS (Server Linux)

Đăng nhập vào máy chủ VPS của bạn qua SSH:
```bash
ssh root@your_server_ip
```

### 2.1 Cài đặt Docker & Docker Compose trên VPS (Ubuntu/Debian):
```bash
# Cập nhật hệ thống
sudo apt update && sudo apt upgrade -y

# Cài đặt Docker & Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Cài đặt Docker Compose Plugin
sudo apt install -y docker-compose-plugin

# Kiểm tra phiên bản cài đặt thành công
docker --version
docker compose version
```

---

## 📥 BƯỚC 3: Tải Mã Nguồn Về Server & Cấu Hình

### 3.1 Clone dự án từ Git về VPS:
```bash
cd /var/www/
git clone https://github.com/username/repository.git hoantien
cd hoantien
```

### 3.2 Cấu hình bảo mật biến môi trường trong `docker-compose.yml`:
Chỉnh sửa file `docker-compose.yml` trên server (nếu cần đổi khóa bảo mật JWT):
```bash
nano docker-compose.yml
```
*Đảm bảo thay đổi `JWT_SECRET` thành chuỗi bí mật an toàn ngẫu nhiên của bạn.*

---

## 🚀 BƯỚC 4: Khởi Chạy Hệ Thống Bằng Docker Compose

Thực hiện lệnh sau trên VPS để tự động build ứng dụng và khởi chạy dưới dạng daemon chạy ngầm:

```bash
docker compose up -d --build
```

> ⚡ **Kết quả mong đợi:**
> - Docker sẽ tự động tải các base image `node:18-alpine` và `nginx:alpine`.
> - Tự động biên dịch mã nguồn Frontend React ra mã tĩnh siêu nhẹ.
> - Tự động bật 2 Container `hoantien_backend` và `hoantien_frontend`.

---

## 🔍 BƯỚC 5: Kiểm Tra Trạng Thái & Nhật Ký Server

### 5.1 Kiểm tra các container đang chạy:
```bash
docker compose ps
```

### 5.2 Xem nhật ký hoạt động (Logs) của hệ thống:
```bash
# Xem log toàn bộ hệ thống
docker compose logs -f

# Xem log riêng Backend
docker compose logs -f backend

# Xem log riêng Frontend Nginx
docker compose logs -f frontend
```

---

## 🔄 BƯỚC 6: Cập Nhật Phiên Bản Mới Khi Có Thay Đổi Mã Nguồn

Mỗi khi bạn sửa mã nguồn ở máy local và đẩy lên Git (`git push`), hãy đăng nhập VPS và chạy 3 lệnh sau để cập nhật tự động **không làm gián đoạn dữ liệu**:

```bash
cd /var/www/hoantien
git pull origin main
docker compose up -d --build
```

---

## 🛡️ BƯỚC 7: (Tùy Chọn) Cài Đặt Tên Miền & SSL HTTPS Miễn Phí

Nếu bạn muốn trỏ tên miền (VD: `hoantienmuasam.com`) và cài SSL HTTPS bằng Certbot:

### 7.1 Cài đặt Nginx Host & Certbot trên Ubuntu:
```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 7.2 Đăng ký SSL HTTPS tự động:
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## ❓ Các Lệnh Quản Lý Docker Thường Dùng

- **Tạm dừng hệ thống**: `docker compose stop`
- **Khởi động lại hệ thống**: `docker compose restart`
- **Tắt và xóa các container**: `docker compose down`
- **Xóa cache Docker thừa**: `docker system prune -f`
