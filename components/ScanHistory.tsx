
import React from 'react';
import { ScanResult } from '../types';

interface ScanHistoryProps {
  history: ScanResult[];
  onClear: () => void;
  onSelect: (item: ScanResult) => void;
}

const ScanHistory: React.FC<ScanHistoryProps> = ({ history, onClear, onSelect }) => {
  const formatDate = (timestamp: number) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(timestamp);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'url': return 'fa-link text-blue-400';
      case 'email': return 'fa-envelope text-amber-400';
      case 'phone': return 'fa-phone text-emerald-400';
      default: return 'fa-font text-slate-400';
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4 pb-20">
      <div className="flex justify-between items-center px-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <i className="fas fa-history text-emerald-500"></i>
          Histórico
        </h2>
        {history.length > 0 && (
          <button 
            onClick={onClear}
            className="text-sm text-slate-400 hover:text-red-400 transition-colors"
          >
            Limpar tudo
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500 bg-slate-800/50 rounded-2xl mx-4 border border-dashed border-slate-700">
          <i className="fas fa-qrcode text-5xl mb-4 opacity-20"></i>
          <p>Nenhum QR Code escaneado ainda.</p>
        </div>
      ) : (
        <div className="space-y-3 px-4">
          {history.map((item) => (
            <div 
              key={item.id}
              onClick={() => onSelect(item)}
              className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 hover:border-emerald-500/50 cursor-pointer transition-all hover:scale-[1.01] flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
                <i className={`fas ${getIcon(item.type)}`}></i>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-slate-100 font-medium truncate">{item.content}</p>
                <p className="text-xs text-slate-500">{formatDate(item.timestamp)}</p>
              </div>
              <i className="fas fa-chevron-right text-slate-600 text-sm"></i>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ScanHistory;
