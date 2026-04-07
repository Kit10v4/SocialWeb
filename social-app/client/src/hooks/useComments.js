import { useState, useMemo, useCallback } from "react";
import { commentAPI } from "../services/api";

/**
 * Transform backend comment format to frontend format.
 */
function transformComment(comment) {
  if (!comment) return null;
  return {
    id: comment.id,
    content: comment.content,
    createdAt: comment.created_at,
    author: {
      id: comment.author?.id,
      name: comment.author?.username,
      avatarUrl: comment.author?.avatar,
    },
    replies: Array.isArray(comment.replies)
      ? comment.replies.map(transformComment).filter(Boolean)
      : [],
  };
}

/**
 * Custom hook for managing comments on a post.
 *
 * @param {string} postId - The ID of the post
 * @returns {{
 *   comments: Array,
 *   transformedComments: Array,
 *   isLoading: boolean,
 *   error: string,
 *   fetched: boolean,
 *   fetchComments: () => Promise<void>,
 *   submitComment: (text: string, parentId?: string) => Promise<void>,
 *   deleteComment: (commentId: string) => Promise<boolean>,
 *   setComments: React.Dispatch<React.SetStateAction<Array>>,
 * }}
 */
export function useComments(postId) {
  const [comments, setComments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [fetched, setFetched] = useState(false);

  // Transform comments to frontend format
  const transformedComments = useMemo(
    () => comments.map(transformComment).filter(Boolean),
    [comments]
  );

  // Fetch comments from API
  const fetchComments = useCallback(async () => {
    if (!postId) return;
    setIsLoading(true);
    setError("");
    try {
      const res = await commentAPI.list(postId);
      const data = Array.isArray(res.data) ? res.data : res.data.results ?? [];
      setComments(data);
      setFetched(true);
    } catch (err) {
      const message =
        err?.response?.data?.detail || err?.message || "Không thể tải bình luận.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [postId]);

  // Submit a new comment or reply
  const submitComment = useCallback(
    async (text, parentId = null) => {
      if (!postId) return;

      const res = await commentAPI.create(postId, {
        content: text,
        parent: parentId,
      });

      const newComment = res.data;

      if (parentId) {
        // Add reply to existing comment
        setComments((prev) =>
          prev.map((c) => {
            if (c.id === parentId) {
              return {
                ...c,
                replies: [...(c.replies || []), newComment],
              };
            }
            return c;
          })
        );
      } else {
        // Add new top-level comment
        setComments((prev) => [newComment, ...prev]);
      }

      return newComment;
    },
    [postId]
  );

  // Delete a comment (returns true if it was a top-level comment)
  const deleteComment = useCallback(async (commentId) => {
    await commentAPI.delete(commentId);

    let wasTopLevel = false;
    setComments((prev) => {
      const filtered = prev.filter((c) => {
        if (c.id === commentId) {
          wasTopLevel = true;
          return false;
        }
        return true;
      });

      // If not found at top level, remove from replies
      if (!wasTopLevel) {
        return filtered.map((c) => ({
          ...c,
          replies: (c.replies || []).filter((r) => r.id !== commentId),
        }));
      }

      return filtered;
    });

    return wasTopLevel;
  }, []);

  return {
    comments,
    transformedComments,
    isLoading,
    error,
    fetched,
    fetchComments,
    submitComment,
    deleteComment,
    setComments,
  };
}

export { transformComment };
