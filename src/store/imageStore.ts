import { create } from 'zustand';

export interface ImageFile {
  id: string;
  name: string;
  path: string;
  size: number;
  format: string;
  width: number;
  height: number;
  estimatedSize?: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress?: number;
  error?: string;
  outputPath?: string;
}

interface ConversionSettings {
  targetFormat: 'jpeg' | 'png';
  quality: number;
  preserveMetadata: boolean;
}

interface ImageStore {
  files: ImageFile[];
  settings: ConversionSettings;
  addFiles: (files: ImageFile[]) => void;
  removeFile: (id: string) => void;
  updateFile: (id: string, updates: Partial<ImageFile>) => void;
  updateSettings: (settings: Partial<ConversionSettings>) => void;
  clearCompleted: () => void;
  clearAll: () => void;
}

export const useImageStore = create<ImageStore>((set) => ({
  files: [],
  settings: {
    targetFormat: 'jpeg',
    quality: 90,
    preserveMetadata: false,
  },
  addFiles: (files) =>
    set((state) => ({ files: [...state.files, ...files] })),
  removeFile: (id) =>
    set((state) => ({ files: state.files.filter((f) => f.id !== id) })),
  updateFile: (id, updates) =>
    set((state) => ({
      files: state.files.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    })),
  updateSettings: (settings) =>
    set((state) => ({
      settings: { ...state.settings, ...settings },
    })),
  clearCompleted: () =>
    set((state) => ({
      files: state.files.filter((f) => f.status !== 'completed'),
    })),
  clearAll: () => set({ files: [] }),
}));
