"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Copy, Check, ChevronDown, Minimize2, MessageCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion, AnimatePresence } from "framer-motion";

export default function ChatPanel({ 
  onNewData, 
  onLoading,
  isMinimized,
  onMinimizeToggle
}: { 
  onNewData: (data: any, query: string) => void,
  onLoading: (isLoading: boolean) => void,
  isMinimized: boolean,
  onMinimizeToggle: (val: boolean) => void
}) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "ai"; content: string }[]>([
    { role: "ai", content: "Hello! I am your AI Business Advisor. Ask me anything about your sales data." }
  ]);
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    // Show button if we scroll up more than 100px from bottom
    setShowScrollBottom(scrollHeight - scrollTop - clientHeight > 100);
  };
  
  useEffect(() => {
    if (!isMinimized && !showScrollBottom) {
      setTimeout(scrollToBottom, 100);
    }
  }, [messages, isMinimized]);

  // Handle expanding textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMessage = input.trim();
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'; // Reset height
    }
    setLoading(true);
    onLoading(true);
    setTimeout(scrollToBottom, 50);

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
        onNewData(data, userMessage);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: "ai", content: "Failed to connect to the server." }]);
    }
    setLoading(false);
    onLoading(false);
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <button 
          onClick={() => onMinimizeToggle(false)}
          className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-all flex items-center justify-center"
        >
          <MessageCircle className="w-8 h-8" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl border-l border-gray-200/50 dark:border-gray-800/50 shadow-xl relative w-full mb-4 sm:mb-0">
      <div className="p-4 border-b border-gray-200/50 dark:border-gray-800/50 bg-white/40 dark:bg-black/40 flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">AI Assistant</h2>
        <button 
          onClick={() => onMinimizeToggle(true)}
          className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 rounded-lg hover:bg-gray-200/50 dark:hover:bg-gray-800/50 transition-colors"
          title="Minimize Chat"
        >
          <Minimize2 className="w-5 h-5" />
        </button>
      </div>
      
      <div 
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4"
        style={{ scrollBehavior: 'smooth' }}
      >
        <AnimatePresence>
          {messages.map((m, i) => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={i} 
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className={`p-4 rounded-2xl max-w-[85%] text-sm relative group ${
                m.role === "user" 
                  ? "bg-blue-600 text-white rounded-br-none" 
                  : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-none shadow-sm"
              }`}>
                {m.role === "ai" ? (
                  <div className="prose dark:prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-headings:font-bold prose-a:text-blue-500">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {m.content}
                    </ReactMarkdown>
                    <button
                      onClick={() => handleCopy(m.content, i)}
                      className="absolute bottom-2 right-2 p-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                      title="Copy response"
                    >
                      {copiedIndex === i ? <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400" /> : <Copy className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />}
                    </button>
                  </div>
                ) : (
                  m.content
                )}
              </div>
            </motion.div>
          ))}
          {loading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="p-3 rounded-2xl bg-gray-100 dark:bg-gray-800 rounded-bl-none flex items-center gap-2 shadow-sm">
                <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                <span className="text-sm text-gray-500">Thinking...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      <AnimatePresence>
        {showScrollBottom && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute bottom-[90px] right-6 z-10"
          >
            <button
              onClick={scrollToBottom}
              className="p-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all"
              title="Scroll to latest"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-4 bg-white/40 dark:bg-black/40 border-t border-gray-200/50 dark:border-gray-800/50">
        <div className="flex items-end gap-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border border-gray-300/50 dark:border-gray-700/50 rounded-2xl p-2 shadow-sm focus-within:ring-2 focus-within:ring-blue-500/50 transition-all">
          <textarea 
            ref={textareaRef}
            className="flex-1 bg-transparent outline-none text-sm text-gray-800 dark:text-gray-100 placeholder-gray-500 resize-none py-2 px-3 max-h-[120px]"
            placeholder="e.g., Show me total sales by region..."
            value={input}
            onChange={handleInput}
            onKeyDown={(e) => {
               if (e.key === "Enter" && !e.shiftKey) {
                 e.preventDefault();
                 handleSend();
               }
            }}
            disabled={loading}
            rows={1}
          />
          <button 
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="text-white bg-blue-600/90 hover:bg-blue-600 backdrop-blur-md p-2 rounded-xl transition-all disabled:opacity-50 mb-1 mr-1"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
