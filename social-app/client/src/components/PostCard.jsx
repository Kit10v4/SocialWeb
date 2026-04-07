import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Heart, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { postAPI } from "../services/api";
import { useToast } from "./shared/Toast";
import { useComments } from "../hooks/useComments";
import ImageViewer from "./ImageViewer";
import CommentSection from "./CommentSection";
import EditPostModal from "./EditPostModal";

function formatRelativeTime(dateInput) {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "vừa xong";
  if (diffMin < 60) return `${diffMin} phút trước`;
  if (diffHour < 24) return `${diffHour} giờ trước`;
  if (diffDay === 1) return "hôm qua";
  if (diffDay < 7) return `${diffDay} ngày trước`;
  const diffWeek = Math.floor(diffDay / 7);
  if (diffWeek < 5) return `${diffWeek} tuần trước`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth} tháng trước`;
  const diffYear = Math.floor(diffMonth / 12);
  return `${diffYear} năm trước`;
}

function buildLikeText({ likedFriends = [], othersCount = 0 }) {
  if (!likedFriends.length && !othersCount) return "";

  const you = likedFriends.find((f) => f.isYou);
  const others = likedFriends.filter((f) => !f.isYou);

  if (you && others.length) {
    const first = others[0]?.name;
    const remaining = othersCount + others.length - 1;
    if (remaining > 0) return `Bạn, ${first} và ${remaining} người khác`;
    return `Bạn và ${first}`;
  }

  if (you && !others.length) {
    if (othersCount > 0) return `Bạn và ${othersCount} người khác`;
    return "Bạn";
  }

  if (!you && others.length) {
    const first = others[0]?.name;
    const remaining = othersCount + others.length - 1;
    if (remaining > 0) return `${first} và ${remaining} người khác`;
    return first || "";
  }

  return `${othersCount} người khác`;
}

/**
 * Normalize images from API format to URL strings
 * API format: [{ id, image, order }]
 * Output: string[]
 */
function normalizeImages(images) {
  if (!Array.isArray(images)) return [];
  return images.map((img) => {
    if (typeof img === "string") return img;
    return img.image || img.url || "";
  }).filter(Boolean);
}

/**
 * PostCard
 *
 * Props (API format from Django):
 *  - post: {
 *      id: string,
 *      author: { id: string, username: string, avatar: string },
 *      content: string,
 *      images: [{ id: string, image: string, order: number }],
 *      privacy: string,
 *      like_count: number,
 *      comment_count: number,
 *      is_liked: boolean,
 *      is_saved: boolean,
 *      created_at: string (ISO),
 *      likedFriends?: { id: string | number; name: string; isYou?: boolean }[],
 *      otherLikesCount?: number,
 *    }
 *  - onLike?: (postId) => Promise<void> | void
 *  - onCommentClick?: (postId) => void
 *  - onShare?: (postId) => void
 *  - onBookmark?: (postId) => void
 *  - isLoading?: boolean
 *  - error?: string
 */
export default function PostCard({
  post,
  onLike,
  onCommentClick,
  onShare,
  onBookmark,
  onDelete,
  compact = false,
  isLoading = false,
  error,
}) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Use the comments hook
  const {
    transformedComments,
    isLoading: commentsLoading,
    error: commentsError,
    fetched: commentsFetched,
    fetchComments,
    submitComment,
    deleteComment,
  } = useComments(post?.id);

  const [localLiked, setLocalLiked] = useState(post?.is_liked || false);
  const [localLikeCount, setLocalLikeCount] = useState(post?.like_count || 0);
  const [localCommentCount, setLocalCommentCount] = useState(post?.comment_count || 0);
  const [localSaved, setLocalSaved] = useState(post?.is_saved || false);
  const [localContent, setLocalContent] = useState(
    typeof post?.content === "string" ? post?.content : post?.rawContent || ""
  );
  const [localPrivacy, setLocalPrivacy] = useState(post?.privacy || "");
  const [likeBusy, setLikeBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [showContentFull, setShowContentFull] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [internalError, setInternalError] = useState("");
  const menuRef = useRef(null);

  // Comment section states
  const [showComments, setShowComments] = useState(false);

  const contentRef = (node) => {
    if (!node) return;
    // Detect if content exceeds ~3 lines
    requestAnimationFrame(() => {
      if (node.scrollHeight > node.clientHeight + 4) {
        setIsTruncated(true);
      }
    });
  };

  useEffect(() => {
    setLocalLiked(post?.is_liked || false);
    setLocalLikeCount(post?.like_count || 0);
  }, [post?.is_liked, post?.like_count]);

  useEffect(() => {
    setLocalCommentCount(post?.comment_count || 0);
  }, [post?.comment_count]);

  useEffect(() => {
    setLocalSaved(post?.is_saved || false);
  }, [post?.is_saved]);

  useEffect(() => {
    setLocalContent(typeof post?.content === "string" ? post?.content : post?.rawContent || "");
  }, [post?.content, post?.rawContent]);

  useEffect(() => {
    setLocalPrivacy(post?.privacy || "");
  }, [post?.privacy]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const likeSummary = useMemo(
    () =>
      buildLikeText({
        likedFriends: post?.likedFriends || [],
        othersCount: post?.otherLikesCount || 0,
      }),
    [post?.likedFriends, post?.otherLikesCount]
  );

  // Normalize images from API format to URL strings
  const imageUrls = useMemo(() => normalizeImages(post?.images), [post?.images]);

  const handleLike = async () => {
    if (!post || likeBusy) return;

    setInternalError("");
    setLikeBusy(true);
    const nextLiked = !localLiked;
    setLocalLiked(nextLiked);
    setLocalLikeCount((c) => c + (nextLiked ? 1 : -1));

    try {
      await onLike?.(post.id);
    } catch (err) {
      // revert on error
      setLocalLiked((prev) => !prev);
      setLocalLikeCount((c) => c + (nextLiked ? -1 : 1));
      const message = err?.response?.data?.detail || err?.message || "Không thể cập nhật lượt thích.";
      setInternalError(message);
      showToast("error", "Không thể thích bài viết");
    } finally {
      setLikeBusy(false);
    }
  };

  const handleCommentClick = () => {
    if (!post) return;

    // Toggle comment section
    const willShow = !showComments;
    setShowComments(willShow);

    // Fetch comments if opening and not yet fetched
    if (willShow && !commentsFetched) {
      fetchComments();
    }

    // Also call external handler if provided
    onCommentClick?.(post.id);
  };

  const handleOpenDetail = () => {
    if (!post?.id) return;
    navigate(`/post/${post.id}`);
  };

  const handleShare = async () => {
    if (!post) return;
    const url = `${window.location.origin}/post/${post.id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Sao chép liên kết:", url);
    }
    onShare?.(post.id);
  };

  const handleBookmark = async () => {
    if (!post) return;
    setLocalSaved((prev) => !prev);
    try {
      await onBookmark?.(post.id);
    } catch {
      setLocalSaved((prev) => !prev);
    }
  };

  const handleDelete = async () => {
    if (!post || deleteBusy) return;
    const confirmed = window.confirm("Bạn có chắc muốn xoá bài viết này không?");
    if (!confirmed) return;
    setDeleteBusy(true);
    setInternalError("");
    try {
      await postAPI.delete(post.id);
      onDelete?.(post.id);
      showToast("success", "Đã xoá bài viết");
    } catch (err) {
      const message = err?.response?.data?.detail || err?.message || "Không thể xoá bài viết.";
      setInternalError(message);
    } finally {
      setDeleteBusy(false);
      setMenuOpen(false);
    }
  };

  const handleUpdate = async ({ content, privacy }) => {
    if (!post) return;
    const nextContent = content ?? "";
    const nextPrivacy = privacy ?? localPrivacy;
    const prevContent = localContent;
    const prevPrivacy = localPrivacy;
    setLocalContent(nextContent);
    setLocalPrivacy(nextPrivacy);
    setEditOpen(false);
    setInternalError("");
    try {
      await postAPI.update(post.id, {
        content: nextContent,
        privacy: nextPrivacy,
      });
    } catch (err) {
      setLocalContent(prevContent);
      setLocalPrivacy(prevPrivacy);
      const message =
        err?.response?.data?.detail || err?.message || "Không thể cập nhật bài viết.";
      setInternalError(message);
      showToast("error", "Không thể cập nhật bài viết");
    }
  };

  // Submit comment handler - wraps the hook's method and updates local count
  const handleSubmitComment = async (text, parentId = null) => {
    const wasTopLevel = !parentId;
    await submitComment(text, parentId);
    if (wasTopLevel) {
      setLocalCommentCount((c) => c + 1);
    }
  };

  // Delete comment handler - wraps the hook's method and updates local count
  const handleDeleteComment = async (commentId) => {
    // Check if it's a top-level comment before deleting
    const isTopLevel = transformedComments.some((c) => String(c.id) === String(commentId));
    await deleteComment(commentId);
    if (isTopLevel) {
      setLocalCommentCount((c) => Math.max(0, c - 1));
    }
  };

  if (isLoading) return <PostCardSkeleton />;

  if (!post) return null;
  const isOwner = String(post.author?.id) === String(user?.id);
  const displayContent =
    typeof post?.content === "string" ? localContent : post?.content || localContent;

  return (
    <article className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-5 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <Link
          to={`/profile/${post.author?.username}`}
          className="flex items-center gap-3 hover:opacity-80 min-w-0"
        >
          <img
            src={post.author?.avatar}
            alt={post.author?.username}
            loading="lazy"
            className="w-10 h-10 rounded-full object-cover bg-gray-200 dark:bg-gray-700"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <p className="font-semibold text-sm sm:text-base text-gray-900 dark:text-gray-100 hover:underline truncate">
                {post.author?.username}
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  handleOpenDetail();
                }}
                className="hover:underline"
              >
                {formatRelativeTime(post.created_at)}
              </button>
              {localPrivacy && <span>· {localPrivacy}</span>}
              {post.is_trending && (
                <span className="ml-1 text-[10px] text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full">
                  🔥 Đang hot
                </span>
              )}
            </div>
          </div>
        </Link>
        {isOwner && (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl shadow-lg z-10 overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    setEditOpen(true);
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <Pencil className="w-4 h-4" />
                  Chỉnh sửa bài viết
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleteBusy}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
                >
                  <Trash2 className="w-4 h-4" />
                  Xoá bài viết
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {displayContent && (
        <div className="mb-3">
          <p
            ref={contentRef}
            className={`text-sm sm:text-base text-gray-800 dark:text-gray-100 whitespace-pre-wrap ${
              showContentFull ? "max-h-none" : "max-h-20 overflow-hidden"
            }`}
          >
            {displayContent}
          </p>
          {isTruncated && !showContentFull && (
            <button
              type="button"
              onClick={() => setShowContentFull(true)}
              className="mt-1 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Xem thêm
            </button>
          )}
        </div>
      )}

      {/* Images */}
      {imageUrls.length > 0 && (
        <div className="mb-3">
          <ImageGrid images={imageUrls} onOpen={(index) => {
            setActiveImageIndex(index);
            setImageViewerOpen(true);
          }} />
        </div>
      )}

      {!compact && (
        <>
          {/* Like summary */}
          {(localLikeCount > 0 || likeSummary) && (
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
              <div className="flex items-center gap-1">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-white text-[10px]">
                  <Heart className="w-3 h-3 fill-current" />
                </span>
                <span>{likeSummary || `${localLikeCount} lượt thích`}</span>
              </div>
              {localCommentCount > 0 && (
                <button
                  type="button"
                  onClick={handleOpenDetail}
                  className="hover:underline"
                >
                  {localCommentCount} bình luận
                </button>
              )}
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-gray-100 dark:border-gray-700 my-2" />

          {/* Actions */}
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
            <button
              type="button"
              onClick={handleLike}
              disabled={likeBusy}
              className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg active:scale-95 transition ${
                localLiked ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold" : "hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              {localLiked ? (
                <Heart className={`w-5 h-5 fill-current ${likeBusy ? "animate-bounce" : ""}`} />
              ) : (
                <Heart className={`w-5 h-5 ${likeBusy ? "animate-bounce" : ""}`} />
              )}
              <span>Thích{localLikeCount > 0 ? ` · ${localLikeCount}` : ""}</span>
            </button>

            <button
              type="button"
              onClick={handleCommentClick}
              className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-95 transition ${
                showComments ? "text-blue-600 dark:text-blue-400 font-semibold" : ""
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7.5 8.25h9m-9 3h5.25M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>Bình luận{localCommentCount > 0 ? ` · ${localCommentCount}` : ""}</span>
            </button>

            <button
              type="button"
              onClick={handleShare}
              className="flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-95 transition"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7.5 8.25l9-5.25m-9 12l9 5.25m0-17.25v12m0-12L7.5 5.25m9 0L7.5 13.5"
                />
              </svg>
              <span>Chia sẻ</span>
            </button>

            <button
              type="button"
              onClick={handleBookmark}
              className={`ml-auto flex items-center justify-center w-9 h-9 rounded-lg active:scale-95 transition ${
                localSaved ? "bg-yellow-50 dark:bg-yellow-900/30 text-yellow-500 dark:text-yellow-400" : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                className="w-5 h-5"
                fill={localSaved ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17.25 3.75H6.75A1.5 1.5 0 005.25 5.25v15l6-3 6 3v-15a1.5 1.5 0 00-1.5-1.5z"
                />
              </svg>
            </button>
          </div>
        </>
      )}

      {(error || internalError) && (
        <p className="mt-2 text-xs text-red-500 bg-red-50 border border-red-100 rounded px-2 py-1.5">
          {error || internalError}
        </p>
      )}

      {!compact && showComments && (
        <CommentSection
          comments={transformedComments}
          currentUserId={user?.id}
          currentUserAvatar={user?.avatar}
          onSubmitComment={handleSubmitComment}
          onDeleteComment={handleDeleteComment}
          isLoading={commentsLoading}
          error={commentsError}
        />
      )}

      {imageViewerOpen && (
        <ImageViewer
          images={imageUrls}
          initialIndex={activeImageIndex}
          isOpen={imageViewerOpen}
          onClose={() => setImageViewerOpen(false)}
        />
      )}

      {editOpen && (
        <EditPostModal
          isOpen={editOpen}
          post={{ ...post, content: localContent, privacy: localPrivacy }}
          onClose={() => setEditOpen(false)}
          onSubmit={handleUpdate}
        />
      )}
    </article>
  );
}

function ImageGrid({ images, onOpen }) {
  const count = images.length;

  if (count === 1) {
    return (
      <div
        className="relative rounded-xl overflow-hidden cursor-pointer max-h-[480px]"
        onClick={() => onOpen(0)}
      >
        <img
          src={images[0]}
          alt="post"
          loading="lazy"
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  if (count === 2) {
    return (
      <div className="grid grid-cols-2 gap-1 rounded-xl overflow-hidden max-h-[420px]">
        {images.slice(0, 2).map((src, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onOpen(idx)}
            className="relative aspect-[4/5] w-full overflow-hidden"
          >
            <img
              src={src}
              alt={`post-${idx}`}
              loading="lazy"
              className="w-full h-full object-cover"
            />
          </button>
        ))}
      </div>
    );
  }

  if (count === 3) {
    return (
      <div className="grid grid-cols-2 grid-rows-2 gap-1 rounded-xl overflow-hidden max-h-[420px]">
        <button
          type="button"
          onClick={() => onOpen(0)}
          className="row-span-2 relative overflow-hidden"
        >
          <img
            src={images[0]}
            alt="post-0"
            loading="lazy"
            className="w-full h-full object-cover"
          />
        </button>
        {images.slice(1, 3).map((src, idx) => (
          <button
            key={idx + 1}
            type="button"
            onClick={() => onOpen(idx + 1)}
            className="relative overflow-hidden"
          >
            <img
              src={src}
              alt={`post-${idx + 1}`}
              className="w-full h-full object-cover"
            />
          </button>
        ))}
      </div>
    );
  }

  // 4 or more
  const extra = count - 4;
  return (
    <div className="grid grid-cols-2 grid-rows-2 gap-1 rounded-xl overflow-hidden max-h-[420px]">
      {images.slice(0, 4).map((src, idx) => {
        const isLast = idx === 3 && extra > 0;
        return (
          <button
            key={idx}
            type="button"
            onClick={() => onOpen(idx)}
            className="relative overflow-hidden"
          >
            <img
              src={src}
              alt={`post-${idx}`}
              loading="lazy"
              className="w-full h-full object-cover"
            />
            {isLast && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span className="text-white font-semibold text-lg">+{extra}</span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function PostCardSkeleton() {
  return (
    <article className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-5 mb-4 animate-pulse space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="space-y-2 flex-1">
          <div className="h-3 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-3 w-20 bg-gray-100 dark:bg-gray-800 rounded" />
        </div>
      </div>
      <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded" />
      <div className="h-4 bg-gray-100 dark:bg-gray-800 w-5/6 rounded" />
      <div className="h-52 bg-gray-100 dark:bg-gray-800 rounded-xl" />
      <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded" />
    </article>
  );
}
