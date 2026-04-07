import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../context/AuthContext";
import { postAPI } from "../services/api";
import { useComments } from "../hooks/useComments";
import PostCard, { PostCardSkeleton } from "../components/PostCard";
import CommentSection from "../components/CommentSection";
import PageHeader from "../components/shared/PageHeader";
import NotFoundPage from "./NotFoundPage";

export default function PostDetailPage() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const {
    data: post,
    isLoading: isPostLoading,
    isError: isPostError,
    error: postError,
  } = useQuery({
    queryKey: ["post", postId],
    queryFn: async () => {
      const res = await postAPI.get(postId);
      return res.data;
    },
    enabled: !!postId,
  });

  // Use the comments hook - fetch immediately for detail page
  const {
    transformedComments,
    isLoading: isCommentsLoading,
    error: commentsError,
    submitComment,
    deleteComment,
    fetchComments,
    fetched,
  } = useComments(postId);

  // Auto-fetch comments when postId is available (detail page shows all comments)
  useEffect(() => {
    if (postId && !fetched) {
      fetchComments();
    }
  }, [postId, fetched, fetchComments]);

  if (isPostError && postError?.response?.status === 404) {
    return <NotFoundPage />;
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 pb-16 md:pb-0">
      <div className="md:hidden">
        <PageHeader title="Chi tiết bài viết" />
      </div>
      <div className="max-w-3xl mx-auto px-2 sm:px-4 py-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-3 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
        >
          ← Quay lại
        </button>

        {isPostLoading && (
          <div className="space-y-3">
            <PostCardSkeleton />
          </div>
        )}

        {!isPostLoading && post && (
          <>
            <PostCard
              post={post}
              onLike={(id) => postAPI.toggleLike(id)}
              onBookmark={(id) => postAPI.toggleSave(id)}
              onDelete={() => navigate(-1)}
            />

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
              <CommentSection
                comments={transformedComments}
                currentUserId={user?.id}
                currentUserAvatar={user?.avatar}
                onSubmitComment={submitComment}
                onDeleteComment={deleteComment}
                isLoading={isCommentsLoading}
                error={commentsError}
                showAll
              />
            </div>
          </>
        )}

        {isPostError && !isPostLoading && postError?.response?.status !== 404 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-red-100 dark:border-red-800 text-red-600 dark:text-red-400 text-sm p-4">
            Không thể tải bài viết.
          </div>
        )}
      </div>
    </div>
  );
}
