import { useState } from "react";
import { Link } from "react-router-dom";
import { authAPI } from "../services/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const startCooldown = () => {
    setCooldown(60);
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const { data } = await authAPI.forgotPassword({ email });
      setMessage(data?.detail || "Kiểm tra hộp thư của bạn.");
      startCooldown();
    } catch (err) {
      setError(err.response?.data?.detail || "Không thể gửi yêu cầu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-md p-8 space-y-4">
        <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">Quên mật khẩu</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
          />
          <button
            type="submit"
            disabled={loading || cooldown > 0}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50"
          >
            {loading
              ? "Đang gửi..."
              : cooldown > 0
                ? `Gửi lại sau ${cooldown}s`
                : "Gửi link đặt lại"}
          </button>
        </form>
        {message && <p className="text-green-600 dark:text-green-400 text-sm">{message}</p>}
        {error && <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>}
        <Link to="/login" className="inline-block text-blue-600 dark:text-blue-400 hover:underline text-sm">
          ← Đăng nhập
        </Link>
      </div>
    </div>
  );
}
