import { useState, useRef } from "react";
import { X, Camera, Loader2 } from "lucide-react";
import { profileAPI } from "../../services/api";

/**
 * Modal for editing own profile: avatar, cover_photo, bio, date_of_birth.
 * @prop {object}   profile   — current user profile data
 * @prop {Function} onClose   — called when modal is dismissed
 * @prop {Function} onSaved   — called with updated profile after success
 */
export default function EditProfileModal({ profile, onClose, onSaved }) {
  const [bio, setBio] = useState(profile.bio || "");
  const [dob, setDob] = useState(profile.date_of_birth || "");
  const [avatarFile, setAvatarFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(profile.avatar || null);
  const [coverPreview, setCoverPreview] = useState(profile.cover_photo || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const avatarInputRef = useRef(null);
  const coverInputRef = useRef(null);

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleFileChange = (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    if (type === "avatar") {
      setAvatarFile(file);
      setAvatarPreview(previewUrl);
    } else {
      setCoverFile(file);
      setCoverPreview(previewUrl);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("bio", bio);
    if (dob) formData.append("date_of_birth", dob);
    if (avatarFile) formData.append("avatar", avatarFile);
    if (coverFile) formData.append("cover_photo", coverFile);

    try {
      const { data } = await profileAPI.updateProfile(formData);
      onSaved(data);
    } catch (err) {
      const detail = err.response?.data;
      if (typeof detail === "object") {
        const msg = Object.values(detail).flat().join(" ");
        setError(msg);
      } else {
        setError("Failed to save profile. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Chỉnh sửa profile</h2>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body — scrollable */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="p-6 space-y-6">
            {/* Cover photo */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Ảnh bìa
              </label>
              <div
                className="relative h-36 rounded-xl overflow-hidden bg-gradient-to-br from-blue-400 to-indigo-500 cursor-pointer group"
                onClick={() => coverInputRef.current?.click()}
              >
                {coverPreview && (
                  <img
                    src={coverPreview}
                    alt="Cover preview"
                    className="w-full h-full object-cover"
                  />
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition">
                  <div className="flex items-center gap-2 bg-black/50 text-white text-sm font-medium px-4 py-2 rounded-lg">
                    <Camera className="h-4 w-4" />
                    Thay đổi ảnh bìa
                  </div>
                </div>
              </div>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileChange(e, "cover")}
              />
            </div>

            {/* Avatar */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Ảnh đại diện
              </label>
              <div className="flex items-center gap-4">
                <div
                  className="relative h-20 w-20 rounded-full overflow-hidden bg-gradient-to-br from-blue-400 to-indigo-500 cursor-pointer flex-shrink-0 group"
                  onClick={() => avatarInputRef.current?.click()}
                >
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Avatar preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white text-2xl font-bold">
                      {profile.username[0].toUpperCase()}
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition rounded-full">
                    <Camera className="h-5 w-5 text-white" />
                  </div>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition"
                  >
                    Chọn ảnh mới
                  </button>
                  <p className="text-xs text-gray-400 mt-0.5">
                    JPG, PNG — tối đa 5 MB. Ảnh sẽ được resize về 400×400.
                  </p>
                </div>
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileChange(e, "avatar")}
              />
            </div>

            {/* Bio */}
            <div>
              <label
                htmlFor="bio"
                className="block text-sm font-semibold text-gray-700 mb-1.5"
              >
                Bio
              </label>
              <textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Giới thiệu về bản thân..."
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition"
              />
              <p className="text-right text-xs text-gray-400 mt-1">{bio.length}/500</p>
            </div>

            {/* Birthday */}
            <div>
              <label
                htmlFor="dob"
                className="block text-sm font-semibold text-gray-700 mb-1.5"
              >
                Ngày sinh
              </label>
              <input
                id="dob"
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang lưu...
                </>
              ) : (
                "Lưu thay đổi"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
