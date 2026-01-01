
import React, { useState, useRef, useEffect } from 'react';

interface ImageCropperProps {
  imageSrc: string;
  onConfirm: (croppedDataUrl: string) => void;
  onCancel: () => void;
}

const ImageCropper: React.FC<ImageCropperProps> = ({ imageSrc, onConfirm, onCancel }) => {
  const [crop, setCrop] = useState({ x: 10, y: 10, width: 80, height: 80 }); // Porcentagens
  const containerRef = useRef<HTMLDivElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const mobilePreviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, cropX: 0, cropY: 0 });

  // Atualiza a pré-visualização sempre que o crop muda
  useEffect(() => {
    const updatePreview = () => {
      const img = imageRef.current;
      if (!img) return;

      const drawToCanvas = (canvas: HTMLCanvasElement | null) => {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const realX = (crop.x / 100) * img.naturalWidth;
        const realY = (crop.y / 100) * img.naturalHeight;
        const realW = (crop.width / 100) * img.naturalWidth;
        const realH = (crop.height / 100) * img.naturalHeight;

        canvas.width = 300; // Resolução interna do preview
        canvas.height = 300;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, realX, realY, realW, realH, 0, 0, canvas.width, canvas.height);
      };

      drawToCanvas(previewCanvasRef.current);
      drawToCanvas(mobilePreviewCanvasRef.current);
    };

    updatePreview();
  }, [crop, imageSrc]);

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setIsDragging(true);
    setDragStart({ x: clientX, y: clientY, cropX: crop.x, cropY: crop.y });
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || !containerRef.current) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const dx = ((clientX - dragStart.x) / containerRef.current.offsetWidth) * 100;
    const dy = ((clientY - dragStart.y) / containerRef.current.offsetHeight) * 100;

    setCrop(prev => ({
      ...prev,
      x: Math.max(0, Math.min(100 - prev.width, dragStart.cropX + dx)),
      y: Math.max(0, Math.min(100 - prev.height, dragStart.cropY + dy))
    }));
  };

  const handleEnd = () => setIsDragging(false);

  const performCrop = () => {
    const img = imageRef.current;
    if (!img) return;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const realX = (crop.x / 100) * img.naturalWidth;
    const realY = (crop.y / 100) * img.naturalHeight;
    const realW = (crop.width / 100) * img.naturalWidth;
    const realH = (crop.height / 100) * img.naturalHeight;

    canvas.width = realW;
    canvas.height = realH;
    ctx.drawImage(img, realX, realY, realW, realH, 0, 0, realW, realH);
    onConfirm(canvas.toDataURL('image/png'));
  };

  // Helper para renderizar os cantos do preview
  const PreviewDecorator = () => (
    <>
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-[scan_2s_linear_infinite] z-10 pointer-events-none"></div>
      <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-emerald-400 z-20 pointer-events-none"></div>
      <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-emerald-400 z-20 pointer-events-none"></div>
      <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-emerald-400 z-20 pointer-events-none"></div>
      <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-emerald-400 z-20 pointer-events-none"></div>
    </>
  );

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col animate-in fade-in duration-300">
      <style>{`
        @keyframes scan {
          0% { top: 0; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
      
      <div className="p-6 flex justify-between items-center border-b border-slate-800 shrink-0">
        <button onClick={onCancel} className="text-slate-400 font-bold px-4 py-2 hover:text-white transition-colors">Cancelar</button>
        <h3 className="text-white font-black uppercase tracking-widest text-sm">Ajustar Recorte</h3>
        <button onClick={performCrop} className="text-emerald-500 font-black px-4 py-2 hover:text-emerald-400 transition-colors">Pronto</button>
      </div>

      <div 
        ref={containerRef}
        className="flex-1 relative overflow-hidden flex items-center justify-center p-4 touch-none"
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
      >
        <div className="relative inline-block max-w-full max-h-full">
          <img 
            ref={imageRef}
            src={imageSrc} 
            className="max-w-full max-h-[60vh] pointer-events-none select-none" 
            alt="Para recortar" 
          />
          
          {/* Overlay Escuro */}
          <div className="absolute inset-0 bg-black/70 pointer-events-none" style={{
            clipPath: `polygon(
              0% 0%, 0% 100%, 
              ${crop.x}% 100%, ${crop.x}% ${crop.y}%, 
              ${crop.x + crop.width}% ${crop.y}%, ${crop.x + crop.width}% ${crop.y + crop.height}%, 
              ${crop.x}% ${crop.y + crop.height}%, ${crop.x}% 100%, 
              100% 100%, 100% 0%
            )`
          }}></div>

          {/* Área de Seleção */}
          <div 
            onMouseDown={handleStart}
            onTouchStart={handleStart}
            className="absolute border-2 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)] cursor-move transition-shadow hover:shadow-[0_0_30px_rgba(16,185,129,0.5)]"
            style={{
              left: `${crop.x}%`,
              top: `${crop.y}%`,
              width: `${crop.width}%`,
              height: `${crop.height}%`
            }}
          >
            {/* Cantos Visuais Principais */}
            <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-emerald-400"></div>
            <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-emerald-400"></div>
            <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-emerald-400"></div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-emerald-400"></div>
            
            {/* Grid Interno */}
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-20">
              <div className="border-r border-b border-white/40"></div><div className="border-r border-b border-white/40"></div><div className="border-b border-white/40"></div>
              <div className="border-r border-b border-white/40"></div><div className="border-r border-b border-white/40"></div><div className="border-b border-white/40"></div>
              <div className="border-r border-white/40"></div><div className="border-r border-white/40"></div><div></div>
            </div>
          </div>
        </div>

        {/* Floating Preview Window (Desktop) */}
        <div className="absolute bottom-4 right-4 w-32 h-32 md:w-48 md:h-48 bg-slate-900 border-2 border-slate-700 rounded-2xl overflow-hidden shadow-2xl z-20 pointer-events-none hidden sm:block">
            <div className="absolute top-0 left-0 right-0 bg-slate-800/80 px-2 py-1 flex items-center justify-between z-30">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Preview IA</span>
                <i className="fas fa-microchip text-[8px] text-emerald-500 animate-pulse"></i>
            </div>
            <div className="relative w-full h-full">
                <PreviewDecorator />
                <canvas ref={previewCanvasRef} className="w-full h-full object-cover" />
            </div>
        </div>
      </div>

      <div className="p-6 md:p-8 bg-slate-900/80 border-t border-slate-800 shrink-0">
        <div className="max-w-md mx-auto flex flex-col items-center">
            {/* Preview para Mobile (Inline) */}
            <div className="sm:hidden mb-6 flex flex-col items-center w-full">
                <div className="relative w-32 h-32 bg-slate-950 border-2 border-emerald-500/30 rounded-2xl overflow-hidden mb-2 shadow-inner">
                    <PreviewDecorator />
                    <canvas ref={mobilePreviewCanvasRef} className="w-full h-full object-cover" />
                </div>
                <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Enquadramento Detectado</p>
            </div>

            <p className="text-slate-400 text-[10px] uppercase tracking-widest mb-6 font-bold">Ajuste o tamanho da área de captura</p>
            <div className="flex justify-center items-center gap-8">
                <button 
                  onClick={() => setCrop(prev => {
                    const nextW = Math.max(10, prev.width - 10);
                    const nextH = Math.max(10, prev.height - 10);
                    return {
                      ...prev,
                      width: nextW,
                      height: nextH,
                      x: Math.min(prev.x, 100 - nextW),
                      y: Math.min(prev.y, 100 - nextH)
                    };
                  })} 
                  className="w-14 h-14 rounded-2xl bg-slate-800 text-white flex items-center justify-center hover:bg-slate-700 active:scale-90 transition-all border border-slate-700 shadow-xl"
                >
                  <i className="fas fa-minus text-xl"></i>
                </button>
                <button 
                  onClick={() => setCrop(prev => {
                    const nextW = Math.min(95, prev.width + 10);
                    const nextH = Math.min(95, prev.height + 10);
                    return {
                      ...prev,
                      width: nextW,
                      height: nextH,
                      x: Math.min(prev.x, 100 - nextW),
                      y: Math.min(prev.y, 100 - nextH)
                    };
                  })} 
                  className="w-14 h-14 rounded-2xl bg-slate-800 text-white flex items-center justify-center hover:bg-slate-700 active:scale-90 transition-all border border-slate-700 shadow-xl"
                >
                  <i className="fas fa-plus text-xl"></i>
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ImageCropper;
