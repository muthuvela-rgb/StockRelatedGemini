import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  LineChart,
  ShieldCheck,
  Lock,
  Layers,
  Activity,
  FileSpreadsheet,
  AlertCircle,
  ExternalLink,
  Cloud,
  CheckCircle2,
  Sparkles
} from "lucide-react";

export const LoginPortal: React.FC = () => {
  const { signIn, authError, clearAuthError } = useAuth();
  const [signingIn, setSigningIn] = useState(false);

  const handleSignIn = async () => {
    setSigningIn(true);
    try {
      await signIn();
    } finally {
      setSigningIn(false);
    }
  };

  const handleOpenInNewTab = () => {
    window.open(window.location.href, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden">
      {/* Ambient background glow accents */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-blue-600/10 via-indigo-600/5 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-cyan-600/5 blur-3xl pointer-events-none" />

      {/* Top mini-bar */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-sm px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-md shadow-blue-500/20 ring-1 ring-white/20">
            <LineChart className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-base text-white font-display tracking-tight">StockRelated</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Lock className="w-3.5 h-3.5 text-blue-400" />
          <span className="font-mono text-[11px]">Protected Access</span>
        </div>
      </header>

      {/* Main Login Card Section */}
      <main className="flex-1 flex items-center justify-center px-4 py-12 z-10">
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl shadow-black/60 backdrop-blur-xl flex flex-col items-center text-center">
          {/* Logo badge */}
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-xl shadow-blue-500/30 ring-1 ring-white/20 mb-6">
            <LineChart className="w-8 h-8 text-white" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-3">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Secure Authentication Gate</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-white font-display tracking-tight">
            StockRelated Analytics
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-sm leading-relaxed">
            Sign in with your Google account to access quantitative options scanner, OCC TIMS margin models, and live market intelligence.
          </p>

          {/* Sign In Button */}
          <div className="w-full mt-7 space-y-3">
            <button
              onClick={handleSignIn}
              disabled={signingIn}
              className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-blue-600/30 hover:shadow-blue-600/40 border border-blue-400/30 transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60 select-none group"
            >
              {/* Google Brand G Icon */}
              <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-sm shrink-0">
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              </div>
              <span className="tracking-wide">
                {signingIn ? "Connecting to Google..." : "Continue with Google"}
              </span>
            </button>

            {/* Error Notification with Sandbox resolution tip */}
            {authError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-left text-xs text-rose-300 animate-in fade-in duration-200">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-rose-200">Sign-in Notice</p>
                    <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                      {authError}
                    </p>
                    <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-rose-500/20">
                      <button
                        onClick={handleOpenInNewTab}
                        className="text-[11px] text-cyan-300 hover:text-cyan-200 font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <span>Open in New Tab</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                      <button
                        onClick={clearAuthError}
                        className="text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Feature Highlights included in subscription */}
          <div className="w-full mt-8 pt-6 border-t border-slate-800/80 text-left space-y-2.5">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block font-mono">
              Features Unlocked
            </span>
            <div className="grid grid-cols-1 gap-2 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>3-Tier Cash-Secured Put Recommendations</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Real-Time OCC TIMS Margin Calculations</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Black-Scholes Greeks, IV Smile, & Fall Detector</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Cloud Firestore Watchlists & Trade Bookmarks</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 px-6 py-4 text-center text-xs text-slate-500 z-10 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>StockRelated • Quantitative Options & Technical Analysis Suite</span>
        <span className="text-[11px] text-slate-500 font-mono">
          Firebase Authentication • Cloud Firestore Persistent Storage
        </span>
      </footer>
    </div>
  );
};
