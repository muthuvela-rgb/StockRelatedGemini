import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import {
  fetchAccessLogsFromCloud,
  subscribeAccessLogs,
  clearAccessLogsFromCloud,
  SUPERADMIN_EMAIL,
  logAccessEvent,
} from "../lib/firebase";
import { AccessLogEntry, AccessEventType } from "../types";
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  Search,
  RefreshCw,
  Download,
  Trash2,
  Filter,
  UserCheck,
  UserX,
  Globe,
  Monitor,
  Clock,
  ExternalLink,
  Eye,
  AlertTriangle,
  X,
  Copy,
  Check,
  Radio,
  Calendar,
  Smartphone,
  Laptop
} from "lucide-react";

export const AccessAuditViewer: React.FC = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AccessLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEventType, setSelectedEventType] = useState<string>("ALL");
  const [timeFilter, setTimeFilter] = useState<"ALL" | "TODAY" | "24H" | "7D">("ALL");
  const [selectedLog, setSelectedLog] = useState<AccessLogEntry | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [liveConnected, setLiveConnected] = useState(false);

  const isAdmin = Boolean(
    user?.email && user.email.toLowerCase() === SUPERADMIN_EMAIL.toLowerCase()
  );

  // Security barrier if accessed by any other user
  useEffect(() => {
    if (!isAdmin) {
      logAccessEvent({
        eventType: "RESTRICTED_ATTEMPT",
        status: "BLOCKED",
        details: `UNAUTHORIZED ACCESS ATTEMPT: User ${user?.email || "Anonymous"} tried accessing AccessAuditViewer.`,
      });
    }
  }, [isAdmin, user]);

  // Load and listen for live access logs
  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    setLoading(true);
    // Initial fetch
    fetchAccessLogsFromCloud()
      .then((data) => {
        setLogs(data);
      })
      .finally(() => {
        setLoading(false);
      });

    // Real-time listener
    const unsubscribe = subscribeAccessLogs(
      (newLogs) => {
        if (newLogs && newLogs.length > 0) {
          setLogs(newLogs);
          setLiveConnected(true);
        }
      },
      () => {
        setLiveConnected(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [isAdmin]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const refreshed = await fetchAccessLogsFromCloud();
      setLogs(refreshed);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleClearLogs = async () => {
    if (!window.confirm("Are you sure you want to purge all access audit logs? This action is permanent.")) {
      return;
    }
    setIsClearing(true);
    try {
      await clearAccessLogsFromCloud();
      setLogs([]);
      setSelectedLog(null);
    } catch (e: any) {
      alert(e?.message || "Failed to clear access logs.");
    } finally {
      setIsClearing(false);
    }
  };

  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 1800);
  };

  const handleExportCsv = () => {
    if (logs.length === 0) return;
    const headers = [
      "Timestamp",
      "User Email",
      "User Name",
      "Event Type",
      "Status",
      "IP Address",
      "Device / OS",
      "Path",
      "Referrer",
      "Details"
    ];

    const rows = logs.map((l) => [
      `"${l.timestamp}"`,
      `"${l.userEmail}"`,
      `"${l.userName}"`,
      `"${l.eventType}"`,
      `"${l.status}"`,
      `"${l.ip}"`,
      `"${l.userAgent?.replace(/"/g, '""')}"`,
      `"${l.path}"`,
      `"${l.referrer || ""}"`,
      `"${l.details?.replace(/"/g, '""') || ""}"`
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `stockrelated_access_audit_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJson = () => {
    if (logs.length === 0) return;
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `stockrelated_access_audit_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter logs by search, event type, and date
  const filteredLogs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const now = new Date().getTime();

    return logs.filter((log) => {
      // Event type filter
      if (selectedEventType !== "ALL" && log.eventType !== selectedEventType) {
        return false;
      }

      // Time filter
      if (timeFilter !== "ALL") {
        const logTime = new Date(log.timestamp).getTime();
        const diffHours = (now - logTime) / (1000 * 60 * 60);
        if (timeFilter === "TODAY") {
          const logDate = new Date(log.timestamp).toDateString();
          const todayDate = new Date().toDateString();
          if (logDate !== todayDate) return false;
        } else if (timeFilter === "24H" && diffHours > 24) {
          return false;
        } else if (timeFilter === "7D" && diffHours > 24 * 7) {
          return false;
        }
      }

      // Search query
      if (query) {
        const matchEmail = log.userEmail?.toLowerCase().includes(query);
        const matchName = log.userName?.toLowerCase().includes(query);
        const matchIp = log.ip?.toLowerCase().includes(query);
        const matchUa = log.userAgent?.toLowerCase().includes(query);
        const matchDetails = log.details?.toLowerCase().includes(query);
        const matchPath = log.path?.toLowerCase().includes(query);
        return matchEmail || matchName || matchIp || matchUa || matchDetails || matchPath;
      }

      return true;
    });
  }, [logs, searchQuery, selectedEventType, timeFilter]);

  // High-level statistics
  const stats = useMemo(() => {
    const total = logs.length;
    const googleUsers = new Set(
      logs.filter((l) => l.userEmail && l.userEmail.includes("@")).map((l) => l.userEmail.toLowerCase())
    );
    const uniqueIps = new Set(logs.map((l) => l.ip).filter(Boolean));
    const blockedCount = logs.filter((l) => l.status === "BLOCKED" || l.eventType === "RESTRICTED_ATTEMPT").length;
    const latest = logs[0] || null;

    return {
      total,
      uniqueUsersCount: googleUsers.size,
      uniqueIpsCount: uniqueIps.size,
      blockedCount,
      latestTime: latest ? formatRelativeTime(latest.timestamp) : "No activity yet",
      latestUser: latest ? (latest.userEmail || latest.userName) : "None",
    };
  }, [logs]);

  function formatRelativeTime(isoString: string) {
    try {
      const past = new Date(isoString).getTime();
      const now = new Date().getTime();
      const diffSecs = Math.max(0, Math.floor((now - past) / 1000));

      if (diffSecs < 10) return "Just now";
      if (diffSecs < 60) return `${diffSecs}s ago`;
      const diffMins = Math.floor(diffSecs / 60);
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return isoString;
    }
  }

  function formatFullDateTime(isoString: string) {
    try {
      const date = new Date(isoString);
      return date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return isoString;
    }
  }

  // -------------------------------------------------------------
  // BANNED BARRIER: Non-authorized account
  // -------------------------------------------------------------
  if (!isAdmin) {
    return (
      <div className="w-full py-12 px-4 flex justify-center items-center">
        <div className="max-w-lg w-full bg-slate-900 border border-rose-900/60 rounded-2xl p-8 shadow-2xl text-center backdrop-blur-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-600 via-red-500 to-rose-600" />
          
          <div className="mx-auto w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-5 shadow-lg shadow-rose-950/50">
            <Lock className="w-8 h-8" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono font-semibold mb-3">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>403 FORBIDDEN • BANNED AREA</span>
          </div>

          <h2 className="text-2xl font-bold text-white font-display tracking-tight">
            Restricted Access
          </h2>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
            This security audit console is strictly restricted to administrator{" "}
            <span className="text-rose-300 font-mono font-medium">{SUPERADMIN_EMAIL}</span>.
          </p>

          <div className="mt-6 p-4 rounded-xl bg-slate-950/80 border border-rose-900/40 text-left text-xs text-slate-300 space-y-2 font-mono">
            <div className="flex justify-between items-center text-slate-400 border-b border-slate-800 pb-2">
              <span>SECURITY NOTICE</span>
              <span className="text-rose-400">ACCESS VIOLATION</span>
            </div>
            <p className="text-slate-400">
              Your Google Account (<span className="text-white">{user?.email || "Anonymous Visitor"}</span>) does not hold administrative authorization.
            </p>
            <p className="text-[11px] text-slate-500 pt-1">
              This access attempt and your connection metadata have been permanently recorded to the central audit log.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // SUPERADMIN VIEW (muthu.vela@gmail.com)
  // -------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-600/20 ring-1 ring-white/20 shrink-0">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-white font-display tracking-tight">
                  Access & Security Audit Console
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Superadmin Only
                </span>
                {liveConnected && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[11px] font-mono">
                    <Radio className="w-3 h-3 text-blue-400 animate-pulse" />
                    Live Sync
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Real-time tracking of who accessed or attempted to access this web application, exact timestamps, and network origins.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 self-end lg:self-center flex-wrap">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition cursor-pointer disabled:opacity-50"
              title="Refresh access records"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-blue-400" : ""}`} />
              <span>{isRefreshing ? "Syncing..." : "Refresh"}</span>
            </button>

            <button
              onClick={handleExportCsv}
              disabled={logs.length === 0}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition cursor-pointer disabled:opacity-40"
              title="Export to CSV"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>CSV</span>
            </button>

            <button
              onClick={handleExportJson}
              disabled={logs.length === 0}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition cursor-pointer disabled:opacity-40"
              title="Export to JSON"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>JSON</span>
            </button>

            <button
              onClick={handleClearLogs}
              disabled={isClearing || logs.length === 0}
              className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 text-xs font-semibold flex items-center gap-1.5 border border-rose-500/30 transition cursor-pointer disabled:opacity-40"
              title="Purge audit records"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>{isClearing ? "Clearing..." : "Purge Logs"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* Total Hits */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
              Total Attempts
            </span>
            <Globe className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-white font-display mt-2">
            {stats.total.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Recorded access attempts
          </p>
        </div>

        {/* Unique Google Accounts */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
              Google Accounts
            </span>
            <UserCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400 font-display mt-2">
            {stats.uniqueUsersCount}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Distinct signed-in users
          </p>
        </div>

        {/* Unique IP Addresses */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
              Unique IPs
            </span>
            <Monitor className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-bold text-indigo-300 font-display mt-2">
            {stats.uniqueIpsCount}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Distinct visitor IP nodes
          </p>
        </div>

        {/* Flagged / Blocked Attempts */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
              Security Flags
            </span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-bold text-rose-400 font-display mt-2">
            {stats.blockedCount}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {stats.blockedCount > 0 ? "Unauthorized attempts flagged" : "Clean security state"}
          </p>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Google email, name, IP address, device, or details..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Time Filter Tabs */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 shrink-0">
            {(
              [
                { id: "ALL", label: "All Time" },
                { id: "TODAY", label: "Today" },
                { id: "24H", label: "Last 24h" },
                { id: "7D", label: "Last 7d" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setTimeFilter(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
                  timeFilter === t.id
                    ? "bg-blue-600 text-white shadow-sm font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Event Type Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs scrollbar-none">
          <span className="text-slate-500 text-[11px] font-mono uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Filter:
          </span>
          {[
            { id: "ALL", label: `All Events (${logs.length})` },
            {
              id: "LOGIN_SUCCESS",
              label: `Google Sign-Ins (${logs.filter((l) => l.eventType === "LOGIN_SUCCESS").length})`,
            },
            {
              id: "PAGE_VISIT",
              label: `Page Visits (${logs.filter((l) => l.eventType === "PAGE_VISIT").length})`,
            },
            {
              id: "RESTRICTED_ATTEMPT",
              label: `Blocked Attempts (${logs.filter((l) => l.eventType === "RESTRICTED_ATTEMPT" || l.status === "BLOCKED").length})`,
            },
            {
              id: "LOGIN_FAILED",
              label: `Failed Logins (${logs.filter((l) => l.eventType === "LOGIN_FAILED").length})`,
            },
            {
              id: "SIGNOUT",
              label: `Signouts (${logs.filter((l) => l.eventType === "SIGNOUT").length})`,
            },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedEventType(item.id)}
              className={`px-3 py-1 rounded-full text-xs whitespace-nowrap transition cursor-pointer ${
                selectedEventType === item.id
                  ? "bg-slate-700 text-white font-semibold border border-slate-600 shadow-sm"
                  : "bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-white font-display">
              Access Log Stream
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
              Showing {filteredLogs.length} of {logs.length}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
            Ordered by newest timestamp first
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-400 mb-2" />
            <p className="text-xs">Loading access audit logs from Firestore...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Clock className="w-8 h-8 mx-auto text-slate-600 mb-3" />
            <p className="text-sm font-medium text-slate-300">No access logs found</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchQuery || selectedEventType !== "ALL" || timeFilter !== "ALL"
                ? "Try adjusting your search query or filters."
                : "No access events have been recorded yet. Any new visits or Google logins will immediately appear here."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[11px] border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">User / Identity</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Event & Status</th>
                  <th className="py-3 px-4">IP Address</th>
                  <th className="py-3 px-4">Device / Client</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {filteredLogs.map((log, index) => {
                  const isLogAdmin = log.userEmail?.toLowerCase() === SUPERADMIN_EMAIL.toLowerCase();
                  const isBlocked = log.status === "BLOCKED" || log.eventType === "RESTRICTED_ATTEMPT";
                  const isLogin = log.eventType === "LOGIN_SUCCESS";

                  return (
                    <tr
                      key={log.id || `row_${index}`}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isBlocked ? "bg-rose-950/20" : isLogAdmin ? "bg-emerald-950/10" : ""
                      }`}
                    >
                      {/* User / Identity */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {log.userPhoto ? (
                            <img
                              src={log.userPhoto}
                              alt=""
                              referrerPolicy="no-referrer"
                              className="w-8 h-8 rounded-full ring-1 ring-slate-700 shrink-0 object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold shrink-0 text-xs">
                              {log.userName ? log.userName[0]?.toUpperCase() : "?"}
                            </div>
                          )}
                          <div className="min-w-0 max-w-[200px] sm:max-w-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-white truncate">
                                {log.userName || "Guest Visitor"}
                              </span>
                              {isLogAdmin && (
                                <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold">
                                  ADMIN
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono truncate block">
                              {log.userEmail || "Anonymous (No Google Login)"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Timestamp */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-200">
                            {formatRelativeTime(log.timestamp)}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {formatFullDateTime(log.timestamp)}
                          </span>
                        </div>
                      </td>

                      {/* Event & Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                              isBlocked
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                : isLogin
                                ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                                : log.eventType === "SIGNOUT"
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                : "bg-slate-800 text-slate-300 border border-slate-700"
                            }`}
                          >
                            {isBlocked && <AlertTriangle className="w-3 h-3 text-rose-400" />}
                            {isLogin && <UserCheck className="w-3 h-3 text-blue-400" />}
                            <span>{log.eventType}</span>
                          </span>

                          <span className="text-[10px] text-slate-500 font-mono">
                            Status: <span className="text-slate-400 uppercase">{log.status}</span>
                          </span>
                        </div>
                      </td>

                      {/* IP Address */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <span>{log.ip || "Unknown"}</span>
                          {log.ip && (
                            <button
                              onClick={() => handleCopy(log.ip, `ip_${index}`)}
                              className="text-slate-500 hover:text-slate-300 transition"
                              title="Copy IP"
                            >
                              {copiedField === `ip_${index}` ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Device / Client */}
                      <td className="py-3.5 px-4 text-slate-300">
                        <div className="max-w-[220px]">
                          <p className="truncate font-medium text-slate-200">
                            {log.userAgent || "Standard Browser"}
                          </p>
                          <p className="text-[11px] text-slate-500 font-mono truncate">
                            Path: {log.path || "/"}
                          </p>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1 ml-auto border border-slate-700 transition cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-blue-400" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inspector Modal for Detailed Log Inspection */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white font-display">
                  Access Attempt Details
                </h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Profile Card */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-4">
                {selectedLog.userPhoto ? (
                  <img
                    src={selectedLog.userPhoto}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-full ring-2 ring-blue-500/30 object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold text-lg">
                    {selectedLog.userName ? selectedLog.userName[0]?.toUpperCase() : "?"}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-white truncate">
                      {selectedLog.userName || "Guest Visitor"}
                    </h4>
                    {selectedLog.userEmail?.toLowerCase() === SUPERADMIN_EMAIL.toLowerCase() && (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold">
                        SUPERADMIN
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400 font-mono mt-0.5 truncate">
                    {selectedLog.userEmail || "Unauthenticated Guest"}
                  </p>
                  {selectedLog.userId && (
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                      UID: {selectedLog.userId}
                    </p>
                  )}
                </div>
              </div>

              {/* Grid of Key Properties */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-mono">Timestamp (ISO)</span>
                  <p className="font-mono text-slate-200 break-all">{selectedLog.timestamp}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-mono">Event Type & Status</span>
                  <p className="font-mono text-slate-200">
                    {selectedLog.eventType} • <span className="uppercase text-blue-400">{selectedLog.status}</span>
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-mono">IP Address</span>
                  <p className="font-mono text-emerald-400">{selectedLog.ip || "Unknown"}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-mono">Device / OS</span>
                  <p className="font-mono text-slate-200">{selectedLog.device || "Desktop"}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-mono">Landing Path</span>
                  <p className="font-mono text-slate-200 truncate">{selectedLog.path || "/"}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-mono">HTTP Referrer</span>
                  <p className="font-mono text-slate-200 truncate">{selectedLog.referrer || "direct"}</p>
                </div>
              </div>

              {/* Full User-Agent */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-mono">User Agent / Client</span>
                <p className="font-mono text-slate-300 break-all leading-relaxed">
                  {selectedLog.userAgent}
                </p>
              </div>

              {/* Log Details / Context */}
              {selectedLog.details && (
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-mono">Audit Context / Note</span>
                  <p className="text-slate-300 leading-relaxed">{selectedLog.details}</p>
                </div>
              )}

              {/* Raw JSON Payload */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 uppercase font-mono">Raw Document Data</span>
                  <button
                    onClick={() => handleCopy(JSON.stringify(selectedLog, null, 2), "raw_json")}
                    className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-mono"
                  >
                    {copiedField === "raw_json" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedField === "raw_json" ? "Copied" : "Copy JSON"}</span>
                  </button>
                </div>
                <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-40 scrollbar-thin">
                  {JSON.stringify(selectedLog, null, 2)}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
