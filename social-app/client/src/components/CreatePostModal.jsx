import { useEffect, useRef, useState } from "react";

/**
 * CreatePostModal
 * UI-only modal for creating a post.
 *
 * Props:
 *  - isOpen: boolean
 *  - onClose: () => void
 *  - onSubmit: ({ content, images, privacy }) => Promise<void> | void
 *  - isSubmitting?: boolean
 *  - maxLength?: number
 *  - initialImages?: File[]
 */
export default function CreatePostModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
  maxLength = 1000,
  initialImages = [],
}) {
  const [content, setContent] = useState("");
  const [privacy, setPrivacy] = useState("Public");
  const [images, setImages] = useState([]); // File[]
  const [previews, setPreviews] = useState([]); // string[]
  const [error, setError] = useState("");

  const textareaRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      setContent("");
      setPrivacy("Public");
      setImages([]);
      setPreviews([]);
      setError("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (!Array.isArray(initialImages) || initialImages.length === 0) return;

    const newPreviews = initialImages.map((file) => URL.createObjectURL(file));
    setImages(initialImages);
    setPreviews((prev) => {
      prev.forEach((url) => URL.revokeObjectURL(url));
      return newPreviews;
    });
    setError("");
  }, [initialImages, isOpen]);

  useEffect(() => {
    // Auto-resize textarea
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [content]);

  useEffect(() => {
    // Cleanup object URLs when component unmounts
    return () => {
      previews.forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilesChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const newPreviews = files.map((file) => URL.createObjectURL(file));
    setImages((prev) => [...prev, ...files]);
    setPreviews((prev) => [...prev, ...newPreviews]);
    setError("");
  };

  const handleRemoveImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed);
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!onSubmit) return;

    if (!content.trim() && images.length === 0) {
      setError("Vui lòng nhập nội dung hoặc thêm ảnh.");
      return;
    }

    setError("");
    try {
      await onSubmit({ content: content.trim(), images, privacy });
    } catch (err) {
      const message = err?.response?.data?.detail || err?.message || "Đã xảy ra lỗi khi đăng bài.";
      setError(message);
    }
  };

  if (!isOpen) return null;

  const charsUsed = content.length;
  const isDisabled = (!content.trim() && images.length === 0) || isSubmitting;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose?.();
      }}
    >
      <div className="w-full h-full sm:h-auto sm:max-w-xl sm:max-h-[90vh] rounded-none sm:rounded-2xl bg-white dark:bg-gray-800 shadow-xl p-4 sm:p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold dark:text-gray-100">Tạo bài viết</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 disabled:opacity-50"
          >
            <span className="sr-only">Đóng</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Privacy selector */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700" />
              <div>
                <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded mb-1" />
                <select
                  value={privacy}
                  onChange={(e) => setPrivacy(e.target.value)}
                  className="text-xs px-2 py-1 rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Public">Công khai</option>
                  <option value="Friends">Bạn bè</option>
                  <option value="Only me">Chỉ mình tôi</option>
                </select>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Bạn đang nghĩ gì?"
              maxLength={maxLength}
              rows={3}
              className="w-full resize-none border-none outline-none text-sm sm:text-base placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-transparent dark:text-gray-100"
            />
            <div className="absolute bottom-0 right-0 text-xs text-gray-400 dark:text-gray-500">
              {charsUsed}/{maxLength}
            </div>
          </div>

          {/* Image previews */}
          {previews.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 rounded-lg border border-gray-200 dark:border-gray-700 p-2">
              {previews.map((url, idx) => (
                <div key={idx} className="relative group aspect-square overflow-hidden rounded-md bg-gray-100 dark:bg-gray-700">
                  <img
                    src={url}
                    alt={`preview-${idx}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(idx)}
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-900/50 rounded-md px-2 py-1.5">
              {error}
            </p>
          )}

          <div className="border-t border-gray-200 dark:border-gray-700 pt-3 flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-sm cursor-pointer">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                className="w-5 h-5 text-green-500 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0L16.5 16.5m0 0l2.591-2.591a2.25 2.25 0 013.182 0l.977.977M16.5 16.5L14.25 18.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="hidden sm:inline dark:text-gray-200">Ảnh</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFilesChange}
              />
            </label>

            <button
              type="submit"
              disabled={isDisabled}
              className="ml-auto px-4 py-1.5 rounded-full text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-transform active:scale-95"
            >
              {isSubmitting ? "Đang đăng..." : "Đăng"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function CreatePostModalSkeleton() {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 dark:bg-black/60">
      <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-gray-800 shadow-xl p-4 sm:p-6 animate-pulse space-y-4">
        <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
        <div className="h-20 bg-gray-100 dark:bg-gray-700 rounded" />
        <div className="h-10 bg-gray-100 dark:bg-gray-700 rounded" />
      </div>
    </div>
  );
}
