import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, X } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { chatAPI } from "../services/api";
import ConversationList from "../components/ConversationList";
import ChatBox from "../components/ChatBox";
import SearchUserModal from "../components/SearchUserModal";
import BottomNav from "../components/shared/BottomNav";

export default function MessagesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [showListOnMobile, setShowListOnMobile] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const {
    data: conversations,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const res = await chatAPI.listConversations();
      return Array.isArray(res.data) ? res.data : res.data.results ?? [];
    },
  });

  const handleSelect = (conv) => {
    setSelected(conv);
    setShowListOnMobile(false);
  };

  const handleConversationCreated = (conv) => {
    if (!conv) return;
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
    setSelected(conv);
    setShowListOnMobile(false);
  };

  const showListMobile = showListOnMobile || !selected;

  return (
    <div className="min-h-screen bg-gray-100 pb-16 md:pb-0">
      <div className="md:hidden sticky top-0 bg-white border-b border-gray-100 z-40">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <span className="font-semibold text-base">Tin nhắn</span>
          <Link to="/" className="p-2 rounded-full hover:bg-gray-100">
            <X className="w-5 h-5" />
          </Link>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-2 sm:px-4 py-4 h-[calc(100vh-1rem)]">
        <div className="h-full flex flex-col md:flex-row gap-3">
          {/* Left: conversation list */}
          <div
            className={`md:w-1/3 lg:w-2/5 ${
              showListMobile ? "block" : "hidden"
            } md:block h-full`}
          >
            <ConversationList
              conversations={conversations || []}
              activeId={selected?.id}
              onSelect={handleSelect}
              onNewChat={() => setIsSearchOpen(true)}
              search={search}
              onSearchChange={setSearch}
              loading={isLoading}
              error={isError}
            />
          </div>

          {/* Right: chat box */}
          <div
            className={`md:flex-1 ${showListMobile ? "hidden" : "block"} md:block h-full`}
          >
            {selected ? (
              <div className="h-full flex flex-col">
                <div className="md:hidden mb-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="p-2 rounded-full hover:bg-gray-100 mr-2"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <p className="text-xs text-gray-500 truncate">
                    Đang chat với {selected.participants
                      .filter((p) => p.id !== user?.id)
                      .map((p) => p.username)
                      .join(", ") || user?.username}
                  </p>
                </div>
                <ChatBox conversation={selected} />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center bg-white rounded-2xl shadow-sm border border-gray-100 text-xs text-gray-400">
                Chọn một cuộc trò chuyện để bắt đầu.
              </div>
            )}
          </div>
        </div>
      </div>

      <BottomNav />

      <SearchUserModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onConversationCreated={handleConversationCreated}
      />
    </div>
  );
}
