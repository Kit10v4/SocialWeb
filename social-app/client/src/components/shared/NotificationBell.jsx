import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../../context/AuthContext";
import { chatAPI, feedAPI } from "../../services/api";
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

export default function NotificationBell() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const socketRef = useRef(null);

  const { data: notifications } = useQuery({
    queryKey: ["notifications", "latest"],
    queryFn: async () => {
      const res = await notificationsAPI.list();
      const results = Array.isArray(res.data) ? res.data : res.data.results ?? [];
      return results;
    },
  });

  // Initial unread count
  useEffect(() => {
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
  }, []);

  // WebSocket connection for notifications
  useEffect(() => {
    if (!user) return;

    const token = localStorage.getItem("access_token");
    if (!token) return;

    const loc = window.location;
    const protocol = loc.protocol === "https:" ? "wss" : "ws";
    const base = `${protocol}://${loc.host}`;
    const url = new URL(`${base}/ws/notifications/`);
    url.searchParams.set("token", token);

    const ws = new WebSocket(url.toString());
    socketRef.current = ws;

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
        }
      } catch {
        // ignore
      }
    };

    ws.onclose = () => {
      socketRef.current = null;
    };

    return () => {
      if (socketRef.current) {
        try {
          socketRef.current.close();
        } catch {}
      }
    };
  }, [user, queryClient]);

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

  const list = notifications || [];

  return (
    <div className="relative">
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

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white rounded-2xl shadow-xl border border-gray-100 z-40">
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

            {list.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => handleMarkOneRead(n.id, n.is_read)}
                className={`w-full text-left px-4 py-3 text-xs flex gap-2 hover:bg-gray-50 ${
                  n.is_read ? "bg-white" : "bg-blue-50/60"
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center text-[11px] font-semibold text-gray-600 flex-shrink-0">
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
                <div className="flex-1 min-w-0">
                  <p className="text-gray-800 truncate mb-0.5">
                    {formatMessage(n)}
                  </p>
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
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
