import { useState, useEffect, useCallback } from "react";
import { profileAPI } from "../services/api";

/**
 * Fetch and manage a user's profile.
 * @param {string} username — URL segment from useParams()
 */
export function useProfile(username) {
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProfile = useCallback(async () => {
    if (!username) return;
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await profileAPI.getProfile(username);
      setProfile(data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load profile.");
    } finally {
      setIsLoading(false);
    }
  }, [username]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  /** Optimistically mutate friendship_status after an action. */
  const updateFriendshipStatus = useCallback((newStatus) => {
    setProfile((prev) => (prev ? { ...prev, friendship_status: newStatus } : prev));
  }, []);

  return { profile, isLoading, error, refetch: fetchProfile, updateFriendshipStatus };
}
