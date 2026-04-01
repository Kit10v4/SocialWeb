import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function RegisterForm() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    password_confirm: "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "", general: "" });
  };

  const validate = () => {
    const errs = {};
    if (!form.username.trim()) errs.username = "Username is required.";
    if (!form.email) errs.email = "Email is required.";
    else if (!/\S+@\S+\.\S+/.test(form.email))
      errs.email = "Invalid email format.";
    if (!form.password) errs.password = "Password is required.";
    else if (form.password.length < 8)
      errs.password = "Password must be at least 8 characters.";
    if (form.password !== form.password_confirm)
      errs.password_confirm = "Passwords do not match.";
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setLoading(true);
    setErrors({});
    try {
      await register(form);
      navigate("/");
    } catch (err) {
      const data = err.response?.data;
      if (data?.non_field_errors) {
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

  const fields = [
    { name: "username", label: "Username", type: "text", placeholder: "johndoe" },
    { name: "email", label: "Email", type: "email", placeholder: "you@example.com" },
    { name: "password", label: "Password", type: "password", placeholder: "••••••••" },
    {
      name: "password_confirm",
      label: "Confirm Password",
      type: "password",
      placeholder: "••••••••",
    },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400">Social App</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Create your account</p>
        </div>

        {/* Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-8 space-y-5"
        >
          {errors.general && (
            <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-lg px-4 py-3">
              {errors.general}
            </div>
          )}

          {fields.map(({ name, label, type, placeholder }) => (
            <div key={name}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {label}
              </label>
              <input
                type={type}
                name={name}
                value={form[name]}
                onChange={handleChange}
                placeholder={placeholder}
                className={`w-full px-4 py-2.5 rounded-lg border text-sm outline-none transition bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500
                  ${errors[name] ? "border-red-400 focus:ring-red-400" : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"}
                  focus:ring-2 focus:border-transparent`}
              />
              {errors[name] && (
                <p className="text-red-500 dark:text-red-400 text-xs mt-1">{errors[name]}</p>
              )}
            </div>
          ))}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Creating account..." : "Sign Up"}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-blue-600 dark:text-blue-400 font-medium hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
