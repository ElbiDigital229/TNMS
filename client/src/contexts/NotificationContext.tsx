import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { notificationApi } from "../lib/api";
import { useAuth } from "./AuthContext";
import { useToast } from "../components/ui/Toast";

interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  linkUrl: string | null;
  isRead: boolean;
  readAt: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
}

interface NotificationContextType {
  unreadCount: number;
  notifications: Notification[];
  isLoading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refetch: () => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

const POLL_INTERVAL = 30_000; // 30 seconds

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const toast = useToast();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const prevCountRef = useRef(0);
  const initialFetchDone = useRef(false);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const res = await notificationApi.getUnreadCount();
      const newCount = res.data.data.count;

      // Show toast when new notifications arrive (not on initial load)
      if (initialFetchDone.current && newCount > prevCountRef.current) {
        const diff = newCount - prevCountRef.current;
        toast.info(
          diff === 1
            ? "You have a new notification"
            : `You have ${diff} new notifications`
        );
        // Refetch the list to show new items
        fetchNotifications();
      }

      prevCountRef.current = newCount;
      setUnreadCount(newCount);
      initialFetchDone.current = true;
    } catch {
      // Silently fail — polling should not disrupt the UX
    }
  }, [user]);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const res = await notificationApi.list({ limit: 20 });
      setNotifications(res.data.data.data);
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const markAsRead = useCallback(
    async (id: string) => {
      try {
        await notificationApi.markAsRead(id);
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
        prevCountRef.current = Math.max(0, prevCountRef.current - 1);
      } catch {
        // Silently fail
      }
    },
    []
  );

  const markAllAsRead = useCallback(async () => {
    try {
      await notificationApi.markAllAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
      );
      setUnreadCount(0);
      prevCountRef.current = 0;
    } catch {
      // Silently fail
    }
  }, []);

  const refetch = useCallback(() => {
    fetchUnreadCount();
    fetchNotifications();
  }, [fetchUnreadCount, fetchNotifications]);

  // Initial fetch + polling
  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      setNotifications([]);
      prevCountRef.current = 0;
      initialFetchDone.current = false;
      return;
    }

    fetchUnreadCount();
    fetchNotifications();

    const interval = setInterval(fetchUnreadCount, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [user, fetchUnreadCount, fetchNotifications]);

  return (
    <NotificationContext.Provider
      value={{ unreadCount, notifications, isLoading, markAsRead, markAllAsRead, refetch }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return context;
}
