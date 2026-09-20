import { useState, useEffect, useRef } from "react";
import { API_BASE_URL, WS_BASE_URL } from "../config/api";

const GlobalChatWidget = ({ profileName }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const wsRef = useRef(null);

  // Hydrate chat history
  useEffect(() => {
    if (isOpen) {
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
        .catch((err) => console.error("Error loading chat history:", err));
    }
  }, [isOpen]);

  useEffect(() => {
    let reconnectTimer;

    const connect = () => {
      if (!isOpen) return;

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
        if (isOpen) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };
    };

    if (isOpen && !wsRef.current) {
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
  }, [isOpen]);

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

  return (
    <div className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 z-[9999] flex flex-col items-end">
      {isOpen ? (
        <div className="w-[calc(100vw-2rem)] sm:w-[400px] max-w-full h-[600px] max-h-[85vh] bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl shadow-teal-900/20 border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden mb-4">
          <div
            className="bg-teal-600 text-white p-4 font-bold flex justify-between items-center cursor-pointer shadow-sm"
            onClick={() => setIsOpen(false)}
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">🌍</span>
              <span className="font-extrabold text-base">
                Campus Global Chat
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
              className="hover:bg-teal-500 rounded-full w-8 h-8 flex items-center justify-center transition-colors"
            >
              ✕
            </button>
          </div>
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-slate-50 dark:bg-slate-900/80"
          >
            {messages.map((msg, i) => {
              const isSelf = profileName && msg.senderName === profileName;
              return (
                <div
                  key={i}
                  className={`max-w-[85%] p-3.5 text-sm shadow-sm ${
                    isSelf
                      ? "bg-teal-600 text-white self-end rounded-2xl rounded-br-none shadow-teal-700/20"
                      : "bg-gray-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 self-start rounded-2xl rounded-bl-none border border-slate-100 dark:border-slate-600"
                  }`}
                >
                  <div
                    className={`font-bold text-[11px] mb-1 ${
                      isSelf
                        ? "text-teal-200"
                        : "text-teal-700 dark:text-teal-400"
                    }`}
                  >
                    {msg.senderName}
                  </div>
                  <div className="leading-relaxed">{msg.text}</div>
                  <div
                    className={`text-[9px] text-right mt-1 ${
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
          <form
            onSubmit={handleSend}
            className="p-3 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex gap-2 items-center"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 p-3 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-400 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all border border-transparent dark:border-slate-600"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-95 shadow-md shrink-0"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-5 h-5 ml-0.5"
              >
                <path d="M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.404z" />
              </svg>
            </button>
          </form>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-teal-600 hover:bg-teal-700 text-white w-14 h-14 rounded-full shadow-lg shadow-teal-700/30 flex items-center justify-center text-2xl relative transform transition-transform active:scale-95 hover:scale-105"
        >
          🌍
        </button>
      )}
    </div>
  );
};

export default GlobalChatWidget;
