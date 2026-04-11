import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { authAPI } from "../services/api";

export default function VerifyEmailPage() {
  const { setAuthenticatedUser } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = useMemo(() => (searchParams.get("token") || "").trim(), [searchParams]);

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState("Đang xác minh...");
  const [emailForResend, setEmailForResend] = useState("");
  const [resendMsg, setResendMsg] = useState("");
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setSuccess(false);
      setMessage("Token xác minh bị thiếu.");
      return;
    }

    authAPI
      .verifyEmail(token)
      .then((res) => {
        const data = res.data || {};
        if (data.user) {
          setAuthenticatedUser(data.user);
        }
        setSuccess(true);
        setMessage(data.detail || "✓ Email đã được xác minh!");
        setTimeout(() => navigate("/"), 900);
      })
      .catch((err) => {
        setSuccess(false);
        setMessage(
          err.response?.data?.detail || "Link không hợp lệ hoặc đã hết hạn."
        );
      })
      .finally(() => setLoading(false));
  }, [navigate, setAuthenticatedUser, token]);

  const handleResend = async (e) => {
    e.preventDefault();
    if (!emailForResend.trim()) return;
    setResending(true);
    setResendMsg("");
    try {
      const { data } = await authAPI.resendVerification({ email: emailForResend.trim() });
      setResendMsg(data?.detail || "Đã gửi lại email xác minh.");
    } catch (err) {
      setResendMsg(err.response?.data?.detail || "Không thể gửi lại email xác minh.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-md p-8 space-y-4">
        <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">Xác minh email</h1>
        {loading ? (
          <p className="text-gray-600 dark:text-gray-300">{message}</p>
        ) : (
          <>
            <p className={success ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
              {message}
            </p>
            {success ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Đang chuyển hướng...</p>
            ) : (
              <form onSubmit={handleResend} className="space-y-3">
                <input
                  type="email"
                  value={emailForResend}
                  onChange={(e) => setEmailForResend(e.target.value)}
                  placeholder="Nhập email để gửi lại link"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                />
                <button
                  type="submit"
                  disabled={resending}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50"
                >
                  {resending ? "Đang gửi..." : "Gửi lại"}
                </button>
                {resendMsg && (
                  <p className="text-sm text-gray-600 dark:text-gray-300">{resendMsg}</p>
                )}
              </form>
            )}
          </>
        )}
        <Link to="/login" className="inline-block text-blue-600 dark:text-blue-400 hover:underline text-sm">
          Đến trang đăng nhập
        </Link>
      </div>
    </div>
  );
}
