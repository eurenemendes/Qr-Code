
import React, { useState, useEffect, useCallback, useRef } from 'react';
import jsQR from 'jsqr';
import QRScanner from './components/QRScanner';
import ScanHistory from './components/ScanHistory';
import ImageCropper from './components/ImageCropper';
import { AppTab, ScanResult } from './types';
import { analyzeQRContent } from './services/geminiService';

type PermissionStatus = 'prompt' | 'granted' | 'denied' | 'checking';

interface CustomAlert {
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

const ANALYSIS_STEPS = [
  "Lendo dados...",
  "Processando...",
  "Consultando IA...",
  "Finalizando..."
];

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.SCANNER);
  const [history, setHistory] = useState<ScanResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<ScanResult | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState("");
  const [isCooldown, setIsCooldown] = useState(false);
  
  const [permission, setPermission] = useState<PermissionStatus>('checking');
  const [isTorchSupported, setIsTorchSupported] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [multiScanResults, setMultiScanResults] = useState<string[] | null>(null);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [customAlert, setCustomAlert] = useState<CustomAlert | null>(null);
  const [isDecodingFile, setIsDecodingFile] = useState(false);
  const [decodingProgress, setDecodingProgress] = useState(0);

  // PWA Install Prompt
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('qr_history');
    if (saved) {
      try { setHistory(JSON.parse(saved)); } catch (e) { console.error(e); }
    }
    checkInitialPermission();

    // Ouvinte para instalação do PWA
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    });

    window.addEventListener('appinstalled', () => {
      setIsInstallable(false);
      setDeferredPrompt(null);
    });
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

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

  const showAlert = (title: string, message: string, type: CustomAlert['type'] = 'info') => {
    setCustomAlert({ title, message, type });
  };

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
    setIsDecodingFile(true);
    setDecodingProgress(0);
    
    const progressInt = setInterval(() => {
      setDecodingProgress(prev => Math.min(prev + 15, 90));
    }, 100);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) {
        clearInterval(progressInt);
        setIsDecodingFile(false);
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;
      context.drawImage(img, 0, 0);
      
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      clearInterval(progressInt);
      setDecodingProgress(100);

      setTimeout(() => {
        setIsDecodingFile(false);
        if (code) {
          handleScan(code.data);
        } else {
          showAlert("Busca Concluída", "Nenhum QR Code foi detectado. Tente recortar a área para melhor precisão.", "warning");
        }
      }, 300);
    };
    img.src = imageSrc;
    setImageToCrop(null);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      setPendingImage(e.target?.result as string);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!selectedResult || isAnalyzing) return;
    
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setAnalysisStatus(ANALYSIS_STEPS[0]);

    let currentProgress = 0;
    const progressInterval = setInterval(() => {
      currentProgress += Math.random() * (currentProgress > 80 ? 0.5 : 8);
      if (currentProgress > 92) currentProgress = 92;
      setAnalysisProgress(Math.floor(currentProgress));
      
      const stepIndex = Math.min(Math.floor((currentProgress / 100) * ANALYSIS_STEPS.length), ANALYSIS_STEPS.length - 1);
      setAnalysisStatus(ANALYSIS_STEPS[stepIndex]);
    }, 100);

    try {
      const analysis = await analyzeQRContent(selectedResult.content);
      clearInterval(progressInterval);
      setAnalysisProgress(100);
      setAiAnalysis(analysis);
      setIsAnalyzing(false);
    } catch (error) {
      clearInterval(progressInterval);
      setIsAnalyzing(false);
      showAlert("Erro na IA", "Não foi possível completar a análise.", "error");
    }
  };

  const renderPermissionDenied = () => (
    <div className="w-full aspect-square rounded-[3rem] bg-slate-900 border-4 border-slate-800 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
      <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 relative">
        <i className="fas fa-lock text-2xl text-red-500"></i>
      </div>
      <h3 className="text-white font-bold mb-2">Acesso Negado</h3>
      <p className="text-slate-500 text-xs mb-8 max-w-[200px]">O acesso à câmera foi negado. Por favor, habilite as permissões nas configurações do seu navegador.</p>
    </div>
  );

  const renderCameraPlaceholder = () => (
    <div className="w-full aspect-square rounded-[3rem] bg-slate-900 border-4 border-slate-800 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
      <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6 relative">
        <i className="fas fa-video-slash text-2xl text-slate-500"></i>
        <div className="absolute inset-0 rounded-full border border-slate-700 animate-ping opacity-20"></div>
      </div>
      <h3 className="text-white font-bold mb-2">Câmera Desligada</h3>
      <p className="text-slate-500 text-xs mb-8 max-w-[200px]">Ative a câmera ou use a galeria para escanear.</p>
      <button 
        onClick={() => setIsCameraEnabled(true)}
        className="px-8 py-3 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-lg"
      >
        Ligar Câmera
      </button>
    </div>
  );

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-slate-950 overflow-hidden relative shadow-[0_0_100px_rgba(16,185,129,0.05)]">
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />

      {imageToCrop && (
        <ImageCropper imageSrc={imageToCrop} onConfirm={processImageForQR} onCancel={() => setImageToCrop(null)} />
      )}

      {isDecodingFile && (
        <div className="fixed top-0 left-0 right-0 z-[250] bg-emerald-500 h-1 transition-all duration-300" style={{ width: `${decodingProgress}%` }}></div>
      )}

      {customAlert && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-8 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-[320px] bg-slate-900 rounded-[2.5rem] border border-slate-800 shadow-2xl p-8 flex flex-col items-center text-center">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 ${customAlert.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
              <i className={`fas fa-lg ${customAlert.type === 'success' ? 'fa-check-circle' : 'fa-triangle-exclamation'}`}></i>
            </div>
            <h3 className="text-white font-black text-lg mb-2">{customAlert.title}</h3>
            <p className="text-slate-400 text-sm leading-relaxed">{customAlert.message}</p>
            <button onClick={() => setCustomAlert(null)} className="mt-8 w-full py-4 bg-slate-800 text-white rounded-2xl font-bold border border-slate-700">Fechar</button>
          </div>
        </div>
      )}

      {pendingImage && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="w-full max-w-sm bg-slate-900 rounded-[2.5rem] border border-slate-800 p-8 text-center animate-in zoom-in-95 duration-500">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 mx-auto">
              <i className="fas fa-file-image text-2xl text-emerald-500"></i>
            </div>
            <h2 className="text-xl font-black text-white mb-2">Imagem Carregada</h2>
            <p className="text-sm text-slate-400 mb-8">Escolha como processar para encontrar o QR Code:</p>
            <div className="space-y-3">
              <button onClick={() => { processImageForQR(pendingImage); setPendingImage(null); }} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold flex items-center justify-center gap-3">
                <i className="fas fa-expand"></i> Imagem Inteira
              </button>
              <button onClick={() => { setImageToCrop(pendingImage); setPendingImage(null); }} className="w-full py-4 bg-slate-800 text-white rounded-2xl font-bold flex items-center justify-center gap-3">
                <i className="fas fa-crop-simple"></i> Recortar Área
              </button>
              <button onClick={() => setPendingImage(null)} className="w-full py-3 text-slate-500 font-bold text-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <header className="p-6 pb-2 flex items-center justify-between z-10">
        <div className="flex flex-col">
          <h1 className="text-xl font-black tracking-tight text-white leading-none"><span className="text-emerald-500">QR</span> MASTER</h1>
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">Scanner Inteligente</span>
        </div>
        <div className="bg-slate-900/50 p-2 px-3 rounded-full border border-slate-800 flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${isCameraEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`}></span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{isCameraEnabled ? 'Sensor On' : 'Sensor Off'}</span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto custom-scrollbar px-6">
        {activeTab === AppTab.SCANNER ? (
          <div className="py-4 space-y-8">
            <div className="relative pt-4">
                {permission === 'denied' ? renderPermissionDenied() : !isCameraEnabled ? renderCameraPlaceholder() : (
                  <>
                    <QRScanner onScan={handleScan} isActive={activeTab === AppTab.SCANNER && !selectedResult && !multiScanResults && !imageToCrop && isCameraEnabled} isTorchOn={isTorchOn} onTorchSupportChange={setIsTorchSupported} />
                    <div className="absolute top-8 right-4 flex flex-col gap-3 z-20">
                      {isTorchSupported && (
                        <button onClick={() => setIsTorchOn(!isTorchOn)} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isTorchOn ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800/80 text-slate-400'}`}><i className="fas fa-bolt"></i></button>
                      )}
                      <button onClick={() => setIsCameraEnabled(false)} className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 backdrop-blur-md flex items-center justify-center border border-red-500/20"><i className="fas fa-power-off"></i></button>
                      <button onClick={() => fileInputRef.current?.click()} className="w-12 h-12 rounded-full bg-slate-800/80 text-slate-400 backdrop-blur-md flex items-center justify-center"><i className="fas fa-image"></i></button>
                    </div>
                  </>
                )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900/40 p-5 rounded-[2rem] border border-slate-800/50">
                <div className="text-2xl font-black text-white">{history.length}</div>
                <div className="text-[9px] text-slate-500 font-bold uppercase">Histórico</div>
              </div>
              <div className="bg-slate-900/40 p-5 rounded-[2rem] border border-slate-800/50">
                <div className="text-2xl font-black text-white">IA</div>
                <div className="text-[9px] text-slate-500 font-bold uppercase">Habilitada</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {isInstallable && (
              <button 
                onClick={handleInstallClick}
                className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 p-4 rounded-2xl flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-top-4 duration-500"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <i className="fas fa-mobile-screen-button text-white"></i>
                  </div>
                  <div className="text-left">
                    <div className="text-white font-bold text-sm">Instalar App</div>
                    <div className="text-white/70 text-[10px] font-medium">Acesse direto da tela inicial</div>
                  </div>
                </div>
                <i className="fas fa-download text-white/50 text-sm"></i>
              </button>
            )}
            <ScanHistory history={history} onClear={() => setHistory([])} onSelect={setSelectedResult} />
          </div>
        )}
      </main>

      {/* Floating Bottom Nav */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[280px] h-16 bg-slate-900/80 backdrop-blur-2xl rounded-full border border-slate-800 flex items-center justify-between px-2 z-40 shadow-2xl">
        <button onClick={() => setActiveTab(AppTab.SCANNER)} className={`flex-1 h-12 rounded-full flex items-center justify-center gap-2 transition-all ${activeTab === AppTab.SCANNER ? 'bg-emerald-500 text-slate-950 font-black' : 'text-slate-500'}`}>
          <i className="fas fa-qrcode"></i><span className="text-[10px] uppercase">Lente</span>
        </button>
        <button onClick={() => setActiveTab(AppTab.HISTORY)} className={`flex-1 h-12 rounded-full flex items-center justify-center gap-2 transition-all ${activeTab === AppTab.HISTORY ? 'bg-emerald-500 text-slate-950 font-black' : 'text-slate-500'}`}>
          <i className="fas fa-history"></i><span className="text-[10px] uppercase">Logs</span>
        </button>
      </div>

      {/* Result Modal UI */}
      {selectedResult && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-slate-900 w-full rounded-t-[3rem] border-t border-slate-800 shadow-2xl animate-in slide-in-from-bottom-full duration-500 max-w-md">
            <div className="p-8 pt-6 pb-12">
              <div className="w-12 h-1.5 bg-slate-800 rounded-full mx-auto mb-8"></div>
              <div className="flex justify-between items-center mb-8">
                <div className="bg-emerald-500/10 text-emerald-500 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">{selectedResult.type} Detectado</div>
                <button onClick={() => { setSelectedResult(null); setAiAnalysis(null); setIsAnalyzing(false); }} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-800 text-slate-400"><i className="fas fa-times"></i></button>
              </div>
              
              <div className="bg-slate-950 p-6 rounded-[2.5rem] border border-slate-800 mb-8 max-h-40 overflow-y-auto custom-scrollbar">
                <p className="text-slate-100 font-medium text-lg leading-relaxed break-all">{selectedResult.content}</p>
              </div>

              {isAnalyzing ? (
                <div className="mb-8 p-6 rounded-[2.5rem] bg-emerald-500/5 border border-emerald-500/20">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">{analysisStatus}</span>
                    <span className="text-[10px] font-black text-emerald-500">{analysisProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${analysisProgress}%` }}></div>
                  </div>
                </div>
              ) : aiAnalysis ? (
                <div className="mb-8 p-6 rounded-[2.5rem] bg-emerald-500/5 border border-emerald-500/20 animate-in zoom-in duration-300">
                  <div className="flex items-center gap-2 mb-3 text-emerald-400 text-[10px] font-black uppercase tracking-widest"><i className="fas fa-sparkles"></i> Análise IA</div>
                  <p className="text-slate-300 text-sm leading-relaxed font-medium">"{aiAnalysis}"</p>
                </div>
              ) : (
                <button onClick={handleAnalyze} className="w-full mb-8 py-5 px-6 bg-emerald-600 hover:bg-emerald-500 rounded-[2rem] font-black text-sm text-white flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl uppercase tracking-widest">
                  <i className="fas fa-wand-magic-sparkles"></i> Analisar com IA
                </button>
              )}

              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => { navigator.clipboard.writeText(selectedResult.content); showAlert("Copiado", "Conteúdo enviado para área de transferência.", "success"); }} className="py-5 bg-slate-800 rounded-[2rem] font-bold text-sm text-white flex items-center justify-center gap-3 active:scale-95 transition-all">
                  <i className="fas fa-copy opacity-40"></i> Copiar
                </button>
                <button onClick={() => selectedResult.type === 'url' ? window.open(selectedResult.content.startsWith('http') ? selectedResult.content : `https://${selectedResult.content}`, '_blank') : (navigator.share && navigator.share({text: selectedResult.content}))} className="py-5 bg-white text-slate-950 rounded-[2rem] font-bold text-sm flex items-center justify-center gap-3 active:scale-95 transition-all">
                  <i className={`fas ${selectedResult.type === 'url' ? 'fa-external-link-alt' : 'fa-share-nodes'}`}></i> {selectedResult.type === 'url' ? 'Acessar' : 'Enviar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
