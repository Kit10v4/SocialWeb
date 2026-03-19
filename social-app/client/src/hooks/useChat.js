import { useCallback, useEffect, useRef, useState } from "react";
import { chatAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";

/**
 * useChat
 * Manages WebSocket connection + REST history for a conversation.
 *
 * Props:
 *  - conversationId: string | null
 *
 * Returns: {
 *  messages,
 *  isConnected,
 *  isLoading,
 *  error,
 *  typingUsers, // array of { id, username }
 *  onlineUsers, // Set of userIds
 *  sendMessage(content: string),
 *  sendTyping(isTyping: boolean),
 *  markRead(): Promise<void>,
 * }
 */
export function useChat(conversationId) {
  const { user } = useAuth();

  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState(() => new Set());

  const socketRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);
  const lastTypingMapRef = useRef(new Map()); // userId -> timestamp

  // Clean typing users that have not updated in > 3s
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const map = lastTypingMapRef.current;
      let changed = false;
      for (const [userId, ts] of map.entries()) {
        if (now - ts > 3000) {
          map.delete(userId);
          changed = true;
        }
      }
      if (changed) {
        setTypingUsers(
          Array.from(map.values()).map((item) => ({ id: item.id, username: item.username }))
        );
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch initial history when conversation changes
  useEffect(() => {
    setOnlineUsers(new Set());
    if (!conversationId) {
      setMessages([]);
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);

    chatAPI
      .listMessages(conversationId, { page_size: 50 })
      .then(({ data }) => {
        if (!active) return;
        const results = Array.isArray(data) ? data : data.results ?? [];
        const sorted = [...results].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        setMessages(sorted);
      })
      .catch((err) => {
        if (!active) return;
        setError(err?.response?.data?.detail || "Không thể tải lịch sử chat.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [conversationId]);

  // WebSocket connection management
  useEffect(() => {
    if (!conversationId) {
      cleanupSocket();
      return;
    }

    let cancelled = false;

    const connect = () => {
      if (cancelled) return;

      const token = localStorage.getItem("access_token");
      if (!token) {
        setError("Missing access token.");
        return;
      }

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
      const url = new URL(`${base}/ws/chat/${conversationId}/`);
      url.searchParams.set("token", token);

      const ws = new WebSocket(url.toString());
      socketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        sendSocketEvent(ws, {
          type: "user_online",
          user: {
            id: user?.id,
            username: user?.username,
            avatar: user?.avatar,
          },
        });
      };

      ws.onclose = () => {
        setIsConnected(false);
        socketRef.current = null;

        if (cancelled) return;
        const attempts = (reconnectAttemptsRef.current || 0) + 1;
        reconnectAttemptsRef.current = attempts;
        const delay = Math.min(30000, 1000 * 2 ** attempts);
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        setError("Lỗi kết nối WebSocket.");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleSocketEvent(data);
        } catch {
          // ignore parse error
        }
      };
    };

    const handleSocketEvent = (data) => {
      const type = data.type;
      if (type === "chat_history") {
        const history = Array.isArray(data.messages) ? data.messages : [];
        setMessages((prev) => {
          const merged = [...prev];
          const existingIds = new Set(prev.map((m) => m.id));
          history.forEach((m) => {
            if (!existingIds.has(m.id)) merged.push(m);
          });
          return merged.sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        });
      } else if (type === "chat_message" && data.message) {
        const msg = data.message;
        setMessages((prev) =>
          [...prev, msg].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          )
        );
      } else if (type === "typing_indicator") {
        const u = data.user;
        const isTyping = !!data.is_typing;
        if (!u || !u.id || String(u.id) === String(user?.id)) return;

        const map = lastTypingMapRef.current;
        if (isTyping) {
          map.set(String(u.id), { id: String(u.id), username: u.username, ts: Date.now() });
        } else {
          map.delete(String(u.id));
        }
        setTypingUsers(
          Array.from(map.values()).map((item) => ({ id: item.id, username: item.username }))
        );
      } else if (type === "user_online" || type === "user_offline") {
        const u = data.user || {};
        const userId = data.user_id ?? u.id;
        if (!userId || String(userId) === String(user?.id)) return;
        updateOnlineUsers(String(userId), type === "user_online");
      } else if (type === "mark_read") {
        const readerId = data.user_id ?? data.user?.id;
        if (!readerId) return;
        setMessages((prev) =>
          prev.map((m) => {
            const senderId = m.sender?.id;
            if (!senderId) return m;
            const isMine = String(senderId) === String(user?.id);
            if (String(readerId) === String(user?.id)) {
              return isMine ? m : { ...m, is_read: true };
            }
            return isMine ? { ...m, is_read: true } : m;
          })
        );
      }
    };

    connect();

    return () => {
      cancelled = true;
      cleanupSocket();
    };
  }, [conversationId, user?.id]);

  const sendSocketEvent = useCallback((ws, payload) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(payload));
  }, []);

  const cleanupSocket = () => {
    clearTimeout(reconnectTimeoutRef.current);
    if (socketRef.current) {
      try {
        if (socketRef.current.readyState === WebSocket.OPEN) {
          sendSocketEvent(socketRef.current, {
            type: "user_offline",
            user: {
              id: user?.id,
              username: user?.username,
              avatar: user?.avatar,
            },
          });
        }
        socketRef.current.close();
      } catch {
        // ignore
      }
      socketRef.current = null;
    }
    setIsConnected(false);
  };

  const updateOnlineUsers = useCallback((userId, isOnline) => {
    setOnlineUsers((prev) => {
      const next = new Set(prev);
      if (isOnline) next.add(userId);
      else next.delete(userId);
      return next;
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("chat:online-status", {
          detail: { userId, online: isOnline },
        })
      );
    }
  }, []);

  const sendMessage = (content, messageType = "text") => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const payload = {
      type: "chat_message",
      content,
      message_type: messageType,
    };
    ws.send(JSON.stringify(payload));
  };

  const sendTyping = (isTyping) => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(
      JSON.stringify({
        type: "typing_indicator",
        is_typing: !!isTyping,
      })
    );
  };

  const markRead = useCallback(async () => {
    if (!conversationId) return;
    try {
      await chatAPI.markRead(conversationId);
      setMessages((prev) =>
        prev.map((m) => {
          const senderId = m.sender?.id;
          if (!senderId) return m;
          const isMine = String(senderId) === String(user?.id);
          return isMine ? m : { ...m, is_read: true };
        })
      );
      sendSocketEvent(socketRef.current, {
        type: "mark_read",
        user_id: user?.id,
      });
    } catch (err) {
      setError(err?.response?.data?.detail || "Không thể đánh dấu đã đọc.");
    }
  }, [conversationId, sendSocketEvent, user?.id]);

  return {
    messages,
    isConnected,
    isLoading,
    error,
    typingUsers,
    onlineUsers,
    sendMessage,
    sendTyping,
    markRead,
  };
}
