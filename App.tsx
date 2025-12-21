
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

  // Load history from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('qr_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse history");
      }
    }
  }, []);

  // Save history to localStorage
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

    setHistory(prev => [result, ...prev]);
    setSelectedResult(result);
    setAiAnalysis(null);
    
    // Notification vibration
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

    // Simple cooldown to avoid duplicate scans
    setTimeout(() => setIsCooldown(false), 2000);
  }, [isCooldown]);

  const clearHistory = () => {
    if (window.confirm("Deseja realmente apagar todo o histórico?")) {
      setHistory([]);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedResult || isAnalyzing) return;
    setIsAnalyzing(true);
    const analysis = await analyzeQRContent(selectedResult.content);
    setAiAnalysis(analysis);
    setIsAnalyzing(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Conteúdo copiado!");
  };

  const openLink = (url: string) => {
    if (!url.startsWith('http')) {
        url = 'https://' + url;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex flex-col min-h-screen max-w-2xl mx-auto pb-24">
      {/* Header */}
      <header className="p-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            QR Master Pro
          </h1>
          <p className="text-slate-500 text-sm">Escaneie, salve e analise</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
          <i className="fas fa-qrcode text-emerald-400"></i>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-4">
        {activeTab === AppTab.SCANNER ? (
          <div className="space-y-8 animate-in fade-in duration-500">
            <QRScanner onScan={handleScan} isActive={true} />
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 text-center">
                <p className="text-2xl font-bold text-emerald-400">{history.length}</p>
                <p className="text-xs text-slate-400">Escaneados</p>
              </div>
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 text-center">
                <p className="text-2xl font-bold text-cyan-400">IA</p>
                <p className="text-xs text-slate-400">Análise Pronta</p>
              </div>
            </div>

            <div className="bg-emerald-500/10 p-6 rounded-2xl border border-emerald-500/20 text-center">
              <i className="fas fa-lightbulb text-emerald-400 mb-2"></i>
              <p className="text-sm text-slate-300">
                Aponte sua câmera para qualquer QR Code. Ele será reconhecido instantaneamente.
              </p>
            </div>
          </div>
        ) : (
          <div className="animate-in slide-in-from-right duration-300">
            <ScanHistory 
              history={history} 
              onClear={clearHistory} 
              onSelect={setSelectedResult}
            />
          </div>
        )}
      </main>

      {/* Result Modal */}
      {selectedResult && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-slate-700 overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider border border-emerald-500/30">
                  {selectedResult.type} Detectado
                </span>
                <button 
                  onClick={() => setSelectedResult(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>

              <div className="bg-slate-800 p-4 rounded-xl mb-6 break-all">
                <p className="text-slate-100 font-medium text-lg text-center">{selectedResult.content}</p>
              </div>

              {/* AI Analysis Section */}
              {aiAnalysis ? (
                <div className="mb-6 p-4 rounded-xl bg-gradient-to-br from-indigo-900/40 to-cyan-900/40 border border-indigo-500/30 animate-in zoom-in duration-300">
                  <div className="flex items-center gap-2 mb-2 text-cyan-400 text-sm font-bold">
                    <i className="fas fa-robot"></i> Analisado por Gemini AI
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed">{aiAnalysis}</p>
                </div>
              ) : (
                <button 
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="w-full mb-6 py-3 px-4 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 disabled:opacity-50 rounded-xl font-bold flex items-center justify-center gap-3 transition-all transform active:scale-95"
                >
                  {isAnalyzing ? (
                    <><i className="fas fa-circle-notch animate-spin"></i> Analisando...</>
                  ) : (
                    <><i className="fas fa-magic"></i> Analisar com IA</>
                  )}
                </button>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => copyToClipboard(selectedResult.content)}
                  className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <i className="fas fa-copy"></i> Copiar
                </button>
                {selectedResult.type === 'url' ? (
                  <button 
                    onClick={() => openLink(selectedResult.content)}
                    className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
                  >
                    <i className="fas fa-external-link-alt"></i> Abrir Link
                  </button>
                ) : (
                  <button 
                    onClick={() => {
                       // Share API support
                       if (navigator.share) {
                          navigator.share({
                            title: 'Conteúdo de QR Code',
                            text: selectedResult.content,
                          });
                       } else {
                         copyToClipboard(selectedResult.content);
                       }
                    }}
                    className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
                  >
                    <i className="fas fa-share-alt"></i> Compartilhar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-2xl mx-auto h-20 bg-slate-900/80 backdrop-blur-xl border-t border-slate-800 flex items-center justify-around px-8 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-40">
        <button 
          onClick={() => setActiveTab(AppTab.SCANNER)}
          className={`flex flex-col items-center justify-center gap-1 transition-all ${activeTab === AppTab.SCANNER ? 'text-emerald-400 scale-110' : 'text-slate-500'}`}
        >
          <i className={`fas fa-camera text-xl`}></i>
          <span className="text-[10px] font-bold uppercase tracking-wider">Scanner</span>
        </button>
        
        <div className="w-px h-8 bg-slate-800"></div>

        <button 
          onClick={() => setActiveTab(AppTab.HISTORY)}
          className={`flex flex-col items-center justify-center gap-1 transition-all ${activeTab === AppTab.HISTORY ? 'text-emerald-400 scale-110' : 'text-slate-500'}`}
        >
          <i className={`fas fa-list text-xl`}></i>
          <span className="text-[10px] font-bold uppercase tracking-wider">Histórico</span>
        </button>
      </nav>
    </div>
  );
};

export default App;
