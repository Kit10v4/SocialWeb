import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Lock, Mail, XCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

function parseLockoutSeconds(message = "") {
  const match = message.match(/(\d+)\s*phút\s*(\d+)\s*giây/i);
  if (!match) return 0;
  const minutes = Number(match[1]) || 0;
  const seconds = Number(match[2]) || 0;
  return minutes * 60 + seconds;
}

export default function LoginForm() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  const validators = useMemo(
    () => ({
      email: (v) => {
        if (!v) return "Email is required.";
        if (!/\S+@\S+\.\S+/.test(v)) return "Invalid email format.";
        return "";
      },
      password: (v) => (!v ? "Password is required." : ""),
    }),
    []
  );

  useEffect(() => {
    if (lockoutSeconds <= 0) return undefined;
    const timer = setInterval(() => {
      setLockoutSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  const fieldStatus = (name) => {
    if (!touched[name]) return "idle";
    return errors[name] ? "error" : "success";
  };

  const validateAll = () => {
    const nextErrors = {
      email: validators.email(form.email),
      password: validators.password(form.password),
    };
    return Object.fromEntries(
      Object.entries(nextErrors).filter(([, value]) => Boolean(value))
    );
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (touched[name]) {
      const err = validators[name](value);
      setErrors((prev) => ({ ...prev, [name]: err, general: "" }));
    } else {
      setErrors((prev) => ({ ...prev, general: "" }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    const err = validators[name](value);
    setErrors((prev) => ({ ...prev, [name]: err }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const submitErrors = validateAll();
    setTouched({ email: true, password: true });
    if (Object.keys(submitErrors).length) {
      setErrors((prev) => ({ ...prev, ...submitErrors }));
      return;
    }

    setLoading(true);
    setErrors({});
    try {
      await login(form.email, form.password);
      navigate("/");
    } catch (err) {
      const data = err.response?.data;
      if (data?.non_field_errors) {
        const msg = data.non_field_errors[0];
        setErrors({ general: msg });
        setLockoutSeconds(parseLockoutSeconds(msg));
      } else if (typeof data === "object" && data !== null) {
        const fieldErrs = {};
        for (const [key, val] of Object.entries(data)) {
          fieldErrs[key] = Array.isArray(val) ? val[0] : val;
        }
        setErrors(fieldErrs);
      } else {
        setErrors({ general: "Something went wrong. Please try again." });
      }
    } finally {
      setLoading(false);
    }
  };

  const lockoutMinutes = Math.floor(lockoutSeconds / 60);
  const lockoutRemainSeconds = lockoutSeconds % 60;

  const inputClasses = (name) => {
    const status = fieldStatus(name);
    if (status === "error") {
      return "border-red-400 focus:ring-red-400";
    }
    if (status === "success") {
      return "border-green-400 focus:ring-green-400";
    }
    return "border-gray-300 dark:border-gray-600 focus:ring-blue-500";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-950 dark:to-gray-900 px-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="mx-auto mb-3 h-14 w-14 rounded-full bg-blue-600 text-white flex items-center justify-center text-2xl font-bold">
            S
          </div>
          <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400">SocialWeb</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Đăng nhập vào tài khoản của bạn</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {errors.general && (
            <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-lg px-4 py-3 flex gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p>{errors.general}</p>
                {lockoutSeconds > 0 && (
                  <p className="text-xs mt-1">
                    Còn lại: {lockoutMinutes} phút {lockoutRemainSeconds} giây
                  </p>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                onBlur={handleBlur}
                disabled={loading}
                placeholder="you@example.com"
                className={`w-full pl-10 pr-10 py-2.5 rounded-xl border text-sm outline-none transition bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${inputClasses("email")} focus:ring-2 focus:border-transparent`}
              />
              {fieldStatus("email") === "error" && (
                <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />
              )}
              {fieldStatus("email") === "success" && (
                <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
              )}
            </div>
            {touched.email && errors.email && (
              <p className="text-red-500 dark:text-red-400 text-xs mt-1">{errors.email}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={form.password}
                onChange={handleChange}
                onBlur={handleBlur}
                disabled={loading}
                placeholder="••••••••"
                className={`w-full pl-10 pr-20 py-2.5 rounded-xl border text-sm outline-none transition bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${inputClasses("password")} focus:ring-2 focus:border-transparent`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                disabled={loading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-blue-600 transition"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {touched.password && errors.password && (
              <p className="text-red-500 dark:text-red-400 text-xs mt-1">{errors.password}</p>
            )}
            <div className="flex justify-end mt-1">
              <Link
                to="/forgot-password"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Quên mật khẩu?
              </Link>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Đang đăng nhập...
              </>
            ) : (
              "Đăng nhập"
            )}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
          Chưa có tài khoản?{" "}
          <Link to="/register" className="text-blue-600 dark:text-blue-400 font-medium hover:underline">
            Đăng ký
          </Link>
        </p>
      </div>
    </div>
  );
}
