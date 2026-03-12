"use client";

import { X, Trash2, Clock } from "lucide-react";

export interface HistoryItem {
  id: string;
  query: string;
  data: any;
  date: number;
}

export default function HistoryPanel({
  history,
  onSelect,
  onDelete,
  onClose,
}: {
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 shadow-xl w-72 flex-shrink-0 absolute z-50 md:relative">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-500" />
          History
        </h2>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {history.length === 0 ? (
          <div className="text-center text-sm text-gray-400 mt-10">
            No saved sessions yet.
          </div>
        ) : (
          history.map((item) => (
            <div 
              key={item.id} 
              className="flex justify-between items-start group p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-[#151515] hover:border-gray-300 dark:hover:border-gray-600 transition-colors cursor-pointer"
              onClick={() => onSelect(item)}
            >
              <div className="flex-1 overflow-hidden pr-2">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{item.query}</p>
                <p className="text-xs text-gray-500 mt-1">{new Date(item.date).toLocaleString()}</p>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                className="opacity-0 group-hover:opacity-100 p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition"
                title="Delete item"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
