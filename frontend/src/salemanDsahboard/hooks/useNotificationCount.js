import { useState, useEffect, useCallback } from "react";
import { getMyFollowUps } from "../../services/salemanservices/followUpService";
import { getVisitTargets } from "../../services/salemanservices/visitTargetService";
import { getMySamples } from "../../services/salemanservices/sampleService";
import { NOTIFICATION_UPDATE_EVENT } from "./useNotificationSocket";

// Mark all current notifications as seen
export const markAllNotificationsAsSeen = () => {
  // Store timestamp when notifications page was opened
  localStorage.setItem("notificationsLastSeen", new Date().toISOString());
};

// Get notification item creation/update time
const getItemTimestamp = (item, type) => {
  // Prefer createdAt, fallback to updatedAt
  if (item.createdAt) {
    return new Date(item.createdAt);
  }
  if (item.updatedAt) {
    return new Date(item.updatedAt);
  }
  // If no timestamp, consider it old (won't show as new)
  return new Date(0);
};

export const useNotificationCount = () => {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadNotificationCount = useCallback(async () => {
    try {
      setLoading(true);
      // Load all 3 in parallel so one round trip instead of 3 sequential
      const [tasksResult, visitsResult, samplesResult] = await Promise.all([
        getMyFollowUps({}),
        getVisitTargets({}),
        getMySamples({}),
      ]);

      let tasks = [];
      let visits = [];
      let samples = [];
      if (tasksResult.success && tasksResult.data) {
        tasks = tasksResult.data.filter(
          (t) => (t.status || "").toLowerCase() !== "completed"
        );
      }
      if (visitsResult.success && visitsResult.data) {
        visits = visitsResult.data.filter(
          (v) => (v.status || "").toLowerCase() !== "completed"
        );
      }
      if (samplesResult.success && samplesResult.data) {
        samples = samplesResult.data.filter(
          (s) => (s.status || "").toLowerCase() !== "converted"
        );
      }

      // Get last seen timestamp
      const lastSeenTimestamp = localStorage.getItem("notificationsLastSeen");
      const lastSeenTime = lastSeenTimestamp
        ? new Date(lastSeenTimestamp)
        : null;

      // If notifications were never seen, count all active items
      if (!lastSeenTime) {
        setCount(tasks.length + visits.length + samples.length);
        return;
      }

      // Count only NEW notifications (created/updated after last seen)
      let newCount = 0;

      // Check tasks
      tasks.forEach((task) => {
        const itemTime = getItemTimestamp(task, "task");
        if (itemTime > lastSeenTime) {
          newCount++;
        }
      });

      // Check visits
      visits.forEach((visit) => {
        const itemTime = getItemTimestamp(visit, "visit");
        if (itemTime > lastSeenTime) {
          newCount++;
        }
      });

      // Check samples
      samples.forEach((sample) => {
        const itemTime = getItemTimestamp(sample, "sample");
        if (itemTime > lastSeenTime) {
          newCount++;
        }
      });

      setCount(newCount);
    } catch (error) {
      console.error("Error loading notification count:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotificationCount();
    const onUpdate = () => loadNotificationCount();
    window.addEventListener(NOTIFICATION_UPDATE_EVENT, onUpdate);
    const onVisibility = () => {
      if (document.visibilityState === "visible") loadNotificationCount();
    };
    document.addEventListener("visibilitychange", onVisibility);
    const interval = setInterval(loadNotificationCount, 60000);
    return () => {
      window.removeEventListener(NOTIFICATION_UPDATE_EVENT, onUpdate);
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(interval);
    };
  }, [loadNotificationCount]);

  return { count, loading, refresh: loadNotificationCount };
};
