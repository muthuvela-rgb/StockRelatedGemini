import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  deleteDoc,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";
import { AccessLogEntry, AccessEventType, UserWatchlist } from "../types";

export const SUPERADMIN_EMAIL = "muthu.vela@gmail.com";

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: "select_account",
});

// Initialize Firestore with custom databaseId if configured
export const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)"
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Authentication Functions
export async function signInWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    // Record or update user document in Firestore upon login
    try {
      const userRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email || "",
          displayName: user.displayName || "Trader",
          photoURL: user.photoURL || "",
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
        });
      } else {
        await updateDoc(userRef, {
          lastLoginAt: new Date().toISOString(),
          displayName: user.displayName || userDoc.data()?.displayName || "Trader",
          photoURL: user.photoURL || userDoc.data()?.photoURL || "",
        });
      }
    } catch (dbErr) {
      console.warn("Could not update user record in Firestore:", dbErr);
    }

    return user;
  } catch (error: any) {
    console.error("Error signing in with Google:", error);
    throw error;
  }
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

// User Profile & 3-Watchlist Persistence
export const DEFAULT_USER_WATCHLISTS: UserWatchlist[] = [
  {
    id: "wl-1",
    name: "Core Portfolio",
    tickers: ["NVDA", "QQQ", "ALAB", "MU", "NBIS", "SNDK", "SKHY", "SPCX", "TSLA", "META", "CRWV", "SNOW", "TQQQ", "RKLB", "CRDO"],
  },
  {
    id: "wl-2",
    name: "Tech & Options Leaders",
    tickers: ["NVDA", "AAPL", "MSFT", "MU", "AMZN", "META", "TSLA", "AMD", "PLTR", "QQQ"],
  },
  {
    id: "wl-3",
    name: "High Volatility & Growth",
    tickers: ["TSLA", "NVDA", "PLTR", "ARM", "AMD", "COIN", "MSTR", "SMCI", "MARA"],
  },
];

export async function fetchUserWatchlists(
  uid?: string
): Promise<{ watchlists: UserWatchlist[]; activeIndex: number } | null> {
  const effectiveUid = uid || auth.currentUser?.uid;
  if (!effectiveUid) return null;

  try {
    const userRef = doc(db, "users", effectiveUid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      let activeIndex = typeof data?.activeWatchlistIndex === "number" ? data.activeWatchlistIndex : 0;
      if (activeIndex < 0 || activeIndex > 2) activeIndex = 0;

      // 1. Check if structured 3-watchlists array exists
      if (Array.isArray(data?.watchlists) && data.watchlists.length > 0) {
        const loadedList: UserWatchlist[] = [];
        for (let i = 0; i < 3; i++) {
          const item = data.watchlists[i];
          const defaultItem = DEFAULT_USER_WATCHLISTS[i];
          if (item) {
            const cleanTickers: string[] = Array.isArray(item.tickers)
              ? Array.from(new Set(item.tickers.map((t: any) => String(t).trim().toUpperCase()))).filter((t): t is string => Boolean(t))
              : defaultItem.tickers;
            loadedList.push({
              id: item.id || `wl-${i + 1}`,
              name: typeof item.name === "string" && item.name.trim() ? item.name.trim() : defaultItem.name,
              tickers: cleanTickers,
            });
          } else {
            loadedList.push(defaultItem);
          }
        }
        return { watchlists: loadedList, activeIndex };
      }

      // 2. Legacy fallback: check single watchlist array and migrate to slot 1
      if (Array.isArray(data?.watchlist) && data.watchlist.length > 0) {
        const cleanList: string[] = Array.from(
          new Set(data.watchlist.map((t: any) => String(t).trim().toUpperCase()))
        ).filter((t): t is string => Boolean(t));
        const migratedList: UserWatchlist[] = [
          {
            id: "wl-1",
            name: "Core Portfolio",
            tickers: cleanList,
          },
          DEFAULT_USER_WATCHLISTS[1],
          DEFAULT_USER_WATCHLISTS[2],
        ];
        return { watchlists: migratedList, activeIndex: 0 };
      }
    }
  } catch (err) {
    console.error("Error fetching user watchlists from Firestore:", err);
  }
  return null;
}

export async function saveUserWatchlistsToCloud(
  uid: string | undefined,
  watchlists: UserWatchlist[],
  activeIndex: number = 0
): Promise<{ watchlists: UserWatchlist[]; activeIndex: number }> {
  const effectiveUid = uid || auth.currentUser?.uid;
  if (!effectiveUid) {
    throw new Error("User must be authenticated to push watchlists to Cloud Firestore.");
  }

  // Ensure exactly 3 watchlists are properly sanitized
  const sanitizedWatchlists: UserWatchlist[] = [];
  for (let i = 0; i < 3; i++) {
    const wl = watchlists[i] || DEFAULT_USER_WATCHLISTS[i];
    const cleanTickers = Array.from(
      new Set((wl.tickers || []).map((t) => String(t).trim().toUpperCase()))
    ).filter(Boolean);
    sanitizedWatchlists.push({
      id: wl.id || `wl-${i + 1}`,
      name: wl.name && wl.name.trim() ? wl.name.trim() : DEFAULT_USER_WATCHLISTS[i].name,
      tickers: cleanTickers,
    });
  }

  const safeActiveIndex = Math.min(Math.max(0, activeIndex), 2);
  const activeTickers = sanitizedWatchlists[safeActiveIndex].tickers;

  try {
    const userRef = doc(db, "users", effectiveUid);
    const currentUser = auth.currentUser;

    await setDoc(
      userRef,
      {
        uid: effectiveUid,
        email: currentUser?.email || "",
        displayName: currentUser?.displayName || "Trader",
        photoURL: currentUser?.photoURL || "",
        watchlist: activeTickers,
        watchlists: sanitizedWatchlists,
        activeWatchlistIndex: safeActiveIndex,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    console.log(`[Firestore] Saved 3 watchlists for user ${effectiveUid} (active index: ${safeActiveIndex})`);
    return { watchlists: sanitizedWatchlists, activeIndex: safeActiveIndex };
  } catch (err) {
    console.error("Error saving user watchlists to Firestore:", err);
    throw err;
  }
}

// Legacy wrappers for backward compatibility with existing components
export async function fetchUserWatchlist(uid?: string): Promise<string[] | null> {
  const res = await fetchUserWatchlists(uid);
  if (!res) return null;
  return res.watchlists[res.activeIndex]?.tickers || res.watchlists[0]?.tickers || null;
}

export async function saveUserWatchlistToCloud(uid: string | undefined, watchlist: string[]): Promise<string[]> {
  const effectiveUid = uid || auth.currentUser?.uid;
  const current = await fetchUserWatchlists(effectiveUid);
  const watchlists = current ? [...current.watchlists] : [...DEFAULT_USER_WATCHLISTS];
  const activeIdx = current ? current.activeIndex : 0;

  const cleanList = Array.from(
    new Set(watchlist.map((t) => String(t).trim().toUpperCase()))
  ).filter(Boolean);

  watchlists[activeIdx] = {
    ...watchlists[activeIdx],
    tickers: cleanList,
  };

  await saveUserWatchlistsToCloud(effectiveUid, watchlists, activeIdx);
  return cleanList;
}

// Saved Trades / Bookmarked Recommendations Persistence
export interface SavedTradeItem {
  id?: string;
  ticker: string;
  strike: number;
  expiration: string;
  dte?: number;
  bid?: number;
  ask?: number;
  premium?: number;
  annualizedReturn?: number;
  downsideBuffer?: number;
  tier?: string;
  score?: number;
  rationale?: string;
  savedAt?: string;
}

export async function saveTradeToCloud(uid: string, trade: SavedTradeItem): Promise<string> {
  const safeId = trade.id || `${trade.ticker}_${trade.expiration}_${trade.strike}P`;
  const tradeRef = doc(db, "users", uid, "savedTrades", safeId);
  const data = {
    ...trade,
    id: safeId,
    savedAt: new Date().toISOString(),
  };
  await setDoc(tradeRef, data, { merge: true });
  return safeId;
}

export async function fetchSavedTradesFromCloud(uid: string): Promise<SavedTradeItem[]> {
  try {
    const colRef = collection(db, "users", uid, "savedTrades");
    const snap = await getDocs(colRef);
    const trades: SavedTradeItem[] = [];
    snap.forEach((d) => {
      trades.push({ id: d.id, ...(d.data() as SavedTradeItem) });
    });
    return trades;
  } catch (err) {
    console.error("Error fetching saved trades from Firestore:", err);
    return [];
  }
}

export async function removeSavedTradeFromCloud(uid: string, tradeId: string): Promise<void> {
  const tradeRef = doc(db, "users", uid, "savedTrades", tradeId);
  await deleteDoc(tradeRef);
}

// ----------------------------------------------------
// ACCESS AUDIT & ATTEMPT LOGGING (Admin: muthu.vela@gmail.com)
// ----------------------------------------------------

export function parseUserAgent(ua: string): { browser: string; os: string; device: string } {
  let browser = "Unknown Browser";
  let os = "Unknown OS";
  let device = "Desktop";

  if (/iPhone/i.test(ua)) {
    device = "iPhone";
    os = "iOS";
  } else if (/iPad/i.test(ua)) {
    device = "iPad";
    os = "iPadOS";
  } else if (/Android/i.test(ua)) {
    device = /Mobile/i.test(ua) ? "Android Phone" : "Android Tablet";
    os = "Android";
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    os = "macOS";
  } else if (/Windows NT/i.test(ua)) {
    os = "Windows";
  } else if (/Linux/i.test(ua)) {
    os = "Linux";
  }

  if (/Edg\//i.test(ua)) {
    browser = "Microsoft Edge";
  } else if (/Chrome\//i.test(ua) && !/Chromium|OPR|Edg/i.test(ua)) {
    browser = "Google Chrome";
  } else if (/Safari\//i.test(ua) && !/Chrome|Chromium/i.test(ua)) {
    browser = "Apple Safari";
  } else if (/Firefox\//i.test(ua)) {
    browser = "Mozilla Firefox";
  } else if (/OPR|Opera/i.test(ua)) {
    browser = "Opera";
  }

  return { browser, os, device };
}

export async function logAccessEvent(params: {
  eventType: AccessEventType;
  email?: string;
  name?: string;
  photo?: string;
  uid?: string;
  details?: string;
  status?: "AUTHORIZED" | "GUEST" | "ADMIN" | "BLOCKED";
}): Promise<void> {
  try {
    const currentUser = auth.currentUser;
    const email = (params.email || currentUser?.email || "Anonymous / Unauthenticated").trim();
    const name = params.name || currentUser?.displayName || (email.includes("@") ? email.split("@")[0] : "Guest Visitor");
    const photo = params.photo || currentUser?.photoURL || "";
    const uid = params.uid || currentUser?.uid || "";
    const nowIso = new Date().toISOString();

    const isSuperAdmin = email.toLowerCase() === SUPERADMIN_EMAIL.toLowerCase();

    let computedStatus: "AUTHORIZED" | "GUEST" | "ADMIN" | "BLOCKED" = params.status || "GUEST";
    if (params.status) {
      computedStatus = params.status;
    } else if (isSuperAdmin) {
      computedStatus = "ADMIN";
    } else if (currentUser || (params.email && params.email.includes("@"))) {
      computedStatus = "AUTHORIZED";
    } else {
      computedStatus = "GUEST";
    }

    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "Server/Backend";
    const { browser, os, device } = parseUserAgent(ua);
    const path = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/";
    const referrer = typeof document !== "undefined" ? document.referrer || "direct" : "direct";

    const logEntry: AccessLogEntry = {
      timestamp: nowIso,
      userEmail: email,
      userName: name,
      userPhoto: photo,
      userId: uid,
      eventType: params.eventType,
      status: computedStatus,
      ip: "Detecting...", // will be enriched by server proxy or IP resolver
      userAgent: `${browser} on ${os} (${device})`,
      path,
      referrer,
      device: `${device} • ${os}`,
      details: params.details || (isSuperAdmin ? "Superadmin access" : "Standard session access"),
    };

    // 1. Send to server proxy to record real client IP & server audit log
    try {
      const res = await fetch("/api/log-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(logEntry),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ip) {
          logEntry.ip = data.ip;
        }
      }
    } catch {
      // server call failure is non-blocking
    }

    // 2. Persist to Firestore access_logs collection
    try {
      const colRef = collection(db, "access_logs");
      await addDoc(colRef, logEntry);
    } catch (fsErr) {
      console.warn("Could not write access log to Firestore:", fsErr);
    }
  } catch (err) {
    console.error("Failed to log access event:", err);
  }
}

export async function fetchAccessLogsFromCloud(): Promise<AccessLogEntry[]> {
  try {
    const colRef = collection(db, "access_logs");
    const q = query(colRef, orderBy("timestamp", "desc"), limit(300));
    const snap = await getDocs(q);
    const logs: AccessLogEntry[] = [];
    snap.forEach((d) => {
      logs.push({ id: d.id, ...(d.data() as AccessLogEntry) });
    });
    return logs;
  } catch (err) {
    console.warn("Firestore fetchAccessLogsFromCloud failed, attempting server fallback:", err);
    // Fallback to server API
    try {
      const currentUser = auth.currentUser;
      const res = await fetch(`/api/access-logs?email=${encodeURIComponent(currentUser?.email || "")}`);
      if (res.ok) {
        const data = await res.json();
        return data.logs || [];
      }
    } catch (srvErr) {
      console.error("Server access-logs fallback failed:", srvErr);
    }
    return [];
  }
}

export function subscribeAccessLogs(
  onUpdate: (logs: AccessLogEntry[]) => void,
  onError?: (err: any) => void
): () => void {
  try {
    const colRef = collection(db, "access_logs");
    const q = query(colRef, orderBy("timestamp", "desc"), limit(300));
    return onSnapshot(
      q,
      (snap) => {
        const logs: AccessLogEntry[] = [];
        snap.forEach((d) => {
          logs.push({ id: d.id, ...(d.data() as AccessLogEntry) });
        });
        onUpdate(logs);
      },
      (err) => {
        console.warn("Firestore access_logs snapshot listener error:", err);
        if (onError) onError(err);
      }
    );
  } catch (err) {
    console.error("Error setting up access_logs listener:", err);
    return () => {};
  }
}

export async function clearAccessLogsFromCloud(): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.email?.toLowerCase() !== SUPERADMIN_EMAIL.toLowerCase()) {
    throw new Error(`Unauthorized: Only ${SUPERADMIN_EMAIL} can clear access logs.`);
  }

  // 1. Clear in Firestore
  try {
    const colRef = collection(db, "access_logs");
    const snap = await getDocs(query(colRef, limit(300)));
    const deletePromises = snap.docs.map((d) => deleteDoc(d.ref));
    await Promise.all(deletePromises);
  } catch (e) {
    console.warn("Failed to batch delete Firestore access logs:", e);
  }

  // 2. Clear on server
  try {
    await fetch(`/api/access-logs?email=${encodeURIComponent(currentUser.email)}`, {
      method: "DELETE",
    });
  } catch (e) {
    console.warn("Failed to clear server access logs:", e);
  }
}

export { onAuthStateChanged };
export type { User };

