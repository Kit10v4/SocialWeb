import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, UserPlus, Clock, UserCheck, Loader2, X } from "lucide-react";
import { profileAPI, friendsAPI, postAPI } from "../services/api";
import PostCard from "../components/PostCard";
import BottomNav from "../components/shared/BottomNav";
import { useToast } from "../components/shared/Toast";
import PageHeader from "../components/shared/PageHeader";

const TABS = {
  USERS: "users",
  POSTS: "posts",
};

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightText(text, query) {
  if (!text || !query?.trim()) return text;
  const escaped = escapeRegExp(query.trim());
  const regex = new RegExp(`(${escaped})`, "ig");
  const parts = String(text).split(regex);
  const needle = query.trim().toLowerCase();
  return parts.map((part, idx) =>
    part.toLowerCase() === needle ? (
      <mark key={idx} className="bg-yellow-200/70 px-0.5 rounded">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

// ── SearchPage ─────────────────────────────────────────────────────────────
export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [activeTab, setActiveTab] = useState(TABS.USERS);
  const [userResults, setUserResults] = useState([]);
  const [postResults, setPostResults] = useState([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [isSearchingPosts, setIsSearchingPosts] = useState(false);
  const [searchedUsers, setSearchedUsers] = useState(false);
  const [searchedPosts, setSearchedPosts] = useState(false);
  // Map of userId → friendship action state: "none" | "sending" | "sent"
  const [requestStates, setRequestStates] = useState({});
  const inputRef = useRef(null);
  const { showToast } = useToast();

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const q = searchParams.get("q") || "";
    setQuery(q);
  }, [searchParams]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed) {
      setSearchParams({ q: trimmed }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }, [query, setSearchParams]);

  // Debounced search — fires 300 ms after the user stops typing
  useEffect(() => {
    if (activeTab !== TABS.USERS) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setUserResults([]);
      setSearchedUsers(false);
      setIsSearchingUsers(false);
      return;
    }

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setIsSearchingUsers(true);
      setSearchedUsers(true);
      try {
        const { data } = await profileAPI.search(trimmed, {
          signal: controller.signal,
        });
        setUserResults(Array.isArray(data) ? data : data.results ?? []);
      } catch (err) {
        if (err.name !== "CanceledError" && err.code !== "ERR_CANCELED") {
          setUserResults([]);
        }
      } finally {
        setIsSearchingUsers(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, activeTab]);

  useEffect(() => {
    if (activeTab !== TABS.POSTS) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setPostResults([]);
      setSearchedPosts(false);
      setIsSearchingPosts(false);
      return;
    }

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setIsSearchingPosts(true);
      setSearchedPosts(true);
      try {
        const { data } = await postAPI.search(trimmed, undefined, {
          signal: controller.signal,
        });
        const list = Array.isArray(data) ? data : data.results ?? [];
        setPostResults(list);
      } catch (err) {
        if (err.name !== "CanceledError" && err.code !== "ERR_CANCELED") {
          setPostResults([]);
        }
      } finally {
        setIsSearchingPosts(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, activeTab]);

  // ── Friend request from search result ──────────────────────────────────
  const handleAddFriend = async (userId) => {
    setRequestStates((s) => ({ ...s, [userId]: "sending" }));
    try {
      await friendsAPI.sendRequest(userId);
      setRequestStates((s) => ({ ...s, [userId]: "sent" }));
      showToast("success", "Đã gửi lời mời kết bạn");
    } catch {
      setRequestStates((s) => ({ ...s, [userId]: "none" }));
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────
  const highlightedPosts = useMemo(
    () =>
      postResults.map((post) => ({
        ...post,
        rawContent: post.content,
        content: highlightText(post.content, query),
      })),
    [postResults, query]
  );

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 pb-20 md:pb-0">
      <PageHeader title="Tìm kiếm" />
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-10">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500 pointer-events-none" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="text"
            placeholder="Tìm kiếm theo tên hoặc nội dung bài viết..."
            className="w-full pl-12 pr-10 py-3.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-2xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center rounded-full text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 transition"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab(TABS.USERS)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
              activeTab === TABS.USERS
                ? "bg-blue-600 text-white"
                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
            }`}
          >
            Mọi người
          </button>
          <button
            type="button"
            onClick={() => setActiveTab(TABS.POSTS)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
              activeTab === TABS.POSTS
                ? "bg-blue-600 text-white"
                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
            }`}
          >
            Bài viết
          </button>
        </div>

        {/* Results area */}
        <div className="mt-4">
          {activeTab === TABS.USERS && (
            <>
              {isSearchingUsers && (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
                </div>
              )}

              {!isSearchingUsers && !searchedUsers && (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
                  <Search className="h-12 w-12 mb-3 opacity-30" />
                  <p className="font-medium">Nhập ít nhất 2 ký tự để tìm kiếm</p>
                </div>
              )}

              {!isSearchingUsers && searchedUsers && userResults.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
                  <div className="mb-3 h-14 w-14 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                    <Search className="h-7 w-7 text-blue-600 dark:text-blue-300" />
                  </div>
                  <p className="font-medium">Không tìm thấy kết quả cho "{query}"</p>
                </div>
              )}

              {!isSearchingUsers && userResults.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-gray-400 dark:text-gray-500 font-medium mb-1 px-1">
                    {userResults.length} kết quả
                  </p>
                  {userResults.map((user) => (
                    <UserResultCard
                      key={user.id}
                      user={user}
                      requestState={requestStates[user.id] ?? "none"}
                      onAddFriend={() => handleAddFriend(user.id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === TABS.POSTS && (
            <>
              {isSearchingPosts && (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
                </div>
              )}

              {!isSearchingPosts && !searchedPosts && (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
                  <Search className="h-12 w-12 mb-3 opacity-30" />
                  <p className="font-medium">Nhập ít nhất 2 ký tự để tìm bài viết</p>
                </div>
              )}

              {!isSearchingPosts && searchedPosts && postResults.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
                  <div className="mb-3 h-14 w-14 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                    <Search className="h-7 w-7 text-blue-600 dark:text-blue-300" />
                  </div>
                  <p className="font-medium">Không tìm thấy kết quả cho "{query}"</p>
                </div>
              )}

              {!isSearchingPosts && postResults.length > 0 && (
                <div className="space-y-4">
                  {highlightedPosts.map((post) => (
                    <PostCard key={post.id} post={post} compact />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}

// ── UserResultCard ─────────────────────────────────────────────────────────
function UserResultCard({ user, requestState, onAddFriend }) {
  return (
    <div className="flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl px-4 py-3 shadow-sm hover:shadow-md transition-shadow">
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
          className="font-semibold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-sm truncate block"
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
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs font-semibold cursor-default select-none">
        <UserCheck className="h-3.5 w-3.5" />
        Đã gửi
      </div>
    );
  }

  if (state === "sending") {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-400 dark:text-blue-300 text-xs font-semibold cursor-default select-none">
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
