"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send, Loader2, Copy, Check, ChevronDown,
  Minimize2, MessageCircle, UploadCloud, X,
  Database, ChevronDown as DropChevron
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion, AnimatePresence } from "framer-motion";
import { callBackend } from "@/lib/api";

// Dataset entry: either the default or an uploaded one
// if sessionId is null, backend defaults to static Amazon Sales db
interface Dataset {
  sessionId: string | null;   // null = default Amazon Sales
  label: string;              // display name
  filename?: string;
  rows?: number;
}

const DEFAULT_DATASET: Dataset = {
  sessionId: null,
  label: "Amazon Sales",
};

export default function ChatPanel({
  onNewData,
  onLoading,
  isMinimized,
  onMinimizeToggle,
}: {
  onNewData: (data: any, query: string) => void;
  onLoading: (isLoading: boolean) => void;
  isMinimized: boolean;
  onMinimizeToggle: (val: boolean) => void;
}) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "ai"; content: string }[]>([
    {
      role: "ai",
      content:
        "Hello! I'm Orbit AI. I'm currently analysing the **Amazon Sales** dataset.\n\nYou can upload any CSV using the dataset selector above to switch datasets instantly.",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Dataset management
  const [datasets, setDatasets] = useState<Dataset[]>([DEFAULT_DATASET]);
  const [activeDataset, setActiveDataset] = useState<Dataset>(DEFAULT_DATASET);
  const [showDatasetMenu, setShowDatasetMenu] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPhase, setUploadPhase] = useState<"sending" | "processing">("sending");
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const datasetMenuRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // cleanup dataset dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (datasetMenuRef.current && !datasetMenuRef.current.contains(e.target as Node)) {
        setShowDatasetMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    setShowScrollBottom(scrollHeight - scrollTop - clientHeight > 100);
  };

  useEffect(() => {
    if (!isMinimized && !showScrollBottom) setTimeout(scrollToBottom, 100);
  }, [messages, isMinimized]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // ---- Dataset upload ----
  // posts csv to fastapi backend for in-memory sqlite db creation
  const uploadCSV = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: "⚠️ Only `.csv` files are supported." },
      ]);
      return;
    }

    setIsUploading(true);
    setUploadPhase("sending");
    setShowDatasetMenu(false);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const phaseTimer = setTimeout(() => setUploadPhase("processing"), 500);
      
      const data = await callBackend("/api/upload-csv", {
        method: "POST",
        body: formData,
      });
      
      clearTimeout(phaseTimer);
      setUploadPhase("processing");

      const newDataset: Dataset = {
        sessionId: data.session_id,
        label: data.dataset_name,
        filename: data.filename,
        rows: data.rows,
      };

      setDatasets((prev) => {
        // Replace if same filename already uploaded
        const exists = prev.findIndex((d) => d.filename === data.filename);
        if (exists !== -1) {
          const updated = [...prev];
          updated[exists] = newDataset;
          return updated;
        }
        return [...prev, newDataset];
      });
      setActiveDataset(newDataset);

      setMessages((prev) => [...prev, { role: "ai", content: data.message }]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: `❌ Upload failed: ${err.message}` },
      ]);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadCSV(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadCSV(file);
  };

  const switchDataset = (dataset: Dataset) => {
    setActiveDataset(dataset);
    setShowDatasetMenu(false);
    setMessages((prev) => [
      ...prev,
      {
        role: "ai",
        content: `Switched to **${dataset.label}**${dataset.rows ? ` (${dataset.rows.toLocaleString()} rows)` : ""}. What would you like to explore?`,
      },
    ]);
  };

  // ---- Send message ----
  const handleSend = async () => {
    if (!input.trim()) return;
    const userMessage = input.trim();
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setLoading(true);
    onLoading(true);
    setTimeout(scrollToBottom, 50);

    try {
      // route query with optional session context (for custom csvs)
      const data = await callBackend("/api/chat", {
        method: "POST",
        body: JSON.stringify({ message: userMessage, session_id: activeDataset.sessionId }),
      });
      
      if (data.error) {
        setMessages((prev) => [...prev, { role: "ai", content: `Error: ${data.error}` }]);
      } else {
        setMessages((prev) => [...prev, { role: "ai", content: data.insights || "Here are your insights." }]);
        // propogate dashboard payload up to page.tsx renderer
        onNewData(data, userMessage);
      }
    } catch (err: any) {
      setMessages((prev) => [...prev, { role: "ai", content: `Failed to connect to the server. ${err.message}` }]);
    }
    setLoading(false);
    onLoading(false);
  };

  // ---- Minimized bubble ----
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
    <div
      className="flex flex-col h-full bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl border-l border-gray-200/50 dark:border-gray-800/50 shadow-xl relative w-full mb-4 sm:mb-0"
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-blue-500/20 backdrop-blur-sm border-2 border-dashed border-blue-400 rounded-xl pointer-events-none"
          >
            <UploadCloud className="w-12 h-12 text-blue-500 mb-3" />
            <p className="text-blue-700 dark:text-blue-300 font-semibold text-lg">Drop CSV to upload</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <div className="border-b border-gray-200/50 dark:border-gray-800/50 bg-white/40 dark:bg-black/40 shrink-0">
        <div className="px-4 py-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">Orbit AI</h2>
          <button
            onClick={() => onMinimizeToggle(true)}
            className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100/60 dark:hover:bg-gray-800/60 transition-colors"
            title="Minimize"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>

        {/* Dataset selector — ChatGPT-style */}
        <div className="px-4 pb-3">
          <div className="relative" ref={datasetMenuRef}>
            <button
              onClick={() => setShowDatasetMenu((v) => !v)}
              disabled={isUploading}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/70 hover:bg-white dark:hover:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 transition-all shadow-sm disabled:opacity-60 max-w-full"
            >
              <Database className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span className="truncate max-w-[180px]">{activeDataset.label}</span>
              {activeDataset.rows && (
                <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                  {activeDataset.rows.toLocaleString()} rows
                </span>
              )}
              {isUploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500 shrink-0" />
              ) : (
                <DropChevron className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform ${showDatasetMenu ? "rotate-180" : ""}`} />
              )}
            </button>

            {/* Dropdown menu */}
            <AnimatePresence>
              {showDatasetMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.12 }}
                  className="absolute top-full left-0 mt-1 z-50 min-w-[240px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden"
                >
                  <div className="p-1.5">
                    <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 px-2 py-1 uppercase tracking-wider">
                      Active Datasets
                    </p>
                    {datasets.map((ds) => (
                      <button
                        key={ds.sessionId ?? "default"}
                        onClick={() => ds.sessionId !== activeDataset.sessionId && switchDataset(ds)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                          ds.sessionId === activeDataset.sessionId
                            ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                            : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        <Database className="w-3.5 h-3.5 shrink-0" />
                        <span className="flex-1 truncate">{ds.label}</span>
                        {ds.rows && (
                          <span className="text-xs text-gray-400">{ds.rows.toLocaleString()}r</span>
                        )}
                        {ds.sessionId === activeDataset.sessionId && (
                          <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="border-t border-gray-100 dark:border-gray-800 p-1.5">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={handleFileInputChange}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      Upload CSV dataset…
                    </button>
                    <p className="text-xs text-gray-400 dark:text-gray-600 px-3 py-1">
                      Or drag & drop a CSV onto the chat
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Upload progress bar */}
          <AnimatePresence>
            {isUploading && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 overflow-hidden"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {uploadPhase === "sending" ? "Sending file…" : "Building dataset…"}
                    </span>
                  </div>
                </div>
                <div className="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden relative">
                  <motion.div
                    className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-blue-500 to-transparent"
                    animate={{ x: ["-100%", "400%"] }}
                    transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Messages ── */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4"
        style={{ scrollBehavior: "smooth" }}
      >
        <AnimatePresence>
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`p-4 rounded-2xl max-w-[85%] text-sm relative group ${
                  m.role === "user"
                    ? "bg-blue-600 text-white rounded-br-none"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-none shadow-sm"
                }`}
              >
                {m.role === "ai" ? (
                  <div className="prose dark:prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-headings:font-bold prose-a:text-blue-500">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                    <button
                      onClick={() => handleCopy(m.content, i)}
                      className="absolute bottom-2 right-2 p-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                      title="Copy"
                    >
                      {copiedIndex === i ? (
                        <Check className="w-3.5 h-3.5 text-green-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-gray-500" />
                      )}
                    </button>
                  </div>
                ) : (
                  m.content
                )}
              </div>
            </motion.div>
          ))}

          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <div className="p-3 rounded-2xl bg-gray-100 dark:bg-gray-800 rounded-bl-none flex items-center gap-2 shadow-sm">
                <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                <span className="text-sm text-gray-500">Thinking…</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll-to-bottom button */}
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
              className="p-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-full shadow-lg hover:scale-105 transition-all"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Input ── */}
      <div className="p-4 bg-white/40 dark:bg-black/40 border-t border-gray-200/50 dark:border-gray-800/50 shrink-0">
        <div className="flex items-end gap-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border border-gray-300/50 dark:border-gray-700/50 rounded-2xl p-2 shadow-sm focus-within:ring-2 focus-within:ring-blue-500/50 transition-all">
          <textarea
            ref={textareaRef}
            className="flex-1 bg-transparent outline-none text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 resize-none py-2 px-3 max-h-[120px]"
            placeholder={`Ask about ${activeDataset.label}…`}
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
