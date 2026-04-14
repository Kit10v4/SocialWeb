import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Home, MessageCircle, Users, LogOut, Bell, Settings, Shield } from "lucide-react";
import NotificationBell from "../components/shared/NotificationBell";
import BottomNav from "../components/shared/BottomNav";

import { useAuth } from "../context/AuthContext";
import { feedAPI, postAPI, profileAPI } from "../services/api";
import PostCard from "../components/PostCard";
import CreatePostModal from "../components/CreatePostModal";
import StoriesBar from "../components/StoriesBar";
import SkeletonCard from "../components/shared/SkeletonCard";
import { useToast } from "../components/shared/Toast";
import { useUnreadCount } from "../hooks/useUnreadCount";

export default function HomePage() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const { pathname } = location;
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { unreadCount } = useUnreadCount();

  const pageTitle = useMemo(() => {
    if (pathname === "/") return "";
    if (pathname.startsWith("/search")) return "Tìm kiếm";
    if (pathname.startsWith("/messages")) return "Tin nhắn";
    if (pathname.startsWith("/profile")) return "Trang cá nhân";
    if (pathname.startsWith("/post")) return "Chi tiết bài viết";
    return "Social App";
  }, [pathname]);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [composerText, setComposerText] = useState("");
  const [pendingImages, setPendingImages] = useState([]);
  const [newPostsCount, setNewPostsCount] = useState(0);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const loadMoreRef = useRef(null);
  const photoInputRef = useRef(null);
  const touchStartYRef = useRef(0);
  const lastNotifiedLatestIdRef = useRef(null);

  // ── Infinite feed query ───────────────────────────────────────────────
  // API returns posts with structure:
  // {
  //   id, author: { id, username, avatar }, content, images: [{ id, image, order }],
  //   privacy, like_count, comment_count, is_liked, is_saved, created_at
  // }
  const {
    data,
    isLoading,
    isError,
    error,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["feed"],
    queryFn: async ({ pageParam }) => {
      const res = await feedAPI.getFeed({ cursor: pageParam });
      return res.data;
    },
    getNextPageParam: (lastPage) => lastPage?.next_cursor ?? undefined,
  });

  const posts = useMemo(
    () => data?.pages?.flatMap((page) => page.results ?? []) ?? [],
    [data]
  );
  const latestPostId = posts[0]?.id;

  // ── IntersectionObserver for infinite scroll ─────────────────────────
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return;

    const node = loadMoreRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchNextPage();
        }
      },
      { rootMargin: "0px 0px 400px 0px" }
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    if (!latestPostId) return;
    const interval = setInterval(async () => {
      try {
        const res = await feedAPI.getFeed({});
        const latest = res.data?.results?.[0];
        if (!latest || posts.length === 0) return;
        if (
          latest.id !== latestPostId &&
          lastNotifiedLatestIdRef.current !== latest.id
        ) {
          setNewPostsCount((prev) => prev + 1);
          lastNotifiedLatestIdRef.current = latest.id;
        }
      } catch {
        // ignore polling errors
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [latestPostId, posts.length]);

  const refreshFeed = async () => {
    await queryClient.invalidateQueries({ queryKey: ["feed"] });
    setNewPostsCount(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleTouchStart = (e) => {
    touchStartYRef.current = e.touches[0]?.clientY ?? 0;
  };

  const handleTouchEnd = async (e) => {
    const endY = e.changedTouches[0]?.clientY ?? 0;
    const diff = endY - touchStartYRef.current;
    if (diff > 80 && window.scrollY === 0 && !isPullRefreshing) {
      setIsPullRefreshing(true);
      await queryClient.invalidateQueries({ queryKey: ["feed"] });
      setNewPostsCount(0);
      setTimeout(() => setIsPullRefreshing(false), 500);
    }
  };

  // ── Optimistic like mutation using React Query ───────────────────────
  const likeMutation = useMutation({
    mutationFn: (postId) => postAPI.toggleLike(postId),
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: ["feed"] });
      const previous = queryClient.getQueryData(["feed"]);

      queryClient.setQueryData(["feed"], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            results: page.results?.map((post) => {
              if (post.id !== postId) return post;
              const nextLiked = !post.is_liked;
              const nextCount = (post.like_count || 0) + (nextLiked ? 1 : -1);
              return { ...post, is_liked: nextLiked, like_count: nextCount };
            }),
          })),
        };
      });

      return { previous };
    },
    onError: (_err, _postId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["feed"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
  });

  const handleLike = async (postId) => {
    return likeMutation.mutateAsync(postId);
  };

  // ── Bookmark mutation ───────────────────────────────────────────────
  const bookmarkMutation = useMutation({
    mutationFn: (postId) => postAPI.toggleSave(postId),
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: ["feed"] });
      const previous = queryClient.getQueryData(["feed"]);

      queryClient.setQueryData(["feed"], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            results: page.results?.map((post) => {
              if (post.id !== postId) return post;
              return { ...post, is_saved: !post.is_saved };
            }),
          })),
        };
      });

      return { previous };
    },
    onError: (_err, _postId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["feed"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
  });

  const handleBookmark = async (postId) => {
    return bookmarkMutation.mutateAsync(postId);
  };

  const removePostFromFeed = (postId) => {
    queryClient.setQueryData(["feed"], (old) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          results: (page.results || []).filter((post) => post.id !== postId),
        })),
      };
    });
  };

  const closeCreateModal = () => {
    setIsCreateOpen(false);
    setPendingImages([]);
  };

  const handlePhotoChipClick = () => {
    photoInputRef.current?.click();
  };

  const handlePhotoFilesChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setPendingImages(files);
    setIsCreateOpen(true);
    e.target.value = "";
  };

  // ── Create post handler ──────────────────────────────────────────────
  const handleCreatePost = async ({ content, images, privacy }) => {
    const formData = new FormData();
    if (content) formData.append("content", content);
    if (privacy) formData.append("privacy", privacy.toLowerCase());
    images.forEach((file) => formData.append("images", file));

    setIsCreating(true);

    try {
      await postAPI.create(formData);
      closeCreateModal();
      setComposerText("");
      await queryClient.invalidateQueries({ queryKey: ["feed"] });

      // Scroll to top to show new post
      window.scrollTo({ top: 0, behavior: "smooth" });

      // Show success toast
      showToast("success", "Đã đăng bài viết");
    } finally {
      setIsCreating(false);
    }
    // Note: errors are caught and displayed by CreatePostModal internally
  };

  // ── Right column: suggestions + trending ─────────────────────────────
  const {
    data: suggestions,
    isLoading: suggestionsLoading,
    isError: suggestionsError,
  } = useQuery({
    queryKey: ["suggestions"],
    queryFn: async () => {
      const res = await profileAPI.getSuggestions();
      return Array.isArray(res.data) ? res.data : res.data.results ?? [];
    },
  });

  const {
    data: trending,
    isLoading: trendingLoading,
    isError: trendingError,
  } = useQuery({
    queryKey: ["trending-posts"],
    queryFn: async () => {
      const res = await feedAPI.getTrending();
      return Array.isArray(res.data) ? res.data : res.data.results ?? [];
    },
  });

  const atEnd = !hasNextPage && posts.length > 0;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 pb-20 md:pb-0">
      {/* Navbar */}
      <nav className="bg-white dark:bg-gray-900 shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 h-12 sm:h-14 flex items-center justify-between">
          <span className="text-lg sm:text-xl font-bold text-blue-600 min-w-[60px]">
            {pathname === "/" ? (
              <>
                <span className="sm:hidden">SA</span>
                <span className="hidden sm:inline">Social App</span>
              </>
            ) : (
              <span className="sm:hidden">SA</span>
            )}
          </span>
          {pathname !== "/" && (
            <span className="sm:hidden absolute left-1/2 -translate-x-1/2 text-sm font-semibold text-gray-800 dark:text-gray-100">
              {pageTitle}
            </span>
          )}
          <div className="flex items-center gap-3">
            <NotificationBell />
            <Link to="/messages" className="relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
              <MessageCircle className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
            <Link
              to={`/profile/${user?.username}`}
              className="flex items-center gap-2 hover:opacity-80 cursor-pointer"
            >
              <img
                src={user?.avatar || "https://i.pravatar.cc/100?img=67"}
                alt={user?.username || "user"}
                loading="lazy"
                className="w-8 h-8 rounded-full object-cover"
              />
              <span className="hidden sm:inline text-sm font-medium text-gray-700 dark:text-gray-300">
                {user?.username}
              </span>
            </Link>
            {user?.is_staff && (
              <Link
                to="/admin"
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                title="Admin Panel"
              >
                <span className="text-lg">🛠️</span>
              </Link>
            )}
            <Link
              to="/settings"
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              title="Cài đặt"
            >
              <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </Link>
            <button
              onClick={async () => {
                await logout();
                showToast("info", "Đã đăng xuất");
              }}
              className="flex items-center gap-1 text-sm text-red-500 hover:text-red-600 font-medium"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Đăng xuất</span>
            </button>
          </div>
        </div>
      </nav>

      {/* 3-column responsive layout */}
      <main className="max-w-6xl mx-auto px-0 sm:px-4 lg:px-6 py-4 flex flex-col md:flex-row md:items-start gap-4">
        {/* Left column – user card + nav (hidden on mobile) */}
        <aside className="hidden md:block md:w-1/3 lg:w-1/4 md:sticky md:top-14">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex items-center justify-center">
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.username}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                    {user?.username?.[0]?.toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {user?.username}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">Chào mừng trở lại</p>
              </div>
            </div>
          </div>

          <nav className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 py-2">
            <SidebarItem
              icon={Home}
              label="Home"
              to="/"
              active={pathname === "/"}
            />
            <SidebarItem
              icon={Users}
              label="Friends"
              to="/search"
              active={pathname === "/search" || pathname.startsWith("/search")}
            />
            <SidebarItem
              icon={MessageCircle}
              label="Messages"
              to="/messages"
              active={pathname.startsWith("/messages")}
            />
            <SidebarItem icon={Bell} label="Notifications" disabled />
            <SidebarItem
              icon={Settings}
              label="Cài đặt"
              to="/settings"
              active={pathname === "/settings"}
            />
            {user?.is_staff && (
              <SidebarItem
                icon={Shield}
                label="Admin"
                to="/admin"
                active={pathname === "/admin"}
              />
            )}
          </nav>
        </aside>

        {/* Middle column – stories + composer + feed */}
         <section
           className="w-full md:flex-1 lg:w-1/2 md:max-w-2xl md:mx-auto md:max-h-[calc(100vh-56px-2rem)] md:overflow-y-auto scrollbar-thin"
           onTouchStart={handleTouchStart}
           onTouchEnd={handleTouchEnd}
         >
           <StoriesBar />

          {/* Create post card */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-2 sm:p-4 mb-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex items-center justify-center">
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.username}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-[11px] sm:text-xs font-semibold text-gray-600 dark:text-gray-400">
                    {user?.username?.[0]?.toUpperCase()}
                  </span>
                )}
              </div>
              <input
                type="text"
                value={composerText}
                onChange={(e) => setComposerText(e.target.value)}
                placeholder="Bạn đang nghĩ gì?"
                className="flex-1 text-left text-xs sm:text-sm text-gray-700 dark:text-gray-300 placeholder:text-gray-500 dark:placeholder:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-full px-2 sm:px-3 py-1.5 sm:py-2 outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition"
              />
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                disabled={!composerText.trim() && pendingImages.length === 0}
                className="px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Đăng
              </button>
            </div>

            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handlePhotoFilesChange}
            />

            <div className="flex items-center gap-2 mt-3 overflow-x-auto">
              <button
                type="button"
                onClick={handlePhotoChipClick}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer whitespace-nowrap"
              >
                <span>📷</span>
                <span>Ảnh</span>
              </button>
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer whitespace-nowrap"
              >
                <span>😊</span>
                <span>Cảm xúc</span>
              </button>
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer whitespace-nowrap"
              >
                <span>📍</span>
                <span>Check-in</span>
              </button>
            </div>
          </div>

          {/* Feed list */}
          {isPullRefreshing && (
            <div className="flex items-center justify-center gap-2 text-xs text-blue-600 mb-3">
              <span className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              Đang làm mới...
            </div>
          )}

          {newPostsCount > 0 && (
            <button
              type="button"
              onClick={refreshFeed}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 rounded-xl mb-3 font-medium"
            >
              Có {newPostsCount} bài viết mới — Nhấn để xem
            </button>
          )}

          {isLoading && (
            <div className="space-y-3">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          )}

          {isError && !isLoading && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-red-100 dark:border-red-900 text-red-600 dark:text-red-400 text-sm p-4 mb-3">
              <p className="font-medium mb-1">Không thể tải news feed.</p>
              <p className="text-xs mb-2">{error?.message || "Vui lòng thử lại sau."}</p>
              <button
                type="button"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["feed"] })}
                className="text-xs font-semibold text-blue-600 hover:underline"
              >
                Thử lại
              </button>
            </div>
          )}

          {!isLoading && !isError && posts.length === 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-700 text-center text-sm text-gray-400 dark:text-gray-500 p-6 space-y-3">
              <p>Kết bạn để xem bài viết của bạn bè</p>
              <Link
                to="/search"
                className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
              >
                Tìm bạn bè
              </Link>
            </div>
          )}

          <div className="space-y-3 mt-2">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onLike={handleLike}
                onBookmark={handleBookmark}
                onDelete={removePostFromFeed}
              />
            ))}
          </div>

          {/* Infinite scroll sentinel & loading more */}
          <div ref={loadMoreRef} className="h-8" />

          {hasNextPage && !isFetchingNextPage && (
            <button
              type="button"
              onClick={() => fetchNextPage()}
              className="w-full py-2 text-sm text-blue-600 dark:text-blue-400 font-medium border border-blue-200 dark:border-blue-800 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/30"
            >
              Tải thêm bài viết
            </button>
          )}

          {isFetchingNextPage && (
            <div className="mt-2 space-y-3">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          )}

          {atEnd && (
            <p className="mt-4 text-center text-xs text-gray-400 dark:text-gray-500">
              Đã xem hết bài viết.
            </p>
          )}
        </section>

        {/* Right column – suggestions + trending (desktop only) */}
        <aside className="hidden lg:block lg:w-1/4 lg:sticky lg:top-14 space-y-4">
          {/* Friend suggestions */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-3">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">
              Gợi ý kết bạn
            </p>
            {suggestionsLoading && (
              <div className="space-y-2 animate-pulse">
                <div className="h-6 bg-gray-100 dark:bg-gray-800 rounded" />
                <div className="h-6 bg-gray-100 dark:bg-gray-800 rounded" />
                <div className="h-6 bg-gray-100 dark:bg-gray-800 rounded" />
              </div>
            )}
            {suggestionsError && !suggestionsLoading && (
              <p className="text-xs text-red-500">
                Không thể tải gợi ý kết bạn.
              </p>
            )}
            {!suggestionsLoading && !suggestionsError && (
              <ul className="space-y-2">
                {(suggestions || []).slice(0, 5).map((f) => (
                  <li key={f.id} className="flex items-center gap-2 text-xs">
                    <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex items-center justify-center">
                      {f.avatar ? (
                        <img
                          src={f.avatar}
                          alt={f.username}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-400">
                          {f.username?.[0]?.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 dark:text-gray-100 truncate">
                        {f.username}
                      </p>
                    </div>
                    <Link
                      to={`/profile/${f.username}`}
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Xem
                    </Link>
                  </li>
                ))}
                {(suggestions || []).length === 0 && (
                  <li className="text-xs text-gray-400 dark:text-gray-500">Không có gợi ý.</li>
                )}
              </ul>
            )}
          </div>

          {/* Trending posts */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-3">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">
              Bài viết nổi bật
            </p>
            {trendingLoading && (
              <div className="space-y-2 animate-pulse">
                <div className="h-6 bg-gray-100 dark:bg-gray-800 rounded" />
                <div className="h-6 bg-gray-100 dark:bg-gray-800 rounded" />
                <div className="h-6 bg-gray-100 dark:bg-gray-800 rounded" />
              </div>
            )}
            {trendingError && !trendingLoading && (
              <p className="text-xs text-red-500">
                Không thể tải bài viết nổi bật.
              </p>
            )}
            {!trendingLoading && !trendingError && (
              <ul className="space-y-2 text-xs">
                {(trending || []).slice(0, 5).map((p) => (
                  <li key={p.id} className="flex flex-col">
                    <p className="font-medium text-gray-800 dark:text-gray-100 truncate">
                      {p.author?.username}
                    </p>
                    {p.content && (
                      <p className="text-gray-500 dark:text-gray-400 truncate max-w-[220px]">
                        {p.content}
                      </p>
                    )}
                    <p className="text-[11px] text-gray-400 dark:text-gray-500">
                      {p.like_count ?? 0} lượt thích · {p.comment_count ?? 0} bình luận
                    </p>
                  </li>
                ))}
                {(trending || []).length === 0 && (
                  <li className="text-xs text-gray-400 dark:text-gray-500">Chưa có dữ liệu.</li>
                )}
              </ul>
            )}
          </div>
        </aside>
      </main>

      <BottomNav />

      {/* Create Post Modal */}
      {isCreateOpen && (
        <CreatePostModal
          isOpen={isCreateOpen}
          onClose={closeCreateModal}
          onSubmit={handleCreatePost}
          isSubmitting={isCreating}
          initialImages={pendingImages}
        />
      )}

    </div>
  );
}

function SidebarItem({ icon: Icon, label, to, active, disabled }) {
  const { pathname } = useLocation();
  const resolvedActive =
    typeof active === "boolean"
      ? active
      : to === "/"
        ? pathname === "/"
        : pathname.startsWith(to);

  const content = (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer transition-colors ${
        resolvedActive
          ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold"
          : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </div>
  );

  if (disabled || !to) return content;
  return (
    <Link to={to} className="block">
      {content}
    </Link>
  );
}

