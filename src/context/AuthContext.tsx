import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  auth,
  onAuthStateChanged,
  signInWithGoogle,
  signOutUser,
  fetchUserWatchlist,
  saveUserWatchlistToCloud,
  fetchUserWatchlists,
  saveUserWatchlistsToCloud,
  DEFAULT_USER_WATCHLISTS,
  SavedTradeItem,
  fetchSavedTradesFromCloud,
  saveTradeToCloud,
  removeSavedTradeFromCloud,
  logAccessEvent,
  SUPERADMIN_EMAIL,
} from "../lib/firebase";
import { UserWatchlist } from "../types";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  authError: string | null;
  clearAuthError: () => void;
  // Multi-Watchlist System
  watchlists: UserWatchlist[];
  activeWatchlistIndex: number;
  setActiveWatchlistIndex: (index: number) => void;
  createWatchlist: (name: string, tickers: string[], setAsActive?: boolean) => Promise<void>;
  deleteWatchlistAtIndex: (index: number) => Promise<void>;
  updateWatchlistAtIndex: (index: number, newTickers: string[], newName?: string) => Promise<void>;
  renameWatchlistAtIndex: (index: number, newName: string) => Promise<void>;
  syncCloudWatchlists: (watchlists: UserWatchlist[], activeIndex?: number) => Promise<void>;
  loadCloudWatchlists: () => Promise<{ watchlists: UserWatchlist[]; activeIndex: number } | null>;
  // Legacy Cloud Watchlist sync
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
  const [watchlists, setWatchlists] = useState<UserWatchlist[]>(DEFAULT_USER_WATCHLISTS);
  const [activeWatchlistIndex, setActiveWatchlistIndexState] = useState<number>(0);

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
          // Load 3 watchlists from cloud
          const cloudData = await fetchUserWatchlists(currentUser.uid);
          if (cloudData && cloudData.watchlists && cloudData.watchlists.length === 3) {
            setWatchlists(cloudData.watchlists);
            setActiveWatchlistIndexState(cloudData.activeIndex);
          }
        } catch (e) {
          console.warn("Failed to load user watchlists from cloud:", e);
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

  const setActiveWatchlistIndex = (index: number) => {
    const safeIdx = Math.min(Math.max(0, index), Math.max(0, watchlists.length - 1));
    setActiveWatchlistIndexState(safeIdx);
    if (user?.uid) {
      saveUserWatchlistsToCloud(user.uid, watchlists, safeIdx).catch((err) =>
        console.warn("Failed to persist active watchlist index to cloud:", err)
      );
    }
  };

  const createWatchlist = async (name: string, tickers: string[], setAsActive: boolean = true) => {
    const cleanName = name.trim() || `Watchlist ${watchlists.length + 1}`;
    const cleanList = Array.from(
      new Set(tickers.map((t) => String(t).trim().toUpperCase()))
    ).filter(Boolean);

    const newId = `wl-${Date.now()}`;
    const newWatchlist: UserWatchlist = {
      id: newId,
      name: cleanName,
      tickers: cleanList,
    };

    const updated = [...watchlists, newWatchlist];
    const newIndex = setAsActive ? updated.length - 1 : activeWatchlistIndex;

    setWatchlists(updated);
    if (setAsActive) {
      setActiveWatchlistIndexState(newIndex);
    }

    if (user?.uid) {
      try {
        await saveUserWatchlistsToCloud(user.uid, updated, newIndex);
      } catch (err) {
        console.error("Error saving newly created watchlist to cloud:", err);
      }
    }
  };

  const deleteWatchlistAtIndex = async (index: number) => {
    if (watchlists.length <= 1) {
      throw new Error("Cannot delete the only remaining watchlist.");
    }
    const safeIdx = Math.min(Math.max(0, index), watchlists.length - 1);
    const updated = watchlists.filter((_, i) => i !== safeIdx);

    let nextActiveIndex = activeWatchlistIndex;
    if (activeWatchlistIndex === safeIdx) {
      nextActiveIndex = Math.max(0, safeIdx - 1);
    } else if (activeWatchlistIndex > safeIdx) {
      nextActiveIndex = activeWatchlistIndex - 1;
    }
    nextActiveIndex = Math.min(Math.max(0, nextActiveIndex), updated.length - 1);

    setWatchlists(updated);
    setActiveWatchlistIndexState(nextActiveIndex);

    if (user?.uid) {
      try {
        await saveUserWatchlistsToCloud(user.uid, updated, nextActiveIndex);
      } catch (err) {
        console.error("Error saving watchlists to cloud after deletion:", err);
      }
    }
  };

  const updateWatchlistAtIndex = async (index: number, newTickers: string[], newName?: string) => {
    const safeIdx = Math.min(Math.max(0, index), Math.max(0, watchlists.length - 1));
    const cleanList = Array.from(
      new Set(newTickers.map((t) => String(t).trim().toUpperCase()))
    ).filter(Boolean);

    const updated = watchlists.map((wl, i) => {
      if (i === safeIdx) {
        return {
          ...wl,
          name: newName && newName.trim() ? newName.trim() : wl.name,
          tickers: cleanList,
        };
      }
      return wl;
    });

    setWatchlists(updated);

    if (user?.uid) {
      try {
        await saveUserWatchlistsToCloud(user.uid, updated, activeWatchlistIndex);
      } catch (err) {
        console.error("Error saving updated watchlist to cloud:", err);
      }
    }
  };

  const renameWatchlistAtIndex = async (index: number, newName: string) => {
    const safeIdx = Math.min(Math.max(0, index), Math.max(0, watchlists.length - 1));
    const cleanName = newName.trim() || `Watchlist ${safeIdx + 1}`;

    const updated = watchlists.map((wl, i) => (i === safeIdx ? { ...wl, name: cleanName } : wl));
    setWatchlists(updated);

    if (user?.uid) {
      try {
        await saveUserWatchlistsToCloud(user.uid, updated, activeWatchlistIndex);
      } catch (err) {
        console.error("Error saving renamed watchlist to cloud:", err);
      }
    }
  };

  const syncCloudWatchlists = async (listsToSync: UserWatchlist[], activeIdx?: number) => {
    const currentUid = user?.uid || auth.currentUser?.uid;
    if (!currentUid) {
      throw new Error("You must be signed in with Google to sync watchlists to Cloud.");
    }
    const safeActive = activeIdx !== undefined ? Math.min(Math.max(0, activeIdx), Math.max(0, listsToSync.length - 1)) : activeWatchlistIndex;
    const res = await saveUserWatchlistsToCloud(currentUid, listsToSync, safeActive);
    setWatchlists(res.watchlists);
    setActiveWatchlistIndexState(res.activeIndex);
  };

  const loadCloudWatchlists = async (): Promise<{ watchlists: UserWatchlist[]; activeIndex: number } | null> => {
    const currentUid = user?.uid || auth.currentUser?.uid;
    if (!currentUid) return null;
    const res = await fetchUserWatchlists(currentUid);
    if (res) {
      setWatchlists(res.watchlists);
      setActiveWatchlistIndexState(res.activeIndex);
    }
    return res;
  };

  // Backward compatibility methods
  const syncCloudWatchlist = async (watchlist: string[]): Promise<string[]> => {
    const currentUid = user?.uid || auth.currentUser?.uid;
    if (!currentUid) {
      throw new Error("You must be signed in with Google to sync watchlist to Cloud.");
    }
    const cleanList = Array.from(
      new Set(watchlist.map((t) => String(t).trim().toUpperCase()))
    ).filter(Boolean);

    await updateWatchlistAtIndex(activeWatchlistIndex, cleanList);
    return cleanList;
  };

  const loadCloudWatchlist = async (): Promise<string[] | null> => {
    const res = await loadCloudWatchlists();
    if (!res) return null;
    return res.watchlists[res.activeIndex]?.tickers || res.watchlists[0]?.tickers || null;
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
        watchlists,
        activeWatchlistIndex,
        setActiveWatchlistIndex,
        createWatchlist,
        deleteWatchlistAtIndex,
        updateWatchlistAtIndex,
        renameWatchlistAtIndex,
        syncCloudWatchlists,
        loadCloudWatchlists,
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

