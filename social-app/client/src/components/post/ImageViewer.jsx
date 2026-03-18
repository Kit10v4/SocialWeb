import { useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Full-screen lightbox for viewing post images.
 * @prop {string[]} images       — array of image URLs
 * @prop {number}  currentIndex  — index of the currently-displayed image
 * @prop {Function} onClose      — called when the viewer should close
 * @prop {Function} onNavigate   — called with new index when user navigates
 */
export default function ImageViewer({ images, currentIndex, onClose, onNavigate }) {
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < images.length - 1;

  const handlePrev = useCallback(() => {
    if (hasPrev) onNavigate(currentIndex - 1);
  }, [hasPrev, currentIndex, onNavigate]);

  const handleNext = useCallback(() => {
    if (hasNext) onNavigate(currentIndex + 1);
  }, [hasNext, currentIndex, onNavigate]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, handlePrev, handleNext]);

  if (!images?.length) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 h-10 w-10 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition"
        aria-label="Đóng"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Counter */}
      {images.length > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full bg-black/50 text-white text-sm font-medium">
          {currentIndex + 1} / {images.length}
        </div>
      )}

      {/* Prev button */}
      {hasPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); handlePrev(); }}
          className="absolute left-4 z-10 h-12 w-12 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition"
          aria-label="Ảnh trước"
        >
          <ChevronLeft className="h-7 w-7" />
        </button>
      )}

      {/* Next button */}
      {hasNext && (
        <button
          onClick={(e) => { e.stopPropagation(); handleNext(); }}
          className="absolute right-4 z-10 h-12 w-12 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition"
          aria-label="Ảnh tiếp theo"
        >
          <ChevronRight className="h-7 w-7" />
        </button>
      )}

      {/* Image */}
      <img
        src={images[currentIndex]}
        alt={`Ảnh ${currentIndex + 1}`}
        className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
