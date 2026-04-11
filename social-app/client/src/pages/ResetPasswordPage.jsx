import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authAPI } from "../services/api";

function getPasswordStrength(password) {
  if (!password) return { score: 0, label: "", color: "bg-gray-200" };
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const map = {
    0: { label: "", color: "bg-gray-200" },
    1: { label: "Rất yếu", color: "bg-red-500" },
    2: { label: "Yếu", color: "bg-orange-500" },
    3: { label: "Khá mạnh", color: "bg-yellow-500" },
    4: { label: "Mạnh", color: "bg-green-500" },
    5: { label: "Rất mạnh", color: "bg-green-600" },
  };
  return { score, ...map[score] };
}

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => (searchParams.get("token") || "").trim(), [searchParams]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const strength = getPasswordStrength(newPassword);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");
    try {
      const { data } = await authAPI.resetPassword({
        token,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setMessage(data?.detail || "Mật khẩu đã được đặt lại.");
    } catch (err) {
      setError(err.response?.data?.detail || "Không thể đặt lại mật khẩu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-md p-8 space-y-4">
        <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">Đặt lại mật khẩu</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mật khẩu mới"
                required
                className="w-full px-4 py-2.5 pr-20 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-blue-600"
              >
                {showNew ? "Ẩn" : "Hiện"}
              </button>
            </div>
            {newPassword && (
              <div className="space-y-1">
                <div className="w-full h-2 rounded bg-gray-200 overflow-hidden">
                  <div
                    className={`h-2 ${strength.color}`}
                    style={{ width: `${(strength.score / 5) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300">{strength.label}</p>
              </div>
            )}
          </div>

          <div className="relative">
            <input
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Xác nhận mật khẩu"
              required
              className="w-full px-4 py-2.5 pr-20 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-blue-600"
            >
              {showConfirm ? "Ẩn" : "Hiện"}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading || !token}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50"
          >
            {loading ? "Đang xử lý..." : "Đặt lại mật khẩu"}
          </button>
        </form>

        {message && (
          <div className="space-y-2">
            <p className="text-green-600 dark:text-green-400 text-sm">{message}</p>
            <Link to="/login" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">
              Đăng nhập
            </Link>
          </div>
        )}

        {error && (
          <div className="space-y-2">
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            <Link to="/forgot-password" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">
              Yêu cầu link mới
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
