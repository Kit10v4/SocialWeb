import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { adminAPI } from "../services/api";

// Stats Card Component
function StatCard({ title, value, subtext, icon, color }) {
  const colorClasses = {
    green: "border-l-green-500 bg-green-50",
    blue: "border-l-blue-500 bg-blue-50",
    purple: "border-l-purple-500 bg-purple-50",
    red: "border-l-red-500 bg-red-50",
    orange: "border-l-orange-500 bg-orange-50",
  };

  return (
    <div className={`rounded-lg border-l-4 p-4 shadow-sm ${colorClasses[color] || colorClasses.blue}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtext && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
        </div>
        <span className="text-3xl">{icon}</span>
      </div>
    </div>
  );
}

// User Row Component
function UserRow({ user, onAction, onViewDetail }) {
  const [loading, setLoading] = useState(false);

  const handleAction = async (action) => {
    setLoading(true);
    try {
      await onAction(user.id, action);
    } finally {
      setLoading(false);
    }
  };

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {user.avatar ? (
            <img src={user.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
              {user.username.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <button
              onClick={() => onViewDetail(user)}
              className="font-medium text-blue-600 hover:underline"
            >
              {user.username}
            </button>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1 flex-wrap">
          {user.is_superuser && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700">Superuser</span>
          )}
          {user.is_staff && !user.is_superuser && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">Staff</span>
          )}
          {user.is_active ? (
            <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">Active</span>
          ) : (
            <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700">Inactive</span>
          )}
          {user.is_locked && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-700">Locked</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-center">{user.post_count}</td>
      <td className="px-4 py-3 text-center">{user.friend_count}</td>
      <td className="px-4 py-3 text-sm text-gray-500">
        {new Date(user.created_at).toLocaleDateString("vi-VN")}
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-2">
          {!user.is_superuser && (
            <>
              {user.is_active ? (
                <button
                  onClick={() => handleAction("deactivate")}
                  disabled={loading}
                  className="px-2 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
                >
                  Ban
                </button>
              ) : (
                <button
                  onClick={() => handleAction("activate")}
                  disabled={loading}
                  className="px-2 py-1 text-xs rounded bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50"
                >
                  Activate
                </button>
              )}
              {user.is_locked && (
                <button
                  onClick={() => handleAction("unlock")}
                  disabled={loading}
                  className="px-2 py-1 text-xs rounded bg-orange-100 text-orange-700 hover:bg-orange-200 disabled:opacity-50"
                >
                  Unlock
                </button>
              )}
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

// User Detail Modal
function UserDetailModal({ user, onClose, onAction }) {
  if (!user) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="relative">
          {user.cover_photo ? (
            <img src={user.cover_photo} alt="" className="w-full h-32 object-cover" />
          ) : (
            <div className="w-full h-32 bg-gradient-to-r from-blue-400 to-purple-500" />
          )}
          <button
            onClick={onClose}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/80 flex items-center justify-center hover:bg-white"
          >
            ✕
          </button>
          <div className="absolute -bottom-12 left-6">
            {user.avatar ? (
              <img src={user.avatar} alt="" className="w-24 h-24 rounded-full border-4 border-white object-cover" />
            ) : (
              <div className="w-24 h-24 rounded-full border-4 border-white bg-blue-100 flex items-center justify-center text-blue-600 text-3xl font-bold">
                {user.username.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>

        <div className="pt-14 px-6 pb-6">
          {/* User Info */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold">{user.username}</h2>
              <p className="text-gray-500">{user.email}</p>
              {user.bio && <p className="text-gray-700 mt-2">{user.bio}</p>}
            </div>
            <div className="flex gap-2">
              {user.is_superuser && <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-sm">Superuser</span>}
              {user.is_staff && !user.is_superuser && <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm">Staff</span>}
              {user.is_active ? (
                <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm">Active</span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 text-sm">Inactive</span>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{user.post_count}</p>
              <p className="text-sm text-gray-500">Bài viết</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{user.friend_count}</p>
              <p className="text-sm text-gray-500">Bạn bè</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-orange-600">{user.failed_login_attempts}</p>
              <p className="text-sm text-gray-500">Login thất bại</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">{user.reports_received?.length || 0}</p>
              <p className="text-sm text-gray-500">Reports</p>
            </div>
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div>
              <span className="text-gray-500">Ngày sinh:</span>
              <span className="ml-2">{user.date_of_birth || "Chưa cập nhật"}</span>
            </div>
            <div>
              <span className="text-gray-500">Ngày tạo:</span>
              <span className="ml-2">{new Date(user.created_at).toLocaleString("vi-VN")}</span>
            </div>
            <div>
              <span className="text-gray-500">Locked until:</span>
              <span className="ml-2">{user.locked_until ? new Date(user.locked_until).toLocaleString("vi-VN") : "Không"}</span>
            </div>
            <div>
              <span className="text-gray-500">Terms accepted:</span>
              <span className="ml-2">{user.terms_accepted_at ? new Date(user.terms_accepted_at).toLocaleString("vi-VN") : "Chưa"}</span>
            </div>
          </div>

          {/* Recent Posts */}
          {user.recent_posts?.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold mb-3">Bài viết gần đây</h3>
              <div className="space-y-2">
                {user.recent_posts.map((post) => (
                  <div key={post.id} className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm">{post.content}</p>
                    <div className="flex gap-4 mt-2 text-xs text-gray-500">
                      <span>❤️ {post.like_count}</span>
                      <span>💬 {post.comment_count}</span>
                      <span>{new Date(post.created_at).toLocaleDateString("vi-VN")}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reports */}
          {user.reports_received?.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold mb-3 text-red-600">⚠️ Reports về user này</h3>
              <div className="space-y-2">
                {user.reports_received.map((report) => (
                  <div key={report.id} className="p-3 bg-red-50 rounded-lg border border-red-100">
                    <div className="flex justify-between">
                      <span className="font-medium">{report.reporter}</span>
                      <span className="text-sm text-gray-500">{new Date(report.created_at).toLocaleDateString("vi-VN")}</span>
                    </div>
                    <p className="text-sm text-red-700 mt-1">{report.reason}: {report.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Audit Logs */}
          {user.audit_logs?.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3">Hoạt động gần đây</h3>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {user.audit_logs.map((log, idx) => (
                  <div key={idx} className="flex justify-between text-sm py-1 border-b">
                    <span className={log.event_type.includes("success") ? "text-green-600" : log.event_type.includes("failed") ? "text-red-600" : ""}>
                      {log.event_type}
                    </span>
                    <span className="text-gray-500">{log.ip_address} - {new Date(log.created_at).toLocaleString("vi-VN")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          {!user.is_superuser && (
            <div className="flex gap-3 mt-6 pt-6 border-t">
              {user.is_active ? (
                <button
                  onClick={() => { onAction(user.id, "deactivate"); onClose(); }}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
                >
                  🚫 Ban User
                </button>
              ) : (
                <button
                  onClick={() => { onAction(user.id, "activate"); onClose(); }}
                  className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
                >
                  ✅ Activate User
                </button>
              )}
              {user.is_locked && (
                <button
                  onClick={() => { onAction(user.id, "unlock"); onClose(); }}
                  className="px-4 py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-700"
                >
                  🔓 Unlock
                </button>
              )}
              {user.is_staff ? (
                <button
                  onClick={() => { onAction(user.id, "remove_staff"); onClose(); }}
                  className="px-4 py-2 rounded-lg bg-gray-600 text-white hover:bg-gray-700"
                >
                  Remove Staff
                </button>
              ) : (
                <button
                  onClick={() => { onAction(user.id, "make_staff"); onClose(); }}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                >
                  Make Staff
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Report Row Component
function ReportRow({ report, onAction }) {
  const [loading, setLoading] = useState(false);

  const handleAction = async (action) => {
    setLoading(true);
    try {
      await onAction(report.id, action);
    } finally {
      setLoading(false);
    }
  };

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {report.reporter.avatar ? (
            <img src={report.reporter.avatar} alt="" className="w-8 h-8 rounded-full" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm">
              {report.reporter.username.charAt(0).toUpperCase()}
            </div>
          )}
          <span>{report.reporter.username}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {report.target_user.avatar ? (
            <img src={report.target_user.avatar} alt="" className="w-8 h-8 rounded-full" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm">
              {report.target_user.username.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <span className="font-medium">{report.target_user.username}</span>
            {!report.target_user.is_active && (
              <span className="ml-2 text-xs text-red-600">(Banned)</span>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="px-2 py-1 rounded-full bg-orange-100 text-orange-700 text-xs">
          {report.reason_display}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
        {report.detail || "-"}
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">
        {new Date(report.created_at).toLocaleDateString("vi-VN")}
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-2">
          <button
            onClick={() => handleAction("dismiss")}
            disabled={loading}
            className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
          >
            Dismiss
          </button>
          {report.target_user.is_active && (
            <button
              onClick={() => handleAction("ban")}
              disabled={loading}
              className="px-2 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
            >
              Ban User
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function AdminPage() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  
  const [activeTab, setActiveTab] = useState("dashboard");
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [nextCursor, setNextCursor] = useState(null);

  // Check admin access
  useEffect(() => {
    if (!authLoading && (!user || !user.is_staff)) {
      navigate("/");
    }
  }, [user, authLoading, navigate]);

  // Load data based on active tab
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === "dashboard") {
        const res = await adminAPI.getStats();
        setStats(res.data);
      } else if (activeTab === "users") {
        const params = {};
        if (searchQuery) params.search = searchQuery;
        if (statusFilter) params.status = statusFilter;
        const res = await adminAPI.listUsers(params);
        setUsers(res.data.results);
        setNextCursor(res.data.next);
      } else if (activeTab === "reports") {
        const res = await adminAPI.listReports();
        setReports(res.data);
      } else if (activeTab === "logs") {
        const res = await adminAPI.listAuditLogs();
        setAuditLogs(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery, statusFilter]);

  useEffect(() => {
    if (user?.is_staff) {
      loadData();
    }
  }, [loadData, user]);

  // User actions
  const handleUserAction = async (userId, action) => {
    try {
      await adminAPI.userAction(userId, action);
      loadData();
    } catch (err) {
      alert(err.response?.data?.error || "Có lỗi xảy ra");
    }
  };

  // View user detail
  const handleViewUserDetail = async (user) => {
    try {
      const res = await adminAPI.getUser(user.id);
      setSelectedUser(res.data);
    } catch (err) {
      alert("Không thể load thông tin user");
    }
  };

  // Report actions
  const handleReportAction = async (reportId, action) => {
    try {
      await adminAPI.reportAction(reportId, action);
      loadData();
    } catch (err) {
      alert(err.response?.data?.error || "Có lỗi xảy ra");
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!user?.is_staff) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-gray-500 hover:text-gray-700">
              ← Về trang chủ
            </Link>
            <h1 className="text-xl font-bold text-gray-800">🛠️ Admin Panel</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">Xin chào, {user.username}</span>
            {user.avatar ? (
              <img src={user.avatar} alt="" className="w-8 h-8 rounded-full" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center">
                {user.username.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-lg p-1 shadow-sm">
          {[
            { id: "dashboard", label: "📊 Dashboard" },
            { id: "users", label: "👥 Users" },
            { id: "reports", label: "🚨 Reports" },
            { id: "logs", label: "📋 Audit Logs" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Dashboard Tab */}
        {activeTab === "dashboard" && (
          <div>
            {loading ? (
              <div className="text-center py-12">Đang tải...</div>
            ) : stats ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  <StatCard
                    title="Tổng Users"
                    value={stats.users.total}
                    subtext={`Active: ${stats.users.active} | Locked: ${stats.users.locked}`}
                    icon="👥"
                    color="green"
                  />
                  <StatCard
                    title="Users mới (tuần)"
                    value={stats.users.new_week}
                    subtext={`Hôm nay: ${stats.users.new_today} | Tháng: ${stats.users.new_month}`}
                    icon="📈"
                    color="blue"
                  />
                  <StatCard
                    title="Tổng Posts"
                    value={stats.posts.total}
                    subtext={`Comments: ${stats.posts.comments} | Likes: ${stats.posts.likes}`}
                    icon="📝"
                    color="purple"
                  />
                  <StatCard
                    title="Tin nhắn"
                    value={stats.chat.messages}
                    subtext={`Conversations: ${stats.chat.conversations}`}
                    icon="💬"
                    color="orange"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <StatCard
                    title="Bạn bè"
                    value={stats.friendships.total}
                    subtext={`Pending: ${stats.friendships.pending}`}
                    icon="🤝"
                    color="green"
                  />
                  <StatCard
                    title="Reports cần xử lý"
                    value={stats.reports.pending}
                    icon="🚨"
                    color="red"
                  />
                  <StatCard
                    title="Posts tuần này"
                    value={stats.posts.week}
                    subtext={`Hôm nay: ${stats.posts.today}`}
                    icon="📊"
                    color="blue"
                  />
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* Users Tab */}
        {activeTab === "users" && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            {/* Search & Filter */}
            <div className="p-4 border-b flex gap-4 flex-wrap">
              <input
                type="text"
                placeholder="Tìm theo username hoặc email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 min-w-[200px] px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tất cả</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="locked">Locked</option>
                <option value="staff">Staff</option>
              </select>
              <button
                onClick={loadData}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                🔍 Tìm kiếm
              </button>
            </div>

            {loading ? (
              <div className="text-center py-12">Đang tải...</div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">User</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Trạng thái</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">Posts</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">Friends</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Ngày tạo</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map((u) => (
                    <UserRow
                      key={u.id}
                      user={u}
                      onAction={handleUserAction}
                      onViewDetail={handleViewUserDetail}
                    />
                  ))}
                </tbody>
              </table>
            )}

            {users.length === 0 && !loading && (
              <div className="text-center py-12 text-gray-500">
                Không tìm thấy user nào
              </div>
            )}
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === "reports" && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            {loading ? (
              <div className="text-center py-12">Đang tải...</div>
            ) : reports.length > 0 ? (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Người báo cáo</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Người bị báo cáo</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Lý do</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Chi tiết</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Ngày</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {reports.map((r) => (
                    <ReportRow key={r.id} report={r} onAction={handleReportAction} />
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-12 text-gray-500">
                🎉 Không có report nào cần xử lý
              </div>
            )}
          </div>
        )}

        {/* Audit Logs Tab */}
        {activeTab === "logs" && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            {loading ? (
              <div className="text-center py-12">Đang tải...</div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Sự kiện</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Email</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">User</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">IP</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Thời gian</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          log.event_type.includes("success") ? "bg-green-100 text-green-700" :
                          log.event_type.includes("failed") || log.event_type.includes("locked") ? "bg-red-100 text-red-700" :
                          "bg-blue-100 text-blue-700"
                        }`}>
                          {log.event_display}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{log.email}</td>
                      <td className="px-4 py-3 text-sm">
                        {log.user ? log.user.username : "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{log.ip_address || "-"}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(log.created_at).toLocaleString("vi-VN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* User Detail Modal */}
      <UserDetailModal
        user={selectedUser}
        onClose={() => setSelectedUser(null)}
        onAction={handleUserAction}
      />
    </div>
  );
}
