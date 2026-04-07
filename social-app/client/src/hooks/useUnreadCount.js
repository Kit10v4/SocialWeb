import { useQuery } from "@tanstack/react-query";
import { chatAPI } from "../services/api";

export function useUnreadCount() {
  const { data } = useQuery({
    queryKey: ["unread-count"],
    queryFn: async () => {
      const res = await chatAPI.getUnreadCount();
      return res.data?.count ?? 0;
    },
    staleTime: 30 * 1000, // 30 seconds — WebSocket will invalidate on new messages
  });

  return { unreadCount: data ?? 0 };
}
