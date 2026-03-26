import { useQuery } from "@tanstack/react-query";
import { feedAPI } from "../services/api";

const FALLBACK_COLORS = [
  "bg-blue-400",
  "bg-violet-400",
  "bg-emerald-400",
  "bg-amber-400",
  "bg-rose-400",
];

function getFallbackColor(username) {
  const firstChar = username?.[0] || "A";
  const idx = firstChar.charCodeAt(0) % FALLBACK_COLORS.length;
  return FALLBACK_COLORS[idx];
}

export default function StoriesBar() {
  const {
    data,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["feed", "stories"],
    queryFn: async () => {
      const res = await feedAPI.getStories();
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 mb-3 animate-pulse">
        <div className="h-16 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 mb-3 text-xs text-red-500">
        Không thể tải danh sách bạn bè đang hoạt động.
      </div>
    );
  }

  const friends = data || [];
  const visibleFriends = friends.slice(0, 6);
  const extraCount = Math.max(friends.length - visibleFriends.length, 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 mb-3">
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-sm font-semibold text-gray-800">Bạn bè đang hoạt động</p>
        <p className="text-[11px] text-gray-400">Trực tuyến gần đây</p>
      </div>
      <div className="flex gap-3 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent pb-1">
        {visibleFriends.map((friend) => {
          const username = friend.username || "Bạn";
          const fallbackColor = getFallbackColor(username);

          return (
          <div key={friend.id} className="flex-shrink-0 flex flex-col items-center w-16 text-center">
            <div className="w-14 h-14 bg-gradient-to-tr from-blue-500 to-indigo-500 p-[2px] rounded-full">
              <div className="w-full h-full bg-white rounded-full overflow-hidden">
                {friend.avatar ? (
                  <img
                    src={friend.avatar}
                    alt={username}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className={`w-full h-full flex items-center justify-center text-xs font-semibold text-white ${fallbackColor}`}
                  >
                    {username[0]?.toUpperCase()}
                  </div>
                )}
              </div>
            </div>
            <p className="mt-1 text-[11px] text-gray-600 truncate w-full">
              {username}
            </p>
          </div>
          );
        })}

        {extraCount > 0 && (
          <div className="flex-shrink-0 flex flex-col items-center w-16 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-sm font-semibold">
              +{extraCount}
            </div>
            <p className="mt-1 text-[11px] text-gray-500 truncate w-full">khác</p>
          </div>
        )}
      </div>
    </div>
  );
}
