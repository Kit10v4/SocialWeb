import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  Pencil,
  UserPlus,
  UserCheck,
  Clock,
  ChevronDown,
  UserMinus,
  FileText,
  Image,
  Users,
  Loader2,
  MessageCircle,
  CheckCircle,
  XCircle,
  MoreHorizontal,
  Link2,
  Flag,
  Ban,
  X,
  ArrowLeft,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useProfile } from "../hooks/useProfile";
import { useFriend } from "../hooks/useFriend";
import { friendsAPI, profileAPI, postAPI, chatAPI, reportAPI } from "../services/api";
import EditProfileModal from "../components/profile/EditProfileModal";
import FriendCard from "../components/profile/FriendCard";
import PostCard, { PostCardSkeleton } from "../components/PostCard";
import ImageViewer from "../components/ImageViewer";
import BottomNav from "../components/shared/BottomNav";
import PageHeader from "../components/shared/PageHeader";

// ── Tab constants ──────────────────────────────────────────────────────────
const TABS = { POSTS: "posts", PHOTOS: "photos", FRIENDS: "friends" };
const TAB_CONFIG = [
  { key: TABS.POSTS, label: "Bài viết", icon: FileText },
  { key: TABS.PHOTOS, label: "Ảnh", icon: Image },
  { key: TABS.FRIENDS, label: "Bạn bè", icon: Users },
];

// ── ProfilePage ────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { username } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { profile, isLoading, error, refetch, updateFriendshipStatus } =
    useProfile(username);
  const { actionLoading, sendRequest, accept, reject, unfriend } = useFriend();

  const [activeTab, setActiveTab] = useState(TABS.POSTS);
  const [showEditModal, setShowEditModal] = useState(false);
  const [friends, setFriends] = useState([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [messageBusy, setMessageBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const dropdownRef = useRef(null);

  // Photo lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const isOwnProfile = user?.username === username;

  // ── Toast auto-dismiss ──────────────────────────────────────────────────
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Fetch user posts ──────────────────────────────────────────────────
  const {
    data: postsData,
    isLoading: postsLoading,
    isError: postsError,
  } = useQuery({
    queryKey: ["user-posts", username],
    queryFn: async () => {
      const res = await profileAPI.getUserPosts(username);
      return Array.isArray(res.data) ? res.data : res.data.results ?? [];
    },
    enabled: !!username && !!profile,
  });

  const posts = postsData || [];

  // Extract all photos from posts
  const allPhotos = useMemo(() => {
    const photos = [];
    posts.forEach((post) => {
      if (Array.isArray(post.images)) {
        post.images.forEach((img) => {
          const url = typeof img === "string" ? img : img.image || img.url;
          if (url) {
            photos.push({ url, postId: post.id });
          }
        });
      }
    });
    return photos;
  }, [posts]);

  // ── Optimistic like mutation ──────────────────────────────────────────
  const likeMutation = useMutation({
    mutationFn: (postId) => postAPI.toggleLike(postId),
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: ["user-posts", username] });
      const previous = queryClient.getQueryData(["user-posts", username]);

      queryClient.setQueryData(["user-posts", username], (old) => {
        if (!old) return old;
        return old.map((post) => {
          if (post.id !== postId) return post;
          const nextLiked = !post.is_liked;
          const nextCount = (post.like_count || 0) + (nextLiked ? 1 : -1);
          return { ...post, is_liked: nextLiked, like_count: nextCount };
        });
      });

      return { previous };
    },
    onError: (_err, _postId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["user-posts", username], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["user-posts", username] });
    },
  });

  const handleLike = async (postId) => {
    return likeMutation.mutateAsync(postId);
  };

  // ── Bookmark mutation ─────────────────────────────────────────────────
  const bookmarkMutation = useMutation({
    mutationFn: (postId) => postAPI.toggleSave(postId),
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: ["user-posts", username] });
      const previous = queryClient.getQueryData(["user-posts", username]);

      queryClient.setQueryData(["user-posts", username], (old) => {
        if (!old) return old;
        return old.map((post) => {
          if (post.id !== postId) return post;
          return { ...post, is_saved: !post.is_saved };
        });
      });

      return { previous };
    },
    onError: (_err, _postId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["user-posts", username], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["user-posts", username] });
    },
  });

  const handleBookmark = async (postId) => {
    return bookmarkMutation.mutateAsync(postId);
  };

  // Fetch friends list when Friends tab is active
  useEffect(() => {
    if (activeTab !== TABS.FRIENDS || !profile) return;
    setFriendsLoading(true);
    friendsAPI
      .list()
      .then(({ data }) => setFriends(Array.isArray(data) ? data : data.results ?? []))
      .catch(() => setFriends([]))
      .finally(() => setFriendsLoading(false));
  }, [activeTab, profile]);

  // ── Friendship action handlers with optimistic update ──────────────────
  const handleSendRequest = async () => {
    const prevStatus = profile?.friendship_status;
    try {
      // Optimistic update
      updateFriendshipStatus("sent");
      await sendRequest(profile.id);
      // Refetch to get accurate data
      await refetch();
      setToast({ type: "success", message: "Đã gửi lời mời kết bạn" });
    } catch (err) {
      // Rollback on error
      updateFriendshipStatus(prevStatus);
      const message = err?.response?.data?.detail || "Không thể gửi lời mời";
      setToast({ type: "error", message });
    }
  };

  const handleAccept = async () => {
    const prevStatus = profile?.friendship_status;
    try {
      // Optimistic update
      updateFriendshipStatus("accepted");
      await accept(profile.id);
      // Refetch to get accurate data
      await refetch();
      setToast({ type: "success", message: "Đã chấp nhận lời mời kết bạn" });
    } catch (err) {
      // Rollback on error
      updateFriendshipStatus(prevStatus);
      const message = err?.response?.data?.detail || "Không thể chấp nhận lời mời";
      setToast({ type: "error", message });
    }
  };

  const handleReject = async () => {
    const prevStatus = profile?.friendship_status;
    try {
      // Optimistic update
      updateFriendshipStatus("none");
      await reject(profile.id);
      // Refetch to get accurate data
      await refetch();
      setToast({ type: "success", message: "Đã huỷ lời mời" });
    } catch (err) {
      // Rollback on error
      updateFriendshipStatus(prevStatus);
      const message = err?.response?.data?.detail || "Không thể huỷ lời mời";
      setToast({ type: "error", message });
    }
  };

  const handleUnfriend = async () => {
    const prevStatus = profile?.friendship_status;
    setDropdownOpen(false);
    try {
      // Optimistic update
      updateFriendshipStatus("none");
      await unfriend(profile.id);
      // Refetch to get accurate data
      await refetch();
      setToast({ type: "success", message: "Đã huỷ kết bạn" });
    } catch (err) {
      // Rollback on error
      updateFriendshipStatus(prevStatus);
      const message = err?.response?.data?.detail || "Không thể huỷ kết bạn";
      setToast({ type: "error", message });
    }
  };

  // ── Message handler ────────────────────────────────────────────────────
  const handleMessage = async () => {
    if (!profile?.id || messageBusy) return;
    setMessageBusy(true);
    try {
      await chatAPI.createConversation(profile.id);
      navigate("/messages");
    } catch (err) {
      const message = err?.response?.data?.detail || "Không thể tạo cuộc trò chuyện";
      setToast({ type: "error", message });
    } finally {
      setMessageBusy(false);
    }
  };

  const handleCopyProfileLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setToast({ type: "success", message: "Đã sao chép" });
    } catch {
      setToast({ type: "error", message: "Không thể sao chép liên kết" });
    }
  };

  const handleReportUser = async ({ reason, detail }) => {
    try {
      await reportAPI.create({
        target_user: profile.id,
        reason,
        detail,
      });
      setToast({ type: "success", message: "Đã gửi báo cáo" });
    } catch {
      alert("Đã gửi báo cáo");
    }
  };

  const handleBlockUser = () => {
    const ok = window.confirm("Bạn có chắc muốn chặn người dùng này không?");
    if (!ok) return;
    setToast({ type: "success", message: "Đã chặn người dùng" });
    navigate(-1);
  };

  // ── Photo click handler ────────────────────────────────────────────────
  const handlePhotoClick = (index) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  // ── Loading / error states ─────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gray-100">
        <p className="text-gray-500 text-lg">{error || "Người dùng không tồn tại."}</p>
        <Link to="/" className="text-blue-600 hover:underline text-sm">
          ← Về trang chủ
        </Link>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-100 pb-20 md:pb-0">
      <div className="md:hidden">
        <PageHeader title="Trang cá nhân" />
      </div>
      {/* ── Profile card ──────────────────────────────────────────────── */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto">

          {/* Cover photo */}
          <div className="relative h-48 sm:h-60 md:h-72 bg-gradient-to-br from-blue-400 to-indigo-600 overflow-hidden">
            <button
              onClick={() => navigate(-1)}
              className="absolute top-4 left-4 z-10 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-sm transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            {profile.cover_photo && (
              <img
                src={profile.cover_photo}
                alt="Cover"
                className="w-full h-full object-cover"
              />
            )}
            {isOwnProfile && (
              <button
                onClick={() => setShowEditModal(true)}
                className="absolute bottom-3 right-3 flex items-center gap-2 bg-black/40 hover:bg-black/60 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition"
              >
                <Camera className="h-4 w-4" />
                <span className="hidden sm:inline">Đổi ảnh bìa</span>
              </button>
            )}
          </div>

          {/* Avatar + actions row */}
          <div className="px-4 sm:px-8">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 -mt-12 sm:-mt-14 pb-4">
              {/* Avatar */}
              <div className="relative w-fit">
                <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-full ring-4 ring-white bg-gray-200 overflow-hidden shadow-md">
                  {profile.avatar ? (
                    <img
                      src={profile.avatar}
                      alt={profile.username}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-400 to-indigo-500 text-white text-3xl sm:text-4xl font-bold select-none">
                      {profile.username[0].toUpperCase()}
                    </div>
                  )}
                </div>
                {isOwnProfile && (
                  <button
                    onClick={() => setShowEditModal(true)}
                    className="absolute bottom-0.5 right-0.5 h-7 w-7 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center shadow transition"
                    title="Thay ảnh đại diện"
                  >
                    <Camera className="h-3.5 w-3.5 text-gray-700" />
                  </button>
                )}
              </div>

              {/* Action buttons */}
              <ActionButtons
                status={profile.friendship_status}
                isOwnProfile={isOwnProfile}
                loading={actionLoading}
                messageBusy={messageBusy}
                dropdownOpen={dropdownOpen}
                dropdownRef={dropdownRef}
                onEdit={() => setShowEditModal(true)}
                onSendRequest={handleSendRequest}
                onAccept={handleAccept}
                onReject={handleReject}
                onUnfriend={handleUnfriend}
                onMessage={handleMessage}
                onToggleDropdown={() => setDropdownOpen((v) => !v)}
                onCopyProfileLink={handleCopyProfileLink}
                onReportUser={handleReportUser}
                onBlockUser={handleBlockUser}
              />
            </div>

            {/* Name / bio / stats */}
            <div className="pb-1">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">
                {profile.username}
              </h1>
              {profile.bio && (
                <p className="mt-1.5 text-gray-600 text-sm max-w-xl leading-relaxed">
                  {profile.bio}
                </p>
              )}
              <div className="flex gap-5 mt-3">
                <StatItem count={profile.posts_count} label="bài viết" />
                <StatItem count={profile.friends_count} label="bạn bè" />
              </div>
            </div>

            {/* Tabs */}
            <div className="flex overflow-x-auto mt-2 border-t border-gray-100 -mx-4 sm:-mx-8 px-4 sm:px-8 scrollbar-none">
              {TAB_CONFIG.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                    activeTab === key
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab content ───────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-6">
        {/* Posts Tab */}
        {activeTab === TABS.POSTS && (
          <>
            {postsLoading ? (
              <div className="space-y-4">
                <PostCardSkeleton />
                <PostCardSkeleton />
                <PostCardSkeleton />
              </div>
            ) : postsError ? (
              <div className="bg-white rounded-2xl border border-red-100 text-red-600 text-sm p-4">
                <p className="font-medium">Không thể tải bài viết.</p>
              </div>
            ) : posts.length === 0 ? (
              <EmptyState
                icon={<FileText className="h-12 w-12" />}
                message="Chưa có bài viết nào"
              />
            ) : (
              <div className="space-y-4">
                {posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onLike={handleLike}
                    onBookmark={handleBookmark}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Photos Tab */}
        {activeTab === TABS.PHOTOS && (
          <>
            {postsLoading ? (
              <div className="grid grid-cols-3 gap-1 sm:gap-2">
                {[...Array(9)].map((_, i) => (
                  <div
                    key={i}
                    className="aspect-square bg-gray-200 rounded-lg animate-pulse"
                  />
                ))}
              </div>
            ) : allPhotos.length === 0 ? (
              <EmptyState
                icon={<Image className="h-12 w-12" />}
                message="Chưa có ảnh nào"
              />
            ) : (
              <div className="grid grid-cols-3 gap-1 sm:gap-2">
                {allPhotos.map((photo, idx) => (
                  <button
                    key={`${photo.postId}-${idx}`}
                    type="button"
                    onClick={() => handlePhotoClick(idx)}
                    className="aspect-square overflow-hidden rounded-lg bg-gray-100 hover:opacity-90 transition focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <img
                      src={photo.url}
                      alt={`Ảnh ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* Friends Tab */}
        {activeTab === TABS.FRIENDS && (
          <>
            {friendsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : friends.length === 0 ? (
              <EmptyState
                icon={<Users className="h-12 w-12" />}
                message="Chưa có bạn bè"
              />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                {friends.map((friend) => (
                  <FriendCard key={friend.id} friend={friend} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Edit modal ────────────────────────────────────────────────── */}
      {showEditModal && (
        <EditProfileModal
          profile={profile}
          onClose={() => setShowEditModal(false)}
          onSaved={() => {
            refetch();
            setShowEditModal(false);
          }}
        />
      )}

      {/* ── Photo Lightbox ────────────────────────────────────────────── */}
      {lightboxOpen && allPhotos.length > 0 && (
        <ImageViewer
          images={allPhotos.map((p) => p.url)}
          initialIndex={lightboxIndex}
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      {/* ── Toast Notification ────────────────────────────────────────── */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      <BottomNav />
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatItem({ count, label }) {
  return (
    <div className="text-sm">
      <span className="font-bold text-gray-900">{count ?? 0}</span>
      <span className="text-gray-500 ml-1">{label}</span>
    </div>
  );
}

function EmptyState({ icon, message }) {
  return (
    <div className="flex flex-col items-center justify-center bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-gray-300">
      <div className="mb-3">{icon}</div>
      <p className="font-medium text-gray-400">{message}</p>
    </div>
  );
}

function Toast({ type, message, onClose }) {
  const isSuccess = type === "success";

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border ${
          isSuccess
            ? "bg-green-50 border-green-200 text-green-800"
            : "bg-red-50 border-red-200 text-red-800"
        }`}
      >
        {isSuccess ? (
          <CheckCircle className="w-5 h-5 text-green-500" />
        ) : (
          <XCircle className="w-5 h-5 text-red-500" />
        )}
        <p className="text-sm font-medium">{message}</p>
        <button
          onClick={onClose}
          className="ml-2 text-gray-400 hover:text-gray-600"
        >
          <XCircle className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function ActionButtons({
  status,
  isOwnProfile,
  loading,
  messageBusy,
  onEdit,
  onSendRequest,
  onAccept,
  onReject,
  onMessage,
  dropdownOpen,
  dropdownRef,
  onToggleDropdown,
  onUnfriend,
  onCopyProfileLink,
  onReportUser,
  onBlockUser,
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const menuRef = useRef(null);
  const base =
    "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition";
  const primary = `${base} bg-blue-600 hover:bg-blue-700 text-white shadow-sm`;
  const secondary = `${base} bg-gray-100 hover:bg-gray-200 text-gray-800`;
  const messageButton = `${base} bg-blue-600 hover:bg-blue-700 text-white shadow-sm`;

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (isOwnProfile) {
    return (
      <button onClick={onEdit} className={secondary}>
        <Pencil className="h-4 w-4" />
        Chỉnh sửa profile
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/* None → Kết bạn */}
      {status === "none" && (
        <button onClick={onSendRequest} disabled={loading} className={primary}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          Kết bạn
        </button>
      )}

      {/* Sent → Huỷ lời mời */}
      {status === "sent" && (
        <button onClick={onReject} disabled={loading} className={secondary}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Clock className="h-4 w-4" />
          )}
          Huỷ lời mời
        </button>
      )}

      {/* Pending → Chấp nhận + Từ chối */}
      {status === "pending" && (
        <>
          <button onClick={onAccept} disabled={loading} className={primary}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Chấp nhận
          </button>
          <button onClick={onReject} disabled={loading} className={secondary}>
            Từ chối
          </button>
        </>
      )}

      {/* Accepted → Bạn bè + dropdown */}
      {status === "accepted" && (
        <>
          <button
            onClick={onMessage}
            disabled={messageBusy}
            className={messageButton}
          >
            {messageBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MessageCircle className="h-4 w-4" />
            )}
            Nhắn tin
          </button>
          <div className="relative" ref={dropdownRef}>
            <button onClick={onToggleDropdown} className={secondary}>
              <UserCheck className="h-4 w-4 text-green-600" />
              Bạn bè
              <ChevronDown
                className={`h-4 w-4 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
              />
            </button>
            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 bg-white shadow-xl rounded-xl py-1 min-w-[160px] border border-gray-100 z-20">
                <button
                  onClick={onUnfriend}
                  className="w-full flex items-center gap-2 text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition rounded-lg mx-auto"
                >
                  <UserMinus className="h-4 w-4" />
                  Huỷ kết bạn
                </button>
              </div>
            )}
          </div>
        </>
      )}

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setShowMenu((v) => !v)}
          className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200"
          type="button"
        >
          <MoreHorizontal className="w-5 h-5" />
        </button>
        {showMenu && (
          <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-100 py-1 min-w-[180px] z-20">
            <button
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2"
              onClick={() => {
                setShowMenu(false);
                onCopyProfileLink?.();
              }}
            >
              <Link2 className="w-4 h-4" /> Sao chép liên kết profile
            </button>
            <button
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 text-amber-600"
              onClick={() => {
                setShowMenu(false);
                setShowReportModal(true);
              }}
            >
              <Flag className="w-4 h-4" /> Báo cáo người dùng
            </button>
            <button
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600"
              onClick={() => {
                setShowMenu(false);
                onBlockUser?.();
              }}
            >
              <Ban className="w-4 h-4" /> Chặn người dùng
            </button>
          </div>
        )}
      </div>

      {showReportModal && (
        <ReportModal
          onClose={() => setShowReportModal(false)}
          onSubmit={async (payload) => {
            await onReportUser?.(payload);
            setShowReportModal(false);
          }}
        />
      )}
    </div>
  );
}

function ReportModal({ onClose, onSubmit }) {
  const [reason, setReason] = useState("spam");
  const [detail, setDetail] = useState("");
  const options = [
    { value: "spam", label: "Spam" },
    { value: "sensitive", label: "Nội dung phản cảm" },
    { value: "impersonation", label: "Giả mạo" },
    { value: "other", label: "Khác" },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <p className="font-semibold text-sm">Báo cáo người dùng</p>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          {options.map((item) => (
            <label key={item.value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="report-reason"
                value={item.value}
                checked={reason === item.value}
                onChange={(e) => setReason(e.target.value)}
              />
              {item.label}
            </label>
          ))}
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            rows={4}
            placeholder="Mô tả thêm (không bắt buộc)"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={onClose}
              className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-medium"
            >
              Huỷ
            </button>
            <button
              onClick={() => onSubmit?.({ reason, detail })}
              className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
            >
              Gửi báo cáo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
