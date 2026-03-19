import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Heart,
  MessageCircle,
  MessageSquare,
  UserPlus,
  UserCheck,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

// Simple REST helpers for notifications (client-side only)
const notificationsAPI = {
  list: () => api.get("/notifications/", { params: { page_size: 10 } }),
  markAllRead: () => api.post("/notifications/read/"),
  markOneRead: (id) => api.post(`/notifications/${id}/read/`),
  getUnreadCount: () => api.get("/notifications/unread-count/"),
};

function formatMessage(n) {
  switch (n.notification_type) {
    case "like":
      return n.text || `${n.sender?.username} đã thích bài viết của bạn`;
    case "comment":
      return n.text || `${n.sender?.username} đã bình luận về bài viết của bạn`;
    case "friend_request":
      return n.text || `${n.sender?.username} đã gửi lời mời kết bạn`;
    case "friend_accept":
      return n.text || `${n.sender?.username} đã chấp nhận lời mời kết bạn`;
    case "message":
      return n.text || `${n.sender?.username} đã gửi cho bạn một tin nhắn`;
    default:
      return n.text || "Thông báo mới";
  }
}

const UNREAD_KEY = "notifications_unread_count";

function getNotificationLink(n) {
  const type = n.notification_type;
  if (type === "like" || type === "comment") {
    return n.target_id ? `/?post=${n.target_id}` : "/";
  }
  if (type === "friend_request" || type === "friend_accept") {
    return n.sender?.username ? `/profile/${n.sender.username}` : "/search";
  }
  if (type === "message") return "/messages";
  return "/";
}

function getTypeIcon(n) {
  switch (n.notification_type) {
    case "like":
      return { Icon: Heart, className: "text-red-500 bg-red-50" };
    case "comment":
      return { Icon: MessageCircle, className: "text-blue-500 bg-blue-50" };
    case "friend_request":
      return { Icon: UserPlus, className: "text-purple-500 bg-purple-50" };
    case "friend_accept":
      return { Icon: UserCheck, className: "text-emerald-500 bg-emerald-50" };
    case "message":
      return { Icon: MessageSquare, className: "text-orange-500 bg-orange-50" };
    default:
      return { Icon: Bell, className: "text-gray-500 bg-gray-100" };
  }
}

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(() => {
    const saved = localStorage.getItem(UNREAD_KEY);
    const parsed = Number(saved);
    return Number.isFinite(parsed) ? parsed : 0;
  });
  const socketRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);
  const dropdownRef = useRef(null);

  const { data: notifications } = useQuery({
    queryKey: ["notifications", "latest"],
    queryFn: async () => {
      const res = await notificationsAPI.list();
      const results = Array.isArray(res.data) ? res.data : res.data.results ?? [];
      return results;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      localStorage.removeItem(UNREAD_KEY);
      setOpen(false);
      return;
    }
    localStorage.setItem(UNREAD_KEY, String(unreadCount));
  }, [unreadCount, user]);

  // Initial unread count
  useEffect(() => {
    if (!user) return;
    let active = true;
    notificationsAPI
      .getUnreadCount()
      .then((res) => {
        if (!active) return;
        setUnreadCount(res.data?.count ?? 0);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user]);

  // WebSocket connection for notifications
  useEffect(() => {
    if (!user) return;

    const token = localStorage.getItem("access_token");
    if (!token) return;

    let cancelled = false;

    const connect = () => {
      if (cancelled || !user) return;

      const access = localStorage.getItem("access_token");
      if (!access) return;

      // Use VITE_WS_URL for production, fallback to current host for dev
      const wsBase = import.meta.env.VITE_WS_URL;
      let base;
      if (wsBase) {
        base = wsBase;
      } else {
        const loc = window.location;
        const protocol = loc.protocol === "https:" ? "wss" : "ws";
        base = `${protocol}://${loc.host}`;
      }
      const url = new URL(`${base}/ws/notifications/`);
      url.searchParams.set("token", access);

      const ws = new WebSocket(url.toString());
      socketRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "unread_count") {
            setUnreadCount(data.count ?? 0);
          } else if (data.type === "notification" && data.notification) {
            // Prepend new notification to cache
            queryClient.setQueryData(["notifications", "latest"], (old) => {
              const prev = Array.isArray(old) ? old : [];
              const merged = [data.notification, ...prev];
              return merged.slice(0, 10);
            });
            setUnreadCount((c) => c + 1);
          } else if (data.type === "list" && Array.isArray(data.notifications)) {
            queryClient.setQueryData(["notifications", "latest"], data.notifications);
          }
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        socketRef.current = null;
        if (cancelled || !user) return;
        const attempts = (reconnectAttemptsRef.current || 0) + 1;
        reconnectAttemptsRef.current = attempts;
        const delay = Math.min(30000, 1000 * 2 ** attempts);
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      cancelled = true;
      clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) {
        try {
          socketRef.current.close();
        } catch {}
      }
      socketRef.current = null;
    };
  }, [user, queryClient]);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  const handleToggle = () => {
    setOpen((v) => !v);
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsAPI.markAllRead();
      setUnreadCount(0);
      queryClient.invalidateQueries({ queryKey: ["notifications", "latest"] });
    } catch {}
  };

  const handleMarkOneRead = async (id, isRead) => {
    if (isRead) return;
    try {
      await notificationsAPI.markOneRead(id);
      setUnreadCount((c) => Math.max(0, c - 1));
      queryClient.invalidateQueries({ queryKey: ["notifications", "latest"] });
    } catch {}
  };

  const handleNotificationClick = async (n) => {
    await handleMarkOneRead(n.id, n.is_read);
    setOpen(false);
    navigate(getNotificationLink(n));
  };

  const list = notifications || [];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={handleToggle}
        className="relative flex items-center justify-center w-9 h-9 rounded-full hover:bg-gray-100 text-gray-600"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <div
        className={`absolute right-0 mt-2 w-80 max-w-[90vw] bg-white rounded-2xl shadow-xl border border-gray-100 z-40 overflow-hidden transition-all duration-200 ${
          open ? "max-h-[520px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-900">Thông báo</p>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-[11px] text-blue-600 hover:underline"
            >
              Đánh dấu đã đọc hết
            </button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
          {list.length === 0 && (
            <div className="px-4 py-6 text-xs text-gray-400 text-center">
              Chưa có thông báo.
            </div>
          )}

          {list.map((n) => {
            const { Icon, className } = getTypeIcon(n);
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => handleNotificationClick(n)}
                className={`w-full text-left px-4 py-3 text-xs flex gap-2 hover:bg-gray-50 ${
                  n.is_read ? "bg-white" : "bg-blue-50/60"
                }`}
              >
                <div className="relative w-8 h-8 flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center text-[11px] font-semibold text-gray-600">
                    {n.sender?.avatar ? (
                      <img
                        src={n.sender.avatar}
                        alt={n.sender.username}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{n.sender?.username?.[0]?.toUpperCase()}</span>
                    )}
                  </div>
                  <span
                    className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center ${className}`}
                  >
                    <Icon className="w-3 h-3" />
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-800 truncate mb-0.5">{formatMessage(n)}</p>
                  <p className="text-[10px] text-gray-400">
                    {new Date(n.created_at).toLocaleString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </p>
                </div>
                {!n.is_read && (
                  <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-2" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
