
import React, { useState, useEffect, useCallback, useRef } from 'react';
import jsQR from 'jsqr';
import QRScanner from './components/QRScanner';
import ScanHistory from './components/ScanHistory';
import ImageCropper from './components/ImageCropper';
import { AppTab, ScanResult } from './types';
import { analyzeQRContent } from './services/geminiService';

type PermissionStatus = 'prompt' | 'granted' | 'denied' | 'checking';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.SCANNER);
  const [history, setHistory] = useState<ScanResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<ScanResult | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCooldown, setIsCooldown] = useState(false);
  
  // Estados para permissão, lanterna, upload e energia da câmera
  const [permission, setPermission] = useState<PermissionStatus>('checking');
  const [isTorchSupported, setIsTorchSupported] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [isCameraEnabled, setIsCameraEnabled] = useState(false); // Inicia desligada
  const [multiScanResults, setMultiScanResults] = useState<string[] | null>(null);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('qr_history');
    if (saved) {
      try { setHistory(JSON.parse(saved)); } catch (e) { console.error(e); }
    }
    checkInitialPermission();
  }, []);

  const checkInitialPermission = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setPermission('denied');
      return;
    }

    try {
      if ('permissions' in navigator && (navigator as any).permissions.query) {
        const result = await (navigator as any).permissions.query({ name: 'camera' });
        setPermission(result.state);
        result.onchange = () => setPermission(result.state);
      } else {
        // Apenas verifica se existe permissão sem manter o stream aberto
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
        setPermission('granted');
      }
    } catch (e) {
      setPermission('prompt');
    }
  };

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
    if (isCooldown || !content) return;
    
    setIsCooldown(true);
    const result: ScanResult = {
      id: Math.random().toString(36).substr(2, 9),
      content,
      timestamp: Date.now(),
      type: detectType(content)
    };

    setHistory(prev => {
      if (prev.length > 0 && prev[0].content === content) return prev;
      return [result, ...prev];
    });
    
    setSelectedResult(result);
    setAiAnalysis(null);
    setIsTorchOn(false);
    setMultiScanResults(null);
    
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    setTimeout(() => setIsCooldown(false), 2000);
  }, [isCooldown]);

  const processImageForQR = (imageSrc: string) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return;

      canvas.width = img.width;
      canvas.height = img.height;
      context.drawImage(img, 0, 0);
      
      const results: string[] = [];
      let searching = true;
      let attempts = 0;
      const MAX_ATTEMPTS = 10;

      while (searching && attempts < MAX_ATTEMPTS) {
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code) {
          results.push(code.data);
          const { topLeftCorner, topRightCorner, bottomRightCorner, bottomLeftCorner } = code.location;
          context.fillStyle = 'black';
          context.beginPath();
          context.moveTo(topLeftCorner.x, topLeftCorner.y);
          context.lineTo(topRightCorner.x, topRightCorner.y);
          context.lineTo(bottomRightCorner.x, bottomRightCorner.y);
          context.lineTo(bottomLeftCorner.x, bottomLeftCorner.y);
          context.closePath();
          context.fill();
          attempts++;
        } else {
          searching = false;
        }
      }

      if (results.length === 1) {
        handleScan(results[0]);
      } else if (results.length > 1) {
        const uniqueResults = Array.from(new Set(results));
        setMultiScanResults(uniqueResults);
      } else {
        alert("Nenhum QR Code encontrado nesta área.");
      }
    };
    img.src = imageSrc;
    setImageToCrop(null);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      setImageToCrop(e.target?.result as string);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!selectedResult || isAnalyzing) return;
    setIsAnalyzing(true);
    const analysis = await analyzeQRContent(selectedResult.content);
    setAiAnalysis(analysis);
    setIsAnalyzing(false);
  };

  const renderCameraPlaceholder = () => (
    <div className="w-full aspect-square rounded-[3rem] bg-slate-900 border-4 border-slate-800 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
      <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6 relative">
        <i className="fas fa-video-slash text-2xl text-slate-500"></i>
        <div className="absolute inset-0 rounded-full border border-slate-700 animate-ping opacity-20"></div>
      </div>
      <h3 className="text-white font-bold mb-2">Câmera Desligada</h3>
      <p className="text-slate-500 text-xs mb-8 max-w-[200px]">Ative a câmera para escanear códigos em tempo real ou use a galeria.</p>
      <button 
        onClick={() => setIsCameraEnabled(true)}
        className="px-8 py-3 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-emerald-900/20"
      >
        Ligar Câmera
      </button>
    </div>
  );

  const renderPermissionDenied = () => (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 animate-in fade-in duration-500">
      <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
        <i className="fas fa-camera-slash text-3xl text-red-500"></i>
      </div>
      <h2 className="text-xl font-bold text-white mb-4">Câmera Indisponível</h2>
      <p className="text-slate-400 text-sm leading-relaxed mb-8">
        O acesso à câmera foi negado. Você ainda pode usar a galeria para analisar imagens.
      </p>
      <div className="space-y-3 w-full">
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold active:scale-95 transition-all flex items-center justify-center gap-3 shadow-lg shadow-emerald-900/20"
        >
          <i className="fas fa-image"></i> Abrir Galeria
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-slate-950 overflow-hidden relative shadow-[0_0_100px_rgba(16,185,129,0.05)]">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        accept="image/*" 
        className="hidden" 
      />

      {imageToCrop && (
        <ImageCropper 
          imageSrc={imageToCrop} 
          onConfirm={processImageForQR} 
          onCancel={() => setImageToCrop(null)} 
        />
      )}

      <header className="p-6 pb-2 flex items-center justify-between z-10">
        <div className="flex flex-col">
          <h1 className="text-xl font-black tracking-tight text-white leading-none">
            <span className="text-emerald-500">QR</span> MASTER
          </h1>
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">Scanner Inteligente</span>
        </div>
        <div className="bg-slate-900/50 p-2 px-3 rounded-full border border-slate-800 flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${isCameraEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`}></span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {isCameraEnabled ? 'Sensor On' : 'Sensor Off'}
            </span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto custom-scrollbar px-6">
        {activeTab === AppTab.SCANNER ? (
          <div className="py-4 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="relative pt-4">
                {permission === 'denied' ? (
                  renderPermissionDenied()
                ) : !isCameraEnabled ? (
                  renderCameraPlaceholder()
                ) : (
                  <>
                    <QRScanner 
                      onScan={handleScan} 
                      isActive={activeTab === AppTab.SCANNER && !selectedResult && !multiScanResults && !imageToCrop && isCameraEnabled}
                      isTorchOn={isTorchOn}
                      onTorchSupportChange={setIsTorchSupported}
                      onError={(err) => err.name === 'NotAllowedError' && setPermission('denied')}
                    />
                    
                    <div className="absolute top-8 right-4 flex flex-col gap-3 z-20">
                      {isTorchSupported && !selectedResult && !multiScanResults && !imageToCrop && (
                        <button 
                          onClick={() => setIsTorchOn(!isTorchOn)}
                          title="Alternar Lanterna"
                          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isTorchOn ? 'bg-emerald-500 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.4)]' : 'bg-slate-800/80 text-slate-400 backdrop-blur-md'}`}
                        >
                          <i className={`fas fa-bolt ${isTorchOn ? 'animate-pulse' : ''}`}></i>
                        </button>
                      )}
                      <button 
                        onClick={() => setIsCameraEnabled(false)}
                        title="Desligar Câmera"
                        className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 backdrop-blur-md flex items-center justify-center border border-red-500/20 active:scale-90 transition-all"
                      >
                        <i className="fas fa-power-off"></i>
                      </button>
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        title="Abrir Galeria"
                        className="w-12 h-12 rounded-full bg-slate-800/80 text-slate-400 backdrop-blur-md flex items-center justify-center active:scale-90 transition-all"
                      >
                        <i className="fas fa-image"></i>
                      </button>
                    </div>
                  </>
                )}

                <div className="mt-8 text-center">
                    <p className="text-slate-400 text-sm font-medium">
                      {!isCameraEnabled ? 'Câmera em Standby' : 'Scanner Ativo'}
                    </p>
                    <p className="text-slate-600 text-[10px] uppercase tracking-widest mt-2">Tecnologia de Baixo Consumo</p>
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900/40 p-5 rounded-[2rem] border border-slate-800/50 backdrop-blur-sm">
                <i className="fas fa-layer-group text-emerald-500/40 mb-3 text-lg"></i>
                <div className="text-2xl font-black text-white">{history.length}</div>
                <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Histórico</div>
              </div>
              <div className="bg-slate-900/40 p-5 rounded-[2rem] border border-slate-800/50 backdrop-blur-sm">
                <i className="fas fa-robot text-cyan-500/40 mb-3 text-lg"></i>
                <div className="text-2xl font-black text-white">Gemini</div>
                <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Analista IA</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-4 animate-in fade-in duration-500">
            <ScanHistory 
              history={history} 
              onClear={() => setHistory([])} 
              onSelect={setSelectedResult}
            />
          </div>
        )}
      </main>

      {/* Floating Bottom Nav */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[280px] h-16 bg-slate-900/80 backdrop-blur-2xl rounded-full border border-slate-800 flex items-center justify-between px-2 z-40 shadow-2xl safe-bottom">
        <button 
          onClick={() => {
            setActiveTab(AppTab.SCANNER);
            setIsTorchOn(false);
            setMultiScanResults(null);
          }}
          className={`flex-1 h-12 rounded-full flex items-center justify-center gap-2 transition-all ${activeTab === AppTab.SCANNER ? 'bg-emerald-500 text-slate-950 font-black' : 'text-slate-500'}`}
        >
          <i className="fas fa-qrcode"></i>
          <span className="text-[10px] uppercase tracking-widest">Lente</span>
        </button>
        <button 
          onClick={() => {
            setActiveTab(AppTab.HISTORY);
            setIsTorchOn(false);
            setMultiScanResults(null);
          }}
          className={`flex-1 h-12 rounded-full flex items-center justify-center gap-2 transition-all ${activeTab === AppTab.HISTORY ? 'bg-emerald-500 text-slate-950 font-black' : 'text-slate-500'}`}
        >
          <i className="fas fa-history"></i>
          <span className="text-[10px] uppercase tracking-widest">Logs</span>
        </button>
      </div>

      {/* Multi-result Selection Modal */}
      {multiScanResults && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-slate-900 w-full rounded-t-[3rem] border-t border-slate-800 shadow-2xl animate-in slide-in-from-bottom-full duration-500 max-w-md">
            <div className="p-8 pt-6 pb-12">
              <div className="w-12 h-1.5 bg-slate-800 rounded-full mx-auto mb-8"></div>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-black text-white">Códigos Encontrados</h2>
                  <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-bold">Toque para analisar</p>
                </div>
                <button onClick={() => setMultiScanResults(null)} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-800 text-slate-400">
                  <i className="fas fa-times"></i>
                </button>
              </div>

              <div className="space-y-3 max-h-[40vh] overflow-y-auto custom-scrollbar pr-2 mb-8">
                {multiScanResults.map((content, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleScan(content)}
                    className="w-full bg-slate-950 p-5 rounded-[2rem] border border-slate-800 hover:border-emerald-500/50 text-left transition-all active:scale-98 group flex items-center gap-4"
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
                      <i className={`fas ${detectType(content) === 'url' ? 'fa-link text-emerald-500' : 'fa-font text-slate-400'}`}></i>
                    </div>
                    <p className="text-slate-300 font-medium truncate flex-1">{content}</p>
                    <i className="fas fa-arrow-right text-slate-700 group-hover:text-emerald-500 transition-colors"></i>
                  </button>
                ))}
              </div>

              <button 
                onClick={() => {
                  multiScanResults.forEach(content => {
                    const res: ScanResult = {
                      id: Math.random().toString(36).substr(2, 9),
                      content,
                      timestamp: Date.now(),
                      type: detectType(content)
                    };
                    setHistory(prev => [res, ...prev]);
                  });
                  setMultiScanResults(null);
                  setActiveTab(AppTab.HISTORY);
                }}
                className="w-full py-5 bg-emerald-600 rounded-[2rem] font-black text-sm text-white uppercase tracking-widest shadow-xl shadow-emerald-900/20 active:scale-95 transition-all"
              >
                Adicionar todos à lista
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Result Modal UI */}
      {selectedResult && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-slate-900 w-full rounded-t-[3rem] border-t border-slate-800 shadow-2xl animate-in slide-in-from-bottom-full duration-500 ease-out max-w-md">
            <div className="p-8 pt-6 pb-12">
              <div className="w-12 h-1.5 bg-slate-800 rounded-full mx-auto mb-8"></div>
              <div className="flex justify-between items-center mb-8">
                <div className="bg-emerald-500/10 text-emerald-500 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
                  {selectedResult.type} Detectado
                </div>
                <button onClick={() => setSelectedResult(null)} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-800 text-slate-400">
                  <i className="fas fa-times"></i>
                </button>
              </div>
              <div className="bg-slate-950 p-6 rounded-[2.5rem] border border-slate-800 mb-8 max-h-40 overflow-y-auto custom-scrollbar">
                <p className="text-slate-100 font-medium text-lg leading-relaxed break-all">{selectedResult.content}</p>
              </div>
              {aiAnalysis ? (
                <div className="mb-8 p-6 rounded-[2.5rem] bg-emerald-500/5 border border-emerald-500/20 animate-in zoom-in duration-500">
                  <div className="flex items-center gap-3 mb-3 text-emerald-400 text-[10px] font-black uppercase tracking-widest">
                    <i className="fas fa-sparkles"></i> Inteligência Gemini
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed font-medium">"{aiAnalysis}"</p>
                </div>
              ) : (
                <button 
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="w-full mb-8 py-5 px-6 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-[2rem] font-black text-sm text-white flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl shadow-emerald-900/20 uppercase tracking-widest"
                >
                  {isAnalyzing ? <i className="fas fa-circle-notch animate-spin"></i> : <i className="fas fa-wand-magic-sparkles"></i>}
                  {isAnalyzing ? "Processando..." : "Analisar com IA"}
                </button>
              )}
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => { navigator.clipboard.writeText(selectedResult.content); alert("Copiado!"); }} className="py-5 bg-slate-800 rounded-[2rem] font-bold text-sm text-white flex items-center justify-center gap-3 active:scale-95 transition-all">
                  <i className="fas fa-copy opacity-40"></i> Copiar
                </button>
                {selectedResult.type === 'url' ? (
                  <button onClick={() => window.open(selectedResult.content.startsWith('http') ? selectedResult.content : `https://${selectedResult.content}`, '_blank')} className="py-5 bg-white text-slate-950 rounded-[2rem] font-bold text-sm flex items-center justify-center gap-3 active:scale-95 transition-all">
                    <i className="fas fa-external-link-alt"></i> Visitar
                  </button>
                ) : (
                  <button onClick={() => navigator.share && navigator.share({text: selectedResult.content})} className="py-5 bg-slate-800 rounded-[2rem] font-bold text-sm text-white flex items-center justify-center gap-3 active:scale-95 transition-all">
                    <i className="fas fa-share-nodes opacity-40"></i> Enviar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
