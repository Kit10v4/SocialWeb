import { useAuth } from "../context/AuthContext";

export default function HomePage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navbar */}
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="text-xl font-bold text-blue-600">Social App</span>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-700">
              {user?.username}
            </span>
            <button
              onClick={logout}
              className="text-sm text-red-500 hover:text-red-600 font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Feed placeholder */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-400">
          <p className="text-lg font-medium">Welcome, {user?.username}!</p>
          <p className="text-sm mt-1">Your news feed will appear here.</p>
        </div>
      </main>
    </div>
  );
}
