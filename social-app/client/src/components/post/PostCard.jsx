import { useState, useCallback } from "react";
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Globe,
  Users,
  Lock,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { postAPI } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import CommentSection from "./CommentSection";
import ImageViewer from "./ImageViewer";

// ── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diffSec = Math.floor((now - date) / 1000);
  if (diffSec < 60) return "Vừa xong";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} phút trước`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} giờ trước`;
  if (diffSec < 172800) return "hôm qua";
  return date.toLocaleDateString("vi-VN");
}

function formatLikeText(likeCount, isLiked) {
  if (likeCount === 0) return null;
  if (likeCount === 1) return isLiked ? "Bạn" : "1 người";
  if (isLiked) {
    const others = likeCount - 1;
    return others === 0 ? "Bạn" : `Bạn và ${others} người khác`;
  }
  return `${likeCount} người`;
}

const PRIVACY_ICON = { public: Globe, friends: Users, private: Lock };

// ── Sub-components ─────────────────────────────────────────────────────────

function Avatar({ user, size = "h-10 w-10" }) {
  return (
    <div className={`${size} rounded-full overflow-hidden bg-gradient-to-br from-blue-400 to-indigo-500 flex-shrink-0`}>
      {user?.avatar ? (
        <img src={user.avatar} alt={user.username} className="w-full h-full object-cover" />
      ) : (
        <span className="w-full h-full flex items-center justify-center text-white font-bold">
          {user?.username?.[0]?.toUpperCase()}
        </span>
      )}
    </div>
  );
}

/** Render post images with smart grid layout */
function ImageGrid({ images, onImageClick }) {
  if (!images?.length) return null;

  const urls = images.map((img) => img.image || img);

  if (urls.length === 1) {
    return (
      <div
        className="w-full max-h-[500px] overflow-hidden rounded-xl cursor-pointer bg-gray-100"
        onClick={() => onImageClick(0)}
      >
        <img
          src={urls[0]}
          alt="Ảnh bài viết"
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  if (urls.length === 2) {
    return (
      <div className="grid grid-cols-2 gap-1 rounded-xl overflow-hidden">
        {urls.map((url, i) => (
          <div
            key={i}
            className="aspect-square cursor-pointer bg-gray-100"
            onClick={() => onImageClick(i)}
          >
            <img src={url} alt={`Ảnh ${i + 1}`} className="w-full h-full object-cover" />
          </div>
        ))}
      </div>
    );
  }

  // 3+ images: first image large on left, rest stacked on right
  const [first, ...rest] = urls;
  const shown = rest.slice(0, 2);
  const extra = urls.length - 3; // images hidden beyond first 3

  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl overflow-hidden">
      {/* First image — spans both rows */}
      <div
        className="row-span-2 cursor-pointer bg-gray-100"
        style={{ aspectRatio: "1 / 1" }}
        onClick={() => onImageClick(0)}
      >
        <img src={first} alt="Ảnh 1" className="w-full h-full object-cover" />
      </div>

      {/* Remaining (up to 2) */}
      {shown.map((url, i) => (
        <div
          key={i}
          className="relative cursor-pointer bg-gray-100"
          style={{ aspectRatio: "1 / 1" }}
          onClick={() => onImageClick(i + 1)}
        >
          <img src={url} alt={`Ảnh ${i + 2}`} className="w-full h-full object-cover" />
          {/* Overlay on last visible if there are more hidden images */}
          {i === 1 && extra > 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <span className="text-white text-2xl font-bold">+{extra}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** Loading skeleton for a post card */
export function PostCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-gray-200" />
        <div className="space-y-1.5 flex-1">
          <div className="h-3.5 bg-gray-200 rounded-full w-1/4" />
          <div className="h-3 bg-gray-200 rounded-full w-1/6" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-gray-200 rounded-full w-full" />
        <div className="h-3 bg-gray-200 rounded-full w-5/6" />
        <div className="h-3 bg-gray-200 rounded-full w-4/6" />
      </div>
      <div className="h-48 bg-gray-200 rounded-xl" />
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

/**
 * Card for displaying a single post.
 * @prop {object}   post      — post data object from API
 * @prop {Function} onDelete  — called with post.id when post is deleted
 */
export default function PostCard({ post: initialPost, onDelete }) {
  const { user } = useAuth();
  const [post, setPost] = useState(initialPost);
  const [likeAnimating, setLikeAnimating] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isOwner = user?.id === post.author?.id;
  const PrivacyIcon = PRIVACY_ICON[post.privacy] || Globe;
  const imageUrls = (post.images || []).map((img) => img.image || img);
  const likeText = formatLikeText(post.like_count, post.is_liked);

  // ── Actions ────────────────────────────────────────────────────────────

  const handleLike = useCallback(async () => {
    const wasLiked = post.is_liked;
    // Optimistic update
    setPost((p) => ({
      ...p,
      is_liked: !wasLiked,
      like_count: wasLiked ? p.like_count - 1 : p.like_count + 1,
    }));
    setLikeAnimating(true);
    setTimeout(() => setLikeAnimating(false), 400);
    try {
      await postAPI.toggleLike(post.id);
    } catch {
      // Revert on error: undo the optimistic change
      setPost((p) => ({
        ...p,
        is_liked: wasLiked,
        like_count: p.like_count + (wasLiked ? 1 : -1),
      }));
    }
  }, [post.id, post.is_liked]);

  const handleSave = useCallback(async () => {
    const wasSaved = post.is_saved;
    setPost((p) => ({ ...p, is_saved: !wasSaved }));
    try {
      await postAPI.toggleSave(post.id);
    } catch {
      setPost((p) => ({ ...p, is_saved: wasSaved }));
    }
  }, [post.id, post.is_saved]);

  const handleDelete = useCallback(async () => {
    if (!window.confirm("Xoá bài viết này?")) return;
    setIsDeleting(true);
    try {
      await postAPI.delete(post.id);
      onDelete?.(post.id);
    } catch {
      setIsDeleting(false);
    }
  }, [post.id, onDelete]);

  const handleShare = useCallback(() => {
    if (navigator.share) {
      navigator.share({ title: "Bài viết", url: window.location.href }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(window.location.href);
    }
  }, []);

  // ── Content "show more" logic ──────────────────────────────────────────
  const contentLines = (post.content || "").split("\n");
  const needsExpand = contentLines.length > 3;
  const displayedContent = expanded || !needsExpand
    ? post.content
    : contentLines.slice(0, 3).join("\n");

  // ── Render ─────────────────────────────────────────────────────────────

  if (isDeleting) return null;

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-4 pb-2">
          <div className="flex items-center gap-3">
            <Avatar user={post.author} />
            <div>
              <p className="font-semibold text-gray-900 text-sm leading-tight">
                {post.author?.username}
              </p>
              <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                <span>{timeAgo(post.created_at)}</span>
                <span>·</span>
                <PrivacyIcon className="h-3 w-3" />
              </div>
            </div>
          </div>

          {/* More options (owner only) */}
          {isOwner && (
            <div className="relative">
              <button
                onClick={() => setShowMenu((v) => !v)}
                className="h-8 w-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition"
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-full mt-1 z-10 bg-white rounded-xl shadow-lg border border-gray-100 py-1 w-36">
                  <button
                    onClick={() => { setShowMenu(false); handleDelete(); }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition"
                  >
                    <Trash2 className="h-4 w-4" />
                    Xoá bài viết
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        {post.content && (
          <div className="px-5 pb-3">
            <p className="text-gray-800 text-sm whitespace-pre-wrap break-words leading-relaxed">
              {displayedContent}
            </p>
            {needsExpand && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition mt-1"
              >
                {expanded ? "Ẩn bớt" : "Xem thêm"}
              </button>
            )}
          </div>
        )}

        {/* Images */}
        {imageUrls.length > 0 && (
          <div className="px-5 pb-3">
            <ImageGrid images={post.images} onImageClick={(i) => setViewerIndex(i)} />
          </div>
        )}

        {/* Like summary */}
        {likeText && (
          <div className="px-5 pb-2">
            <p className="text-xs text-gray-400">
              <span className="inline-flex items-center gap-0.5">
                <span className="h-4 w-4 bg-blue-500 rounded-full flex items-center justify-center">
                  <Heart className="h-2.5 w-2.5 text-white fill-white" />
                </span>
                {likeText}
              </span>
            </p>
          </div>
        )}

        {/* Divider */}
        <div className="mx-5 border-t border-gray-100" />

        {/* Actions bar */}
        <div className="flex items-center px-2 py-1">
          {/* Like */}
          <button
            onClick={handleLike}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition hover:bg-gray-50 ${
              post.is_liked ? "text-blue-600" : "text-gray-500"
            }`}
          >
            <Heart
              className={`h-5 w-5 transition-transform ${likeAnimating ? "scale-125" : ""} ${
                post.is_liked ? "fill-blue-600" : ""
              }`}
            />
            <span>{post.like_count > 0 ? `${post.like_count} ` : ""}Thích</span>
          </button>

          {/* Comment */}
          <button
            onClick={() => setShowComments((v) => !v)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition hover:bg-gray-50 ${
              showComments ? "text-blue-600" : "text-gray-500"
            }`}
          >
            <MessageCircle className="h-5 w-5" />
            <span>{post.comment_count > 0 ? post.comment_count : ""} Bình luận</span>
          </button>

          {/* Share */}
          <button
            onClick={handleShare}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 transition"
          >
            <Share2 className="h-5 w-5" />
            <span>Chia sẻ</span>
          </button>

          {/* Bookmark */}
          <button
            onClick={handleSave}
            className={`p-2.5 rounded-xl transition hover:bg-gray-50 ${
              post.is_saved ? "text-yellow-500" : "text-gray-500"
            }`}
            aria-label={post.is_saved ? "Bỏ lưu" : "Lưu bài"}
          >
            <Bookmark className={`h-5 w-5 ${post.is_saved ? "fill-yellow-500" : ""}`} />
          </button>
        </div>

        {/* Comment section */}
        {showComments && (
          <div className="px-5 pb-4">
            <div className="border-t border-gray-100 pt-3">
              <CommentSection
                postId={post.id}
                commentCount={post.comment_count}
                isOpen={showComments}
              />
            </div>
          </div>
        )}
      </div>

      {/* Image lightbox */}
      {viewerIndex !== null && (
        <ImageViewer
          images={imageUrls}
          currentIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onNavigate={setViewerIndex}
        />
      )}
    </>
  );
}
