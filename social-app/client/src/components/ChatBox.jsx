import { useEffect, useMemo, useRef, useState } from "react";
import { Smile, Loader2, Check, CheckCheck } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { useChat } from "../hooks/useChat";

function formatTimeShort(dateString) {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

const EMOJIS = ["😀", "😂", "😍", "👍", "🙏", "🎉", "😢", "😡"]; // basic picker

export default function ChatBox({ conversation }) {
  const { user } = useAuth();
  const conversationId = conversation?.id;

  const {
    messages,
    isConnected,
    isLoading,
    error,
    typingUsers,
    onlineUsers,
    sendMessage,
    sendTyping,
    markRead,
  } = useChat(conversationId);

  const [input, setInput] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const listRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastTypingSentRef = useRef(0);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length]);

  // Reset input when conversation changes
  useEffect(() => {
    setInput("");
    setShowEmoji(false);
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;
    markRead();
  }, [conversationId, markRead]);

  const groupedMessages = useMemo(() => {
    const groups = [];
    const list = messages || [];

    for (let i = 0; i < list.length; i += 1) {
      const msg = list[i];
      const prev = list[i - 1];
      const isMine = String(msg.sender?.id) === String(user?.id);
      const prevIsSameSender =
        prev && String(prev.sender?.id) === String(msg.sender?.id);
      const withinOneMinute =
        prev && Math.abs(new Date(msg.created_at) - new Date(prev.created_at)) <= 60 * 1000;

      const shouldGroup = prevIsSameSender && withinOneMinute;

      if (shouldGroup && groups.length > 0) {
        groups[groups.length - 1].messages.push(msg);
      } else {
        groups.push({ sender: msg.sender, isMine, messages: [msg] });
      }
    }

    return groups;
  }, [messages, user?.id]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || !conversationId) return;
    sendMessage(text, "text");
    setInput("");
    setShowEmoji(false);
    // stop typing
    sendTyping(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e) => {
    const value = e.target.value;
    setInput(value);

    const now = Date.now();
    if (now - lastTypingSentRef.current > 1000) {
      sendTyping(true);
      lastTypingSentRef.current = now;
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      sendTyping(false);
    }, 3000);
  };

  const handleEmojiClick = (emoji) => {
    setInput((prev) => prev + emoji);
  };

  const otherParticipants = (conversation?.participants || []).filter(
    (p) => String(p.id) !== String(user?.id)
  );
  const title = otherParticipants.map((p) => p.username).join(", ") || "Chat";
  const isOtherOnline = otherParticipants.some((p) =>
    onlineUsers?.has?.(String(p.id))
  );

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <div className="relative">
          <div className="w-9 h-9 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center text-xs font-semibold text-gray-600">
            {otherParticipants[0]?.avatar ? (
              <img
                src={otherParticipants[0].avatar}
                alt={title}
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{title[0]?.toUpperCase()}</span>
            )}
          </div>
          <span
            className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${
              isOtherOnline ? "bg-emerald-500" : "bg-gray-300"
            }`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{title}</p>
          <p className="text-[11px] text-gray-400">
            {!isConnected
              ? "Đang kết nối..."
              : isOtherOnline
                ? "Đang hoạt động"
                : "Offline"}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-gray-50">
        {isLoading && (
          <div className="flex justify-center py-6 text-gray-400 text-sm">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Đang tải lịch sử chat...
          </div>
        )}

        {error && !isLoading && (
          <div className="flex justify-center py-4 text-xs text-red-500">
            {error}
          </div>
        )}

        {!isLoading && !error && groupedMessages.length === 0 && (
          <div className="flex justify-center py-6 text-xs text-gray-400">
            Hãy gửi tin nhắn đầu tiên.
          </div>
        )}

        {!isLoading && !error &&
          groupedMessages.map((group, idx) => (
            <MessageGroup key={idx} group={group} />
          ))}

        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 text-[11px] text-gray-500 px-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              {typingUsers.map((u) => u.username).join(", ")} đang gõ...
            </span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 p-3">
        <div className="flex items-end gap-2">
          <div className="relative flex-1">
            <textarea
              value={input}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Nhập tin nhắn..."
              className="w-full max-h-32 text-sm rounded-2xl border border-gray-200 px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-y-auto"
            />
            <button
              type="button"
              onClick={() => setShowEmoji((v) => !v)}
              className="absolute right-2 bottom-1.5 text-gray-400 hover:text-gray-600"
            >
              <Smile className="w-4 h-4" />
            </button>

            {showEmoji && (
              <div className="absolute bottom-9 right-0 bg-white border border-gray-200 rounded-xl shadow-lg p-2 flex flex-wrap gap-1 w-44 z-10">
                {EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="text-xl hover:bg-gray-100 rounded"
                    onClick={() => handleEmojiClick(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || !conversationId}
            className="px-3 py-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Gửi
          </button>
        </div>
        <p className="mt-1 text-[10px] text-gray-400">
          Enter để gửi, Shift+Enter để xuống dòng
        </p>
      </div>
    </div>
  );
}

function MessageGroup({ group }) {
  const { user } = useAuth();
  const isMine = group.isMine;
  const align = isMine ? "justify-end" : "justify-start";
  const bubbleColor = isMine ? "bg-blue-600 text-white" : "bg-white text-gray-900";
  const timeColor = isMine ? "text-blue-100" : "text-gray-400";

  return (
    <div className={`flex ${align}`}>
      {!isMine && (
        <div className="mr-2 mt-auto w-7 h-7 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center text-[10px] font-semibold text-gray-600">
          {group.sender?.avatar ? (
            <img
              src={group.sender.avatar}
              alt={group.sender.username}
              className="w-full h-full object-cover"
            />
          ) : (
            <span>{group.sender?.username?.[0]?.toUpperCase()}</span>
          )}
        </div>
      )}
      <div className={`max-w-[70%] flex flex-col ${isMine ? "items-end" : "items-start"}`}>
        {group.messages.map((msg) => {
          const showRead = isMine && msg.is_read;
          return (
            <div key={msg.id} className="mb-0.5">
            <div className={`inline-block px-3 py-1.5 rounded-2xl text-sm ${bubbleColor}`}>
              {msg.content}
            </div>
            <div className={`flex items-center gap-1 text-[10px] mt-0.5 ${timeColor}`}>
              <span>{formatTimeShort(msg.created_at)}</span>
              {isMine && (
                <span className="inline-flex items-center">
                  {showRead ? (
                    <CheckCheck className="w-3 h-3" />
                  ) : (
                    <Check className="w-3 h-3" />
                  )}
                </span>
              )}
            </div>
          </div>
        );
        })}
      </div>
    </div>
  );
}
