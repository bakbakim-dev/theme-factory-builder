import { Zap, Code, RefreshCw, Terminal, LucideIcon } from 'lucide-react';

export const STEPS = {
  IDLE: 'idle',
  ANALYZING: 'analyzing',
  SOURCE_DETECTED: 'source_detected',
  PROCESSING: 'processing',
  LINK_AUDIT: 'link_audit',
  ERROR: 'error',
  COMPLETE: 'complete',
  WAKING_UP: 'waking_up',
  UPLOADING_REMOTE: 'uploading_remote',
  DOWNLOADING_ARTIFACT: 'downloading_artifact',
  POLLING_BUILD: 'polling_build',
  BUILDING: 'building',
  BUILDING_REMOTE: 'building_remote'
};

interface PlatformDef {
    id: string;
    label: string;
    icon: LucideIcon;
}

export const PLATFORMS: Record<string, PlatformDef> = {
  LOVABLE: { id: 'lovable', label: 'Lovable', icon: Zap },
  V0: { id: 'v0', label: 'V0.dev', icon: Code },
  BOLT: { id: 'bolt', label: 'Bolt', icon: RefreshCw },
  CURSOR: { id: 'cursor', label: 'Cursor', icon: Terminal }
};