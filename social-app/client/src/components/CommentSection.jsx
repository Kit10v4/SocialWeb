import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const DEFAULT_AVATAR = "https://ui-avatars.com/api/?background=random&name=U";

/**
 * Get avatar URL with fallback
 */
function getAvatarUrl(avatarUrl, name) {
  if (avatarUrl) return avatarUrl;
  const initial = name?.[0]?.toUpperCase() || "U";
  return `https://ui-avatars.com/api/?background=random&name=${initial}`;
}

/**
 * CommentSection
 *
 * Props:
 *  - comments: [
 *      {
 *        id,
 *        content,
 *        createdAt,
 *        author: { id, name, avatarUrl },
 *        replies?: same shape (one level),
 *      }
 *    ]
 *  - currentUserId: string | number
 *  - currentUserAvatar?: string (optional avatar of current user for input)
 *  - onSubmitComment?: (text, parentId: string | number | null) => Promise<void> | void
 *  - onDeleteComment?: (commentId) => Promise<void> | void
 *  - isLoading?: boolean
 *  - error?: string
 */
export default function CommentSection({
  comments = [],
  currentUserId,
  currentUserAvatar,
  onSubmitComment,
  onDeleteComment,
  isLoading = false,
  error,
  showAll = false,
}) {
  const [input, setInput] = useState("");
  const [replyTo, setReplyTo] = useState(null); // comment id
  const [pending, setPending] = useState(false);
  const [deletingIds, setDeletingIds] = useState(new Set());
  const [internalError, setInternalError] = useState("");
  const [visibleCount, setVisibleCount] = useState(showAll ? comments.length : 3);

  useEffect(() => {
    setVisibleCount(showAll ? comments.length : 3);
  }, [comments?.length, showAll]);

  const handleKeyDown = async (e, parentId = null) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      await handleSubmit(parentId);
    }
  };

  const handleSubmit = async (parentId = null) => {
    const text = input.trim();
    if (!text || !onSubmitComment) return;

    setPending(true);
    setInternalError("");
    try {
      await onSubmitComment(text, parentId);
      setInput("");
      setReplyTo(null);
    } catch (err) {
      const message = err?.response?.data?.detail || err?.message || "Không thể gửi bình luận.";
      setInternalError(message);
    } finally {
      setPending(false);
    }
  };

  const handleDelete = async (id) => {
    if (!onDeleteComment) return;
    const next = new Set(Array.from(deletingIds));
    next.add(id);
    setDeletingIds(next);
    setInternalError("");
    try {
      await onDeleteComment(id);
    } catch (err) {
      const message = err?.response?.data?.detail || err?.message || "Không thể xoá bình luận.";
      setInternalError(message);
    } finally {
      const reset = new Set(Array.from(next));
      reset.delete(id);
      setDeletingIds(reset);
    }
  };

  const toShow = comments.slice(0, visibleCount);
  const remaining = showAll ? 0 : Math.max(0, comments.length - visibleCount);

  return (
    <section className="mt-2">
      {isLoading && <CommentSectionSkeleton />}

      {!isLoading && (
        <>
          {error || internalError ? (
            <p className="mb-2 text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 rounded px-2 py-1.5">
              {error || internalError}
            </p>
          ) : null}

          {/* Comments list */}
          <div className="space-y-3">
            {toShow.map((comment) => (
              <div key={comment.id} className="flex items-start gap-2">
                <Link to={`/profile/${comment.author?.name}`}>
                  <img
                    src={getAvatarUrl(comment.author?.avatarUrl, comment.author?.name)}
                    alt={comment.author?.name}
                    className="w-8 h-8 rounded-full object-cover bg-gray-200 dark:bg-gray-700 mt-0.5 cursor-pointer hover:opacity-80"
                  />
                </Link>
                <div className="flex-1">
                  <div className="inline-block rounded-2xl bg-gray-100 dark:bg-gray-700 px-3 py-2">
                    <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                      {comment.author?.name}
                    </p>
                    <p className="text-sm whitespace-pre-wrap text-gray-800 dark:text-gray-200">{comment.content}</p>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                    <span>{formatRelativeTime(comment.createdAt)}</span>
                    <button
                      type="button"
                      className="font-medium hover:underline"
                      onClick={() => setReplyTo(comment.id)}
                    >
                      Trả lời
                    </button>
                    {comment.author?.id === currentUserId && (
                      <button
                        type="button"
                        className="font-medium hover:underline text-red-500 dark:text-red-400 disabled:opacity-50"
                        disabled={deletingIds.has(comment.id)}
                        onClick={() => handleDelete(comment.id)}
                      >
                        Xoá
                      </button>
                    )}
                  </div>

                  {/* Replies (one level) */}
                  {Array.isArray(comment.replies) && comment.replies.length > 0 && (
                    <div className="mt-2 space-y-2 pl-8">
                      {comment.replies.map((reply) => (
                        <div key={reply.id} className="flex items-start gap-2">
                          <Link to={`/profile/${reply.author?.name}`}>
                            <img
                              src={getAvatarUrl(reply.author?.avatarUrl, reply.author?.name)}
                              alt={reply.author?.name}
                              className="w-7 h-7 rounded-full object-cover bg-gray-200 dark:bg-gray-700 mt-0.5 cursor-pointer hover:opacity-80"
                            />
                          </Link>
                          <div>
                            <div className="inline-block rounded-2xl bg-gray-100 dark:bg-gray-700 px-3 py-2">
                              <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                                {reply.author?.name}
                              </p>
                              <p className="text-sm whitespace-pre-wrap text-gray-800 dark:text-gray-200">{reply.content}</p>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                              <span>{formatRelativeTime(reply.createdAt)}</span>
                              {reply.author?.id === currentUserId && (
                                <button
                                  type="button"
                                  className="font-medium hover:underline text-red-500 dark:text-red-400 disabled:opacity-50"
                                  disabled={deletingIds.has(reply.id)}
                                  onClick={() => handleDelete(reply.id)}
                                >
                                  Xoá
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reply input for this comment */}
                  {replyTo === comment.id && (
                    <div className="mt-2 pl-8">
                      <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, comment.id)}
                        rows={1}
                        placeholder="Viết trả lời..."
                        className="w-full text-sm rounded-2xl border border-gray-200 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {remaining > 0 && (
            <button
              type="button"
              onClick={() => setVisibleCount((v) => v + 3)}
              className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              Xem thêm {remaining} bình luận
            </button>
          )}
        </>
      )}

      {/* Main input */}
      <div className="mt-3 flex items-start gap-2">
        <img
          src={currentUserAvatar || DEFAULT_AVATAR}
          alt="You"
          className="w-8 h-8 rounded-full object-cover bg-gray-200 dark:bg-gray-700"
        />
        <div className="flex-1">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, replyTo)}
            rows={1}
            placeholder="Viết bình luận..."
            className="w-full text-sm rounded-2xl border border-gray-200 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
          />
          <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">Enter để gửi, Shift+Enter để xuống dòng</p>
        </div>
      </div>
    </section>
  );
}

function formatRelativeTime(dateInput) {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (!date || Number.isNaN(date.getTime())) return "";
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
  return `${diffDay} ngày trước`;
}

export function CommentSectionSkeleton() {
  return (
    <div className="mt-2 space-y-3 animate-pulse">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 mt-0.5" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-2/3" />
            <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
