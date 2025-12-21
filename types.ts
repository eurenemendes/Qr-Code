
export interface ScanResult {
  id: string;
  content: string;
  timestamp: number;
  type: 'url' | 'text' | 'email' | 'phone';
}

export enum AppTab {
  SCANNER = 'scanner',
  HISTORY = 'history'
}
