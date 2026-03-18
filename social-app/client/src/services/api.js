import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "/api";

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json', },
});

// ── Request interceptor: attach access token ──────────────────────────
api.interceptors.request.use((config) => {
  const access = localStorage.getItem("access_token");
  if (access) {
    config.headers.Authorization = `Bearer ${access}`;
  }
  return config;
});

// ── Response interceptor: auto-refresh on 401 ────────────────────────
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
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

    const refresh = localStorage.getItem("refresh_token");
    if (!refresh) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Queue concurrent requests while refreshing
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const { data } = await axios.post(`${API_URL}/auth/refresh/`, { refresh });
      const newAccess = data.access;
      localStorage.setItem("access_token", newAccess);
      if (data.refresh) {
        localStorage.setItem("refresh_token", data.refresh);
      }
      api.defaults.headers.common.Authorization = `Bearer ${newAccess}`;
      processQueue(null, newAccess);
      originalRequest.headers.Authorization = `Bearer ${newAccess}`;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      window.location.href = "/login";
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
  logout: (refresh) => api.post("/auth/logout/", { refresh }),
  getMe: () => api.get("/auth/me/"),
  updateMe: (data) => api.patch("/auth/me/", data),
};

// ── Profile API helpers ───────────────────────────────────────────────
export const profileAPI = {
  getProfile: (username) => api.get(`/users/${username}/`),
  // multipart/form-data for file uploads (avatar, cover_photo)
  updateProfile: (data) =>
    api.put("/users/me/", data, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  search: (q) => api.get(`/users/search/?q=${encodeURIComponent(q)}`),
  getSuggestions: () => api.get("/users/suggestions/"),
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
  list: (postId) => api.get(`/posts/${postId}/comments/`),
  create: (postId, data) => api.post(`/posts/${postId}/comments/`, data),
  delete: (commentId) => api.delete(`/comments/${commentId}/`),
};

// ── Feed API helpers ────────────────────────────────────────────────────
export const feedAPI = {
  getFeed: ({ cursor } = {}) =>
    api.get("/feed/", {
      params: cursor ? { cursor } : undefined,
    }),
  getStories: () => api.get("/feed/stories/"),
  getTrending: () => api.get("/posts/trending/"),
};

// ── Chat API helpers ────────────────────────────────────────────────────
export const chatAPI = {
  listConversations: () => api.get("/conversations/"),
  createConversation: (userId) =>
    api.post("/conversations/", { user_id: userId }),
  listMessages: (conversationId, params) =>
    api.get(`/conversations/${conversationId}/messages/`, { params }),
  markRead: (conversationId) =>
    api.post(`/conversations/${conversationId}/read/`),
};

export default api;
