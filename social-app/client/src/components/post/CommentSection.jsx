import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Loader2, Trash2, CornerDownRight, ChevronDown } from "lucide-react";
import { commentAPI } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

const INITIAL_VISIBLE = 3;

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

/** Single avatar bubble */
function Avatar({ user, size = "h-8 w-8" }) {
  return (
    <div className={`${size} rounded-full overflow-hidden bg-gradient-to-br from-blue-400 to-indigo-500 flex-shrink-0`}>
      {user?.avatar ? (
        <img src={user.avatar} alt={user.username} className="w-full h-full object-cover" />
      ) : (
        <span className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
          {user?.username?.[0]?.toUpperCase()}
        </span>
      )}
    </div>
  );
}

/** A comment input box (used for both top-level and replies) */
function CommentInput({ postId, parentId = null, placeholder = "Viết bình luận…", onSubmitted, autoFocus = false }) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (autoFocus && textareaRef.current) textareaRef.current.focus();
  }, [autoFocus]);

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const submit = async () => {
    if (!text.trim() || isLoading) return;
    setIsLoading(true);
    try {
      const { data } = await commentAPI.create(postId, {
        content: text.trim(),
        parent: parentId || null,
      });
      setText("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      onSubmitted(data);
    } catch {
      // silently ignore – user can retry
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    setText(e.target.value);
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = `${ta.scrollHeight}px`;
    }
  };

  return (
    <div className="flex items-start gap-2">
      <Avatar user={user} />
      <div className="flex-1 flex items-end bg-gray-100 rounded-2xl px-3 py-2 gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKey}
          placeholder={placeholder}
          rows={1}
          maxLength={2000}
          className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none resize-none overflow-hidden"
        />
        <button
          onClick={submit}
          disabled={!text.trim() || isLoading}
          className="mb-0.5 text-blue-600 hover:text-blue-700 transition disabled:opacity-40"
          aria-label="Gửi bình luận"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

/** A single comment row (supports 1-level replies) */
function CommentItem({ comment, postId, currentUser, onDelete, onReplySubmitted }) {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const isOwner = currentUser?.id === comment.author?.id;

  const handleReplySubmitted = (reply) => {
    setShowReplyInput(false);
    setShowReplies(true);
    onReplySubmitted(comment.id, reply);
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start gap-2 group">
        <Avatar user={comment.author} />
        <div className="flex-1 min-w-0">
          <div className="bg-gray-100 rounded-2xl px-3 py-2 inline-block max-w-full">
            <p className="text-sm font-semibold text-gray-900">{comment.author?.username}</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{comment.content}</p>
          </div>
          <div className="flex items-center gap-3 mt-1 px-1">
            <span className="text-xs text-gray-400">{timeAgo(comment.created_at)}</span>
            <button
              onClick={() => setShowReplyInput((v) => !v)}
              className="text-xs font-semibold text-gray-500 hover:text-blue-600 transition"
            >
              Trả lời
            </button>
            {isOwner && (
              <button
                onClick={() => onDelete(comment.id)}
                className="text-xs font-semibold text-gray-400 hover:text-red-500 transition flex items-center gap-0.5 opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="h-3 w-3" />
                Xoá
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Replies */}
      {comment.replies?.length > 0 && (
        <div className="ml-10">
          {!showReplies ? (
            <button
              onClick={() => setShowReplies(true)}
              className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 transition mt-1"
            >
              <CornerDownRight className="h-3 w-3" />
              Xem {comment.replies.length} phản hồi
            </button>
          ) : (
            <div className="space-y-2 mt-1">
              {comment.replies.map((reply) => (
                <div key={reply.id} className="flex items-start gap-2 group">
                  <Avatar user={reply.author} />
                  <div className="flex-1 min-w-0">
                    <div className="bg-gray-100 rounded-2xl px-3 py-2 inline-block max-w-full">
                      <p className="text-sm font-semibold text-gray-900">{reply.author?.username}</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{reply.content}</p>
                    </div>
                    <div className="flex items-center gap-3 mt-1 px-1">
                      <span className="text-xs text-gray-400">{timeAgo(reply.created_at)}</span>
                      {currentUser?.id === reply.author?.id && (
                        <button
                          onClick={() => onDelete(reply.id, comment.id)}
                          className="text-xs font-semibold text-gray-400 hover:text-red-500 transition flex items-center gap-0.5 opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="h-3 w-3" />
                          Xoá
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <button
                onClick={() => setShowReplies(false)}
                className="text-xs font-semibold text-gray-400 hover:text-gray-600 transition"
              >
                Ẩn phản hồi
              </button>
            </div>
          )}
        </div>
      )}

      {/* Reply input */}
      {showReplyInput && (
        <div className="ml-10 mt-1">
          <CommentInput
            postId={postId}
            parentId={comment.id}
            placeholder={`Trả lời ${comment.author?.username}…`}
            onSubmitted={handleReplySubmitted}
            autoFocus
          />
        </div>
      )}
    </div>
  );
}

/** Loading skeleton for one comment */
function CommentSkeleton() {
  return (
    <div className="flex items-start gap-2 animate-pulse">
      <div className="h-8 w-8 rounded-full bg-gray-200 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-200 rounded-full w-1/4" />
        <div className="h-4 bg-gray-200 rounded-full w-3/4" />
      </div>
    </div>
  );
}

/**
 * Comment section for a post.
 * @prop {string}   postId         — UUID of the post
 * @prop {number}   commentCount   — total number of comments (from post object)
 * @prop {boolean}  isOpen         — whether the section is expanded
 */
export default function CommentSection({ postId, commentCount, isOpen }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fetched, setFetched] = useState(false);

  // Fetch comments when the section is opened for the first time
  useEffect(() => {
    if (!isOpen || fetched) return;
    setIsLoading(true);
    setError(null);
    commentAPI
      .list(postId)
      .then(({ data }) => {
        setComments(Array.isArray(data) ? data : data.results ?? []);
        setFetched(true);
      })
      .catch(() => setError("Không thể tải bình luận."))
      .finally(() => setIsLoading(false));
  }, [isOpen, postId, fetched]);

  const handleNewComment = useCallback((comment) => {
    setComments((prev) => [...prev, comment]);
    setVisibleCount((v) => v + 1);
  }, []);

  const handleReplySubmitted = useCallback((parentId, reply) => {
    setComments((prev) =>
      prev.map((c) =>
        c.id === parentId
          ? { ...c, replies: [...(c.replies || []), reply] }
          : c
      )
    );
  }, []);

  const handleDelete = useCallback(async (commentId, parentId = null) => {
    try {
      await commentAPI.delete(commentId);
      if (parentId) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === parentId
              ? { ...c, replies: (c.replies || []).filter((r) => r.id !== commentId) }
              : c
          )
        );
      } else {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        setVisibleCount((v) => Math.max(INITIAL_VISIBLE, v - 1));
      }
    } catch {
      // silently ignore
    }
  }, []);

  if (!isOpen) return null;

  const visible = comments.slice(0, visibleCount);
  const hiddenCount = comments.length - visibleCount;

  return (
    <div className="space-y-3 pt-2">
      {/* Error */}
      {error && (
        <p className="text-sm text-red-500 text-center">{error}</p>
      )}

      {/* Skeletons while loading */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: Math.min(commentCount, INITIAL_VISIBLE) }).map((_, i) => (
            <CommentSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Comments list */}
      {!isLoading && (
        <div className="space-y-3">
          {visible.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              postId={postId}
              currentUser={user}
              onDelete={handleDelete}
              onReplySubmitted={handleReplySubmitted}
            />
          ))}
        </div>
      )}

      {/* "Load more" button */}
      {hiddenCount > 0 && (
        <button
          onClick={() => setVisibleCount((v) => v + 5)}
          className="flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700 transition"
        >
          <ChevronDown className="h-4 w-4" />
          Xem thêm {hiddenCount} bình luận
        </button>
      )}

      {/* Comment input */}
      <CommentInput postId={postId} onSubmitted={handleNewComment} />
    </div>
  );
}
