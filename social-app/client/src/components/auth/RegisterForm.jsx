import { useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
  XCircle,
} from "lucide-react";
import ReCAPTCHA from "react-google-recaptcha";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { authAPI } from "../../services/api";

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || "";

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

export default function RegisterForm() {
  const { register } = useAuth();
  const recaptchaRef = useRef(null);
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    password_confirm: "",
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState("");
  const [recaptchaError, setRecaptchaError] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [verifyPending, setVerifyPending] = useState(null);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  const strength = getPasswordStrength(form.password);

  const validators = useMemo(
    () => ({
      username: (v) => (!v.trim() ? "Username is required." : ""),
      email: (v) => {
        if (!v) return "Email is required.";
        if (!/\S+@\S+\.\S+/.test(v)) return "Invalid email format.";
        return "";
      },
      password: (v) => {
        if (!v) return "Password is required.";
        if (v.length < 8) return "Password must be at least 8 characters.";
        return "";
      },
      password_confirm: (v, currentForm) =>
        v !== currentForm.password ? "Passwords do not match." : "",
      terms: (_, __, accepted) =>
        accepted ? "" : "Bạn phải đồng ý với điều khoản để tiếp tục.",
    }),
    []
  );

  const fieldStatus = (name) => {
    if (!touched[name]) return "idle";
    return errors[name] ? "error" : "success";
  };

  const inputClasses = (name) => {
    const status = fieldStatus(name);
    if (status === "error") return "border-red-400 focus:ring-red-400";
    if (status === "success") return "border-green-400 focus:ring-green-400";
    return "border-gray-300 dark:border-gray-600 focus:ring-blue-500";
  };

  const validateAll = () => {
    const nextErrors = {
      username: validators.username(form.username),
      email: validators.email(form.email),
      password: validators.password(form.password),
      password_confirm: validators.password_confirm(form.password_confirm, form),
      terms: validators.terms("", form, termsAccepted),
    };
    return Object.fromEntries(
      Object.entries(nextErrors).filter(([, value]) => Boolean(value))
    );
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const nextForm = { ...form, [name]: value };
    setForm(nextForm);
    if (touched[name]) {
      const err =
        name === "password_confirm"
          ? validators.password_confirm(value, nextForm)
          : validators[name](value, nextForm, termsAccepted);
      setErrors((prev) => ({ ...prev, [name]: err, general: "" }));
    } else {
      setErrors((prev) => ({ ...prev, general: "" }));
    }

    if (name === "password" && touched.password_confirm) {
      setErrors((prev) => ({
        ...prev,
        password_confirm: validators.password_confirm(nextForm.password_confirm, nextForm),
      }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    const err =
      name === "password_confirm"
        ? validators.password_confirm(value, form)
        : validators[name](value, form, termsAccepted);
    setErrors((prev) => ({ ...prev, [name]: err }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const submitErrors = validateAll();
    setTouched({
      username: true,
      email: true,
      password: true,
      password_confirm: true,
      terms: true,
    });
    if (RECAPTCHA_SITE_KEY && !recaptchaToken) {
      setRecaptchaError("Vui lòng xác minh bạn không phải robot.");
    }
    if (Object.keys(submitErrors).length || (RECAPTCHA_SITE_KEY && !recaptchaToken)) {
      setErrors((prev) => ({ ...prev, ...submitErrors }));
      return;
    }

    setLoading(true);
    setErrors({});
    setRecaptchaError("");
    try {
      const data = await register({
        ...form,
        recaptcha_token: recaptchaToken,
        terms_accepted: termsAccepted,
      });
      setVerifyPending({
        email: data?.email || form.email,
        detail:
          data?.detail ||
          "Đăng ký thành công! Vui lòng kiểm tra email để xác minh tài khoản.",
      });
    } catch (err) {
      recaptchaRef.current?.reset();
      setRecaptchaToken("");
      const data = err.response?.data;
      if (data?.recaptcha_token) {
        setRecaptchaError(
          Array.isArray(data.recaptcha_token)
            ? data.recaptcha_token[0]
            : data.recaptcha_token
        );
      } else if (data?.non_field_errors) {
        setErrors({ general: data.non_field_errors[0] });
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

  const handleResendVerification = async () => {
    if (!verifyPending?.email) return;
    setResending(true);
    setResendMessage("");
    try {
      const { data } = await authAPI.resendVerification({ email: verifyPending.email });
      setResendMessage(data?.detail || "Đã gửi lại email xác minh.");
    } catch (err) {
      setResendMessage(err.response?.data?.detail || "Không thể gửi lại email xác minh.");
    } finally {
      setResending(false);
    }
  };

  if (verifyPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-950 dark:to-gray-900 px-4">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 space-y-4 text-center">
          <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            Kiểm tra email của bạn
          </h1>
          <p className="text-gray-600 dark:text-gray-300">{verifyPending.detail}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{verifyPending.email}</p>
          <button
            type="button"
            onClick={handleResendVerification}
            disabled={resending}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition disabled:opacity-50"
          >
            {resending ? "Đang gửi..." : "Gửi lại email"}
          </button>
          {resendMessage && (
            <p className="text-sm text-gray-600 dark:text-gray-300">{resendMessage}</p>
          )}
          <Link
            to="/login"
            className="inline-block text-blue-600 dark:text-blue-400 font-medium hover:underline"
          >
            Đã verify → Đăng nhập
          </Link>
        </div>
      </div>
    );
  }

  const confirmMatched =
    Boolean(form.password_confirm) && form.password_confirm === form.password;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-950 dark:to-gray-900 px-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="mx-auto mb-3 h-14 w-14 rounded-full bg-blue-600 text-white flex items-center justify-center text-2xl font-bold">
            S
          </div>
          <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400">SocialWeb</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Tạo tài khoản mới</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {errors.general && (
            <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-lg px-4 py-3 flex gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{errors.general}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Username
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                name="username"
                value={form.username}
                onChange={handleChange}
                onBlur={handleBlur}
                disabled={loading}
                placeholder="johndoe"
                className={`w-full pl-10 pr-10 py-2.5 rounded-xl border text-sm outline-none transition bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${inputClasses("username")} focus:ring-2 focus:border-transparent`}
              />
              {fieldStatus("username") === "error" && (
                <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />
              )}
              {fieldStatus("username") === "success" && (
                <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
              )}
            </div>
            {touched.username && errors.username && (
              <p className="text-red-500 dark:text-red-400 text-xs mt-1">{errors.username}</p>
            )}
          </div>

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
            {form.password && (
              <div className="mt-2 space-y-1">
                <div className="grid grid-cols-4 gap-1">
                  {[1, 2, 3, 4].map((segment) => (
                    <div
                      key={segment}
                      className={`h-2 rounded ${
                        strength.score >= segment ? strength.color : "bg-gray-200 dark:bg-gray-700"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300">{strength.label}</p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type={showConfirmPassword ? "text" : "password"}
                name="password_confirm"
                value={form.password_confirm}
                onChange={handleChange}
                onBlur={handleBlur}
                disabled={loading}
                placeholder="••••••••"
                className={`w-full pl-10 pr-20 py-2.5 rounded-xl border text-sm outline-none transition bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${
                  confirmMatched
                    ? "border-green-400 focus:ring-green-400"
                    : inputClasses("password_confirm")
                } focus:ring-2 focus:border-transparent`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                disabled={loading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-blue-600 transition"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              {confirmMatched && (
                <CheckCircle2 className="absolute right-10 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
              )}
              {!confirmMatched && fieldStatus("password_confirm") === "error" && (
                <XCircle className="absolute right-10 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />
              )}
            </div>
            {touched.password_confirm && errors.password_confirm && (
              <p className="text-red-500 dark:text-red-400 text-xs mt-1">{errors.password_confirm}</p>
            )}
          </div>

          {RECAPTCHA_SITE_KEY && (
            <div className="flex flex-col gap-1">
              <ReCAPTCHA
                ref={recaptchaRef}
                sitekey={RECAPTCHA_SITE_KEY}
                onChange={(token) => {
                  setRecaptchaToken(token || "");
                  setRecaptchaError("");
                }}
                onExpired={() => setRecaptchaToken("")}
                theme="light"
              />
              {recaptchaError && (
                <p className="text-red-500 dark:text-red-400 text-xs mt-1">{recaptchaError}</p>
              )}
            </div>
          )}

          <div className="space-y-1">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="terms"
                checked={termsAccepted}
                onChange={(e) => {
                  setTermsAccepted(e.target.checked);
                  setTouched((prev) => ({ ...prev, terms: true }));
                  setErrors((prev) => ({
                    ...prev,
                    terms: e.target.checked
                      ? ""
                      : "Bạn phải đồng ý với điều khoản để tiếp tục.",
                  }));
                }}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <label
                htmlFor="terms"
                className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer leading-relaxed"
              >
                Tôi đã đọc và đồng ý với{" "}
                <a
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  Điều khoản dịch vụ
                </a>{" "}
                và{" "}
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  Chính sách bảo mật
                </a>
              </label>
            </div>
            {(errors.terms || errors.terms_accepted) && (
              <p className="text-red-500 dark:text-red-400 text-xs">
                {errors.terms || errors.terms_accepted}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || (RECAPTCHA_SITE_KEY && !recaptchaToken)}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Đang tạo tài khoản...
              </>
            ) : (
              "Tạo tài khoản"
            )}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
          Đã có tài khoản?{" "}
          <Link to="/login" className="text-blue-600 dark:text-blue-400 font-medium hover:underline">
            Đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
}
