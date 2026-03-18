import { useState, useCallback } from "react";
import { friendsAPI } from "../services/api";

/**
 * Friendship action helpers with shared loading state.
 * Returns { actionLoading, sendRequest, accept, reject, unfriend }.
 */
export function useFriend() {
  const [actionLoading, setActionLoading] = useState(false);

  const run = useCallback(async (fn) => {
    setActionLoading(true);
    try {
      return await fn();
    } finally {
      setActionLoading(false);
    }
  }, []);

  const sendRequest = useCallback(
    (userId) => run(() => friendsAPI.sendRequest(userId)),
    [run]
  );
  const accept = useCallback(
    (userId) => run(() => friendsAPI.accept(userId)),
    [run]
  );
  const reject = useCallback(
    (userId) => run(() => friendsAPI.reject(userId)),
    [run]
  );
  const unfriend = useCallback(
    (userId) => run(() => friendsAPI.unfriend(userId)),
    [run]
  );

  return { actionLoading, sendRequest, accept, reject, unfriend };
}
