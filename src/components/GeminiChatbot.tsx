import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Bot, User, Loader2 } from "lucide-react";

interface Message {
  role: "user" | "model";
  content: string;
}

export const GeminiChatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "model", content: "Hello! I am your AURA assistant. How can I help you today?" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages })
      });
      
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      
      const data = await response.json();
      setMessages((prev) => [...prev, { role: "model", content: data.reply }]);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [...prev, { role: "model", content: "Sorry, I encountered an error. Please try again later." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 p-4 bg-[#A55D25] text-white rounded-full shadow-xl hover:bg-[#C06A4A] transition-all transform hover:scale-105 z-50 flex items-center justify-center"
          title="Chat with AURA Assistant"
        >
          <MessageSquare size={24} />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-[350px] sm:w-[400px] h-[500px] bg-white rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden border border-slate-100 animate-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="bg-[#3C3530] text-white p-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bot size={20} className="text-[#A55D25]" />
              <h3 className="font-semibold text-sm">AURA Assistant</h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-300 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex items-start space-x-2 ${msg.role === "user" ? "flex-row-reverse space-x-reverse" : "flex-row"}`}
              >
                <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.role === "user" ? "bg-[#A55D25]" : "bg-white border border-slate-200 shadow-sm"}`}>
                  {msg.role === "user" ? <User size={14} className="text-white" /> : <Bot size={14} className="text-[#A55D25]" />}
                </div>
                <div
                  className={`px-4 py-2 text-sm max-w-[75%] rounded-2xl ${
                    msg.role === "user"
                      ? "bg-[#A55D25] text-white rounded-tr-none"
                      : "bg-white text-slate-700 border border-slate-200 rounded-tl-none shadow-sm"
                  }`}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-start space-x-2">
                <div className="shrink-0 w-8 h-8 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center">
                  <Bot size={14} className="text-[#A55D25]" />
                </div>
                <div className="px-4 py-3 bg-white text-slate-700 border border-slate-200 rounded-2xl rounded-tl-none shadow-sm flex items-center space-x-2">
                  <Loader2 size={14} className="animate-spin text-[#A55D25]" />
                  <span className="text-xs text-slate-500">Typing...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white border-t border-slate-100">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center space-x-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask something..."
                className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#A55D25]/20 focus:border-[#A55D25] transition-all"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="p-2 bg-[#A55D25] text-white rounded-xl hover:bg-[#C06A4A] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
