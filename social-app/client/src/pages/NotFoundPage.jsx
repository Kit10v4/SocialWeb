import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-6">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 text-center max-w-sm w-full">
        <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">404</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Trang bạn tìm không tồn tại.</p>
        <Link
          to="/"
          className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
        >
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}
