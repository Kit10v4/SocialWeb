import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  User,
  Shield,
  Palette,
  Eye,
  EyeOff,
  Sun,
  Moon,
  Loader2,
  AlertTriangle,
  X,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { authAPI } from "../services/api";
import { useToast } from "../components/shared/Toast";

// Mask email: abc***@gmail.com
function maskEmail(email) {
  if (!email) return "";
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const visible = local.slice(0, 3);
  return `${visible}***@${domain}`;
}

// Password strength checker
function getPasswordStrength(password) {
  if (!password) return { level: 0, label: "", color: "" };

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { level: 1, label: "Yếu", color: "bg-red-500" };
  if (score <= 4)
    return { level: 2, label: "Trung bình", color: "bg-yellow-500" };
  return { level: 3, label: "Mạnh", color: "bg-green-500" };
}

export default function SettingsPage() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [activeSection, setActiveSection] = useState("account");
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Account section state
  const [emailForm, setEmailForm] = useState({ new_email: "", password: "" });
  const [emailLoading, setEmailLoading] = useState(false);

  // Security section state
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  // Appearance section state
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "light",
  );
  const [language, setLanguage] = useState("vi");

  // Delete account state
  const [deleteForm, setDeleteForm] = useState({ username: "", password: "" });
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Apply theme
  useEffect(() => {
    localStorage.setItem("theme", theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  const passwordStrength = getPasswordStrength(passwordForm.new_password);

  // Handle email change
  const handleEmailChange = async (e) => {
    e.preventDefault();
    if (!emailForm.new_email || !emailForm.password) {
      showToast("error", "Vui lòng điền đầy đủ các trường");
      return;
    }

    setEmailLoading(true);
    try {
      const { data } = await authAPI.changeEmail(emailForm);
      updateUser({ email: data.email });
      setEmailForm({ new_email: "", password: "" });
      showToast("success", "Đã cập nhật email thành công");
    } catch (err) {
      const message = err.response?.data?.detail || "Không thể đổi email";
      showToast("error", message);
    } finally {
      setEmailLoading(false);
    }
  };

  // Handle password change
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    const { current_password, new_password, confirm_password } = passwordForm;

    if (!current_password || !new_password || !confirm_password) {
      showToast("error", "Vui lòng điền đầy đủ các trường");
      return;
    }

    if (new_password !== confirm_password) {
      showToast("error", "Mật khẩu mới không khớp");
      return;
    }

    setPasswordLoading(true);
    try {
      await authAPI.changePassword(passwordForm);
      setPasswordForm({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
      showToast("success", "Đổi mật khẩu thành công");
    } catch (err) {
      const message = err.response?.data?.detail || "Không thể đổi mật khẩu";
      showToast("error", message);
    } finally {
      setPasswordLoading(false);
    }
  };

  // Handle delete account
  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    if (deleteForm.username !== user?.username) {
      showToast("error", "Username không khớp");
      return;
    }

    setDeleteLoading(true);
    try {
      await authAPI.deleteAccount({ password: deleteForm.password });
      // Don't call logout() API — user is already deleted on server
      // Server already cleared cookies in the 204 response
      showToast("success", "Tài khoản đã được xoá");
      // Clear client-side auth state without calling API
      window.location.href = "/login";
    } catch (err) {
      const message = err.response?.data?.detail || "Không thể xoá tài khoản";
      showToast("error", message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const menuItems = [
    { id: "account", label: "Tài khoản", icon: User },
    { id: "security", label: "Bảo mật", icon: Shield },
    { id: "appearance", label: "Giao diện", icon: Palette },
  ];

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link
            to="/"
            className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </Link>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            Cài đặt
          </h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Left sidebar - menu */}
          <nav className="md:w-64 shrink-0">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
              {menuItems.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveSection(id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition ${
                    activeSection === id
                      ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </nav>

          {/* Right content */}
          <div className="flex-1">
            {/* Account Section */}
            {activeSection === "account" && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-6">
                  Thông tin tài khoản
                </h2>

                {/* Current email */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email hiện tại
                  </label>
                  <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded-lg">
                    {maskEmail(user?.email)}
                  </div>
                </div>

                {/* Change email form */}
                <form onSubmit={handleEmailChange}>
                  <h3 className="text-sm font-medium text-gray-800 dark:text-gray-100 mb-3">
                    Đổi email
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                        Email mới
                      </label>
                      <input
                        type="email"
                        value={emailForm.new_email}
                        onChange={(e) =>
                          setEmailForm({
                            ...emailForm,
                            new_email: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        placeholder="example@email.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                        Xác nhận mật khẩu
                      </label>
                      <input
                        type="password"
                        value={emailForm.password}
                        onChange={(e) =>
                          setEmailForm({
                            ...emailForm,
                            password: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        placeholder="Nhập mật khẩu hiện tại"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={emailLoading}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition flex items-center gap-2"
                    >
                      {emailLoading && (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      )}
                      Lưu thay đổi
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Security Section */}
            {activeSection === "security" && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-6">
                  Bảo mật
                </h2>

                <form onSubmit={handlePasswordChange}>
                  <h3 className="text-sm font-medium text-gray-800 dark:text-gray-100 mb-3">
                    Đổi mật khẩu
                  </h3>
                  <div className="space-y-4">
                    {/* Current password */}
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                        Mật khẩu hiện tại
                      </label>
                      <div className="relative">
                        <input
                          type={showPasswords.current ? "text" : "password"}
                          value={passwordForm.current_password}
                          onChange={(e) =>
                            setPasswordForm({
                              ...passwordForm,
                              current_password: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 pr-10 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                          placeholder="Nhập mật khẩu hiện tại"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowPasswords({
                              ...showPasswords,
                              current: !showPasswords.current,
                            })
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          {showPasswords.current ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* New password */}
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                        Mật khẩu mới
                      </label>
                      <div className="relative">
                        <input
                          type={showPasswords.new ? "text" : "password"}
                          value={passwordForm.new_password}
                          onChange={(e) =>
                            setPasswordForm({
                              ...passwordForm,
                              new_password: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 pr-10 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                          placeholder="Nhập mật khẩu mới"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowPasswords({
                              ...showPasswords,
                              new: !showPasswords.new,
                            })
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          {showPasswords.new ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      {/* Password strength indicator */}
                      {passwordForm.new_password && (
                        <div className="mt-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all ${passwordStrength.color}`}
                                style={{
                                  width: `${(passwordStrength.level / 3) * 100}%`,
                                }}
                              />
                            </div>
                            <span
                              className={`text-xs font-medium ${
                                passwordStrength.level === 1
                                  ? "text-red-500"
                                  : passwordStrength.level === 2
                                    ? "text-yellow-500"
                                    : "text-green-500"
                              }`}
                            >
                              {passwordStrength.label}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Confirm password */}
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                        Xác nhận mật khẩu mới
                      </label>
                      <div className="relative">
                        <input
                          type={showPasswords.confirm ? "text" : "password"}
                          value={passwordForm.confirm_password}
                          onChange={(e) =>
                            setPasswordForm({
                              ...passwordForm,
                              confirm_password: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 pr-10 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                          placeholder="Nhập lại mật khẩu mới"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowPasswords({
                              ...showPasswords,
                              confirm: !showPasswords.confirm,
                            })
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          {showPasswords.confirm ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      {passwordForm.confirm_password &&
                        passwordForm.new_password !==
                          passwordForm.confirm_password && (
                          <p className="text-xs text-red-500 mt-1">
                            Mật khẩu không khớp
                          </p>
                        )}
                    </div>

                    <button
                      type="submit"
                      disabled={passwordLoading}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition flex items-center gap-2"
                    >
                      {passwordLoading && (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      )}
                      Đổi mật khẩu
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Appearance Section */}
            {activeSection === "appearance" && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-6">
                  Giao diện
                </h2>

                {/* Theme toggle */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Chế độ hiển thị
                  </label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setTheme("light")}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition ${
                        theme === "light"
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                          : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500"
                      }`}
                    >
                      <Sun className="w-5 h-5" />
                      <span className="text-sm font-medium">Sáng</span>
                    </button>
                    <button
                      onClick={() => setTheme("dark")}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition ${
                        theme === "dark"
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                          : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500"
                      }`}
                    >
                      <Moon className="w-5 h-5" />
                      <span className="text-sm font-medium">Tối</span>
                    </button>
                  </div>
                </div>

                {/* Language selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Ngôn ngữ
                  </label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setLanguage("vi")}
                      className={`flex-1 px-4 py-3 rounded-lg border-2 text-sm font-medium transition ${
                        language === "vi"
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                          : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500"
                      }`}
                    >
                      Tiếng Việt
                    </button>
                    <button
                      onClick={() => setLanguage("en")}
                      className={`flex-1 px-4 py-3 rounded-lg border-2 text-sm font-medium transition ${
                        language === "en"
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                          : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500"
                      }`}
                    >
                      English
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                    Tính năng đổi ngôn ngữ sẽ sớm được cập nhật
                  </p>
                </div>
              </div>
            )}

            {/* Delete Account Section - Always visible at bottom */}
            <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-red-100 dark:border-red-900/50 p-6">
              <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">
                Xoá tài khoản
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Sau khi xoá, tất cả dữ liệu của bạn sẽ bị xoá vĩnh viễn và không
                thể khôi phục.
              </p>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition"
              >
                Xoá tài khoản
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-semibold">Xác nhận xoá tài khoản</h3>
              </div>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Hành động này không thể hoàn tác. Toàn bộ bài viết, tin nhắn và dữ
              liệu của bạn sẽ bị xoá vĩnh viễn.
            </p>

            <form onSubmit={handleDeleteAccount}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Nhập <span className="font-semibold">{user?.username}</span>{" "}
                    để xác nhận
                  </label>
                  <input
                    type="text"
                    value={deleteForm.username}
                    onChange={(e) =>
                      setDeleteForm({ ...deleteForm, username: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                    placeholder="Nhập username"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Mật khẩu
                  </label>
                  <input
                    type="password"
                    value={deleteForm.password}
                    onChange={(e) =>
                      setDeleteForm({ ...deleteForm, password: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                    placeholder="Nhập mật khẩu"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                  >
                    Huỷ
                  </button>
                  <button
                    type="submit"
                    disabled={
                      deleteLoading ||
                      deleteForm.username !== user?.username ||
                      !deleteForm.password
                    }
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition flex items-center justify-center gap-2"
                  >
                    {deleteLoading && (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    )}
                    Xoá tài khoản
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
