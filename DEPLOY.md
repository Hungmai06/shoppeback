# 🚀 Hướng Dẫn Đóng Gói & Deploy Máy Chủ (Git & Docker)

Tài liệu này hướng dẫn chi tiết từng bước để đẩy mã nguồn dự án **Hũ Tài Lộc (Shopee Cashback Affiliate)** lên Git và triển khai tự động bằng Docker & Docker Compose trên máy chủ VPS cho subdomain **`shoppe.khoahocdrivemh.pro.vn`**.

---

## 🛠️ Kiến Trúc Hệ Thống Trong Docker (3 Service)

Dự án đã được đóng gói thành **3 Container Docker** kết nối qua mạng nội bộ:
1. **Database Container (`hoantien_mysql`)**: Chạy cơ sở dữ liệu **MySQL 8.0** độc lập. Toàn bộ dữ liệu tài khoản, đơn hàng và số dư được lưu trữ bền vững vào Docker Volume (`mysql_data`).
2. **Backend Container (`hoantien_backend`)**: Chạy Node.js API (Cổng `5000`), kết nối trực tiếp với MySQL Container (`db:3306`) thông qua cơ chế `service_healthy`.
3. **Frontend Container (`hoantien_frontend`)**: Chạy React Nginx Web Server (Cổng `80`), phục vụ subdomain **`shoppe.khoahocdrivemh.pro.vn`** và Reverse Proxy tất cả yêu cầu `/api/` về Backend.

---

## 📝 BƯỚC 1: Đẩy Mã Nguồn Lên Git (Máy Local)

Thực hiện các lệnh sau trên máy tính cá nhân của bạn để đẩy mã nguồn lên GitHub:

```bash
git add .
git commit -m "Update MySQL docker container & subdomain shoppe.khoahocdrivemh.pro.vn"
git push origin main
```

---

## 💻 BƯỚC 2: Chuẩn Bị Máy Chủ VPS (Server Linux)

Đăng nhập vào VPS qua SSH:
```bash
ssh root@161.248.4.83
```

### 2.1 Cài đặt Docker & Docker Compose Plugin (Ubuntu/Debian):
```bash
# Cập nhật hệ thống
sudo apt update && sudo apt upgrade -y

# Cài đặt Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Cài đặt Docker Compose Plugin
sudo apt install -y docker-compose-plugin

# Kiểm tra cài đặt
docker --version
docker compose version
```

---

## 📥 BƯỚC 3: Tải Mã Nguồn Về Server & Cấu Hình

### 3.1 Clone kho lưu trữ Git về VPS:
```bash
cd /var/www/
git clone https://github.com/Hungmai06/shoppeback.git shoppeback
cd shoppeback
```

### 3.2 Kiểm tra file `docker-compose.yml`:
Có thể tùy chỉnh lại Mật khẩu MySQL hoặc `JWT_SECRET` trong `docker-compose.yml`:
```bash
nano docker-compose.yml
```

---

## 🚀 BƯỚC 4: Khởi Chạy Hệ Thống (3 Containers)

Thực hiện lệnh sau trên VPS để tự động build và bật 3 Container (`MySQL`, `Backend`, `Frontend`):

```bash
docker compose up -d --build
```

> ⚡ **Kết quả mong đợi:**
> - MySQL 8.0 khởi chạy và tự động khởi tạo Database `affiliateshoppe`.
> - Node.js Backend đợi MySQL sẵn sàng (`service_healthy`) rồi tự động chạy Migrations/Seeds.
> - Frontend Nginx sẵn sàng đón nhận truy cập tại subdomain **`shoppe.khoahocdrivemh.pro.vn`**.

> 💡 **Mẹo xử lý nếu VPS thiếu RAM khi build (Lỗi exit code 1 / OOM):**
> Nếu VPS có RAM 1GB - 2GB, hãy tạo bộ nhớ ảo (Swap) trước khi build để tránh bị tràn RAM:
> ```bash
> sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
> echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
> ```

---

## 🔍 BƯỚC 5: Kiểm Tra Trạng Thái & Nhật Ký Server

### 5.1 Kiểm tra các container đang hoạt động:
```bash
docker compose ps
```

### 5.2 Xem log các service:
```bash
# Log tất cả các service
docker compose logs -f

# Log riêng Backend
docker compose logs -f backend

# Log riêng MySQL Database
docker compose logs -f db

# Log riêng Frontend Nginx
docker compose logs -f frontend
```

> 🛠️ **Nếu bị lỗi `container hoantien_mysql is unhealthy`:**
> 1. Xem nguyên nhân log MySQL: `docker compose logs db`
> 2. Nếu dữ liệu kho volume bị lỗi do lần khởi động đầu tiên ngắt đột ngột, hãy xóa volume và khởi chạy lại từ đầu:
>    ```bash
>    docker compose down -v
>    docker compose up -d --build
>    ```

---

## 🔒 BƯỚC 6: Cấu Hình Nginx Host & SSL HTTPS Cho Subdomain `shoppe.khoahocdrivemh.pro.vn`

Vì VPS đang chạy web khác trên cổng 80, Frontend Docker sẽ chạy tại cổng **8080** (`http://127.0.0.1:8080`).

### 6.1 Tạo file cấu hình Nginx Reverse Proxy trên VPS:
```bash
sudo nano /etc/nginx/sites-available/shoppeback
```
Dán nội dung sau vào:
```nginx
server {
    server_name shoppe.khoahocdrivemh.pro.vn;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;
    gzip_min_length 256;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Performance optimizations
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_buffers 8 16k;
        proxy_buffer_size 32k;
    }
}
```
Kích hoạt config và reload Nginx:
```bash
sudo ln -sf /etc/nginx/sites-available/shoppeback /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6.2 Cài đặt SSL HTTPS miễn phí với Certbot:
```bash
sudo certbot --nginx -d shoppe.khoahocdrivemh.pro.vn
```

---

## 🔄 BƯỚC 7: Cập Nhật Phiên Bản Mới Khi Đẩy Code Lên Git

Mỗi khi bạn đẩy code mới lên GitHub (`git push origin main`), chạy 3 lệnh sau trên VPS để cập nhật **không bị mất dữ liệu**:

```bash
cd /var/www/shoppeback
git pull origin main
docker compose up -d --build
```

---

## 🗄️ BƯỚC 8: Quản Lý Dữ Liệu MySQL

- **Sao lưu Database MySQL**:
  ```bash
  docker exec hoantien_mysql mysqldump -u root -proot_secure_password_123 affiliateshoppe > backup.sql
  ```
- **Khôi phục Database MySQL**:
  ```bash
  docker exec -i hoantien_mysql mysql -u root -proot_secure_password_123 affiliateshoppe < backup.sql
  ```

---

## 🔑 BƯỚC 9: Cấu Hình Đăng Nhập Bằng Google (Google OAuth Trực Tiếp - Không cần Supabase)

Hệ thống đã tích hợp trực tiếp **Google Identity Services** qua thư viện `@react-oauth/google` (Frontend) và `google-auth-library` (Backend NodeJS + MySQL):

### 1. Tạo Google OAuth Client ID (Mất ~2 phút)
1. Truy cập [Google Cloud Console](https://console.cloud.google.com/).
2. Tạo một Project mới (hoặc chọn project hiện có).
3. Vào **APIs & Services ➔ OAuth consent screen**:
   - Chọn **External** ➔ Bấm **Create**.
   - Điền **App name** (VD: *Hoàn Tiền Shopee*), chọn email hỗ trợ và điền email liên hệ của bạn.
   - Các bước tiếp theo (Scopes, Test Users) có thể bấm **Save and Continue** (mặc định lấy `email`, `profile`, `openid`).
4. Vào **APIs & Services ➔ Credentials**:
   - Bấm **Create Credentials ➔ OAuth client ID**.
   - Application type: Chọn **Web application**.
   - Name: *Web Client*.
   - Tại mục **Authorized JavaScript origins**, thêm:
     - `http://localhost:5173` (khi chạy máy tính cá nhân)
     - `https://domain-cua-ban.com` (khi đưa lên hosting/VPS)
   - Tại mục **Authorized redirect URIs**, thêm:
     - `http://localhost:5173`
     - `https://domain-cua-ban.com`
   - Bấm **Create**.
5. Bạn sẽ nhận được **Client ID** (chuỗi ký tự kết thúc bằng `.apps.googleusercontent.com`).

### 2. Cập nhật Biến Môi Trường (`.env`)
- **Frontend** (`Frontend/.env` hoặc `Frontend/.env.development`):
  ```env
  VITE_GOOGLE_CLIENT_ID=xxxxxx-xxxxxxxx.apps.googleusercontent.com
  ```
- **Backend** (`Backend/.env`):
  ```env
  GOOGLE_CLIENT_ID=xxxxxx-xxxxxxxx.apps.googleusercontent.com
  ```

### 3. Trải nghiệm
- Người dùng chỉ cần bấm nút **"Đăng nhập bằng Google"** trên Modal hoặc trang Đăng nhập / Đăng ký.
- Nếu email chưa từng có trong MySQL: Hệ thống **tự động tạo tài khoản mới** (mã `USR...`, ví tiền, mã giới thiệu, affiliate tracking sub ID) và đăng nhập ngay.
- Nếu email đã có: Hệ thống tự động đồng bộ avatar và đăng nhập cấp JWT Token bình thường.


