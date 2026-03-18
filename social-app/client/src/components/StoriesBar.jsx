import { useQuery } from "@tanstack/react-query";
import { feedAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function StoriesBar() {
  const { user } = useAuth();

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
        Không thể tải stories.
      </div>
    );
  }

  const friends = data || [];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 mb-3">
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-sm font-semibold text-gray-800">Stories</p>
        <p className="text-[11px] text-gray-400">Trong 24 giờ qua</p>
      </div>
      <div className="flex gap-3 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent pb-1">
        {/* Your story */}
        <div className="flex-shrink-0 flex flex-col items-center w-16 text-center">
          <div className="relative w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.username}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-sm font-semibold text-gray-600">
                {user?.username?.[0]?.toUpperCase()}
              </span>
            )}
            <button
              type="button"
              className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center border border-white"
            >
              +
            </button>
          </div>
          <p className="mt-1 text-[11px] text-gray-600 truncate w-full">
            Tin của bạn
          </p>
        </div>

        {friends.map((friend) => (
          <div key={friend.id} className="flex-shrink-0 flex flex-col items-center w-16 text-center">
            <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 p-[2px]">
              <div className="w-full h-full rounded-full bg-white overflow-hidden">
                {friend.avatar ? (
                  <img
                    src={friend.avatar}
                    alt={friend.username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-100 text-xs font-semibold text-gray-600">
                    {friend.username?.[0]?.toUpperCase()}
                  </div>
                )}
              </div>
            </div>
            <p className="mt-1 text-[11px] text-gray-600 truncate w-full">
              {friend.username}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
