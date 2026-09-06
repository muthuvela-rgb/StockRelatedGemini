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
  serverTimestamp,
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

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

// User Profile & Watchlist Persistence
export async function fetchUserWatchlist(uid?: string): Promise<string[] | null> {
  const effectiveUid = uid || auth.currentUser?.uid;
  if (!effectiveUid) return null;

  try {
    const userRef = doc(db, "users", effectiveUid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data?.watchlist) && data.watchlist.length > 0) {
        const cleanList = Array.from(
          new Set(data.watchlist.map((t: any) => String(t).trim().toUpperCase()))
        ).filter(Boolean);
        return cleanList;
      }
    }
  } catch (err) {
    console.error("Error fetching user watchlist from Firestore:", err);
  }
  return null;
}

export async function saveUserWatchlistToCloud(uid: string | undefined, watchlist: string[]): Promise<string[]> {
  const effectiveUid = uid || auth.currentUser?.uid;
  if (!effectiveUid) {
    throw new Error("User must be authenticated to push watchlist to Cloud Firestore.");
  }

  const cleanList = Array.from(
    new Set(watchlist.map((t) => String(t).trim().toUpperCase()))
  ).filter(Boolean);

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
        watchlist: cleanList,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    console.log(`[Firestore] Saved ${cleanList.length} watchlist tickers for user ${effectiveUid}`);
    return cleanList;
  } catch (err) {
    console.error("Error saving user watchlist to Firestore:", err);
    throw err;
  }
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

export { onAuthStateChanged };
export type { User };
