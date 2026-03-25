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
const GROUP_WINDOW_MS = 10 * 60 * 1000;

function getNotificationLink(n) {
  const type = n.notification_type;
  if (type === "like" || type === "comment") {
    return n.target_id ? `/post/${n.target_id}` : "/";
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

export function groupNotifications(notifications) {
  return buildNotificationGroupBundles(notifications).map((bundle) => bundle.group);
}

function getGroupedActionText(notificationType) {
  switch (notificationType) {
    case "like":
      return "đã thích bài viết của bạn";
    case "comment":
      return "đã bình luận về bài viết của bạn";
    case "friend_request":
      return "đã gửi lời mời kết bạn";
    case "friend_accept":
      return "đã chấp nhận lời mời kết bạn";
    case "message":
      return "đã gửi cho bạn một tin nhắn";
    default:
      return "đã tương tác với bạn";
  }
}

function formatGroupMessage(group, firstItem) {
  if (!firstItem) return "Thông báo mới";
  if (group.actors.length <= 1) return formatMessage(firstItem);

  const actor1 = group.actors[0]?.username || "Ai đó";
  const actor2 = group.actors[1]?.username || "Ai đó";
  const actionText = getGroupedActionText(group.notification_type);

  if (group.count === 2) {
    return `${actor1} và ${actor2} ${actionText}`;
  }
  return `${actor1}, ${actor2} và ${group.count - 2} người khác ${actionText}`;
}

function buildNotificationGroupBundles(notifications) {
  const list = Array.isArray(notifications) ? notifications : [];
  const byKey = new Map();

  list.forEach((n) => {
    const key = `${n.notification_type}::${String(n.target_id)}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(n);
  });

  const bundles = [];

  byKey.forEach((items) => {
    const sorted = [...items].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    let currentChunk = [];

    sorted.forEach((item) => {
      if (currentChunk.length === 0) {
        currentChunk = [item];
        return;
      }
      const anchorTime = new Date(currentChunk[0].created_at).getTime();
      const itemTime = new Date(item.created_at).getTime();
      if (Math.abs(anchorTime - itemTime) <= GROUP_WINDOW_MS) {
        currentChunk.push(item);
      } else {
        bundles.push(createBundleFromChunk(currentChunk));
        currentChunk = [item];
      }
    });

    if (currentChunk.length > 0) {
      bundles.push(createBundleFromChunk(currentChunk));
    }
  });

  return bundles.sort(
    (a, b) => new Date(b.group.latest_at).getTime() - new Date(a.group.latest_at).getTime()
  );
}

function createBundleFromChunk(chunk) {
  const first = chunk[0];
  const actors = [];
  const actorIds = new Set();

  chunk.forEach((item) => {
    const sender = item.sender;
    const senderId = sender?.id;
    if (!sender || senderId == null || actorIds.has(senderId) || actors.length >= 3) return;
    actorIds.add(senderId);
    actors.push(sender);
  });

  return {
    group: {
      id: first.id,
      notification_type: first.notification_type,
      target_id: first.target_id,
      actors,
      count: chunk.length,
      latest_at: first.created_at,
      is_read: chunk.every((item) => !!item.is_read),
      text: first.text || "",
    },
    first,
    items: chunk,
  };
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

  const handleNotificationClick = async (group) => {
    const groupItems = groupItemsById.get(group.id) || [];
    const unreadItems = groupItems.filter((item) => !item.is_read);

    if (unreadItems.length > 0) {
      try {
        await Promise.all(unreadItems.map((item) => notificationsAPI.markOneRead(item.id)));
        setUnreadCount((c) => Math.max(0, c - unreadItems.length));
        queryClient.invalidateQueries({ queryKey: ["notifications", "latest"] });
      } catch {}
    }

    const firstNotification = groupItems[0] || firstNotificationByGroupId.get(group.id);
    if (!firstNotification) return;
    setOpen(false);
    navigate(getNotificationLink(firstNotification));
  };

  const list = notifications || [];
  const bundles = buildNotificationGroupBundles(list);
  const groupedList = groupNotifications(list);
  const firstNotificationByGroupId = new Map(bundles.map((bundle) => [bundle.group.id, bundle.first]));
  const groupItemsById = new Map(bundles.map((bundle) => [bundle.group.id, bundle.items]));

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
          {groupedList.length === 0 && (
            <div className="px-4 py-6 text-xs text-gray-400 text-center">
              Chưa có thông báo.
            </div>
          )}

          {groupedList.map((group) => {
            const firstNotification = firstNotificationByGroupId.get(group.id);
            if (!firstNotification) return null;
            const { Icon, className } = getTypeIcon(firstNotification);
            const actors = group.actors || [];
            const hasMultipleActors = actors.length >= 2;
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => handleNotificationClick(group)}
                className={`w-full text-left px-4 py-3 text-xs flex gap-2 hover:bg-gray-50 ${
                  group.is_read ? "bg-white" : "bg-blue-50/60"
                }`}
              >
                <div className="relative w-10 h-8 flex-shrink-0">
                  <div className="flex items-center">
                    {!hasMultipleActors && (
                      <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center text-[11px] font-semibold text-gray-600">
                        {actors[0]?.avatar ? (
                          <img
                            src={actors[0].avatar}
                            alt={actors[0].username}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>{actors[0]?.username?.[0]?.toUpperCase()}</span>
                        )}
                      </div>
                    )}
                    {hasMultipleActors && (
                      <>
                        <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center text-[11px] font-semibold text-gray-600 border border-white">
                          {actors[0]?.avatar ? (
                            <img
                              src={actors[0].avatar}
                              alt={actors[0].username}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span>{actors[0]?.username?.[0]?.toUpperCase()}</span>
                          )}
                        </div>
                        <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center text-[11px] font-semibold text-gray-600 border border-white ml-[-8px]">
                          {actors[1]?.avatar ? (
                            <img
                              src={actors[1].avatar}
                              alt={actors[1].username}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span>{actors[1]?.username?.[0]?.toUpperCase()}</span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  <span
                    className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center ${className}`}
                  >
                    <Icon className="w-3 h-3" />
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-800 truncate mb-0.5">
                    {formatGroupMessage(group, firstNotification)}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {new Date(group.latest_at).toLocaleString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </p>
                </div>
                {!group.is_read && (
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
