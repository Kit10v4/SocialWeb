# Connect 🌐

Mạng xã hội full-stack hiện đại xây dựng với **Django + React**, hỗ trợ chat real-time, news feed, thông báo tức thì và nhiều tính năng tương tự Facebook.

🔗 **Demo live:** [https://fbfake.vercel.app](https://fbfake.vercel.app)
🔧 **Backend API:** [https://social-app-api-p54k.onrender.com](https://social-app-api-p54k.onrender.com)

---

## ✨ Tính năng chính

| Tính năng             | Mô tả                                                             |
| --------------------- | ----------------------------------------------------------------- |
| 🔐 **Xác thực**       | Đăng ký / Đăng nhập bằng JWT, auto-refresh token                  |
| 👤 **Trang cá nhân**  | Cập nhật avatar, ảnh bìa, bio; xem bài viết & bạn bè              |
| 📝 **Bài đăng**       | Tạo bài với text + nhiều ảnh, Like, Comment (có reply), Bookmark  |
| 👥 **Kết bạn**        | Gửi / chấp nhận / từ chối lời mời; gợi ý kết bạn                  |
| 🗞️ **News Feed**      | Feed theo thời gian + thuật toán điểm tương tác, infinite scroll  |
| 💬 **Chat real-time** | Nhắn tin 1-1 qua WebSocket, typing indicator, trạng thái đã đọc   |
| 🔔 **Thông báo**      | Push notification real-time khi có like, comment, lời mời kết bạn |
| 🔍 **Tìm kiếm**       | Tìm người dùng theo username / email với debounce                 |

---

## 🛠️ Tech Stack

### Frontend

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-06B6D4?logo=tailwindcss&logoColor=white)
![React Query](https://img.shields.io/badge/React_Query-5-FF4154?logo=reactquery&logoColor=white)

- **React 18** + **Vite** — UI chính
- **TailwindCSS** — Styling, responsive mobile-first
- **TanStack React Query** — Data fetching, caching, optimistic updates
- **React Router v6** — Client-side routing
- **Axios** — HTTP client với auto token refresh
- **Socket.io client / WebSocket** — Real-time chat & notifications
- **Lucide React** — Icon library

### Backend

![Django](https://img.shields.io/badge/Django-4.2-092E20?logo=django&logoColor=white)
![DRF](https://img.shields.io/badge/Django_REST_Framework-3.16-ff1709?logo=django&logoColor=white)
![Channels](https://img.shields.io/badge/Django_Channels-4-09f?logoColor=white)

- **Django 4.2** + **Django REST Framework** — REST API
- **Django Channels** + **Daphne** — WebSocket / ASGI server
- **InMemoryChannelLayer** — Real-time messaging (không cần Redis)
- **Simple JWT** — JWT authentication với blacklist
- **django-cors-headers** — CORS handling

### Database & Storage

![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Cloudinary](https://img.shields.io/badge/Cloudinary-Media-3448C5?logo=cloudinary&logoColor=white)

- **PostgreSQL 16** — Database chính
- **Cloudinary** — Lưu trữ ảnh & media (CDN toàn cầu)

### DevOps & Deploy

![Vercel](https://img.shields.io/badge/Vercel-Frontend-000000?logo=vercel&logoColor=white)
![Render](https://img.shields.io/badge/Render-Backend-46E3B7?logo=render&logoColor=white)

- **Vercel** — Deploy frontend (auto deploy từ GitHub)
- **Render.com** — Deploy backend ASGI
- **GitHub** — Version control + CI/CD
- **WhiteNoise** — Serve static files
- **UptimeRobot** — Keep server alive (ping mỗi 10 phút)

---

## 🏗️ Kiến trúc hệ thống

```
Client (React/Vite)
    │
    ├── REST API (HTTPS) ──────────────► Django REST Framework
    │                                         │
    └── WebSocket (WSS) ───────────────► Django Channels
                                              │
                                    ┌─────────┴──────────┐
                                    │                    │
                               PostgreSQL           Cloudinary
                              (Render free)       (Media storage)
```

### Cấu trúc thư mục

```
social-app/
├── client/                  # React + Vite frontend
│   └── src/
│       ├── components/      # UI components (PostCard, ChatBox, ...)
│       ├── pages/           # Pages (Home, Profile, Messages, ...)
│       ├── hooks/           # Custom hooks (useChat, useProfile, ...)
│       ├── services/        # API calls (axios)
│       └── context/         # Auth context
│
└── server/                  # Django backend
    ├── apps/
    │   ├── users/           # Auth, Profile, Friendship
    │   ├── posts/           # Post, Like, Comment, SavedPost
    │   ├── feed/            # News Feed algorithm
    │   ├── chat/            # WebSocket consumers, Conversation
    │   └── notifications/   # Real-time notifications
    └── config/              # Settings, URLs, ASGI
```

---

## 🚀 Chạy local

### Yêu cầu

- Python 3.11+
- Node.js 18+
- PostgreSQL 16

### 1. Clone repository

```bash
git clone https://github.com/Kit10v4/SocialWeb.git
cd SocialWeb
```

### 2. Cài đặt Backend

```bash
cd social-app/server

# Tạo virtual environment
python -m venv venv
source venv/bin/activate        # Mac/Linux
# hoặc: venv\Scripts\activate   # Windows

# Cài dependencies
pip install -r requirements.txt

# Tạo file .env từ example
cp .env.example .env
# Sửa .env: điền DB_PASSWORD, CLOUDINARY keys
```

Tạo database PostgreSQL:

```bash
psql -U postgres
CREATE DATABASE social_app_db;
\q
```

Chạy migrations và khởi động server:

```bash
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

### 3. Cài đặt Frontend

```bash
cd social-app/client

# Cài dependencies
npm install

# Tạo file .env
cp .env.example .env.local
# VITE_API_URL=http://localhost:8000/api
# VITE_WS_URL=ws://localhost:8000

# Chạy dev server
npm run dev
```

Mở trình duyệt: [http://localhost:5173](http://localhost:5173)

---

## 🔑 Biến môi trường

### Server (`social-app/server/.env`)

```env
SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# PostgreSQL
DB_NAME=social_app_db
DB_USER=postgres
DB_PASSWORD=your-password
DB_HOST=localhost
DB_PORT=5432

# Cloudinary (đăng ký miễn phí tại cloudinary.com)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# CORS
FRONTEND_URL=http://localhost:5173

# Redis (optional - dùng cho production)
REDIS_URL=redis://...

# reCAPTCHA (optional)
RECAPTCHA_SECRET_KEY=your-secret-key
RECAPTCHA_ENABLED=False  # True trên production
```

### Client (`social-app/client/.env.local`)

```env
VITE_API_URL=http://localhost:8000/api
VITE_WS_URL=ws://localhost:8000
VITE_RECAPTCHA_SITE_KEY=your-recaptcha-site-key
```

---

## 🌐 Deploy Production

### Vercel (Frontend)

1. Import repository vào Vercel
2. **QUAN TRỌNG:** Đặt biến môi trường trong Vercel Dashboard:
   ```
   VITE_API_URL=https://social-app-api-p54k.onrender.com/api
   VITE_WS_URL=wss://social-app-api-p54k.onrender.com
   VITE_RECAPTCHA_SITE_KEY=your-production-recaptcha-key
   ```
3. Build command: `npm run build`
4. Output directory: `dist`

### Render (Backend)

1. Tạo PostgreSQL database trên Render
2. Tạo Web Service với `render.yml` configuration
3. Đặt biến môi trường:
   - `SECRET_KEY`: tự động generate
   - `DATABASE_URL`: từ PostgreSQL service
   - `CORS_ALLOWED_ORIGINS`: `https://your-frontend-domain.vercel.app`
   - `REDIS_URL`: (optional) nếu dùng Redis
   - `RECAPTCHA_SECRET_KEY`: key từ Google reCAPTCHA
   - `JWT_COOKIE_SAMESITE`: `None` (cross-site)
   - `JWT_COOKIE_SECURE`: `True`

### Troubleshooting

**Lỗi 500 Internal Server Error khi login:**

- Kiểm tra cache backend được cấu hình (REDIS_URL hoặc fallback LocMemCache)
- Kiểm tra health endpoint: `/health/` phải trả về `{"database": "ok", "cache": "ok"}`

**Lỗi 401 khi gọi API:**

- Kiểm tra `CORS_ALLOWED_ORIGINS` có chứa frontend domain
- Kiểm tra cookies được gửi đúng (`withCredentials: true` trong axios)
- Với cross-site (Vercel → Render): cần `JWT_COOKIE_SAMESITE=None` và `JWT_COOKIE_SECURE=True`

---

## 📡 API Endpoints

### Authentication

| Method | Endpoint              | Mô tả                       |
| ------ | --------------------- | --------------------------- |
| POST   | `/api/auth/register/` | Đăng ký tài khoản           |
| POST   | `/api/auth/login/`    | Đăng nhập, nhận JWT         |
| POST   | `/api/auth/refresh/`  | Làm mới access token        |
| POST   | `/api/auth/logout/`   | Đăng xuất, blacklist token  |
| GET    | `/api/auth/me/`       | Lấy thông tin user hiện tại |

### Posts

| Method         | Endpoint                   | Mô tả                |
| -------------- | -------------------------- | -------------------- |
| GET/POST       | `/api/posts/`              | Danh sách / Tạo bài  |
| GET/PUT/DELETE | `/api/posts/:id/`          | Chi tiết / Sửa / Xoá |
| POST           | `/api/posts/:id/like/`     | Toggle like          |
| GET/POST       | `/api/posts/:id/comments/` | Comments             |

### Feed & Social

| Method | Endpoint                    | Mô tả                         |
| ------ | --------------------------- | ----------------------------- |
| GET    | `/api/feed/`                | News feed (cursor pagination) |
| GET    | `/api/users/:username/`     | Profile người dùng            |
| POST   | `/api/friends/request/:id/` | Gửi lời mời kết bạn           |
| GET    | `/api/conversations/`       | Danh sách chat                |

### WebSocket

| URL                                        | Mô tả               |
| ------------------------------------------ | ------------------- |
| `wss://domain/ws/chat/:id/?token=JWT`      | Chat real-time      |
| `wss://domain/ws/notifications/?token=JWT` | Thông báo real-time |

---

## 🗄️ Database Schema

Các model chính:

```
User ──────────────── Post ──── Like
  │                    │
  ├── Friendship        └── Comment ── Comment (reply)
  │                    │
  ├── Conversation ──── Message
  │
  └── Notification
```

**User** — Custom user model với UUID, avatar Cloudinary  
**Post** — Bài viết với nhiều ảnh (PostImage), privacy levels  
**Friendship** — Quan hệ bạn bè: pending / accepted / blocked  
**Conversation + Message** — Chat 1-1  
**Notification** — Thông báo: like / comment / friend_request / friend_accept

---

## ⚙️ Tính năng kỹ thuật nổi bật

### Real-time với Django Channels

Chat và thông báo dùng `AsyncJsonWebsocketConsumer`. Authentication qua JWT trong query string (`?token=...`). Không cần Redis — dùng `InMemoryChannelLayer` phù hợp cho single-instance deployment.

### News Feed Algorithm

Feed không chỉ sắp xếp theo thời gian mà còn tính điểm tương tác:

```python
score = like_count * 2 + comment_count * 3 + recency_bonus
# recency_bonus: +50 (1h), +30 (6h), +10 (24h), +5 (3 ngày)
```

### JWT Auto-refresh

Axios interceptor tự động refresh access token khi nhận 401, queue các request đang chờ và retry sau khi có token mới — người dùng không bị đăng xuất đột ngột.

### Optimistic Updates

Like bài viết cập nhật UI ngay lập tức, rollback nếu API lỗi — dùng React Query `onMutate` / `onError`.

---

## 📱 Screenshots

> _(Thêm ảnh chụp màn hình của app vào đây)_

| Home Feed                     | Profile                             | Chat                          |
| ----------------------------- | ----------------------------------- | ----------------------------- |
| ![feed](screenshots/feed.png) | ![profile](screenshots/profile.png) | ![chat](screenshots/chat.png) |

---

## 📄 License

MIT License — xem file [LICENSE](LICENSE) để biết thêm chi tiết.

---

## 🙏 Acknowledgements

- [Django REST Framework](https://www.django-rest-framework.org/)
- [Django Channels](https://channels.readthedocs.io/)
- [TanStack Query](https://tanstack.com/query)
- [Cloudinary](https://cloudinary.com/)
- [Render.com](https://render.com/) & [Vercel](https://vercel.com/)
