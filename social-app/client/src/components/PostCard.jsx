import { useEffect, useMemo, useState } from "react";
import ImageViewer from "./ImageViewer";

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
 * PostCard
 *
 * Props:
 *  - post: {
 *      id,
 *      author: { name, avatarUrl },
 *      createdAt,
 *      content,
 *      images: string[],
 *      liked?: boolean,
 *      likeCount?: number,
 *      likedFriends?: { id: string | number; name: string; isYou?: boolean }[],
 *      otherLikesCount?: number,
 *      commentCount?: number,
 *      bookmarked?: boolean,
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
  isLoading = false,
  error,
}) {
  const [localLiked, setLocalLiked] = useState(post?.liked || false);
  const [localLikeCount, setLocalLikeCount] = useState(post?.likeCount || 0);
  const [likeBusy, setLikeBusy] = useState(false);
  const [showContentFull, setShowContentFull] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [internalError, setInternalError] = useState("");

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
    setLocalLiked(post?.liked || false);
    setLocalLikeCount(post?.likeCount || 0);
  }, [post?.liked, post?.likeCount]);

  const likeSummary = useMemo(
    () =>
      buildLikeText({
        likedFriends: post?.likedFriends || [],
        othersCount: post?.otherLikesCount || 0,
      }),
    [post?.likedFriends, post?.otherLikesCount]
  );

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
    } finally {
      setLikeBusy(false);
    }
  };

  const handleCommentClick = () => {
    if (!post) return;
    onCommentClick?.(post.id);
  };

  const handleShare = () => {
    if (!post) return;
    onShare?.(post.id);
  };

  const handleBookmark = () => {
    if (!post) return;
    onBookmark?.(post.id);
  };

  if (isLoading) return <PostCardSkeleton />;

  if (!post) return null;

  return (
    <article className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <img
            src={post.author?.avatarUrl}
            alt={post.author?.name}
            className="w-10 h-10 rounded-full object-cover bg-gray-200"
          />
          <div>
            <div className="flex items-center gap-1">
              <p className="font-semibold text-sm sm:text-base">{post.author?.name}</p>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <span>{formatRelativeTime(post.createdAt)}</span>
              {post.privacy && <span>· {post.privacy}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {post.content && (
        <div className="mb-3">
          <p
            ref={contentRef}
            className={`text-sm sm:text-base whitespace-pre-wrap ${
              showContentFull ? "max-h-none" : "max-h-20 overflow-hidden"
            }`}
          >
            {post.content}
          </p>
          {isTruncated && !showContentFull && (
            <button
              type="button"
              onClick={() => setShowContentFull(true)}
              className="mt-1 text-sm font-medium text-gray-600 hover:text-gray-800"
            >
              Xem thêm
            </button>
          )}
        </div>
      )}

      {/* Images */}
      {Array.isArray(post.images) && post.images.length > 0 && (
        <div className="mb-3">
          <ImageGrid images={post.images} onOpen={(index) => {
            setActiveImageIndex(index);
            setImageViewerOpen(true);
          }} />
        </div>
      )}

      {/* Like summary */}
      {(localLikeCount > 0 || likeSummary) && (
        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
          <div className="flex items-center gap-1">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-white text-[10px]">
              ❤
            </span>
            <span>{likeSummary || `${localLikeCount} lượt thích`}</span>
          </div>
          {post.commentCount ? (
            <button
              type="button"
              onClick={handleCommentClick}
              className="hover:underline"
            >
              {post.commentCount} bình luận
            </button>
          ) : null}
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-gray-100 my-2" />

      {/* Actions */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <button
          type="button"
          onClick={handleLike}
          disabled={likeBusy}
          className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg hover:bg-gray-50 active:scale-95 transition ${
            localLiked ? "text-blue-600 font-semibold" : ""
          }`}
        >
          <span
            className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${
              localLiked ? "bg-blue-50 text-blue-600" : "bg-gray-100 text-gray-600"
            } ${likeBusy ? "animate-bounce" : ""}`}
          >
            ❤
          </span>
          <span>Thích</span>
        </button>

        <button
          type="button"
          onClick={handleCommentClick}
          className="flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg hover:bg-gray-50 active:scale-95 transition"
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
          <span>Bình luận</span>
        </button>

        <button
          type="button"
          onClick={handleShare}
          className="flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg hover:bg-gray-50 active:scale-95 transition"
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
          className={`flex items-center justify-center w-9 h-9 rounded-full hover:bg-gray-50 active:scale-95 transition ${
            post.bookmarked ? "text-yellow-500" : "text-gray-500"
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            className="w-5 h-5"
            fill={post.bookmarked ? "currentColor" : "none"}
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

      {(error || internalError) && (
        <p className="mt-2 text-xs text-red-500 bg-red-50 border border-red-100 rounded px-2 py-1.5">
          {error || internalError}
        </p>
      )}

      {imageViewerOpen && (
        <ImageViewer
          images={post.images}
          initialIndex={activeImageIndex}
          isOpen={imageViewerOpen}
          onClose={() => setImageViewerOpen(false)}
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
    <article className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5 mb-4 animate-pulse space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-200" />
        <div className="space-y-2 flex-1">
          <div className="h-3 w-32 bg-gray-200 rounded" />
          <div className="h-3 w-20 bg-gray-100 rounded" />
        </div>
      </div>
      <div className="h-4 bg-gray-100 rounded" />
      <div className="h-4 bg-gray-100 w-5/6 rounded" />
      <div className="h-52 bg-gray-100 rounded-xl" />
      <div className="h-8 bg-gray-100 rounded" />
    </article>
  );
}
