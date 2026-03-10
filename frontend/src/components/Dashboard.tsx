"use client";

import dynamic from "next/dynamic";
import { Info, Code } from "lucide-react";
import { useState } from "react";

// Plotly requires browser environment
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

export default function Dashboard({ data }: { data: any | null }) {
  const [showSql, setShowSql] = useState(false);

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-4">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
          <Info className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-xl font-medium text-gray-700 dark:text-gray-300">Ready for Insights</h3>
        <p className="text-sm">Ask the AI assistant a question to generate a dashboard.</p>
      </div>
    );
  }

  const { charts, sql, insights } = data;

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-[#0a0a0a] overflow-y-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Generated Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Based on your latest query</p>
        </div>
        <button 
          onClick={() => setShowSql(!showSql)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700 transition"
        >
          <Code className="w-4 h-4" />
          {showSql ? "Hide SQL" : "Show SQL"}
        </button>
      </div>

      {showSql && sql && (
        <div className="p-4 bg-gray-900 text-green-400 rounded-xl font-mono text-sm overflow-x-auto shadow-inner">
          <pre>{sql}</pre>
        </div>
      )}

      {/* Grid of charts */}
      <div className="grid grid-cols-1 gap-6">
        {charts && charts.map((chart: any, i: number) => (
          <div key={i} className="bg-white dark:bg-gray-900 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex justify-center w-full h-full min-h-[400px]">
            <Plot
              data={chart.data}
              layout={{
                ...chart.layout,
                autosize: true,
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)',
                font: { color: '#888' },
                margin: { t: 40, b: 40, l: 40, r: 40 }
              }}
              useResizeHandler={true}
              style={{ width: "100%", height: "100%" }}
              config={{ displayModeBar: false, responsive: true }}
            />
          </div>
        ))}
      </div>

      {/* Insight Summary Panel */}
      {insights && (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-900/40">
          <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2 uppercase tracking-wider">Executive Summary</h3>
          <div className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed prose dark:prose-invert max-w-none">
            {insights}
          </div>
        </div>
      )}
    </div>
  );
}
