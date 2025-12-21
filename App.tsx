
import React, { useState, useEffect, useCallback } from 'react';
import QRScanner from './components/QRScanner';
import ScanHistory from './components/ScanHistory';
import { AppTab, ScanResult } from './types';
import { analyzeQRContent } from './services/geminiService';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.SCANNER);
  const [history, setHistory] = useState<ScanResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<ScanResult | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCooldown, setIsCooldown] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('qr_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Erro ao carregar histórico");
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('qr_history', JSON.stringify(history));
  }, [history]);

  const detectType = (content: string): ScanResult['type'] => {
    if (content.startsWith('http')) return 'url';
    if (content.includes('@')) return 'email';
    if (/^\+?\d+$/.test(content.replace(/\s/g, ''))) return 'phone';
    return 'text';
  };

  const handleScan = useCallback((content: string) => {
    if (isCooldown) return;
    
    setIsCooldown(true);
    const result: ScanResult = {
      id: Math.random().toString(36).substr(2, 9),
      content,
      timestamp: Date.now(),
      type: detectType(content)
    };

    setHistory(prev => {
      // Evitar duplicatas consecutivas
      if (prev.length > 0 && prev[0].content === content) return prev;
      return [result, ...prev];
    });
    
    setSelectedResult(result);
    setAiAnalysis(null);
    
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    setTimeout(() => setIsCooldown(false), 3000);
  }, [isCooldown]);

  const handleAnalyze = async () => {
    if (!selectedResult || isAnalyzing) return;
    setIsAnalyzing(true);
    const analysis = await analyzeQRContent(selectedResult.content);
    setAiAnalysis(analysis);
    setIsAnalyzing(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Poderia usar um toast aqui
  };

  const openLink = (url: string) => {
    const validUrl = url.startsWith('http') ? url : `https://${url}`;
    window.open(validUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto bg-slate-950 overflow-hidden relative">
      {/* Header */}
      <header className="p-4 pt-6 flex items-center justify-between z-10">
        <div>
          <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
            <span className="bg-emerald-500 text-slate-950 px-2 py-0.5 rounded">QR</span>
            MASTER PRO
          </h1>
        </div>
        <div className="flex gap-3">
           <div className="flex flex-col items-end">
             <span className="text-[10px] text-slate-500 font-bold uppercase">Status</span>
             <span className="text-xs text-emerald-400 flex items-center gap-1">
               <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
               Pronto
             </span>
           </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto custom-scrollbar">
        {activeTab === AppTab.SCANNER ? (
          <div className="p-4 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="relative">
                <QRScanner onScan={handleScan} isActive={activeTab === AppTab.SCANNER && !selectedResult} />
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-slate-800 px-4 py-1.5 rounded-full border border-slate-700 shadow-xl text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                   Posicione o código no quadro
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3 pt-4">
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col items-center justify-center gap-1">
                <i className="fas fa-history text-emerald-500/50 mb-1"></i>
                <span className="text-xl font-bold text-white">{history.length}</span>
                <span className="text-[10px] text-slate-500 font-bold uppercase">Histórico</span>
              </div>
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col items-center justify-center gap-1">
                <i className="fas fa-shield-alt text-cyan-500/50 mb-1"></i>
                <span className="text-xl font-bold text-white">Ativa</span>
                <span className="text-[10px] text-slate-500 font-bold uppercase">Proteção IA</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 animate-in fade-in duration-300">
            <ScanHistory 
              history={history} 
              onClear={() => setHistory([])} 
              onSelect={setSelectedResult}
            />
          </div>
        )}
      </main>

      {/* Result Modal */}
      {selectedResult && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[2.5rem] border-t border-x border-slate-800 shadow-2xl animate-in slide-in-from-bottom-full duration-500">
            <div className="p-8">
              <div className="w-12 h-1.5 bg-slate-800 rounded-full mx-auto mb-8 sm:hidden"></div>
              
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Conteúdo Detectado</h3>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                    <span className="text-white font-bold text-sm uppercase">{selectedResult.type}</span>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedResult(null)}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>

              <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800 mb-6 overflow-hidden">
                <p className="text-slate-200 font-medium text-lg break-all selection:bg-emerald-500/30 line-clamp-4">
                  {selectedResult.content}
                </p>
              </div>

              {aiAnalysis ? (
                <div className="mb-6 p-5 rounded-3xl bg-emerald-500/5 border border-emerald-500/20 animate-in zoom-in duration-300">
                  <div className="flex items-center gap-2 mb-3 text-emerald-400 text-xs font-black uppercase tracking-widest">
                    <i className="fas fa-robot animate-bounce"></i> Insight da IA
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed italic">"{aiAnalysis}"</p>
                </div>
              ) : (
                <button 
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="w-full mb-6 py-4 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 rounded-2xl font-bold text-white flex items-center justify-center gap-3 transition-all transform active:scale-95 shadow-lg shadow-emerald-900/20"
                >
                  {isAnalyzing ? (
                    <><i className="fas fa-spinner animate-spin"></i> Analisando Conteúdo...</>
                  ) : (
                    <><i className="fas fa-magic"></i> Consultar Gemini IA</>
                  )}
                </button>
              )}

              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => {
                    copyToClipboard(selectedResult.content);
                    alert("Copiado!");
                  }}
                  className="py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all"
                >
                  <i className="fas fa-copy opacity-50"></i> Copiar
                </button>
                {selectedResult.type === 'url' ? (
                  <button 
                    onClick={() => openLink(selectedResult.content)}
                    className="py-4 bg-white text-slate-900 hover:bg-slate-100 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all"
                  >
                    <i className="fas fa-external-link-alt"></i> Abrir
                  </button>
                ) : (
                  <button 
                    onClick={() => {
                       if (navigator.share) {
                          navigator.share({ title: 'QR Code Result', text: selectedResult.content });
                       }
                    }}
                    className="py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all"
                  >
                    <i className="fas fa-share-alt opacity-50"></i> Partilhar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Nav Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-2xl mx-auto h-24 bg-slate-900/90 backdrop-blur-2xl border-t border-slate-800 flex items-center justify-around px-12 z-40 pb-6">
        <button 
          onClick={() => setActiveTab(AppTab.SCANNER)}
          className={`group flex flex-col items-center gap-1.5 transition-all ${activeTab === AppTab.SCANNER ? 'text-emerald-400' : 'text-slate-500'}`}
        >
          <div className={`w-12 h-1 rounded-full mb-1 transition-all ${activeTab === AppTab.SCANNER ? 'bg-emerald-400' : 'bg-transparent'}`}></div>
          <i className={`fas fa-expand text-xl transition-transform group-active:scale-90`}></i>
          <span className="text-[9px] font-black uppercase tracking-widest">Scanner</span>
        </button>
        
        <button 
          onClick={() => setActiveTab(AppTab.HISTORY)}
          className={`group flex flex-col items-center gap-1.5 transition-all ${activeTab === AppTab.HISTORY ? 'text-emerald-400' : 'text-slate-500'}`}
        >
          <div className={`w-12 h-1 rounded-full mb-1 transition-all ${activeTab === AppTab.HISTORY ? 'bg-emerald-400' : 'bg-transparent'}`}></div>
          <i className={`fas fa-layer-group text-xl transition-transform group-active:scale-90`}></i>
          <span className="text-[9px] font-black uppercase tracking-widest">Logs</span>
        </button>
      </nav>
    </div>
  );
};

export default App;
