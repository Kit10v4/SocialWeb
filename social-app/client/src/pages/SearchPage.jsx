import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Search, UserPlus, Clock, UserCheck, Loader2, X } from "lucide-react";
import { profileAPI, friendsAPI } from "../services/api";

// ── SearchPage ─────────────────────────────────────────────────────────────
export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searched, setSearched] = useState(false); // has the user searched at all?
  // Map of userId → friendship action state: "none" | "sending" | "sent"
  const [requestStates, setRequestStates] = useState({});
  const inputRef = useRef(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced search — fires 300 ms after the user stops typing
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      setSearched(true);
      try {
        const { data } = await profileAPI.search(trimmed);
        setResults(Array.isArray(data) ? data : data.results ?? []);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // ── Friend request from search result ──────────────────────────────────
  const handleAddFriend = async (userId) => {
    setRequestStates((s) => ({ ...s, [userId]: "sending" }));
    try {
      await friendsAPI.sendRequest(userId);
      setRequestStates((s) => ({ ...s, [userId]: "sent" }));
    } catch {
      setRequestStates((s) => ({ ...s, [userId]: "none" }));
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-10">

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="text"
            placeholder="Tìm kiếm theo tên hoặc email..."
            className="w-full pl-12 pr-10 py-3.5 bg-white border border-gray-200 rounded-2xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Results area */}
        <div className="mt-4">
          {/* Loading spinner */}
          {isSearching && (
            <div className="flex justify-center py-10">
              <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
            </div>
          )}

          {/* Prompt when query too short */}
          {!isSearching && !searched && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Search className="h-12 w-12 mb-3 opacity-30" />
              <p className="font-medium">Nhập ít nhất 2 ký tự để tìm kiếm</p>
            </div>
          )}

          {/* No results */}
          {!isSearching && searched && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Search className="h-12 w-12 mb-3 opacity-30" />
              <p className="font-medium">Không tìm thấy kết quả cho "{query}"</p>
            </div>
          )}

          {/* Result list */}
          {!isSearching && results.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-gray-400 font-medium mb-1 px-1">
                {results.length} kết quả
              </p>
              {results.map((user) => (
                <UserResultCard
                  key={user.id}
                  user={user}
                  requestState={requestStates[user.id] ?? "none"}
                  onAddFriend={() => handleAddFriend(user.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── UserResultCard ─────────────────────────────────────────────────────────
function UserResultCard({ user, requestState, onAddFriend }) {
  return (
    <div className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm hover:shadow-md transition-shadow">
      {/* Avatar */}
      <Link to={`/profile/${user.username}`} className="flex-shrink-0">
        <div className="h-12 w-12 rounded-full overflow-hidden bg-gradient-to-br from-blue-400 to-indigo-500 shadow-sm">
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.username}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white font-bold text-lg select-none">
              {user.username[0].toUpperCase()}
            </div>
          )}
        </div>
      </Link>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <Link
          to={`/profile/${user.username}`}
          className="font-semibold text-gray-900 hover:text-blue-600 transition-colors text-sm truncate block"
        >
          {user.username}
        </Link>
      </div>

      {/* Add friend button */}
      <AddFriendButton state={requestState} onClick={onAddFriend} />
    </div>
  );
}

function AddFriendButton({ state, onClick }) {
  if (state === "sent") {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 text-gray-500 text-xs font-semibold cursor-default select-none">
        <UserCheck className="h-3.5 w-3.5" />
        Đã gửi
      </div>
    );
  }

  if (state === "sending") {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-400 text-xs font-semibold cursor-default select-none">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Đang gửi...
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition shadow-sm"
    >
      <UserPlus className="h-3.5 w-3.5" />
      Kết bạn
    </button>
  );
}
