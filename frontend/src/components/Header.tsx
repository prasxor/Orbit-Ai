"use client";

import { useTheme } from "next-themes";
import { Moon, Sun, Clock, LayoutPanelLeft } from "lucide-react";
import { useEffect, useState } from "react";

export default function Header({ 
  onToggleHistory, 
  onToggleCompare 
}: { 
  onToggleHistory: () => void,
  onToggleCompare: () => void
}) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-white dark:bg-[#111] border-b border-gray-200 dark:border-gray-800 shrink-0">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-md shadow-blue-500/20">
          <span className="text-white font-bold text-lg">O</span>
        </div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white tracking-tight">Orbit-Ai</h1>
      </div>

      <div className="flex items-center gap-3">
        <button 
          onClick={onToggleCompare}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700 transition-colors"
          title="Compare Queries"
        >
          <LayoutPanelLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Compare</span>
        </button>

        <button 
          onClick={onToggleHistory}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700 transition-colors"
          title="Chat History"
        >
          <Clock className="w-4 h-4" />
          <span className="hidden sm:inline">History</span>
        </button>

        <div className="w-px h-6 bg-gray-300 dark:bg-gray-700 mx-1"></div>

        {mounted && (
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Toggle theme"
          >
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        )}
      </div>
    </header>
  );
}
