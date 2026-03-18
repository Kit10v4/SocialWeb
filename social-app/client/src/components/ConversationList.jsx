import { useMemo } from "react";
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
  search,
  onSearchChange,
  loading,
  error,
}) {
  const { user } = useAuth();

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
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-3 border-b border-gray-100">
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Tìm kiếm cuộc trò chuyện..."
          className="w-full text-sm px-3 py-2 rounded-full bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="p-3 space-y-2 animate-pulse">
            <div className="h-12 bg-gray-100 rounded-xl" />
            <div className="h-12 bg-gray-100 rounded-xl" />
            <div className="h-12 bg-gray-100 rounded-xl" />
          </div>
        )}

        {error && !loading && (
          <div className="p-3 text-xs text-red-500">Không thể tải danh sách chat.</div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="p-4 text-center text-xs text-gray-400">
            Không có cuộc trò chuyện nào.
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <ul className="divide-y divide-gray-100">
            {filtered.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                active={conv.id === activeId}
                onClick={() => onSelect(conv)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ConversationItem({ conversation, active, onClick }) {
  const { user } = useAuth();
  const others = (conversation.participants || []).filter((p) => p.id !== user?.id);
  const name = others.map((p) => p.username).join(", ") || user?.username || "";
  const last = conversation.last_message;
  const preview = last?.content || (last ? "[Tệp đính kèm]" : "Bắt đầu cuộc trò chuyện");
  const time = formatTime(last?.created_at || conversation.updated_at);

  // Very naive unread badge: 1 if last message is unread and from other user
  const unreadCount = last && !last.is_read && last.sender?.id !== user?.id ? 1 : 0;

  return (
    <li
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
        active ? "bg-blue-50" : "hover:bg-gray-50"
      }`}
    >
      <div className="relative">
        <div className="w-9 h-9 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center text-xs font-semibold text-gray-600">
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
        {/* Online indicator placeholder (always green for demo) */}
        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
          <span className="text-[11px] text-gray-400 flex-shrink-0">{time}</span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="text-xs text-gray-500 truncate max-w-[160px]">{preview}</p>
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
