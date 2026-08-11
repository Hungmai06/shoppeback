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

## 🔒 BƯỚC 6: Cài Đặt SSL HTTPS Cho Subdomain `shoppe.khoahocdrivemh.pro.vn`

Trỏ bản ghi DNS **A Record** của subdomain **`shoppe.khoahocdrivemh.pro.vn`** về IP VPS của bạn.

### Cài đặt Certbot & Đăng ký SSL Miễn Phí:
```bash
sudo apt install -y certbot python3-certbot-nginx
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
