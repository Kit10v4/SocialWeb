import { useEffect, useState } from "react";

/**
 * ImageViewer (Lightbox)
 *
 * Props:
 *  - images: string[] | { url: string }[]
 *  - initialIndex?: number
 *  - isOpen: boolean
 *  - onClose: () => void
 */
export default function ImageViewer({ images = [], initialIndex = 0, isOpen, onClose }) {
  const [index, setIndex] = useState(initialIndex);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIndex(initialIndex);
      setLoaded(false);
    }
  }, [isOpen, initialIndex]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === "Escape") onClose?.();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  if (!isOpen || !images.length) return null;

  const normalized = images.map((img) => (typeof img === "string" ? img : img.url));
  const src = normalized[index];

  const goNext = () => {
    setLoaded(false);
    setIndex((i) => (i + 1) % normalized.length);
  };

  const goPrev = () => {
    setLoaded(false);
    setIndex((i) => (i - 1 + normalized.length) % normalized.length);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10"
      >
        <span className="sr-only">Đóng</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Navigation */}
      {normalized.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            className="absolute left-3 sm:left-6 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="w-7 h-7"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            className="absolute right-3 sm:right-6 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="w-7 h-7"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </>
      )}

      <div className="max-w-5xl w-full px-4 flex flex-col items-center">
        <div className="relative w-full max-h-[80vh] flex items-center justify-center">
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            </div>
          )}
          <img
            src={src}
            alt="preview"
            onLoad={() => setLoaded(true)}
            className={`max-h-[80vh] w-auto max-w-full object-contain transition-opacity duration-200 ${
              loaded ? "opacity-100" : "opacity-0"
            }`}
          />
        </div>
        {normalized.length > 1 && (
          <p className="mt-3 text-xs text-white/80">
            {index + 1} / {normalized.length}
          </p>
        )}
      </div>
    </div>
  );
}

export function ImageViewerSkeleton() {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
      <div className="w-40 h-40 rounded-xl bg-white/10 animate-pulse" />
    </div>
  );
}
