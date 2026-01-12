
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { 
  FileUp, 
  Download, 
  Trash2, 
  Image as ImageIcon, 
  Loader2, 
  Sparkles, 
  Layers, 
  FileText, 
  Maximize2, 
  Plus, 
  Files, 
  Menu, 
  X, 
  Settings2, 
  ZoomIn, 
  ZoomOut, 
  Heart,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { ConversionStatus, ConvertedPage, PDFMetadata, ExportFormat, AIAnalysis, PDFProject } from './types';
import { loadPDF, convertPageToImage } from './services/pdfService';
import { analyzePDFContent } from './services/geminiService';

type Language = 'en' | 'km';

const translations = {
  en: {
    welcome: "Welcom to Y.C PDF",
    uploadTitle: "Drop your PDFs here",
    uploadDesc: "High-resolution conversion. No file size limits. Privacy-first processing.",
    browseFiles: "Browse Files",
    filesQueue: "Active Projects",
    addMore: "Add PDF",
    convertQueue: "Process All Files",
    winEdition: "Preah Monivong",
    convertAll: "Convert All",
    zipAll: "Download All (ZIP)",
    resolution: "Output Resolution",
    gallery: "Output Gallery",
    analysis: "AI Summary",
    pages: "PAGES",
    zoomIn: "Zoom In",
    zoomOut: "Zoom Out",
    resetZoom: "100%",
    credit: "Engineered for excellence",
    converting: "Converting..."
  },
  km: {
    welcome: "សូមស្វាគមន៍មកកាន់Y.C PDF",
    uploadTitle: "ដាក់ឯកសារ PDF របស់អ្នកនៅទីនេះ",
    uploadDesc: "បំប្លែងច្បាស់ៗ មិនកំណត់ទំហំឯកសារ និងសុវត្ថិភាពបំផុត។",
    browseFiles: "ជ្រើសរើសឯកសារ",
    filesQueue: "បញ្ជីឯកសារ",
    addMore: "បន្ថែម PDF",
    convertQueue: "បំប្លែងទាំងអស់",
    winEdition: "វិទ្យាល័យព្រះមុនីវង្ស",
    convertAll: "បំប្លែងទាំងអស់",
    zipAll: "ទាញយកទាំងអស់ (ZIP)",
    resolution: "កម្រិតរូបភាព",
    gallery: "រូបភាពលទ្ធផល",
    analysis: "ការវិភាគ AI",
    pages: "ទំព័រ",
    zoomIn: "ពង្រីក",
    zoomOut: "បង្រួម",
    resetZoom: "ដើមវិញ",
    credit: "បង្កើតឡើងដោយក្តីស្រលាញ់",
    converting: "កំពុងបំប្លែង..."
  }
};

const TypewriterText: React.FC<{ lang: Language }> = ({ lang }) => {
  const fullText = translations[lang].welcome;
  const [displayedText, setDisplayedText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [index, setIndex] = useState(0);
  const typingSpeed = 100;
  const deletingSpeed = 50;
  const pauseTime = 3000;

  useEffect(() => {
    setDisplayedText("");
    setIndex(0);
    setIsDeleting(false);
  }, [lang]);

  useEffect(() => {
    let timer: number;
    if (!isDeleting && index < fullText.length) {
      timer = window.setTimeout(() => {
        setDisplayedText(prev => prev + fullText[index]);
        setIndex(prev => prev + 1);
      }, typingSpeed);
    } else if (isDeleting && index > 0) {
      timer = window.setTimeout(() => {
        setDisplayedText(prev => prev.slice(0, -1));
        setIndex(prev => prev - 1);
      }, deletingSpeed);
    } else if (!isDeleting && index === fullText.length) {
      timer = window.setTimeout(() => setIsDeleting(true), pauseTime);
    } else if (isDeleting && index === 0) {
      setIsDeleting(false);
    }
    return () => clearTimeout(timer);
  }, [index, isDeleting, fullText]);

  return (
    <div className="h-16 flex items-center justify-center overflow-hidden">
      <span className={`${lang === 'km' ? 'font-bayon' : 'font-black'} text-3xl sm:text-5xl lg:text-6xl text-slate-900 tracking-tight typewriter-cursor pr-1 text-center`}>
        {displayedText}
      </span>
    </div>
  );
};

const App: React.FC = () => {
  const [language, setLanguage] = useState<Language>('en');
  const [projects, setProjects] = useState<PDFProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('png');
  const [dpi, setDpi] = useState<number>(300); 
  const [activeTab, setActiveTab] = useState<'gallery' | 'ai'>('gallery');
  const [selectedPreview, setSelectedPreview] = useState<ConvertedPage | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const t = translations[language];
  const pdfRefs = useRef<Map<string, any>>(new Map());

  const activeProject = useMemo(() => 
    projects.find(p => p.id === activeProjectId), 
    [projects, activeProjectId]
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles: File[] = e.target.files ? Array.from(e.target.files) : [];
    if (selectedFiles.length === 0) return;
    
    for (const file of selectedFiles) {
      if (file.type !== 'application/pdf') continue;
      const id = `${file.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const placeholder: PDFProject = {
        id, file, metadata: { name: file.name, size: file.size, totalPages: 0 },
        status: ConversionStatus.LOADING, pages: [], selectedPages: [], progress: 0, aiAnalysis: null, error: null
      };
      
      setProjects(prev => [...prev, placeholder]);
      
      try {
        const { pdf, metadata } = await loadPDF(file);
        pdfRefs.current.set(id, pdf);
        setProjects(prev => prev.map(p => p.id === id ? { ...p, metadata, status: ConversionStatus.IDLE } : p));
        if (!activeProjectId) setActiveProjectId(id);
      } catch (err) {
        setProjects(prev => prev.map(p => p.id === id ? { ...p, status: ConversionStatus.ERROR, error: "Load failed." } : p));
      }
    }
  };

  const removeProject = (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    pdfRefs.current.delete(id);
    if (activeProjectId === id) {
      const remaining = projects.filter(p => p.id !== id);
      setActiveProjectId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const convertProject = async (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    const pdf = pdfRefs.current.get(projectId);
    if (!project || !pdf || project.status === ConversionStatus.CONVERTING) return;

    const total = project.metadata.totalPages;
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, status: ConversionStatus.CONVERTING, progress: 0 } : p));
    
    const scale = dpi / 72;
    let completedCount = 0;
    
    try {
      for (let i = 1; i <= total; i++) {
        // Skip if already converted
        if (project.pages.find(pg => pg.pageNumber === i)) {
          completedCount++;
          continue;
        }

        const page = await convertPageToImage(pdf, i, scale, exportFormat);
        setProjects(prev => prev.map(p => {
          if (p.id === projectId) {
            const newPages = [...p.pages, page].sort((a, b) => a.pageNumber - b.pageNumber);
            return { 
              ...p, 
              pages: newPages, 
              progress: Math.round(((++completedCount) / total) * 100) 
            };
          }
          return p;
        }));

        // AI analysis on first page
        if (i === 1 && !project.aiAnalysis) {
          analyzePDFContent(page.dataUrl).then(analysis => {
            setProjects(prev => prev.map(p => p.id === projectId ? { ...p, aiAnalysis: analysis } : p));
          }).catch(() => {});
        }
      }
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, status: ConversionStatus.COMPLETED } : p));
    } catch (err) {
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, status: ConversionStatus.ERROR, error: "Conversion failed." } : p));
    }
  };

  const convertAll = async () => {
    if (isProcessingAll) return;
    setIsProcessingAll(true);
    for (const p of projects) {
      if (p.status !== ConversionStatus.COMPLETED) {
        await convertProject(p.id);
      }
    }
    setIsProcessingAll(false);
  };

  const downloadProjectZip = async (project: PDFProject) => {
    // @ts-ignore
    const zip = new JSZip();
    const folder = zip.folder(project.metadata.name.replace('.pdf', '') + "_images");
    if (project.pages.length === 0) return;
    
    project.pages.forEach((page) => {
      const padding = project.metadata.totalPages.toString().length;
      const pageName = `Page_${page.pageNumber.toString().padStart(padding, '0')}.${exportFormat}`;
      folder.file(pageName, page.dataUrl.split(',')[1], { base64: true });
    });
    
    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `${project.metadata.name.replace('.pdf', '')}_${dpi}dpi.zip`;
    link.click();
  };

  const downloadSingleImage = (page: ConvertedPage) => {
    const link = document.createElement('a');
    link.href = page.dataUrl;
    const padding = activeProject?.metadata.totalPages.toString().length || 3;
    link.download = `Page_${page.pageNumber.toString().padStart(padding, '0')}_${dpi}dpi.${exportFormat}`;
    link.click();
  };

  const fontBodyClass = language === 'km' ? 'font-battambang' : 'font-sans';

  return (
    <div className={`flex h-screen bg-[#F8FAFC] text-slate-900 overflow-hidden ${fontBodyClass}`}>
      {/* Sidebar Overlay */}
      {isSidebarOpen && projects.length > 0 && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-30 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 w-80 bg-white border-r border-slate-200 flex flex-col shadow-2xl lg:shadow-none z-40 transition-transform duration-300 lg:static lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${projects.length === 0 ? 'hidden' : ''}`}>
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Files className="w-5 h-5 text-indigo-600" />
            <h2 className={`font-bold text-slate-800 ${language === 'km' ? 'font-bayon text-lg' : ''}`}>{t.filesQueue}</h2>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {projects.map((p) => (
            <button 
              key={p.id} 
              onClick={() => setActiveProjectId(p.id)} 
              className={`w-full text-left p-4 rounded-2xl border transition-all relative group ${activeProjectId === p.id ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-white border-slate-100 hover:border-slate-300'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className={`p-2.5 rounded-xl shrink-0 ${activeProjectId === p.id ? 'bg-white' : 'bg-slate-50'}`}>
                  <FileText className={`w-4 h-4 ${activeProjectId === p.id ? 'text-indigo-600' : 'text-slate-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold truncate ${activeProjectId === p.id ? 'text-indigo-900' : 'text-slate-700'}`}>{p.metadata.name}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{p.metadata.totalPages || '?'} {t.pages} • {(p.metadata.size / (1024 * 1024)).toFixed(1)}MB</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); removeProject(p.id); }} className="p-1 text-slate-300 hover:text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {p.status === ConversionStatus.CONVERTING && (
                <div className="mt-3">
                   <div className="w-full h-1 bg-indigo-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-600 transition-all duration-300" style={{ width: `${p.progress}%` }} />
                  </div>
                </div>
              )}
            </button>
          ))}
          
          <label className="block w-full cursor-pointer">
            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 hover:border-indigo-300 hover:bg-indigo-50/20 transition-all">
              <Plus className="w-6 h-6 text-slate-400" />
              <span className={`text-xs font-black text-slate-500 uppercase tracking-widest ${language === 'km' ? 'font-battambang' : ''}`}>{t.addMore}</span>
            </div>
            <input type="file" multiple className="hidden" accept="application/pdf" onChange={handleFileChange} />
          </label>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-3">
          <button onClick={convertAll} disabled={isProcessingAll || projects.length === 0} className="w-full bg-slate-900 text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg disabled:opacity-50 flex items-center justify-center gap-3 transition-all active:scale-[0.98]">
            {isProcessingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 fill-current" />}
            <span>{t.convertQueue}</span>
          </button>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center justify-center gap-2">
            <Heart className="w-2.5 h-2.5 text-red-400 fill-current" /> {t.credit}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-20 border-b border-slate-200 bg-white flex items-center justify-between px-4 sm:px-8 shrink-0 z-20">
          <div className="flex items-center gap-4">
             {projects.length > 0 && <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-xl"><Menu className="w-6 h-6" /></button>}
             <button onClick={() => setActiveProjectId(null)} className="flex items-center gap-3 active:scale-95 transition-all">
               <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-200"><Layers className="text-white w-5 h-5" /></div>
               <div className="flex flex-col">
                 <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none uppercase">Y.C PDF</h1>
                 <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mt-1 flex items-center gap-1">
                   <ShieldCheck className="w-2.5 h-2.5" /> {t.winEdition}
                 </span>
               </div>
             </button>
          </div>

          <div className="flex items-center gap-3 sm:gap-6">
            <div className="flex items-center bg-slate-100 rounded-full p-1 border border-slate-200 shadow-inner">
               <button onClick={() => setLanguage('km')} className={`px-4 py-1.5 rounded-full text-[10px] font-black transition-all ${language === 'km' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>KM</button>
               <button onClick={() => setLanguage('en')} className={`px-4 py-1.5 rounded-full text-[10px] font-black transition-all ${language === 'en' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>EN</button>
            </div>
            {activeProject && (
              <div className="flex items-center gap-2">
                 {activeProject.status !== ConversionStatus.CONVERTING && (
                   <button onClick={() => convertProject(activeProject.id)} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all">
                     {activeProject.status === ConversionStatus.COMPLETED ? 'RE-CONVERT' : 'CONVERT NOW'}
                   </button>
                 )}
                 {activeProject.pages.length > 0 && (
                   <button onClick={() => downloadProjectZip(activeProject)} className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition-all flex items-center gap-2">
                     <Download className="w-3.5 h-3.5" /> <span className="hidden sm:inline">DOWNLOAD ZIP</span>
                   </button>
                 )}
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {!activeProject ? (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center">
               <div className="mb-12"><TypewriterText lang={language} /></div>
               <div className="max-w-3xl w-full">
                  <label className="block w-full group cursor-pointer">
                    <div className="bg-white border-2 border-dashed border-slate-200 rounded-[3rem] p-12 sm:p-24 flex flex-col items-center justify-center text-center hover:border-indigo-400 hover:bg-indigo-50/30 transition-all duration-500 shadow-2xl shadow-slate-200/50">
                       <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mb-10 group-hover:scale-110 transition-transform duration-500 ring-8 ring-indigo-50/50">
                          <FileUp className="w-10 h-10 text-indigo-600" />
                       </div>
                       <h2 className={`text-3xl sm:text-4xl font-black text-slate-900 mb-4 ${language === 'km' ? 'font-bayon' : ''}`}>{t.uploadTitle}</h2>
                       <p className={`text-slate-500 text-lg font-medium mb-12 max-w-sm mx-auto ${language === 'km' ? 'font-battambang' : ''}`}>{t.uploadDesc}</p>
                       <div className="bg-slate-900 text-white px-12 py-5 rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-slate-300 transition-all group-hover:-translate-y-1">{t.browseFiles}</div>
                    </div>
                    <input type="file" multiple className="hidden" accept="application/pdf" onChange={handleFileChange} />
                  </label>
               </div>
            </div>
          ) : (
            <div className="p-6 lg:p-12 max-w-7xl mx-auto w-full space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Project Overview */}
                <div className="lg:col-span-8 bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8 flex items-center gap-6">
                   <div className="bg-indigo-50 p-5 rounded-2xl shrink-0"><FileText className="text-indigo-600 w-10 h-10" /></div>
                   <div className="min-w-0">
                      <h2 className="text-2xl font-black text-slate-900 leading-tight truncate pr-4">{activeProject.metadata.name}</h2>
                      <div className="flex items-center gap-3 text-xs text-slate-400 font-black mt-2 uppercase tracking-widest">
                         <span className="bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">{activeProject.metadata.totalPages} {t.pages}</span>
                         <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                         <span>{(activeProject.metadata.size / (1024 * 1024)).toFixed(2)} MB</span>
                      </div>
                   </div>
                </div>

                {/* Settings */}
                <div className="lg:col-span-4 bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8 flex flex-col justify-center">
                  <div className="flex items-center justify-between mb-6">
                     <div className="flex items-center gap-2 text-slate-900"><Settings2 className="w-4 h-4" /><span className="text-[10px] font-black uppercase tracking-widest">{t.resolution}</span></div>
                     <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg font-black text-xs">{dpi} DPI</span>
                  </div>
                  <input type="range" min="72" max="600" step="1" value={dpi} onChange={(e) => setDpi(parseInt(e.target.value))} className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                  <div className="flex justify-between mt-3 text-[9px] font-black text-slate-400 uppercase">
                    <span>Low Res</span>
                    <span>High Res</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/60 border border-slate-100 overflow-hidden">
                 <div className="px-10 py-6 border-b border-slate-50 flex items-center gap-6 bg-slate-50/30">
                    <button onClick={() => setActiveTab('gallery')} className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-3 ${activeTab === 'gallery' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200' : 'text-slate-400 hover:text-slate-600'}`}><ImageIcon className="w-4 h-4" /> {t.gallery}</button>
                    {activeProject.aiAnalysis && <button onClick={() => setActiveTab('ai')} className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-3 ${activeTab === 'ai' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200' : 'text-slate-400 hover:text-slate-600'}`}><Sparkles className="w-4 h-4" /> {t.analysis}</button>}
                 </div>

                 {activeTab === 'gallery' ? (
                   <div className="p-10 grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                      {Array.from({ length: activeProject.metadata.totalPages }, (_, i) => i + 1).map((pageNum) => {
                         const page = activeProject.pages.find(pg => pg.pageNumber === pageNum);
                         return (
                            <div key={pageNum} className="group bg-white rounded-3xl border border-slate-100 overflow-hidden relative shadow-sm hover:shadow-2xl hover:border-indigo-100 transition-all duration-300">
                               <div className="aspect-[3/4] relative bg-slate-50/50 flex items-center justify-center p-4">
                                  {page ? (
                                     <img src={page.dataUrl} className="max-w-full max-h-full object-contain shadow-md rounded-lg" alt={`Page ${pageNum}`} />
                                  ) : (
                                     <div className="flex flex-col items-center gap-3 opacity-20">
                                        <ImageIcon className="w-12 h-12" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">{activeProject.status === ConversionStatus.CONVERTING ? t.converting : 'WAITING'}</span>
                                     </div>
                                  )}
                                  <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-3">
                                     {page && <button onClick={() => setSelectedPreview(page)} className="p-3 bg-white rounded-2xl text-slate-800 shadow-2xl hover:scale-110 active:scale-95 transition-all"><Maximize2 className="w-5 h-5" /></button>}
                                     {page && <button onClick={() => downloadSingleImage(page)} className="p-3 bg-indigo-600 rounded-2xl text-white shadow-2xl hover:scale-110 active:scale-95 transition-all"><Download className="w-5 h-5" /></button>}
                                  </div>
                               </div>
                               <div className="p-4 text-center border-t border-slate-50">
                                 <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">PAGE {pageNum}</span>
                               </div>
                            </div>
                         );
                      })}
                   </div>
                 ) : (
                   <div className="p-12 max-w-4xl mx-auto">
                      {activeProject.aiAnalysis && (
                        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                          <div>
                            <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em] mb-4">Suggested Title</h3>
                            <p className="text-4xl font-black text-slate-900 leading-tight">{activeProject.aiAnalysis.suggestedTitle}</p>
                          </div>
                          <div>
                            <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em] mb-4">Document Abstract</h3>
                            <p className="text-xl text-slate-600 leading-relaxed font-medium">{activeProject.aiAnalysis.summary}</p>
                          </div>
                          <div>
                            <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em] mb-6">Key Insights</h3>
                            <div className="grid grid-cols-1 gap-4">
                              {activeProject.aiAnalysis.keyPoints.map((point, idx) => (
                                <div key={idx} className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex gap-4">
                                  <div className="h-6 w-6 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-1">{idx + 1}</div>
                                  <p className="text-slate-700 font-bold">{point}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                   </div>
                 )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Fullscreen Preview */}
      {selectedPreview && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-3xl flex flex-col animate-in fade-in zoom-in-95 duration-300">
           <div className="flex items-center justify-between p-6 text-white shrink-0">
              <span className="bg-white/10 px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest border border-white/10">Page {selectedPreview.pageNumber} • PREVIEW MODE</span>
              <button onClick={() => setSelectedPreview(null)} className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all active:scale-95"><X className="w-8 h-8" /></button>
           </div>
           
           <div className="flex-1 overflow-auto flex items-center justify-center p-8">
              <div 
                className="transition-transform duration-200 ease-out inline-block"
                style={{ transform: `scale(${previewZoom})` }}
              >
                <img 
                  src={selectedPreview.dataUrl} 
                  className="max-h-[85vh] max-w-full object-contain shadow-[0_0_100px_rgba(0,0,0,0.5)] rounded bg-white" 
                  alt="Full preview"
                />
              </div>
           </div>
           
           <div className="p-10 flex justify-center gap-4 shrink-0">
              <div className="flex items-center bg-white/10 rounded-2xl p-2 border border-white/10 backdrop-blur-xl">
                <button onClick={() => setPreviewZoom(z => Math.max(0.5, z - 0.25))} className="p-4 hover:bg-white/10 rounded-xl transition-all"><ZoomOut className="w-5 h-5 text-white" /></button>
                <button onClick={() => setPreviewZoom(1)} className="px-6 py-4 font-black text-white text-[10px] uppercase tracking-widest hover:bg-white/10 rounded-xl transition-all">{t.resetZoom}</button>
                <button onClick={() => setPreviewZoom(z => Math.min(4, z + 0.25))} className="p-4 hover:bg-white/10 rounded-xl transition-all"><ZoomIn className="w-5 h-5 text-white" /></button>
              </div>
              <button onClick={() => downloadSingleImage(selectedPreview)} className="bg-white text-slate-900 px-12 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3">
                <Download className="w-5 h-5" /> Download Image
              </button>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
