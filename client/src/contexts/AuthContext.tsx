import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../lib/api";
import { identifyUser, resetPostHog, capture } from "../lib/posthog";

interface UserRole {
  id: string;
  name: string;
  level: number;
}

interface User {
  id: string;
  username: string;
  fullName?: string;
  email?: string;
  isSuperAdmin: boolean;
  allProperties: boolean;
  role: UserRole;
  permissions: string[];
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermission: (key: string) => boolean;
  hasAnyPermission: (...keys: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      authApi
        .me()
        .then((res) => {
          setUser(res.data.data);
          identifyUser(res.data.data);
        })
        .catch(() => {
          localStorage.removeItem("token");
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (username: string, password: string) => {
    const res = await authApi.login(username, password);
    const { token, user: userData } = res.data.data;
    localStorage.setItem("token", token);
    setUser(userData);
    identifyUser(userData);
    capture("login_success", {
      username: userData.username,
      role_name: userData.role.name,
      is_super_admin: userData.isSuperAdmin,
    });
    navigate("/");
  };

  const logout = () => {
    capture("logout");
    localStorage.removeItem("token");
    setUser(null);
    resetPostHog();
    navigate("/login");
  };

  const hasPermission = useCallback(
    (key: string) => {
      if (!user) return false;
      if (user.isSuperAdmin) return true;
      return user.permissions.includes(key);
    },
    [user]
  );

  const hasAnyPermission = useCallback(
    (...keys: string[]) => {
      if (!user) return false;
      if (user.isSuperAdmin) return true;
      return keys.some((key) => user.permissions.includes(key));
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        hasPermission,
        hasAnyPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
