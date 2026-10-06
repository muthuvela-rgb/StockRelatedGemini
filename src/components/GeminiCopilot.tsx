import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Send,
  RefreshCw,
  Search,
  MapPin,
  TrendingUp,
  Bot,
  User,
  AlertCircle,
  HelpCircle,
  Globe,
  Compass,
  ArrowRight,
  Copy,
  ExternalLink,
  Check,
} from "lucide-react";

interface Message {
  role: "user" | "model";
  parts: { text: string }[];
}

export const GeminiCopilot: React.FC = () => {
  // Chat state
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "model",
      parts: [
        {
          text: "Welcome to your StockRelated AI Co-Pilot! I can help you model complex sell-put option strategies, explain Greeks, summarize SEC files, or perform real-time macro updates. What are we building today?",
        },
      ],
    },
  ]);
  const [userInput, setUserInput] = useState("");
  const [chatRole, setChatRole] = useState<"general" | "derivs_strategist" | "quick_desk">("derivs_strategist");
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Search grounding state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<string | null>(null);
  const [isSearchLoading, setIsSearchLoading] = useState(false);

  // Maps grounding state
  const [mapsQuery, setMapsQuery] = useState("");
  const [mapsResult, setMapsResult] = useState<string | null>(null);
  const [isMapsLoading, setIsMapsLoading] = useState(false);

  // Traditional Browser & Chrome Gemini Fallbacks
  const [lastActiveSearchQuery, setLastActiveSearchQuery] = useState("");
  const [lastActiveMapsQuery, setLastActiveMapsQuery] = useState("");
  const [copiedSearch, setCopiedSearch] = useState(false);
  const [copiedMaps, setCopiedMaps] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll chat thread to bottom on update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isChatLoading]);

  // Handle multi-turn chat message send
  const handleSendChatMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!userInput.trim() || isChatLoading) return;

    const userMsg = userInput.trim();
    setUserInput("");

    // Append user message to thread
    const updatedMessages: Message[] = [...messages, { role: "user", parts: [{ text: userMsg }] }];
    setMessages(updatedMessages);
    setIsChatLoading(true);

    try {
      const response = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: chatRole,
          message: userMsg,
          history: messages, // Send history for multi-turn session
        }),
      });

      const data = await response.json();
      if (data && data.text) {
        setMessages((prev) => [...prev, { role: "model", parts: [{ text: data.text }] }]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "model", parts: [{ text: `⚠️ Error: ${data.error || "Failed to receive response."}` }] },
        ]);
      }
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) => [
        ...prev,
        { role: "model", parts: [{ text: "⚠️ Network Error: Could not connect to Gemini server." }] },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Trigger Google Search Grounded query
  const handleSearchGrounding = async (queryText: string) => {
    const activeQuery = queryText || searchQuery;
    if (!activeQuery.trim() || isSearchLoading) return;

    setSearchQuery(activeQuery);
    setLastActiveSearchQuery(activeQuery);
    setIsSearchLoading(true);
    setSearchResult(null);

    try {
      const response = await fetch("/api/gemini/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: activeQuery }),
      });
      const data = await response.json();
      if (!response.ok) {
        setSearchResult(`⚠️ Error: ${data.error || "Failed to execute live Google Search grounding."}`);
      } else {
        setSearchResult(data.text || "No output returned.");
      }
    } catch (err) {
      console.error("Search Grounding error:", err);
      setSearchResult("⚠️ Error: Failed to execute live Google Search grounding.");
    } finally {
      setIsSearchLoading(false);
    }
  };

  // Trigger Google Maps Grounded query
  const handleMapsGrounding = async (queryText: string) => {
    const activeQuery = queryText || mapsQuery;
    if (!activeQuery.trim() || isMapsLoading) return;

    setMapsQuery(activeQuery);
    setLastActiveMapsQuery(activeQuery);
    setIsMapsLoading(true);
    setMapsResult(null);

    try {
      const response = await fetch("/api/gemini/maps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: activeQuery }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMapsResult(`⚠️ Error: ${data.error || "Failed to execute geographical operations mapping."}`);
      } else {
        setMapsResult(data.text || "No output returned.");
      }
    } catch (err) {
      console.error("Maps Grounding error:", err);
      setMapsResult("⚠️ Error: Failed to execute geographical operations mapping.");
    } finally {
      setIsMapsLoading(false);
    }
  };

  return (
    <div className="flex-1 w-full mx-auto px-4 sm:px-8 lg:px-12 py-6 space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-32 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/15 ring-1 ring-white/10 shrink-0">
              <Sparkles className="w-5.5 h-5.5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white font-display tracking-tight flex items-center gap-2">
                Gemini AI Co-Pilot & Grounding Center
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Unified workspace combining Multi-Turn Strategy Chat, live Google Search news, and Google Maps corporate asset routing.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Hand Area: Strategist Chat Engine (Col Span 7) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col h-[650px] shadow-lg">
          {/* Chat Header */}
          <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <Bot className="w-4.5 h-4.5 text-cyan-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Multi-Turn Co-Pilot Chat
              </span>
            </div>

            {/* Persona/Role Selector (Segmented Control - Button Grid) */}
            <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setChatRole("derivs_strategist")}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                  chatRole === "derivs_strategist"
                    ? "bg-slate-800 text-cyan-300 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
                title="Use gemini-3.1-pro-preview for complex derivative strategies"
              >
                Strategist Pro
              </button>
              <button
                type="button"
                onClick={() => setChatRole("general")}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                  chatRole === "general"
                    ? "bg-slate-800 text-blue-300 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
                title="Use gemini-3.5-flash for general research"
              >
                Equity Flash
              </button>
              <button
                type="button"
                onClick={() => setChatRole("quick_desk")}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                  chatRole === "quick_desk"
                    ? "bg-slate-800 text-teal-300 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
                title="Use gemini-3.1-flash-lite for rapid education"
              >
                Lite Edu
              </button>
            </div>
          </div>

          {/* Messages Thread */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/40">
            {messages.map((msg, idx) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={idx}
                  className={`flex gap-3 max-w-[85%] ${isUser ? "ml-auto flex-row-reverse" : "mr-auto"}`}
                >
                  <div
                    className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border ${
                      isUser
                        ? "bg-slate-800 border-slate-700 text-slate-200"
                        : "bg-cyan-950/50 border-cyan-800/40 text-cyan-400"
                    }`}
                  >
                    {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>

                  <div
                    className={`p-3.5 rounded-2xl text-xs leading-relaxed font-normal whitespace-pre-line ${
                      isUser
                        ? "bg-blue-600/10 border border-blue-500/20 text-slate-100"
                        : "bg-slate-900 border border-slate-850 text-slate-200"
                    }`}
                  >
                    {msg.parts[0].text}
                  </div>
                </div>
              );
            })}

            {isChatLoading && (
              <div className="flex gap-3 max-w-[80%] mr-auto">
                <div className="h-8 w-8 rounded-lg bg-cyan-950/50 border border-cyan-800/40 text-cyan-400 flex items-center justify-center shrink-0">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-850 text-slate-400 text-xs font-mono">
                  Co-pilot is compiling analysis...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Inputs */}
          <form onSubmit={handleSendChatMessage} className="p-4 bg-slate-900 border-t border-slate-800 shrink-0">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder={
                  chatRole === "derivs_strategist"
                    ? "Ask complex option questions (e.g. roll strategies, hedge collars)..."
                    : chatRole === "general"
                    ? "Ask watchlist or SEC-related fundamental questions..."
                    : "Ask for fast visual descriptions of Greeks and jargon..."
                }
                className="flex-1 bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 font-normal"
              />
              <button
                type="submit"
                disabled={isChatLoading || !userInput.trim()}
                className="h-9 w-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 hover:from-cyan-500 hover:to-blue-400 text-white flex items-center justify-center shrink-0 shadow-lg disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>

        {/* Right Hand Area: Grounding Engines (Col Span 5) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* 1. Google Search Grounding Center */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col h-[313px] shadow-lg relative overflow-hidden">
            <div className="flex items-center gap-2 pb-2.5 border-b border-slate-800">
              <Globe className="w-4.5 h-4.5 text-blue-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Google Search Grounding
              </span>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-3">
              {isSearchLoading ? (
                <div className="h-full flex flex-col items-center justify-center text-xs text-slate-400 gap-2">
                  <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin" />
                  <span className="font-mono">Executing Live Google Search Grounding...</span>
                </div>
              ) : searchResult ? (
                <div className="text-xs text-slate-200 leading-relaxed max-h-[350px] overflow-y-auto pr-1 whitespace-pre-line font-normal">
                  <div className="flex items-center gap-1.5 text-blue-400 text-[10px] font-bold uppercase tracking-wider mb-2 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    Live Grounded Output
                  </div>
                  {searchResult}

                  {/* Traditional Fallback Actions Panel */}
                  {(searchResult.includes("Error") || searchResult.includes("rate limits") || searchResult.includes("quota exceeded") || searchResult.includes("API limits") || searchResult.includes("exceeded")) && (
                    <div className="mt-4 p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-2.5 animate-in fade-in duration-200">
                      <div className="flex items-center gap-1.5 text-[10px] text-amber-400 font-bold uppercase tracking-wider font-mono">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Traditional Browser Fallback
                      </div>
                      <p className="text-[11px] text-slate-400 font-sans leading-normal">
                        All local API slots are currently rate-limited. You can search directly or utilize Chrome's built-in **Ask Gemini** feature:
                      </p>
                      <div className="flex flex-wrap gap-2 pt-0.5">
                        <a
                          href={`https://www.google.com/search?q=${encodeURIComponent(lastActiveSearchQuery || searchQuery || "latest stock news")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold cursor-pointer transition shadow-md shadow-blue-500/10 active:scale-95"
                        >
                          <Search className="w-3 h-3" />
                          Google Search
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(lastActiveSearchQuery || searchQuery);
                            setCopiedSearch(true);
                            setTimeout(() => setCopiedSearch(false), 2000);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-lg text-xs font-semibold cursor-pointer transition active:scale-95"
                        >
                          {copiedSearch ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          {copiedSearch ? "Copied Query!" : "Copy Query"}
                        </button>
                      </div>
                      <div className="text-[10px] text-slate-500 font-sans leading-relaxed border-t border-slate-900 pt-2 flex gap-1.5">
                        <span className="text-cyan-400 font-bold">💡 Tip:</span>
                        <span>Type <code className="bg-slate-900 px-1 py-0.5 rounded text-cyan-300 font-mono text-[9px]">@gemini</code> in your Chrome Address Bar, press Space, and paste your query!</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <span className="text-[10px] text-slate-500 block uppercase font-semibold">
                    Select a Predefined Grounded Search Catalyst:
                  </span>
                  
                  <div className="flex flex-col gap-1.5">
                    {[
                      {
                        label: "Live Volatility Catalyst for TSLA",
                        query: "What is the latest breaking news, deliveries, or volatility catalyst affecting Tesla (TSLA) stock price and outlook in the last 48 hours?",
                      },
                      {
                        label: "Recent Rocket Lab Launch Updates",
                        query: "What is the latest actual status and dates for Rocket Lab (RKLB) launch manifests and recent operating news?",
                      },
                      {
                        label: "Latest FOMC Rate Decisions",
                        query: "What are the latest Federal Reserve FOMC interest rate decision details, CPI numbers, and direct outcomes for Treasury yields?",
                      },
                    ].map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSearchGrounding(item.query)}
                        className="text-left w-full p-2 rounded-lg bg-slate-950/50 hover:bg-slate-950 border border-slate-850 hover:border-slate-800 transition text-slate-300 hover:text-white text-[11px] flex items-center justify-between group cursor-pointer"
                      >
                        <span className="truncate pr-2 font-medium">{item.label}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Custom Input */}
            <div className="pt-2 border-t border-slate-800 flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter custom search prompt..."
                className="flex-1 bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleSearchGrounding("")}
                disabled={isSearchLoading || !searchQuery.trim()}
                className="px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-50"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 2. Google Maps Grounding Center */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col h-[313px] shadow-lg relative overflow-hidden">
            <div className="flex items-center gap-2 pb-2.5 border-b border-slate-800">
              <MapPin className="w-4.5 h-4.5 text-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Google Maps Physical Auditor
              </span>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-3">
              {isMapsLoading ? (
                <div className="h-full flex flex-col items-center justify-center text-xs text-slate-400 gap-2">
                  <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />
                  <span className="font-mono">Auditing Physical Corporate coordinates...</span>
                </div>
              ) : mapsResult ? (
                <div className="text-xs text-slate-200 leading-relaxed max-h-[350px] overflow-y-auto pr-1 whitespace-pre-line font-normal">
                  <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-bold uppercase tracking-wider mb-2 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Live Geographical Audit
                  </div>
                  {mapsResult}

                  {/* Traditional Fallback Actions Panel */}
                  {(mapsResult.includes("Error") || mapsResult.includes("rate limits") || mapsResult.includes("quota exceeded") || mapsResult.includes("API limits") || mapsResult.includes("exceeded")) && (
                    <div className="mt-4 p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-2.5 animate-in fade-in duration-200">
                      <div className="flex items-center gap-1.5 text-[10px] text-amber-400 font-bold uppercase tracking-wider font-mono">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Traditional Browser Fallback
                      </div>
                      <p className="text-[11px] text-slate-400 font-sans leading-normal">
                        All local API slots are currently rate-limited. You can search coordinates directly or utilize Chrome's built-in **Ask Gemini** feature:
                      </p>
                      <div className="flex flex-wrap gap-2 pt-0.5">
                        <a
                          href={`https://www.google.com/search?q=${encodeURIComponent(lastActiveMapsQuery || mapsQuery || "corporate locations mapping")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold cursor-pointer transition shadow-md shadow-emerald-500/10 active:scale-95"
                        >
                          <Search className="w-3 h-3" />
                          Google Maps Search
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(lastActiveMapsQuery || mapsQuery);
                            setCopiedMaps(true);
                            setTimeout(() => setCopiedMaps(false), 2000);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-lg text-xs font-semibold cursor-pointer transition active:scale-95"
                        >
                          {copiedMaps ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          {copiedMaps ? "Copied Query!" : "Copy Query"}
                        </button>
                      </div>
                      <div className="text-[10px] text-slate-500 font-sans leading-relaxed border-t border-slate-900 pt-2 flex gap-1.5">
                        <span className="text-emerald-400 font-bold">💡 Tip:</span>
                        <span>Type <code className="bg-slate-900 px-1 py-0.5 rounded text-emerald-300 font-mono text-[9px]">@gemini</code> in your Chrome Address Bar, press Space, and paste your query!</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <span className="text-[10px] text-slate-500 block uppercase font-semibold">
                    Select a Corporate Geographical Audit Prompt:
                  </span>
                  
                  <div className="flex flex-col gap-1.5">
                    {[
                      {
                        label: "Foundries & Facilities of Nvidia (NVDA)",
                        query: "List the physical fabrication labs, foundries, packaging facilities, and key offices of Nvidia (NVDA) globally. Highlight the geographic centers of their manufacturing line.",
                      },
                      {
                        label: "Gigafactory Geopolitical Risks",
                        query: "What are the exact physical coordinates and locations of Tesla (TSLA)'s Gigafactories globally? Detail any active weather, political, or water-supply issues near these plant coordinates.",
                      },
                      {
                        label: "Micron Semiconductor Plants",
                        query: "Identify Micron (MU)'s primary physical plant facilities and suppliers. Are any located near severe bottleneck zones?",
                      },
                    ].map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleMapsGrounding(item.query)}
                        className="text-left w-full p-2 rounded-lg bg-slate-950/50 hover:bg-slate-950 border border-slate-850 hover:border-slate-800 transition text-slate-300 hover:text-white text-[11px] flex items-center justify-between group cursor-pointer"
                      >
                        <span className="truncate pr-2 font-medium">{item.label}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Custom Input */}
            <div className="pt-2 border-t border-slate-800 flex gap-2">
              <input
                type="text"
                value={mapsQuery}
                onChange={(e) => setMapsQuery(e.target.value)}
                placeholder="Enter company coordinate query..."
                className="flex-1 bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleMapsGrounding("")}
                disabled={isMapsLoading || !mapsQuery.trim()}
                className="px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-50"
              >
                <Compass className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
