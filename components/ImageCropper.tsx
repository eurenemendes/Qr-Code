
import React, { useState, useRef, useEffect } from 'react';

interface ImageCropperProps {
  imageSrc: string;
  onConfirm: (croppedDataUrl: string) => void;
  onCancel: () => void;
}

type DragType = 'move' | 'tl' | 'tr' | 'bl' | 'br';

const ImageCropper: React.FC<ImageCropperProps> = ({ imageSrc, onConfirm, onCancel }) => {
  const [crop, setCrop] = useState({ x: 20, y: 20, width: 60, height: 60 }); // Porcentagens
  const containerRef = useRef<HTMLDivElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const mobilePreviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  
  const [dragState, setDragState] = useState<{
    type: DragType;
    startX: number;
    startY: number;
    startCrop: { x: number; y: number; width: number; height: number };
  } | null>(null);

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

        canvas.width = 300; 
        canvas.height = 300;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, realX, realY, realW, realH, 0, 0, canvas.width, canvas.height);
      };

      drawToCanvas(previewCanvasRef.current);
      drawToCanvas(mobilePreviewCanvasRef.current);
    };

    updatePreview();
  }, [crop, imageSrc]);

  const handleStart = (e: React.MouseEvent | React.TouchEvent, type: DragType = 'move') => {
    e.stopPropagation();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    setDragState({
      type,
      startX: clientX,
      startY: clientY,
      startCrop: { ...crop }
    });
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!dragState || !containerRef.current) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const dx = ((clientX - dragState.startX) / containerRef.current.offsetWidth) * 100;
    const dy = ((clientY - dragState.startY) / containerRef.current.offsetHeight) * 100;

    const { startCrop, type } = dragState;

    setCrop(prev => {
      let next = { ...prev };
      
      switch (type) {
        case 'move':
          next.x = Math.max(0, Math.min(100 - startCrop.width, startCrop.x + dx));
          next.y = Math.max(0, Math.min(100 - startCrop.height, startCrop.y + dy));
          break;
        case 'tl':
          next.x = Math.max(0, Math.min(startCrop.x + startCrop.width - 10, startCrop.x + dx));
          next.y = Math.max(0, Math.min(startCrop.y + startCrop.height - 10, startCrop.y + dy));
          next.width = startCrop.width - (next.x - startCrop.x);
          next.height = startCrop.height - (next.y - startCrop.y);
          break;
        case 'tr':
          next.y = Math.max(0, Math.min(startCrop.y + startCrop.height - 10, startCrop.y + dy));
          next.width = Math.max(10, Math.min(100 - startCrop.x, startCrop.width + dx));
          next.height = startCrop.height - (next.y - startCrop.y);
          break;
        case 'bl':
          next.x = Math.max(0, Math.min(startCrop.x + startCrop.width - 10, startCrop.x + dx));
          next.width = startCrop.width - (next.x - startCrop.x);
          next.height = Math.max(10, Math.min(100 - startCrop.y, startCrop.height + dy));
          break;
        case 'br':
          next.width = Math.max(10, Math.min(100 - startCrop.x, startCrop.width + dx));
          next.height = Math.max(10, Math.min(100 - startCrop.y, startCrop.height + dy));
          break;
      }
      
      return next;
    });
  };

  const handleEnd = () => setDragState(null);

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
    <div className="fixed inset-0 z-[120] bg-black/95 flex flex-col animate-in fade-in duration-300">
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
            className="max-w-full max-h-[60vh] pointer-events-none select-none rounded-lg" 
            alt="Para recortar" 
          />
          
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
            onMouseDown={(e) => handleStart(e, 'move')}
            onTouchStart={(e) => handleStart(e, 'move')}
            className="absolute border-2 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)] cursor-move"
            style={{
              left: `${crop.x}%`,
              top: `${crop.y}%`,
              width: `${crop.width}%`,
              height: `${crop.height}%`
            }}
          >
            {/* Corner Handles */}
            <div 
              onMouseDown={(e) => handleStart(e, 'tl')} onTouchStart={(e) => handleStart(e, 'tl')}
              className="absolute -top-3 -left-3 w-8 h-8 flex items-center justify-center cursor-nwse-resize z-50 group"
            >
              <div className="w-4 h-4 bg-emerald-500 rounded-full border-2 border-white scale-75 group-active:scale-125 transition-transform shadow-lg"></div>
            </div>
            <div 
              onMouseDown={(e) => handleStart(e, 'tr')} onTouchStart={(e) => handleStart(e, 'tr')}
              className="absolute -top-3 -right-3 w-8 h-8 flex items-center justify-center cursor-nesw-resize z-50 group"
            >
              <div className="w-4 h-4 bg-emerald-500 rounded-full border-2 border-white scale-75 group-active:scale-125 transition-transform shadow-lg"></div>
            </div>
            <div 
              onMouseDown={(e) => handleStart(e, 'bl')} onTouchStart={(e) => handleStart(e, 'bl')}
              className="absolute -bottom-3 -left-3 w-8 h-8 flex items-center justify-center cursor-nesw-resize z-50 group"
            >
              <div className="w-4 h-4 bg-emerald-500 rounded-full border-2 border-white scale-75 group-active:scale-125 transition-transform shadow-lg"></div>
            </div>
            <div 
              onMouseDown={(e) => handleStart(e, 'br')} onTouchStart={(e) => handleStart(e, 'br')}
              className="absolute -bottom-3 -right-3 w-8 h-8 flex items-center justify-center cursor-nwse-resize z-50 group"
            >
              <div className="w-4 h-4 bg-emerald-500 rounded-full border-2 border-white scale-75 group-active:scale-125 transition-transform shadow-lg"></div>
            </div>
            
            {/* Grid Decorativo */}
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-20">
              <div className="border-r border-b border-white/40"></div><div className="border-r border-b border-white/40"></div><div className="border-b border-white/40"></div>
              <div className="border-r border-b border-white/40"></div><div className="border-r border-b border-white/40"></div><div className="border-b border-white/40"></div>
              <div className="border-r border-white/40"></div><div className="border-r border-white/40"></div><div></div>
            </div>
          </div>
        </div>

        {/* Floating Preview (Desktop) */}
        <div className="absolute bottom-4 right-4 w-40 h-40 bg-slate-900 border-2 border-slate-700 rounded-2xl overflow-hidden shadow-2xl z-20 pointer-events-none hidden sm:block">
            <div className="absolute top-0 left-0 right-0 bg-slate-800/80 px-2 py-1 flex items-center justify-between z-30">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Resultado do Scan</span>
                <i className="fas fa-microchip text-[8px] text-emerald-500"></i>
            </div>
            <div className="relative w-full h-full">
                <PreviewDecorator />
                <canvas ref={previewCanvasRef} className="w-full h-full object-cover" />
            </div>
        </div>
      </div>

      <div className="p-6 md:p-8 bg-slate-900/80 border-t border-slate-800 shrink-0">
        <div className="max-w-md mx-auto flex flex-col items-center">
            {/* Preview Mobile */}
            <div className="sm:hidden mb-6 flex flex-col items-center w-full">
                <div className="relative w-36 h-36 bg-slate-950 border-2 border-emerald-500/30 rounded-2xl overflow-hidden mb-2 shadow-2xl">
                    <PreviewDecorator />
                    <canvas ref={mobilePreviewCanvasRef} className="w-full h-full object-cover" />
                </div>
                <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Amostra em Tempo Real</p>
            </div>

            <div className="text-center">
              <p className="text-slate-400 text-[10px] uppercase tracking-widest font-black mb-1">Dica Profissional</p>
              <p className="text-slate-500 text-xs max-w-[280px]">Arraste os círculos verdes para ajustar o foco exatamente sobre o QR Code.</p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ImageCropper;
