import { useState, useEffect, useRef } from "react";
import { API_BASE_URL, WS_BASE_URL } from "../config/api";
import { toast } from "react-hot-toast";

const ChatWidget = ({
  hasActiveRide = false,
  currentUser = "",
  rideChatMessages = [],
  onSendRideMessage,
  passengerSelector = null,
  unreadRideCount = 0,
}) => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  // Default to 'global' if !hasActiveRide, otherwise 'ride'
  const [activeTab, setActiveTab] = useState(hasActiveRide ? "ride" : "global");
  const [globalMessages, setGlobalMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const globalWsRef = useRef(null);
  const messagesEndRef = useRef(null);

  // If there is no active ride, enforce default active tab state to 'global'
  useEffect(() => {
    if (!hasActiveRide) {
      setActiveTab("global");
    }
  }, [hasActiveRide]);

  // Global Chat WS & Hydration
  useEffect(() => {
    if (isChatOpen && activeTab === "global") {
      fetch(`${API_BASE_URL}/api/public-chat/history`, {
        credentials: "include",
      })
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          if (Array.isArray(data)) {
            const hydrated = data.map((msg) => ({
              senderName: msg.sender_name || msg.senderName || "Anonymous",
              text: msg.message || msg.text || "",
              timestamp: msg.timestamp,
            }));
            setGlobalMessages(hydrated);
          }
        })
        .catch((err) =>
          console.error("Error loading global chat history:", err),
        );

      const wsUrl = WS_BASE_URL
        ? `${WS_BASE_URL}/ws/public-chat`
        : "ws://localhost:7070/ws/public-chat";
      globalWsRef.current = new WebSocket(wsUrl);

      globalWsRef.current.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          setGlobalMessages((prev) => [...prev, msg]);
        } catch (e) {
          console.error("Error parsing global WS message:", e);
        }
      };

      globalWsRef.current.onclose = () => {
        globalWsRef.current = null;
      };
    }

    return () => {
      if (globalWsRef.current) {
        globalWsRef.current.onclose = null;
        globalWsRef.current.close();
        globalWsRef.current = null;
      }
    };
  }, [isChatOpen, activeTab]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [globalMessages, rideChatMessages, activeTab, isChatOpen]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    if (activeTab === "global") {
      if (
        !globalWsRef.current ||
        globalWsRef.current.readyState !== WebSocket.OPEN
      ) {
        toast.error("Global chat is not connected.");
        return;
      }
      const payload = {
        senderName: currentUser || "User",
        text: chatInput.trim(),
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      globalWsRef.current.send(JSON.stringify(payload));
      setChatInput("");
    } else {
      if (onSendRideMessage) {
        onSendRideMessage(chatInput.trim());
      }
      setChatInput("");
    }
  };

  const currentMessages =
    activeTab === "global" ? globalMessages : rideChatMessages;

  return (
    <div className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 z-[2000] flex flex-col items-end">
      {isChatOpen ? (
        <div className="bg-white dark:bg-slate-800 w-[calc(100vw-2rem)] sm:w-[400px] max-w-full h-[30rem] max-h-[85vh] shadow-2xl shadow-teal-900/10 rounded-[1.5rem] overflow-hidden border border-slate-100 dark:border-slate-700 flex flex-col mb-4 animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div
            className="bg-teal-600 text-white p-4 font-bold flex justify-between items-center cursor-pointer shadow-sm"
            onClick={() => setIsChatOpen(false)}
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">
                {activeTab === "global" ? "🌍" : "💬"}
              </span>
              <span className="font-extrabold text-base">
                {activeTab === "global" ? "Campus Global Chat" : "Ride Chat"}
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsChatOpen(false);
              }}
              className="hover:bg-teal-500 rounded-full w-8 h-8 flex items-center justify-center transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Passenger Selector (for driver ride chat) */}
          {activeTab === "ride" && passengerSelector}

          {/* Dual Tab Switcher */}
          <div className="flex bg-slate-100 dark:bg-slate-900 p-1 border-b border-slate-200 dark:border-slate-700">
            {/* Conditionally hide Ride Chat tab if !hasActiveRide */}
            {hasActiveRide && (
              <button
                type="button"
                data-testid="ride-chat-tab"
                onClick={() => setActiveTab("ride")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${
                  activeTab === "ride"
                    ? "bg-white dark:bg-slate-700 shadow-sm text-teal-700 dark:text-teal-300"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
              >
                Ride Chat
              </button>
            )}
            <button
              type="button"
              data-testid="global-chat-tab"
              onClick={() => setActiveTab("global")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${
                activeTab === "global"
                  ? "bg-white dark:bg-slate-700 shadow-sm text-teal-700 dark:text-teal-300"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              Campus Global
            </button>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-slate-50 dark:bg-slate-900/80">
            {currentMessages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-xs py-8 text-center">
                <span>{activeTab === "global" ? "🌍" : "💬"}</span>
                <span className="mt-1">
                  {activeTab === "global"
                    ? "No public messages yet. Say hello!"
                    : "No ride messages yet. Start the conversation!"}
                </span>
              </div>
            ) : (
              currentMessages.map((msg, i) => {
                const isSelf = currentUser
                  ? msg.senderName === currentUser ||
                    msg.sender_name === currentUser
                  : false;
                return (
                  <div
                    key={i}
                    className={`max-w-[85%] p-3 text-sm shadow-sm ${
                      isSelf
                        ? "bg-teal-600 text-white self-end rounded-t-2xl rounded-l-2xl rounded-br-none shadow-teal-700/20"
                        : "bg-gray-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 self-start rounded-t-2xl rounded-r-2xl rounded-bl-none border border-slate-200/50 dark:border-slate-600"
                    }`}
                  >
                    <div
                      className={`font-bold text-[10px] mb-1 ${
                        isSelf
                          ? "text-teal-200"
                          : "text-teal-700 dark:text-teal-400"
                      }`}
                    >
                      <span className="font-bold text-xs">
                        {msg.senderName || msg.sender_name || "User"}
                      </span>
                    </div>
                    <div className="leading-relaxed break-words">
                      {msg.text || msg.message}
                    </div>
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
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <form
            onSubmit={handleSendMessage}
            className="p-3 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex gap-2 items-center"
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={
                activeTab === "global"
                  ? "Message Campus Global..."
                  : "Message in ride chat..."
              }
              className="flex-1 p-3 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-400 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all border border-transparent dark:border-slate-600"
            />
            <button
              type="submit"
              disabled={!chatInput.trim()}
              className="bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-95 shadow-md shrink-0 cursor-pointer disabled:cursor-not-allowed"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-5 h-5 ml-1"
              >
                <path d="M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.404z" />
              </svg>
            </button>
          </form>
        </div>
      ) : (
        <button
          type="button"
          data-testid="chat-toggle-button"
          onClick={() => setIsChatOpen(true)}
          className="bg-teal-600 hover:bg-teal-700 text-white w-14 h-14 rounded-full shadow-lg shadow-teal-700/30 flex items-center justify-center text-2xl relative transform transition-transform active:scale-95 hover:scale-105 cursor-pointer"
        >
          💬
          {unreadRideCount > 0 && (
            <span className="absolute top-0 right-0 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full border-2 border-white dark:border-slate-800 font-bold">
              {unreadRideCount}
            </span>
          )}
        </button>
      )}
    </div>
  );
};

export default ChatWidget;
