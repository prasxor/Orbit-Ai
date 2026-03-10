"use client";

import { useState } from "react";
import { Send, Loader2 } from "lucide-react";

export default function ChatPanel({ onNewData }: { onNewData: (data: any) => void }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "ai"; content: string }[]>([
    { role: "ai", content: "Hello! I am your AI Business Advisor. Ask me anything about your sales data." }
  ]);
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMessage = input.trim();
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("http://localhost:8000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage })
      });
      const data = await res.json();
      
      if (data.error) {
        setMessages(prev => [...prev, { role: "ai", content: `Error: ${data.error}` }]);
      } else {
        setMessages(prev => [...prev, { role: "ai", content: data.insights || "Here are your insights." }]);
        onNewData(data);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: "ai", content: "Failed to connect to the server." }]);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-xl">
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">AI Assistant</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`p-3 rounded-2xl max-w-[85%] text-sm ${
              m.role === "user" 
                ? "bg-blue-600 text-white rounded-br-none" 
                : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-none"
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="p-3 rounded-2xl bg-gray-100 dark:bg-gray-800 rounded-bl-none flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
              <span className="text-sm text-gray-500">Analyzing data...</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-full px-4 py-2 shadow-sm focus-within:ring-2 focus-within:ring-blue-500">
          <input 
            type="text"
            className="flex-1 bg-transparent outline-none text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400"
            placeholder="e.g., Show me total sales by region"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            disabled={loading}
          />
          <button 
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="text-white bg-blue-600 hover:bg-blue-700 p-1.5 rounded-full transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
