"use client";

import { useState, useEffect } from "react";
import ChatPanel from "@/components/ChatPanel";
import Dashboard from "@/components/Dashboard";
import Header from "@/components/Header";
import HistoryPanel, { HistoryItem } from "@/components/HistoryPanel";
import CollectionsModal from "@/components/CollectionsModal";

export default function Home() {
  const [dashboardData, setDashboardData] = useState<any | null>(null);
  const [compareData, setCompareData] = useState<any | null>(null);
  const [compareData3, setCompareData3] = useState<any | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [showCollections, setShowCollections] = useState(false);
  const [isChatMinimized, setIsChatMinimized] = useState(false);
  const [currentQuery, setCurrentQuery] = useState<string>("");
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

  const handleSaveBookmark = (data: any) => {
    const saved = localStorage.getItem("orbitai-collections");
    let collections = [];
    if (saved) {
      try {
        collections = JSON.parse(saved);
      } catch (e) {}
    }
    
    // Defaulting to "Saved Dashboards" folder for new items
    const newItem = {
      id: Date.now().toString(),
      query: currentQuery || "Dashboard Snapshot",
      data,
      date: Date.now(),
      collectionName: 'Default'
    };
    
    collections.unshift(newItem);
    localStorage.setItem("orbitai-collections", JSON.stringify(collections));
    alert("Dashboard bookmarked successfully!");
  };

  const handleNewData = (data: any, query: string) => {
    setCurrentQuery(query);
    if (showCompare) {
      if (dashboardData === null) {
        setDashboardData(data);
      } else if (compareData === null) {
        setCompareData(data);
      } else {
        setCompareData3(data);
      }
    } else {
      setDashboardData(data);
    }

    const newItem: HistoryItem = { id: Date.now().toString(), query, data, date: Date.now() };
    saveHistory([newItem, ...history]);
  };

  const handleSelectHistory = (item: HistoryItem) => {
    if (showCompare) {
      if (dashboardData === null) {
        setDashboardData(item.data);
      } else if (compareData === null) {
        setCompareData(item.data);
      } else {
        setCompareData3(item.data);
      }
    } else {
      setDashboardData(item.data);
    }
  };

  const handleDeleteHistory = (id: string) => {
    saveHistory(history.filter(h => h.id !== id));
  };

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-white dark:bg-black font-sans relative">
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-400/20 dark:bg-blue-900/20 blur-[100px] mix-blend-multiply dark:mix-blend-screen animate-blob"></div>
        <div className="absolute top-[20%] -right-[10%] w-[40%] h-[40%] rounded-full bg-purple-400/20 dark:bg-purple-900/20 blur-[100px] mix-blend-multiply dark:mix-blend-screen animate-blob" style={{ animationDelay: '2s' }}></div>
        <div className="absolute -bottom-[20%] left-[20%] w-[60%] h-[60%] rounded-full bg-emerald-400/20 dark:bg-emerald-900/20 blur-[120px] mix-blend-multiply dark:mix-blend-screen animate-blob" style={{ animationDelay: '4s' }}></div>
      </div>
      
      <div className="z-10 bg-white/60 dark:bg-black/60 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-800/50 shrink-0">
      <Header 
        onToggleHistory={() => setShowHistory(!showHistory)} 
        onToggleCompare={() => setShowCompare(!showCompare)} 
        onToggleCollections={() => setShowCollections(true)}
      />
      </div>
      
      <div className="flex flex-1 min-h-0 relative z-10 w-full">
        
        {mounted && showHistory && (
          <HistoryPanel 
            history={history}
            onSelect={handleSelectHistory}
            onDelete={handleDeleteHistory}
            onClose={() => setShowHistory(false)}
          />
        )}

        {mounted && showCollections && (
          <CollectionsModal 
            onClose={() => setShowCollections(false)}
            onLoadDashboard={(data) => {
               if (showCompare) {
                 if (dashboardData === null) setDashboardData(data);
                 else if (compareData === null) setCompareData(data);
                 else setCompareData3(data);
               } else {
                 setDashboardData(data);
               }
               setShowCollections(false);
            }}
          />
        )}

        {/* Main Content Area */}
        <main className={`flex-1 min-w-0 h-full flex ${showCompare ? 'flex-col md:flex-row' : 'flex-col'}`}>
          <div className="flex-1 overflow-hidden backdrop-blur-md bg-white/40 dark:bg-black/40 border-r border-gray-200/50 dark:border-gray-800/50">
             <Dashboard data={dashboardData} id="main" isLoading={isAiLoading} onSaveBookmark={handleSaveBookmark} />
          </div>

          {showCompare && (
            <>
              <div className="flex-1 overflow-hidden backdrop-blur-md bg-gray-50/40 dark:bg-[#0a0a0a]/40 border-r border-gray-200/50 dark:border-gray-800/50">
                 <Dashboard data={compareData} id="compare" isLoading={false} />
              </div>
              <div className="flex-1 overflow-hidden backdrop-blur-md bg-white/40 dark:bg-black/40">
                 <Dashboard data={compareData3} id="compare3" isLoading={false} />
              </div>
            </>
          )}
        </main>

        {/* Right Sidebar - Chat Interface */}
        <aside className={`flex-shrink-0 h-full transition-all duration-300 ${isChatMinimized ? 'w-0 border-none overflow-visible' : 'w-full md:w-[400px] lg:w-[450px] border-l border-gray-200/50 dark:border-gray-800/50 relative z-20'}`}>
          <ChatPanel 
             onNewData={handleNewData} 
             onLoading={setIsAiLoading} 
             isMinimized={isChatMinimized}
             onMinimizeToggle={setIsChatMinimized}
          />
        </aside>
      </div>
    </div>
  );
}
