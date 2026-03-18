import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../context/AuthContext";
import { chatAPI } from "../services/api";
import ConversationList from "../components/ConversationList";
import ChatBox from "../components/ChatBox";

export default function MessagesPage() {
  const { user } = useAuth();
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [showListOnMobile, setShowListOnMobile] = useState(true);

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

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-5xl mx-auto px-2 sm:px-4 py-4 h-[calc(100vh-1rem)]">
        <div className="h-full flex flex-col md:flex-row gap-3">
          {/* Left: conversation list */}
          <div
            className={`md:w-1/3 lg:w-2/5 h-64 md:h-full transition-transform duration-200 md:translate-x-0 ${
              showListOnMobile ? "translate-x-0" : "-translate-x-full md:translate-x-0"
            }`}
          >
            <ConversationList
              conversations={conversations || []}
              activeId={selected?.id}
              onSelect={handleSelect}
              search={search}
              onSearchChange={setSearch}
              loading={isLoading}
              error={isError}
            />
          </div>

          {/* Right: chat box */}
          <div
            className={`md:flex-1 h-full transition-transform duration-200 md:translate-x-0 ${
              showListOnMobile ? "translate-x-full md:translate-x-0" : "translate-x-0"
            }`}
          >
            {selected ? (
              <div className="h-full flex flex-col">
                <div className="md:hidden mb-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowListOnMobile(true)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    ← Danh sách chat
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
    </div>
  );
}
