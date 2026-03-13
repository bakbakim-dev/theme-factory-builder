export interface LogEntry {
  msg: string;
  type: 'info' | 'success' | 'warning' | 'error';
  time: string;
}

export interface RouteInfo {
  path: string;
  slug: string;
  title: string;
}

export interface ConversionStats {
  php: number;
  js: number;
  css: number;
  images: number;
  routes: number;
  patterns: number;
}

export interface ConversionRecord {
  id: string;
  projectName: string;
  type: string;
  date: string;
  status: string;
  logs: LogEntry[];
  stats: ConversionStats | null;
}