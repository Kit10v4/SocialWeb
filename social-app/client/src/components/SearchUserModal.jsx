import { useEffect, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { chatAPI, profileAPI } from "../services/api";

export default function SearchUserModal({ isOpen, onClose, onConversationCreated }) {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [creatingId, setCreatingId] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    setResults([]);
    setIsSearching(false);
    setSearched(false);
    setError("");
    setCreatingId(null);
    const timer = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearched(false);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      setSearched(true);
      try {
        const { data } = await profileAPI.search(trimmed);
        const list = Array.isArray(data) ? data : data.results ?? [];
        const filtered = list.filter((u) => String(u.id) !== String(user?.id));
        setResults(filtered);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, isOpen, user?.id]);

  const handleSelect = async (target) => {
    if (!target?.id || creatingId) return;
    setCreatingId(target.id);
    setError("");
    try {
      const { data } = await chatAPI.createConversation(target.id);
      onConversationCreated?.(data);
      onClose?.();
    } catch (err) {
      setError(err?.response?.data?.detail || "Không thể tạo cuộc trò chuyện.");
    } finally {
      setCreatingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Tin nhắn mới</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
          >
            <span className="sr-only">Đóng</span>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm kiếm người dùng..."
              className="w-full pl-9 pr-9 py-2.5 bg-gray-100 dark:bg-gray-700 rounded-full text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center rounded-full text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {error && (
            <p className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 rounded-md px-2 py-1.5">
              {error}
            </p>
          )}

          <div className="max-h-72 overflow-y-auto">
            {isSearching && (
              <div className="flex justify-center py-6 text-gray-400 dark:text-gray-500 text-sm">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Đang tìm kiếm...
              </div>
            )}

            {!isSearching && !searched && (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-gray-500 text-sm">
                <Search className="h-8 w-8 mb-2 opacity-30" />
                Nhập tên để bắt đầu tìm kiếm
              </div>
            )}

            {!isSearching && searched && results.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-gray-500 text-sm">
                <Search className="h-8 w-8 mb-2 opacity-30" />
                Không tìm thấy kết quả cho "{query}"
              </div>
            )}

            {!isSearching && results.length > 0 && (
              <div className="space-y-2">
                {results.map((u) => {
                  const isCreating = creatingId === u.id;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleSelect(u)}
                      disabled={!!creatingId}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-60"
                    >
                      <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex items-center justify-center text-sm font-semibold text-gray-600 dark:text-gray-300">
                        {u.avatar ? (
                          <img
                            src={u.avatar}
                            alt={u.username}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>{u.username?.[0]?.toUpperCase()}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {u.username}
                        </p>
                      </div>
                      {isCreating ? (
                        <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
                      ) : (
                        <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">Nhắn tin</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
