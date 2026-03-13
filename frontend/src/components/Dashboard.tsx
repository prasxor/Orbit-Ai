"use client";

import dynamic from "next/dynamic";
import { Info, Code } from "lucide-react";
import { useState, useRef } from "react";
import { toPng } from "html-to-image";
import { Copy, Download, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useTheme } from "next-themes";


// Plotly requires browser environment
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

export default function Dashboard({ data, id, isLoading }: { data: any | null, id?: string, isLoading?: boolean }) {
  const { theme, systemTheme } = useTheme();
  const [showSql, setShowSql] = useState(false);
  const [copiedChart, setCopiedChart] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);
  
  const currentTheme = theme === "system" ? systemTheme : theme;
  const isDark = currentTheme === "dark";

  if (!data && !isLoading) {
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

  const { charts, sql, insights } = data || {};

  const handleExportPdf = async () => {
    if (!dashboardRef.current) return;
    setIsExporting(true);
    
    try {
      // Give React a tick to apply the `isExporting` layout changes (removes scrollbars)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const html2pdf = (await import("html2pdf.js")).default;
      const opt = {
        margin: 0.5,
        filename: `OrbitAI-Analysis-${id || 'export'}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true,
          windowWidth: dashboardRef.current.scrollWidth,
          scrollY: 0
        },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' as const }
      };
      await html2pdf().set(opt).from(dashboardRef.current).save();
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyChart = async (index: number, elementId: string) => {
    const el = document.getElementById(elementId);
    if (!el) return;
    try {
      const dataUrl = await toPng(el, { cacheBust: true });
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      setCopiedChart(index);
      setTimeout(() => setCopiedChart(null), 2000);
    } catch (err) {
      console.error('Failed to copy chart image', err);
    }
  };

  return (
    <div 
      className={`flex flex-col bg-gray-50 dark:bg-[#0a0a0a] p-6 space-y-6 relative ${isExporting ? 'h-auto overflow-visible' : 'h-full overflow-y-auto'}`} 
      ref={dashboardRef}
    >
      <div className="flex justify-between items-center" data-html2canvas-ignore>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Generated Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Based on your latest query</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleExportPdf}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export PDF</span>
          </button>
          
          <button 
            onClick={() => setShowSql(!showSql)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700 transition"
          >
            <Code className="w-4 h-4" />
            {showSql ? "Hide SQL" : "Show SQL"}
          </button>
        </div>
      </div>

      {showSql && sql && !isLoading && (
        <div className="p-4 bg-gray-900 text-green-400 rounded-xl font-mono text-sm overflow-x-auto shadow-inner">
          <pre>{sql}</pre>
        </div>
      )}

      {/* Grid of charts or Skeleton Loader */}
      <div className="grid grid-cols-1 gap-6">
        {isLoading ? (
          <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col w-full h-full min-h-[400px] animate-pulse">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-md w-1/4 mb-4 mx-auto mt-2"></div>
            <div className="flex-1 w-full bg-gray-100 dark:bg-gray-800 rounded-xl"></div>
          </div>
        ) : (
          charts && charts.map((chart: any, i: number) => {
            const chartId = `chart-${id || 'session'}-${i}`;
            return (
              <div key={i} className={`bg-white dark:bg-gray-900 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col w-full ${isExporting ? 'h-[500px]' : 'h-full min-h-[400px] resize-y'} overflow-auto relative group`}>
                <button
                  onClick={() => handleCopyChart(i, chartId)}
                  data-html2canvas-ignore
                  className="absolute top-4 right-4 z-10 p-2 bg-white/80 dark:bg-black/60 backdrop-blur-sm border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-100 dark:hover:bg-gray-800 shadow-sm"
                  title="Copy Chart Image"
                >
                  {copiedChart === i ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
                <div id={chartId} className="flex-1 w-full h-full bg-white dark:bg-gray-900 rounded-xl overflow-hidden pt-6">
                  <Plot
                    data={chart.data}
                    layout={{
                      ...chart.layout,
                      autosize: true,
                      paper_bgcolor: 'rgba(0,0,0,0)',
                      plot_bgcolor: 'rgba(0,0,0,0)',
                      font: { color: isDark && !isExporting ? '#e5e7eb' : '#374151' },
                      margin: { t: 40, b: 40, l: 40, r: 40 }
                    }}
                    useResizeHandler={true}
                    style={{ width: "100%", height: "100%" }}
                    config={{ displayModeBar: false, responsive: true }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Insight Summary Panel or Skeleton Loader */}
      {(insights || isLoading) && (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-900/40 relative group">
          {isLoading ? (
             <div className="animate-pulse flex flex-col space-y-3">
               <div className="h-4 bg-blue-200 dark:bg-blue-800/50 rounded w-1/3 mb-2"></div>
               <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-full"></div>
               <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-5/6"></div>
               <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-4/6"></div>
             </div>
          ) : (
            <>
               <button
                 onClick={() => {
                    navigator.clipboard.writeText(insights);
                    setCopiedChart(-1); // using -1 to indicate description just to reuse state locally or we can use another state
                    setTimeout(() => setCopiedChart(null), 2000);
                 }}
             data-html2canvas-ignore
             className="absolute bottom-4 right-4 z-10 p-2 bg-white/80 dark:bg-black/60 shadow-sm backdrop-blur-sm border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-100 dark:hover:bg-gray-800"
             title="Copy Description"
           >
             {copiedChart === -1 ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
           </button>
           <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2 uppercase tracking-wider">Executive Summary</h3>
           <div className={`text-gray-700 dark:text-gray-300 text-sm leading-relaxed prose prose-blue prose-sm sm:prose-base dark:prose-invert max-w-none pb-8 ${isExporting ? 'text-black prose-p:text-black prose-headings:text-black' : ''}`}>
             <ReactMarkdown>{insights}</ReactMarkdown>
           </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
