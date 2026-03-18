import { useState, useEffect, useCallback, useRef } from "react";
import { PenSquare, Loader2, AlertCircle, ImageIcon } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { postAPI } from "../services/api";
import PostCard, { PostCardSkeleton } from "../components/post/PostCard";
import CreatePostModal from "../components/post/CreatePostModal";

/** Compact "create post" trigger button at the top of the feed */
function CreatePostTrigger({ user, onClick }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm px-4 py-3 flex items-center gap-3">
      <div className="h-10 w-10 rounded-full overflow-hidden bg-gradient-to-br from-blue-400 to-indigo-500 flex-shrink-0">
        {user?.avatar ? (
          <img src={user.avatar} alt={user.username} className="w-full h-full object-cover" />
        ) : (
          <span className="w-full h-full flex items-center justify-center text-white font-bold">
            {user?.username?.[0]?.toUpperCase()}
          </span>
        )}
      </div>
      <button
        onClick={onClick}
        className="flex-1 text-left px-4 py-2.5 rounded-full bg-gray-100 text-sm text-gray-400 hover:bg-gray-200 transition"
      >
        Bạn đang nghĩ gì, {user?.username}?
      </button>
      <button
        onClick={onClick}
        className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-blue-600 transition px-3 py-2 rounded-xl hover:bg-gray-100"
      >
        <ImageIcon className="h-5 w-5" />
        Ảnh
      </button>
    </div>
  );
}

export default function HomePage() {
  const { user, logout } = useAuth();
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // ── Fetch feed ─────────────────────────────────────────────────────────
  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await postAPI.list();
      setPosts(Array.isArray(data) ? data : data.results ?? []);
    } catch {
      setError("Không thể tải bảng tin. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // ── Post created → prepend to feed ────────────────────────────────────
  const handlePostCreated = useCallback((newPost) => {
    setPosts((prev) => [newPost, ...prev]);
    setShowCreateModal(false);
  }, []);

  // ── Post deleted → remove from feed ───────────────────────────────────
  const handlePostDeleted = useCallback((postId) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navbar */}
      <nav className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="text-xl font-bold text-blue-600">Social App</span>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-700">{user?.username}</span>
            <button
              onClick={logout}
              className="text-sm text-red-500 hover:text-red-600 font-medium"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </nav>

      {/* Feed */}
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Create post trigger */}
        <CreatePostTrigger user={user} onClick={() => setShowCreateModal(true)} />

        {/* Skeletons */}
        {isLoading && (
          <>
            <PostCardSkeleton />
            <PostCardSkeleton />
            <PostCardSkeleton />
          </>
        )}

        {/* Error */}
        {error && !isLoading && (
          <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col items-center gap-3 text-center">
            <AlertCircle className="h-8 w-8 text-red-400" />
            <p className="text-sm text-gray-600">{error}</p>
            <button
              onClick={fetchPosts}
              className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Posts */}
        {!isLoading && !error && (
          <>
            {posts.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-400">
                <PenSquare className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">Chưa có bài viết nào.</p>
                <p className="text-sm mt-1">Hãy là người đầu tiên chia sẻ!</p>
              </div>
            ) : (
              posts.map((post) => (
                <PostCard key={post.id} post={post} onDelete={handlePostDeleted} />
              ))
            )}
          </>
        )}
      </main>

      {/* Create post modal */}
      {showCreateModal && (
        <CreatePostModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handlePostCreated}
        />
      )}
    </div>
  );
}
