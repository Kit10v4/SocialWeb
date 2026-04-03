import { useQuery } from "@tanstack/react-query";
import { chatAPI } from "../services/api";

export function useUnreadCount() {
  const { data } = useQuery({
    queryKey: ["unread-count"],
    queryFn: async () => {
      const res = await chatAPI.getUnreadCount();
      return res.data?.count ?? 0;
    },
    staleTime: 5 * 60 * 1000, // cache 5 phút, không poll
  });

  return { unreadCount: data ?? 0 };
}
