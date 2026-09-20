import { useState, useEffect, useRef } from "react";
import { API_BASE_URL, WS_BASE_URL } from "../config/api";

const Forums = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [profileName, setProfileName] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const wsRef = useRef(null);

  // Fetch current user name & verification status
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/check-auth`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          if (data.name) setProfileName(data.name);
          setIsVerified(Boolean(data.isVerified));
        }
      })
      .catch(() => {
        setIsVerified(false);
      })
      .finally(() => {
        setAuthLoading(false);
      });
  }, []);

  // Hydrate chat history
  useEffect(() => {
    if (!isVerified) return;

    fetch(`${API_BASE_URL}/api/public-chat/history`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const hydrated = data.map((msg) => ({
            senderName: msg.sender_name || msg.senderName || "Anonymous",
            text: msg.message || msg.text || "",
            timestamp: msg.timestamp,
          }));
          setMessages(hydrated);
        }
      })
      .catch((err) => console.error("Error loading forum chat history:", err));
  }, [isVerified]);

  // WebSocket connection
  useEffect(() => {
    if (!isVerified) return;

    let reconnectTimer;

    const connect = () => {
      const wsUrl = WS_BASE_URL
        ? `${WS_BASE_URL}/ws/public-chat`
        : "ws://localhost:7070/ws/public-chat";

      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          setMessages((prev) => [...prev, msg]);
        } catch (e) {}
      };

      wsRef.current.onclose = () => {
        wsRef.current = null;
        reconnectTimer = setTimeout(connect, 3000);
      };
    };

    if (!wsRef.current) {
      connect();
    }

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [isVerified]);

  const messagesContainerRef = useRef(null);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim() || !wsRef.current) return;
    const payload = {
      senderName: profileName || "User",
      text: input.trim(),
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    wsRef.current.send(JSON.stringify(payload));
    setInput("");
  };

  if (authLoading) {
    return null;
  }

  if (!isVerified) {
    return (
      <div className="text-center mt-20 font-bold dark:text-white">
        You must be verified by an admin to access the Global Forums.
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-80px)] bg-slate-50 dark:bg-slate-900 py-0 sm:py-4 px-0 sm:px-6 transition-colors duration-300">
      <div className="w-full max-w-5xl mx-auto h-[calc(100vh-80px)] sm:h-[calc(100vh-120px)] bg-white dark:bg-slate-800 rounded-none sm:rounded-3xl shadow-xl flex flex-col border-0 sm:border border-slate-200 dark:border-slate-700 mt-0 sm:mt-6 overflow-hidden">
        {/* Header */}
        <div className="bg-teal-600 text-white p-3 sm:p-6 font-extrabold flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🌍</span>
            <div>
              <h1 className="text-xl font-extrabold leading-tight">
                Campus Community Forum
              </h1>
              <p className="text-xs text-teal-100 font-normal">
                Real-time public discussion for students and staff
              </p>
            </div>
          </div>
          <div className="text-xs bg-teal-700/60 px-3 py-1.5 rounded-full border border-teal-500/50 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Live Chat</span>
          </div>
        </div>

        {/* Message List */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 sm:p-6 pt-4 flex flex-col gap-4 bg-slate-50 dark:bg-slate-900/50"
        >
          {messages.map((msg, i) => {
            const isSelf = profileName && msg.senderName === profileName;
            return (
              <div
                key={i}
                className={`max-w-[80%] md:max-w-[70%] p-4 text-sm shadow-sm ${
                  isSelf
                    ? "bg-teal-600 text-white self-end rounded-2xl rounded-br-none shadow-teal-700/20"
                    : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 self-start rounded-2xl rounded-bl-none border border-slate-100 dark:border-slate-700"
                }`}
              >
                <div
                  className={`font-bold text-xs mb-1 ${
                    isSelf
                      ? "text-teal-200"
                      : "text-teal-700 dark:text-teal-400"
                  }`}
                >
                  {msg.senderName}
                </div>
                <div className="leading-relaxed text-sm">{msg.text}</div>
                <div
                  className={`text-[10px] text-right mt-1.5 ${
                    isSelf
                      ? "text-teal-300"
                      : "text-slate-400 dark:text-slate-400"
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>
            );
          })}
        </div>

        {/* Send Input */}
        <form
          onSubmit={handleSend}
          className="p-4 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex gap-3 items-center"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Share an announcement, question, or ride request..."
            className="flex-1 p-3.5 px-5 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all placeholder-slate-400 dark:placeholder-slate-400"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white px-7 py-3.5 rounded-full font-bold text-sm flex items-center gap-2 transition-transform active:scale-95 shadow-md shadow-teal-600/20 shrink-0"
          >
            <span>Send</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-4 h-4"
            >
              <path d="M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.404z" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
};

export default Forums;
