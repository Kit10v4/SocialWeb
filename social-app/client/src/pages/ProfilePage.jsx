import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
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
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useProfile } from "../hooks/useProfile";
import { useFriend } from "../hooks/useFriend";
import { friendsAPI } from "../services/api";
import EditProfileModal from "../components/profile/EditProfileModal";
import FriendCard from "../components/profile/FriendCard";

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
  const { user } = useAuth();
  const { profile, isLoading, error, refetch, updateFriendshipStatus } =
    useProfile(username);
  const { actionLoading, sendRequest, accept, reject, unfriend } = useFriend();

  const [activeTab, setActiveTab] = useState(TABS.POSTS);
  const [showEditModal, setShowEditModal] = useState(false);
  const [friends, setFriends] = useState([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const isOwnProfile = user?.username === username;

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

  // ── Friendship action handlers ─────────────────────────────────────────
  const handleSendRequest = async () => {
    try {
      await sendRequest(profile.id);
      updateFriendshipStatus("sent");
    } catch {}
  };
  const handleAccept = async () => {
    try {
      await accept(profile.id);
      updateFriendshipStatus("accepted");
    } catch {}
  };
  const handleReject = async () => {
    try {
      await reject(profile.id);
      updateFriendshipStatus("none");
    } catch {}
  };
  const handleUnfriend = async () => {
    try {
      await unfriend(profile.id);
      updateFriendshipStatus("none");
      setDropdownOpen(false);
    } catch {}
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
    <div className="min-h-screen bg-gray-100">
      {/* ── Profile card ──────────────────────────────────────────────── */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto">

          {/* Cover photo */}
          <div className="relative h-48 sm:h-60 md:h-72 bg-gradient-to-br from-blue-400 to-indigo-600 overflow-hidden">
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
                dropdownOpen={dropdownOpen}
                dropdownRef={dropdownRef}
                onEdit={() => setShowEditModal(true)}
                onSendRequest={handleSendRequest}
                onAccept={handleAccept}
                onReject={handleReject}
                onUnfriend={handleUnfriend}
                onToggleDropdown={() => setDropdownOpen((v) => !v)}
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
        {activeTab === TABS.POSTS && (
          <EmptyState
            icon={<FileText className="h-12 w-12" />}
            message="Chưa có bài viết nào"
          />
        )}

        {activeTab === TABS.PHOTOS && (
          <EmptyState
            icon={<Image className="h-12 w-12" />}
            message="Chưa có ảnh nào"
          />
        )}

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

function ActionButtons({
  status,
  isOwnProfile,
  loading,
  onEdit,
  onSendRequest,
  onAccept,
  onReject,
  dropdownOpen,
  dropdownRef,
  onToggleDropdown,
  onUnfriend,
}) {
  const base =
    "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition";
  const primary = `${base} bg-blue-600 hover:bg-blue-700 text-white shadow-sm`;
  const secondary = `${base} bg-gray-100 hover:bg-gray-200 text-gray-800`;

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
      )}
    </div>
  );
}
