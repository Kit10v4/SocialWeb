import { useState, useRef, useCallback } from "react";
import { X, Image, Globe, Users, Lock, ChevronDown, Loader2 } from "lucide-react";
import { postAPI } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

const MAX_CHARS = 5000;
const MAX_IMAGES = 10;

const PRIVACY_OPTIONS = [
  { value: "public", label: "Công khai", icon: Globe },
  { value: "friends", label: "Bạn bè", icon: Users },
  { value: "private", label: "Chỉ mình tôi", icon: Lock },
];

/**
 * Modal for creating a new post.
 * @prop {Function} onClose   — called when the modal is dismissed
 * @prop {Function} onCreated — called with the new post object after successful creation
 */
export default function CreatePostModal({ onClose, onCreated }) {
  const { user } = useAuth();

  const [content, setContent] = useState("");
  const [privacy, setPrivacy] = useState("public");
  const [showPrivacyMenu, setShowPrivacyMenu] = useState(false);
  const [images, setImages] = useState([]); // [{ file, preview }]
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const selectedPrivacy = PRIVACY_OPTIONS.find((o) => o.value === privacy);

  // ── Auto-resize textarea ───────────────────────────────────────────────
  const handleContentChange = (e) => {
    setContent(e.target.value);
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = `${ta.scrollHeight}px`;
    }
  };

  // ── Image handling ─────────────────────────────────────────────────────
  const handleImageSelect = useCallback((e) => {
    const files = Array.from(e.target.files || []);
    setImages((prev) => {
      const remaining = MAX_IMAGES - prev.length;
      const toAdd = files.slice(0, remaining).map((file) => ({
        file,
        preview: URL.createObjectURL(file),
      }));
      return [...prev, ...toAdd];
    });
    // reset input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const removeImage = useCallback((index) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  // ── Submit ─────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!content.trim() && images.length === 0) return;

    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("content", content.trim());
    formData.append("privacy", privacy);
    images.forEach(({ file }) => formData.append("images", file));

    try {
      const { data } = await postAPI.create(formData);
      images.forEach(({ preview }) => URL.revokeObjectURL(preview));
      onCreated(data);
    } catch (err) {
      const detail = err.response?.data;
      if (typeof detail === "object") {
        setError(Object.values(detail).flat().join(" "));
      } else {
        setError("Đăng bài thất bại. Vui lòng thử lại.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const canPost = (content.trim().length > 0 || images.length > 0) && !isLoading;
  const charsLeft = MAX_CHARS - content.length;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Tạo bài viết</h2>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {/* Author + privacy */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full overflow-hidden bg-gradient-to-br from-blue-400 to-indigo-500 flex-shrink-0">
              {user?.avatar ? (
                <img src={user.avatar} alt={user.username} className="w-full h-full object-cover" />
              ) : (
                <span className="w-full h-full flex items-center justify-center text-white font-bold">
                  {user?.username?.[0]?.toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">{user?.username}</p>
              {/* Privacy dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowPrivacyMenu((v) => !v)}
                  className="flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-md text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition"
                >
                  {selectedPrivacy && <selectedPrivacy.icon className="h-3 w-3" />}
                  {selectedPrivacy?.label}
                  <ChevronDown className="h-3 w-3" />
                </button>
                {showPrivacyMenu && (
                  <div className="absolute top-full left-0 mt-1 z-10 bg-white rounded-xl shadow-lg border border-gray-100 py-1 w-40">
                    {PRIVACY_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => { setPrivacy(opt.value); setShowPrivacyMenu(false); }}
                          className={`w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50 transition ${privacy === opt.value ? "text-blue-600 font-semibold" : "text-gray-700"}`}
                        >
                          <Icon className="h-4 w-4" />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            maxLength={MAX_CHARS}
            placeholder="Bạn đang nghĩ gì?"
            rows={3}
            className="w-full text-gray-800 text-base placeholder-gray-400 focus:outline-none resize-none overflow-hidden"
          />

          {/* Character counter */}
          <div className="flex justify-end">
            <span className={`text-xs font-medium ${charsLeft < 100 ? "text-orange-500" : "text-gray-400"}`}>
              {charsLeft.toLocaleString()}
            </span>
          </div>

          {/* Image preview grid */}
          {images.length > 0 && (
            <div className={`grid gap-2 ${images.length === 1 ? "grid-cols-1" : images.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
              {images.map((img, i) => (
                <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                  <img
                    src={img.preview}
                    alt={`Ảnh ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 h-6 w-6 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition"
                    aria-label="Xoá ảnh"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 space-y-3">
          {/* Add photo button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={images.length >= MAX_IMAGES}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-gray-300 text-sm text-gray-500 hover:bg-gray-100 hover:border-gray-400 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Image className="h-5 w-5" />
            {images.length >= MAX_IMAGES ? `Đã đạt tối đa ${MAX_IMAGES} ảnh` : "Thêm ảnh"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImageSelect}
          />

          {/* Post button */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canPost}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang đăng...
              </>
            ) : (
              "Đăng"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
