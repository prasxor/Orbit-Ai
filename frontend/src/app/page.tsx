"use client";

import { useState } from "react";
import ChatPanel from "@/components/ChatPanel";
import Dashboard from "@/components/Dashboard";

export default function Home() {
  const [dashboardData, setDashboardData] = useState<any | null>(null);

  const handleNewData = (data: any) => {
    setDashboardData(data);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white dark:bg-black font-sans">
      
      {/* Sidebar - Optional Navigation */}
      <aside className="w-16 hidden md:flex flex-col items-center py-4 bg-gray-50 dark:bg-[#111] border-r border-gray-200 dark:border-gray-900">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
          <span className="text-white font-bold text-xl">O</span>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 relative h-full">
        <Dashboard data={dashboardData} />
      </main>

      {/* Right Sidebar - Chat Interface */}
      <aside className="w-full md:w-96 flex-shrink-0 h-full border-l border-gray-200 dark:border-gray-800">
        <ChatPanel onNewData={handleNewData} />
      </aside>
      
    </div>
  );
}
