import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function PageHeader({ title, showBack = true, rightContent }) {
  const navigate = useNavigate();

  return (
    <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700 z-40 safe-top">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {showBack && (
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <span className="font-semibold text-base text-gray-900 dark:text-gray-100">{title}</span>
        </div>
        {rightContent}
      </div>
    </div>
  );
}
