import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { authService, type AccountUser } from "@/lib/auth/service";

interface AuthState {
  user: AccountUser | null;
  ready: boolean;
  error: string;
  reload: () => Promise<void>;
  confirm: (user: AccountUser) => void;
  logout: () => Promise<void>;
}
const AuthContext = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const serial = useRef(0);
  const reload = useCallback(async () => {
    const request = ++serial.current;
    try {
      const value = await authService.me();
      if (request === serial.current) {
        setUser(value);
        setError("");
      }
    } catch {
      if (request === serial.current) setError("Account connection unavailable.");
    } finally {
      if (request === serial.current) setReady(true);
    }
  }, []);
  useEffect(() => {
    void reload();
    const expired = () => void reload();
    window.addEventListener("nextstep:session-expired", expired);
    return () => window.removeEventListener("nextstep:session-expired", expired);
  }, [reload]);
  return (
    <AuthContext.Provider
      value={{
        user,
        ready,
        error,
        reload,
        confirm: (value) => {
          serial.current++;
          setUser(value);
          setReady(true);
          setError("");
        },
        logout: async () => {
          await authService.logout();
          serial.current++;
          setUser(null);
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  return useContext(AuthContext);
}
