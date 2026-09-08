import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  auth,
  onAuthStateChanged,
  signInWithGoogle,
  signOutUser,
  fetchUserWatchlist,
  saveUserWatchlistToCloud,
  SavedTradeItem,
  fetchSavedTradesFromCloud,
  saveTradeToCloud,
  removeSavedTradeFromCloud,
  logAccessEvent,
  SUPERADMIN_EMAIL,
} from "../lib/firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  authError: string | null;
  clearAuthError: () => void;
  // Cloud Watchlist sync
  syncCloudWatchlist: (watchlist: string[]) => Promise<string[]>;
  loadCloudWatchlist: () => Promise<string[] | null>;
  // Saved Trades
  savedTrades: SavedTradeItem[];
  saveTrade: (trade: SavedTradeItem) => Promise<void>;
  removeTrade: (tradeId: string) => Promise<void>;
  refreshSavedTrades: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [savedTrades, setSavedTrades] = useState<SavedTradeItem[]>([]);

  const isAdmin = Boolean(
    user?.email && user.email.toLowerCase() === SUPERADMIN_EMAIL.toLowerCase()
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser) {
        // Log access for authenticated user session
        const sessionKey = `logged_session_${currentUser.uid}_${new Date().toDateString()}`;
        if (!sessionStorage.getItem(sessionKey)) {
          sessionStorage.setItem(sessionKey, "1");
          logAccessEvent({
            eventType: "LOGIN_SUCCESS",
            email: currentUser.email || "",
            name: currentUser.displayName || "",
            photo: currentUser.photoURL || "",
            uid: currentUser.uid,
            details: currentUser.email?.toLowerCase() === SUPERADMIN_EMAIL.toLowerCase()
              ? "Superadmin session established"
              : "User signed in via Google account",
          });
        }

        try {
          const trades = await fetchSavedTradesFromCloud(currentUser.uid);
          setSavedTrades(trades);
        } catch (e) {
          console.warn("Failed to load saved trades for user:", e);
        }
      } else {
        setSavedTrades([]);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      const signedInUser = await signInWithGoogle();
      logAccessEvent({
        eventType: "LOGIN_SUCCESS",
        email: signedInUser.email || "",
        name: signedInUser.displayName || "",
        photo: signedInUser.photoURL || "",
        uid: signedInUser.uid,
        details: signedInUser.email?.toLowerCase() === SUPERADMIN_EMAIL.toLowerCase()
          ? "Superadmin Google Sign-In"
          : "Google Sign-In completed",
      });
    } catch (err: any) {
      const errMsg = err?.code === "auth/popup-closed-by-user"
        ? "Sign-in cancelled by user."
        : err?.code === "auth/popup-blocked"
        ? "Sign-in popup blocked by browser. Please allow popups or open in a new tab."
        : err?.message || "Failed to sign in with Google.";

      setAuthError(errMsg);
      logAccessEvent({
        eventType: "LOGIN_FAILED",
        status: "BLOCKED",
        details: `Google sign-in attempt failed: ${errMsg}`,
      });
    }
  };

  const handleSignOut = async () => {
    setAuthError(null);
    const prevEmail = user?.email;
    try {
      logAccessEvent({
        eventType: "SIGNOUT",
        email: prevEmail || undefined,
        details: "User initiated sign out",
      });
      await signOutUser();
    } catch (err: any) {
      setAuthError(err?.message || "Failed to sign out.");
    }
  };

  const syncCloudWatchlist = async (watchlist: string[]): Promise<string[]> => {
    const currentUid = user?.uid || auth.currentUser?.uid;
    if (!currentUid) {
      throw new Error("You must be signed in with Google to sync watchlist to Cloud.");
    }
    const cleanList = Array.from(
      new Set(watchlist.map((t) => String(t).trim().toUpperCase()))
    ).filter(Boolean);

    try {
      const savedList = await saveUserWatchlistToCloud(currentUid, cleanList);
      return savedList;
    } catch (e: any) {
      console.error("Cloud watchlist sync error:", e);
      throw e;
    }
  };

  const loadCloudWatchlist = async (): Promise<string[] | null> => {
    const currentUid = user?.uid || auth.currentUser?.uid;
    if (!currentUid) return null;
    return await fetchUserWatchlist(currentUid);
  };

  const refreshSavedTrades = async () => {
    if (!user) return;
    const trades = await fetchSavedTradesFromCloud(user.uid);
    setSavedTrades(trades);
  };

  const saveTrade = async (trade: SavedTradeItem) => {
    if (!user) {
      setAuthError("Sign in with Google to save trades to your account.");
      return;
    }
    const id = await saveTradeToCloud(user.uid, trade);
    setSavedTrades((prev) => {
      const existing = prev.filter((t) => (t.id || `${t.ticker}_${t.expiration}_${t.strike}P`) !== id);
      return [{ ...trade, id }, ...existing];
    });
  };

  const removeTrade = async (tradeId: string) => {
    if (!user) return;
    await removeSavedTradeFromCloud(user.uid, tradeId);
    setSavedTrades((prev) => prev.filter((t) => (t.id || `${t.ticker}_${t.expiration}_${t.strike}P`) !== tradeId));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAdmin,
        signIn: handleSignIn,
        signOut: handleSignOut,
        authError,
        clearAuthError: () => setAuthError(null),
        syncCloudWatchlist,
        loadCloudWatchlist,
        savedTrades,
        saveTrade,
        removeTrade,
        refreshSavedTrades,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
