"use client";

import { useState, useEffect } from "react";
import ChatPanel from "@/components/ChatPanel";
import Dashboard from "@/components/Dashboard";
import Header from "@/components/Header";
import HistoryPanel, { HistoryItem } from "@/components/HistoryPanel";

export default function Home() {
  const [dashboardData, setDashboardData] = useState<any | null>(null);
  const [compareData, setCompareData] = useState<any | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("orbitai-history");
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse history");
      }
    }
  }, []);

  const saveHistory = (items: HistoryItem[]) => {
    setHistory(items);
    localStorage.setItem("orbitai-history", JSON.stringify(items));
  };

  const handleNewData = (data: any, query: string) => {
    // If in compare mode and we already have main dashboard data, put this in compareData
    if (showCompare && dashboardData !== null) {
      setCompareData(data);
    } else {
      setDashboardData(data);
    }

    const newItem: HistoryItem = { id: Date.now().toString(), query, data, date: Date.now() };
    saveHistory([newItem, ...history]);
  };

  const handleSelectHistory = (item: HistoryItem) => {
    if (showCompare && dashboardData !== null) {
      setCompareData(item.data);
    } else {
      setDashboardData(item.data);
    }
  };

  const handleDeleteHistory = (id: string) => {
    saveHistory(history.filter(h => h.id !== id));
  };

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-white dark:bg-black font-sans">
      <Header 
        onToggleHistory={() => setShowHistory(!showHistory)} 
        onToggleCompare={() => setShowCompare(!showCompare)} 
      />
      
      <div className="flex flex-1 min-h-0 relative">
        
        {mounted && showHistory && (
          <HistoryPanel 
            history={history}
            onSelect={handleSelectHistory}
            onDelete={handleDeleteHistory}
            onClose={() => setShowHistory(false)}
          />
        )}

        {/* Main Content Area */}
        <main className={`flex-1 min-w-0 h-full flex ${showCompare ? 'flex-col md:flex-row' : 'flex-col'}`}>
          <div className="flex-1 overflow-hidden border-r border-gray-200 dark:border-gray-800">
             <Dashboard data={dashboardData} id="main" isLoading={isAiLoading} />
          </div>

          {showCompare && (
            <div className="flex-1 overflow-hidden bg-gray-50/50 dark:bg-[#0a0a0a]">
               <Dashboard data={compareData} id="compare" isLoading={false} />
            </div>
          )}
        </main>

        {/* Right Sidebar - Chat Interface */}
        <aside className="w-full md:w-[400px] lg:w-[450px] flex-shrink-0 h-full border-l border-gray-200 dark:border-gray-800 transition-all duration-300">
          <ChatPanel onNewData={handleNewData} onLoading={setIsAiLoading} />
        </aside>
      </div>
    </div>
  );
}
