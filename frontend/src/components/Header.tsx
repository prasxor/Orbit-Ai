"use client";

import { useTheme } from "next-themes";
import { Moon, Sun, Clock, LayoutPanelLeft, Bookmark } from "lucide-react";
import { useEffect, useState } from "react";

export default function Header({ 
  onToggleHistory, 
  onToggleCompare,
  compareCount,
  onToggleCollections
}: { 
  onToggleHistory: () => void,
  onToggleCompare: (count: number) => void,
  compareCount: number,
  onToggleCollections: () => void
}) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-transparent shrink-0">
      <div className="flex items-center gap-2.5">
        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-gray-900/80 dark:bg-white/10 backdrop-blur-md ring-1 ring-white/20 shadow-lg shadow-black/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/orbit_ai_logo.svg" alt="Orbit AI Logo" className="w-12 h-12 object-contain" />
        </div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white tracking-tight">Orbit AI</h1>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative group">
          <button 
            className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors border ${compareCount > 0 ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800' : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700'}`}
            title="Compare Queries"
          >
            <LayoutPanelLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Compare {compareCount > 0 ? `(${compareCount})` : ''}</span>
          </button>
          
          <div className="absolute top-full left-0 mt-1 w-32 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden py-1">
            <button 
              onClick={() => onToggleCompare(0)}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${compareCount === 0 || !compareCount ? 'bg-blue-50/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}
            >
              1 Window
            </button>
            <button 
              onClick={() => onToggleCompare(2)}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${compareCount === 2 ? 'bg-blue-50/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}
            >
              2 Windows
            </button>
            <button 
              onClick={() => onToggleCompare(3)}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${compareCount === 3 ? 'bg-blue-50/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}
            >
              3 Windows
            </button>
          </div>
        </div>

        <button 
          onClick={onToggleHistory}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700 transition-colors"
          title="Chat History"
        >
          <Clock className="w-4 h-4" />
          <span className="hidden sm:inline">History</span>
        </button>

        <button 
          onClick={onToggleCollections}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800 dark:hover:bg-blue-900/50 transition-colors"
          title="Saved Collections"
        >
          <Bookmark className="w-4 h-4" />
          <span className="hidden sm:inline">Collections</span>
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
