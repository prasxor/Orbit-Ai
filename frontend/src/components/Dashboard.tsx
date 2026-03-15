"use client";

import dynamic from "next/dynamic";
import { Copy, Download, Check, Bookmark, Code } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState, useRef } from "react";
import { toPng } from "html-to-image";
import { useTheme } from "next-themes";
import "easymde/dist/easymde.min.css";

// plotly needs window obj so dynamic import it for nextjs ssr bypass
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });
const SimpleMdeReact = dynamic(() => import("react-simplemde-editor"), { ssr: false });

export default function Dashboard({ data, id, isLoading, onSaveBookmark }: { data: any | null, id?: string, isLoading?: boolean, onSaveBookmark?: (data: any) => void }) {
  const { theme, systemTheme } = useTheme();
  const [showSql, setShowSql] = useState(false);
  const [copiedChart, setCopiedChart] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  
  // Executive Summary editing state
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [editedInsights, setEditedInsights] = useState<string>("");
  const dashboardRef = useRef<HTMLDivElement>(null);
  
  const currentTheme = theme === "system" ? systemTheme : theme;
  const isDark = currentTheme === "dark";

  if (!data && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-4">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-2 shrink-0 bg-gray-900/80 dark:bg-white/10 backdrop-blur-md ring-1 ring-white/20 shadow-xl shadow-black/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/orbit_ai_logo.svg" alt="Orbit AI" className="w-24 h-24 object-contain" />
        </div>
        <h3 className="text-xl font-medium text-gray-700 dark:text-gray-300">Ready for Insights</h3>
        <p className="text-sm">Ask the AI assistant a question to generate a dashboard.</p>
      </div>
    );
  }

  const { charts, sql, insights } = data || {};
  const displayInsights = editedInsights || insights;

  const handleExportPdf = async () => {
    if (!dashboardRef.current) return;
    setIsExporting(true);
    
    try {
      // wait for react 1 render cycle so charts can paint resize first 
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const element = dashboardRef.current;
      const html2canvas = (await import("html2canvas-pro")).default;
      const { jsPDF } = await import("jspdf");

      const canvas = await html2canvas(element, { 
        scale: 2, 
        useCORS: true,
        windowWidth: element.scrollWidth,
        backgroundColor: '#ffffff',
        logging: false
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF({ unit: 'in', format: 'a4', orientation: 'portrait' });
      
      const pdfWidth = 8.27;
      const pdfHeight = 11.69;
      const margin = [0.75, 0.5, 0.75, 0.5]; // top, right, bottom, left
      
      const innerWidth = pdfWidth - margin[1] - margin[3];
      const innerHeight = pdfHeight - margin[0] - margin[2];
      
      const imgProps = pdf.getImageProperties(imgData);
      const imgHeight = (imgProps.height * innerWidth) / imgProps.width;
      
      let heightLeft = imgHeight;
      let position = margin[0];
      
      const drawMargins = () => {
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pdfWidth, margin[0], 'F'); // Top margin
        pdf.rect(0, pdfHeight - margin[2], pdfWidth, margin[2], 'F'); // Bottom margin
      };
      
      pdf.addImage(imgData, 'JPEG', margin[3], position, innerWidth, imgHeight);
      drawMargins();
      heightLeft -= innerHeight;
      
      while (heightLeft > 0) {
        position = position - innerHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', margin[3], position, innerWidth, imgHeight);
        drawMargins();
        heightLeft -= innerHeight;
      }
      
      pdf.save(`OrbitAI-Analysis-${id || 'report'}.pdf`);
    } catch (err) {
      console.error("PDF Export failed:", err);
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
      className={`flex flex-col p-6 space-y-6 relative ${isExporting ? 'bg-white text-black h-auto overflow-visible !p-8' : 'bg-transparent h-full overflow-y-auto'}`} 
      ref={dashboardRef}
      style={isExporting ? { width: '1000px', maxWidth: 'none', margin: '0 auto' } : {}}
    >
      {/* Header specifically for PDF Export */}
      {isExporting && (
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/orbit_ai_logo.svg" alt="Orbit AI" className="w-15 h-15 object-cover bg-gray-900 rounded-full p-2" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Data Intelligence Report</h1>
            <p className="text-gray-500 mt-1">Generated by Orbit AI Analyst</p>
          </div>
        </div>
      )}

      <div className={`flex justify-between flex-col items-start ${isExporting ? 'hidden' : ''}`}>
        <div className="mb-4">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Generated Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Based on your latest query</p>
        </div>
        <div className="flex gap-2" data-html2canvas-ignore>
          <button 
            onClick={handleExportPdf}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export PDF</span>
          </button>
          
          {onSaveBookmark && data && (
            <button 
              onClick={() => onSaveBookmark(data)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800 dark:hover:bg-yellow-900/50 transition shadow-sm"
            >
              <Bookmark className="w-4 h-4" />
              <span className="hidden sm:inline">Bookmark</span>
            </button>
          )}
          
          <button 
            onClick={() => setShowSql(!showSql)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700 transition"
          >
            <Code className="w-4 h-4 " />
            {showSql ? "Hide SQL" : "Show SQL"}
          </button>
        </div>
      </div>

      {showSql && sql && !isLoading && (
        <div className="mt-6 w-full bg-gray-950 rounded-xl border border-gray-800 shadow-inner p-6">
          <pre className="font-mono text-[13px] sm:text-sm text-green-400 leading-loose whitespace-pre-wrap break-words">
            {(() => {
              // strip markdown code block ticks from gemini raw response
              let cleanSql = String(sql).replace(/```sql/gi, '').replace(/```/g, '').trim();
              
              // split long one-liners by inserting newline before keywords
              if (!cleanSql.includes('\n') || cleanSql.split('\n').length < 3) {
                // Ensure there's a space before inserting a newline to avoid concatenating keywords
                cleanSql = cleanSql.replace(/\s+(FROM|WHERE|GROUP BY|ORDER BY|HAVING|LIMIT|LEFT JOIN|RIGHT JOIN|INNER JOIN|JOIN)\s+/gi, '\n$1 ');
              }
              return cleanSql;
            })()}
          </pre>
        </div>
      )}

      {/* Grid of charts or Skeleton Loader */}
      <div className="grid grid-cols-1 gap-6">
        {isLoading ? (
          <div className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-gray-100/50 dark:border-gray-800/50 flex flex-col items-center justify-center w-full min-h-[400px] gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/orbit_ai_logo.svg"
              alt="Loading"
              className="w-16 h-16 object-contain [animation:spin-logo_1.4s_linear_infinite] p-2 rounded-full bg-gray-900/80 dark:bg-white/10 backdrop-blur-md ring-1 ring-white/20 shadow-lg"
            />
            <p className="text-sm text-gray-400 dark:text-gray-500 font-medium">Generating charts…</p>
          </div>
        ) : (
          charts && charts.map((chart: any, i: number) => {
            const chartId = `chart-${id || 'session'}-${i}`;
            return (
              <div key={i} className={`${isExporting ? 'bg-white border-gray-200 text-black shadow-none break-inside-avoid h-[450px]' : 'bg-white dark:bg-gray-900 shadow-sm border-gray-100 dark:border-gray-800 h-full min-h-[400px] resize-y'} p-4 rounded-2xl border flex flex-col w-full overflow-auto relative group`}>
                <button
                  onClick={() => handleCopyChart(i, chartId)}
                  data-html2canvas-ignore
                  className="absolute top-4 right-4 z-10 p-2 bg-white/80 dark:bg-black/60 backdrop-blur-sm border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-100 dark:hover:bg-gray-800 shadow-sm"
                  title="Copy Chart Image"
                >
                  {copiedChart === i ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
                <div id={chartId} className={`flex-1 w-full h-full rounded-xl overflow-hidden pt-6 ${isExporting ? 'bg-white' : 'bg-white dark:bg-gray-900'}`}>
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
        <div className={`${isExporting ? 'bg-gray-50 border-gray-200 text-black shadow-none break-inside-avoid mt-6' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900/40'} p-6 rounded-2xl border relative group`}>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/orbit_ai_logo.svg"
                alt="Loading insights"
                className="w-14 h-14 object-contain [animation:spin-logo_1.4s_linear_infinite] p-2 rounded-full bg-gray-900/80 dark:bg-white/10 backdrop-blur-md ring-1 ring-white/20 shadow-lg"
              />
              <p className="text-sm text-blue-400 font-medium">Generating insights…</p>
            </div>
          ) : (
            <>
               <div className="absolute bottom-4 right-4 z-10 flex gap-2" data-html2canvas-ignore>
                 <button
                   onClick={() => {
                     setEditedInsights(displayInsights);
                     setIsEditingSummary(true);
                   }}
                   className="p-2 bg-white/80 dark:bg-black/60 shadow-sm backdrop-blur-sm border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-100 dark:hover:bg-gray-800"
                   title="Edit Summary"
                 >
                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                 </button>
                 <button
                   onClick={() => {
                      navigator.clipboard.writeText(displayInsights);
                      setCopiedChart(-1); // using -1 to indicate description just to reuse state locally or we can use another state
                      setTimeout(() => setCopiedChart(null), 2000);
                   }}
                   className="p-2 bg-white/80 dark:bg-black/60 shadow-sm backdrop-blur-sm border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-100 dark:hover:bg-gray-800"
                   title="Copy Description"
                 >
                   {copiedChart === -1 ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                 </button>
               </div>
               
               <h3 className={`text-xl font-bold mb-2 uppercase tracking-wider ${isExporting ? 'text-gray-900' : 'text-blue-800 dark:text-blue-300'}`}>Summary</h3>
               <div className={`text-sm leading-relaxed max-w-none pb-8 prose prose-blue prose-sm sm:prose-base ${isExporting ? 'text-gray-800 prose-p:text-gray-800 prose-headings:text-gray-900 prose-strong:text-gray-900 prose-li:text-gray-800' : 'text-gray-700 dark:text-gray-300 dark:prose-invert'}`}>
                 <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayInsights}</ReactMarkdown>
               </div>
            </>
          )}
        </div>
      )}

      {/* Editor Modal */}
      {isEditingSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm shadow-2xl overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-4xl shadow-xl flex flex-col my-8">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-black/50 rounded-t-2xl">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Executive Summary</h3>
              <button onClick={() => setIsEditingSummary(false)} className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <div className="p-4 flex-1 bg-white dark:bg-gray-900 prose-editor-container">
              <SimpleMdeReact
                value={editedInsights}
                onChange={setEditedInsights}
                options={{
                  autofocus: true,
                  spellChecker: false,
                  status: false,
                  toolbar: ["bold", "italic", "strikethrough", "|", "heading-1", "heading-2", "heading-3", "|", "unordered-list", "ordered-list", "|", "preview"]
                }}
              />
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3 bg-gray-50/50 dark:bg-black/50 rounded-b-2xl">
              <button 
                onClick={() => setIsEditingSummary(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                   setIsEditingSummary(false);
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
