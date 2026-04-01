import { useEffect, useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";
import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { vi } from "date-fns/locale";

import { useAuth } from "../context/AuthContext";

function formatTime(dateString) {
  if (!dateString) return "";
  try {
    const d = parseISO(dateString);
    return formatDistanceToNowStrict(d, { addSuffix: true, locale: vi });
  } catch {
    return "";
  }
}

export default function ConversationList({
  conversations,
  activeId,
  onSelect,
  onNewChat,
  search,
  onSearchChange,
  loading,
  error,
}) {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState(() => new Set());

  useEffect(() => {
    const handler = (event) => {
      const { userId, online } = event.detail || {};
      if (!userId) return;
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (online) next.add(String(userId));
        else next.delete(String(userId));
        return next;
      });
    };

    window.addEventListener("chat:online-status", handler);
    return () => window.removeEventListener("chat:online-status", handler);
  }, []);

  const filtered = useMemo(() => {
    const list = conversations || [];
    if (!search?.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter((c) => {
      const others = (c.participants || []).filter((p) => p.id !== user?.id);
      const name = others.map((p) => p.username).join(", ");
      return name.toLowerCase().includes(q);
    });
  }, [conversations, search, user?.id]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="p-3 border-b border-gray-100 dark:border-gray-700 space-y-2">
        {onNewChat && (
          <button
            type="button"
            onClick={onNewChat}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition"
          >
            <MessageCircle className="w-4 h-4" />
            Tin nhắn mới
          </button>
        )}
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Tìm kiếm cuộc trò chuyện..."
          className="w-full text-sm px-3 py-2 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="p-3 space-y-2 animate-pulse">
            <div className="h-12 bg-gray-100 dark:bg-gray-700 rounded-xl" />
            <div className="h-12 bg-gray-100 dark:bg-gray-700 rounded-xl" />
            <div className="h-12 bg-gray-100 dark:bg-gray-700 rounded-xl" />
          </div>
        )}

        {error && !loading && (
          <div className="p-3 text-xs text-red-500 dark:text-red-400">Không thể tải danh sách chat.</div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="p-4 text-center text-xs text-gray-400 dark:text-gray-500">
            Chưa có tin nhắn. Bắt đầu cuộc trò chuyện mới!
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {filtered.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                active={conv.id === activeId}
                onlineUsers={onlineUsers}
                onClick={() => onSelect(conv)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ConversationItem({ conversation, active, onlineUsers, onClick }) {
  const { user } = useAuth();
  const others = (conversation.participants || []).filter((p) => p.id !== user?.id);
  const name = others.map((p) => p.username).join(", ") || user?.username || "";
  const last = conversation.last_message;
  const preview = last?.content || (last ? "[Tệp đính kèm]" : "Bắt đầu cuộc trò chuyện");
  const time = formatTime(last?.created_at || conversation.updated_at);
  const isOnline = others.some((p) => onlineUsers?.has?.(String(p.id)));

  // Very naive unread badge: 1 if last message is unread and from other user
  const unreadCount =
    active || !last || last.is_read || last.sender?.id === user?.id ? 0 : 1;

  return (
    <li
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
        active ? "bg-blue-50 dark:bg-blue-900/30" : "hover:bg-gray-50 dark:hover:bg-gray-700"
      }`}
    >
      <div className="relative">
        <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex items-center justify-center text-xs font-semibold text-gray-600 dark:text-gray-300">
          {others[0]?.avatar ? (
            <img
              src={others[0].avatar}
              alt={name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span>{name[0]?.toUpperCase()}</span>
          )}
        </div>
        <span
          className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-gray-800 ${
            isOnline ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"
          }`}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{name}</p>
          <span className="text-[11px] text-gray-400 dark:text-gray-500 flex-shrink-0">{time}</span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[160px]">{preview}</p>
          {unreadCount > 0 && (
            <span className="flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-semibold">
              {unreadCount}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}
