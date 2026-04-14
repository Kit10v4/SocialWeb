import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "/api";

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json', },
  withCredentials: true,
});

// ── Response interceptor: auto-refresh on 401 ────────────────────────
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve();
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Queue concurrent requests while refreshing
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then(() => api(originalRequest))
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      await axios.post(
        `${API_URL}/auth/refresh/`,
        {},
        { withCredentials: true }
      );
      processQueue(null);
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError);
      // Tránh vòng lặp reload vô hạn khi đang ở trang /login.
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

// ── Auth API helpers ──────────────────────────────────────────────────
export const authAPI = {
  register: (data) => api.post("/auth/register/", data),
  login: (data) => api.post("/auth/login/", data),
  logout: () => api.post("/auth/logout/", {}),
  forgotPassword: (data) => api.post("/auth/forgot-password/", data),
  resetPassword: (data) => api.post("/auth/reset-password/", data),
  verifyEmail: (token) => api.get(`/auth/verify-email/?token=${token}`),
  resendVerification: (data) => api.post("/auth/resend-verification/", data),
  getMe: () => api.get("/auth/me/"),
  updateMe: (data) => api.patch("/auth/me/", data),
  changePassword: (data) => api.post("/auth/change-password/", data),
  changeEmail: (data) => api.post("/auth/change-email/", data),
  deleteAccount: (data) => api.delete("/auth/delete-account/", { data }),
};

// ── Profile API helpers ───────────────────────────────────────────────
export const profileAPI = {
  getProfile: (username) => api.get(`/users/${username}/`),
  // multipart/form-data for file uploads (avatar, cover_photo)
  updateProfile: (data) =>
    api.put("/users/me/", data, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  search: (q, options = {}) =>
    api.get(`/users/search/?q=${encodeURIComponent(q)}`, options),
  getSuggestions: () => api.get("/users/suggestions/"),
  getUserPosts: (username, { cursor } = {}) =>
    api.get(`/users/${username}/posts/`, {
      params: cursor ? { cursor } : undefined,
    }),
};

// ── Friends API helpers ───────────────────────────────────────────────
export const friendsAPI = {
  list: () => api.get("/friends/"),
  requests: () => api.get("/friends/requests/"),
  sendRequest: (userId) => api.post(`/friends/request/${userId}/`),
  accept: (userId) => api.post(`/friends/accept/${userId}/`),
  reject: (userId) => api.post(`/friends/reject/${userId}/`),
  unfriend: (userId) => api.delete(`/friends/${userId}/`),
};

// ── Posts API helpers ─────────────────────────────────────────────────
export const postAPI = {
  list: (params) => api.get("/posts/", { params }),
  search: (q, params, options = {}) =>
    api.get("/posts/search/", { params: { q, ...params }, ...options }),
  create: (data) =>
    api.post("/posts/", data, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  get: (id) => api.get(`/posts/${id}/`),
  update: (id, data) => api.patch(`/posts/${id}/`, data),
  delete: (id) => api.delete(`/posts/${id}/`),
  toggleLike: (id) => api.post(`/posts/${id}/like/`),
  toggleSave: (id) => api.post(`/posts/${id}/save/`),
  getSaved: () => api.get("/posts/saved/"),
};

// ── Comments API helpers ──────────────────────────────────────────────
export const commentAPI = {
  list: (postId, params) => api.get(`/posts/${postId}/comments/`, { params }),
  create: (postId, data) => api.post(`/posts/${postId}/comments/`, data),
  delete: (commentId) => api.delete(`/comments/${commentId}/`),
};

// ── Feed API helpers ────────────────────────────────────────────────────
export const feedAPI = {
  getFeed: ({ cursor } = {}) =>
    api.get("/feed/", {
      params: cursor ? { cursor } : undefined,
    }),
  getActiveFriends: () => api.get("/feed/active-friends/"),
  getTrending: () => api.get("/posts/trending/"),
};

// ── Chat API helpers ────────────────────────────────────────────────────
export const chatAPI = {
  listConversations: () => api.get("/conversations/"),
  getUnreadCount: () => api.get("/conversations/unread-count/"),
  createConversation: (userId) =>
    api.post("/conversations/", { user_id: userId }),
  listMessages: (conversationId, params) =>
    api.get(`/conversations/${conversationId}/messages/`, { params }),
  markRead: (conversationId) =>
    api.post(`/conversations/${conversationId}/read/`),
};

export const reportAPI = {
  create: (data) => api.post("/reports/", data),
};

// ── Admin API helpers ──────────────────────────────────────────────────
export const adminAPI = {
  // Dashboard stats
  getStats: () => api.get("/admin/stats/"),
  
  // Users management
  listUsers: (params) => api.get("/admin/users/", { params }),
  getUser: (id) => api.get(`/admin/users/${id}/`),
  updateUser: (id, data) => api.patch(`/admin/users/${id}/`, data),
  userAction: (id, action) => api.post(`/admin/users/${id}/${action}/`),
  
  // Reports management
  listReports: () => api.get("/admin/reports/"),
  reportAction: (id, action) => api.post(`/admin/reports/${id}/${action}/`),
  
  // Audit logs
  listAuditLogs: () => api.get("/admin/audit-logs/"),
};

export default api;
