import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Home, Search, MessageCircle, User } from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import { chatAPI } from "../../services/api";

export default function BottomNav() {
  const { user } = useAuth();
  const location = useLocation();

  const { data: conversations } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const res = await chatAPI.listConversations();
      return Array.isArray(res.data) ? res.data : res.data.results ?? [];
    },
    enabled: !!user,
  });

  const unreadCount = useMemo(() => {
    const list = conversations || [];
    return list.reduce((total, conv) => {
      const last = conv.last_message;
      if (last && !last.is_read && last.sender?.id !== user?.id) return total + 1;
      return total;
    }, 0);
  }, [conversations, user?.id]);

  const isActive = (path) => location.pathname === path;
  const isPrefixActive = (path) => location.pathname.startsWith(path);
  const profilePath = user?.username ? `/profile/${user.username}` : "/";

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 md:hidden bg-white border-t border-gray-200 z-50"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-4 pt-2 pb-3">
        <NavItem to="/" active={isActive("/")}>
          <Home className="w-5 h-5" />
          <span>Home</span>
        </NavItem>
        <NavItem to="/search" active={isPrefixActive("/search")}>
          <Search className="w-5 h-5" />
          <span>Search</span>
        </NavItem>
        <NavItem to="/messages" active={isPrefixActive("/messages")}>
          <span className="relative">
            <MessageCircle className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </span>
          <span>Chat</span>
        </NavItem>
        <NavItem to={profilePath} active={isPrefixActive("/profile")}>
          <User className="w-5 h-5" />
          <span>Profile</span>
        </NavItem>
      </div>
    </nav>
  );
}

function NavItem({ to, active, children }) {
  return (
    <Link
      to={to}
      className={`flex flex-col items-center gap-1 text-[11px] font-semibold ${
        active ? "text-blue-600" : "text-gray-500"
      }`}
    >
      {children}
    </Link>
  );
}
