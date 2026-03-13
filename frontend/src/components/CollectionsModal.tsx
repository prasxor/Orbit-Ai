"use client";

import { X, Search, Bookmark, Trash2, FolderPlus } from "lucide-react";
import { useState, useEffect } from "react";

export interface CollectionItem {
  id: string;
  query: string;
  data: any;
  date: number;
  collectionName: string;
}

export default function CollectionsModal({ 
  onClose,
  onLoadDashboard
}: { 
  onClose: () => void,
  onLoadDashboard: (data: any) => void
}) {
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [collections, setCollections] = useState<string[]>(['Default']);
  const [selectedCollection, setSelectedCollection] = useState<string>('Default');
  const [search, setSearch] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("orbitai-collections");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setItems(parsed);
        const uniqueCollections = Array.from(new Set(parsed.map((i: any) => i.collectionName || 'Default')));
        if (!uniqueCollections.includes('Default')) uniqueCollections.unshift('Default');
        setCollections(uniqueCollections as string[]);
      } catch (e) {
        console.error("Failed to parse collections");
      }
    }
  }, []);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newItems = items.filter(item => item.id !== id);
    setItems(newItems);
    localStorage.setItem("orbitai-collections", JSON.stringify(newItems));
  };

  const filteredItems = items.filter(item => 
    (item.collectionName || 'Default') === selectedCollection &&
    item.query.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 shadow-2xl backdrop-blur-sm">
      <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200/50 dark:border-gray-800/50 w-full max-w-4xl max-h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-gray-200/50 dark:border-gray-800/50 bg-white/40 dark:bg-black/40 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Bookmark className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">Collections</h2>
              <p className="text-sm text-gray-500">Your saved dashboards and insights</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar - Folders */}
          <div className="w-64 border-r border-gray-200/50 dark:border-gray-800/50 bg-gray-50/40 dark:bg-[#0a0a0a]/40 p-4 overflow-y-auto space-y-2">
            <h3 className="text-xs font-semibold uppercase text-gray-500 mb-3 ml-2 tracking-wider">Folders</h3>
            {collections.map(col => (
              <button
                key={col}
                onClick={() => setSelectedCollection(col)}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  selectedCollection === col 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <FolderPlus className={`w-4 h-4 ${selectedCollection === col ? 'text-blue-200' : 'text-gray-400'}`} />
                  {col}
                </div>
              </button>
            ))}
          </div>

          {/* Main Area - Items */}
          <div className="flex-1 flex flex-col bg-white/40 dark:bg-black/20">
            <div className="p-4 border-b border-gray-200/50 dark:border-gray-800/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder={`Search in ${selectedCollection}...`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {filteredItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-400">
                  <Bookmark className="w-12 h-12 mb-4 opacity-20" />
                  <p className="text-lg font-medium text-gray-600 dark:text-gray-300 mb-1">No saved dashboards</p>
                  <p className="text-sm">Bookmarks added to '{selectedCollection}' will appear here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredItems.map(item => (
                    <div 
                      key={item.id}
                      onClick={() => onLoadDashboard(item.data)}
                      className="group p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl cursor-pointer hover:border-blue-500 hover:shadow-lg transition-all text-left relative overflow-hidden flex flex-col"
                    >
                      <div className="absolute top-0 left-0 w-1 h-full bg-transparent group-hover:bg-blue-500 transition-colors"></div>
                      
                      <div className="flex justify-between items-start mb-3">
                        <div className="text-xs font-mono text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                          {new Date(item.date).toLocaleDateString()}
                        </div>
                        <button
                          onClick={(e) => handleDelete(item.id, e)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete bookmark"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <h4 className="font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2 pr-4">{item.query}</h4>
                      
                      <div className="mt-auto pt-4 flex gap-2">
                        <span className="text-xs px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md font-medium">
                          {item.data?.charts?.length || 0} Charts
                        </span>
                        {item.data?.insights && (
                          <span className="text-xs px-2 py-1 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-md font-medium">
                            AI Summary
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
