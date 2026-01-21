import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { useImageStore } from '@/store/imageStore';
import { Upload, Loader2 } from 'lucide-react';

export function DragDropOverlay() {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingCount, setLoadingCount] = useState(0);
  const addFiles = useImageStore((state) => state.addFiles);

  useEffect(() => {
    console.log('DragDropOverlay: Setting up Tauri 2.0 drag-drop listeners');

    const setupListeners = async () => {
      // Tauri 2.0 uses drag-over instead of file-drop-hover
      const unlistenOver = await listen('tauri://drag-over', () => {
        console.log('DragDropOverlay: drag-over event (Tauri 2.0)');
        setIsDragging(true);
      });

      // Tauri 2.0 uses drag-drop instead of file-drop
      const unlistenDrop = await listen<{ paths: string[] }>('tauri://drag-drop', async (event) => {
        console.log('DragDropOverlay: drag-drop event (Tauri 2.0)', event.payload);
        setIsDragging(false);

        // In Tauri 2.0, payload is an object with 'paths' property
        const filePaths = event.payload.paths || [];

        // Show loading state
        setIsLoading(true);
        setLoadingCount(filePaths.length);

        const imageFiles = await Promise.all(
          filePaths.map(async (path) => {
            try {
              const ext = path.split('.').pop()?.toLowerCase();
              if (!['jpg', 'jpeg', 'png', 'heic', 'heif'].includes(ext || '')) {
                console.log('DragDropOverlay: Skipping non-image:', path);
                return null;
              }

              console.log('DragDropOverlay: Analyzing:', path);

              const [metadata, fileSize] = await Promise.all([
                invoke<{ width: number; height: number; format: string }>(
                  'analyze_image',
                  { path }
                ),
                invoke<number>('get_file_size', { path })
              ]);

              return {
                id: crypto.randomUUID(),
                name: path.split('\\').pop() || path,
                path,
                size: fileSize,
                format: metadata.format,
                width: metadata.width,
                height: metadata.height,
                status: 'pending' as const,
              };
            } catch (error) {
              console.error('Failed to analyze:', path, error);
              return null;
            }
          })
        );

        const validFiles = imageFiles.filter((f) => f !== null);
        console.log('DragDropOverlay: Valid files:', validFiles.length);
        if (validFiles.length > 0) {
          addFiles(validFiles);
        }

        // Hide loading state
        setIsLoading(false);
        setLoadingCount(0);
      });

      // Tauri 2.0 uses drag-leave instead of file-drop-cancelled
      const unlistenLeave = await listen('tauri://drag-leave', () => {
        console.log('DragDropOverlay: drag-leave event (Tauri 2.0)');
        setIsDragging(false);
      });

      console.log('DragDropOverlay: All Tauri 2.0 listeners registered successfully');

      return () => {
        unlistenOver();
        unlistenDrop();
        unlistenLeave();
      };
    };

    const cleanup = setupListeners();

    return () => {
      cleanup.then((fn) => fn && fn());
    };
  }, [addFiles]);

  if (!isDragging && !isLoading) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-8 border-4 border-dashed border-primary rounded-2xl flex items-center justify-center">
        <div className="text-center space-y-6 pointer-events-none">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl animate-pulse" />
            <div className="relative bg-primary/10 rounded-full p-8 backdrop-blur-sm">
              {isLoading ? (
                <Loader2 className="w-20 h-20 text-primary animate-spin" />
              ) : (
                <Upload className="w-20 h-20 text-primary animate-bounce" />
              )}
            </div>
          </div>

          <div className="space-y-2">
            {isLoading ? (
              <>
                <h2 className="text-4xl font-bold text-white">
                  Загрузка изображений...
                </h2>
                <p className="text-lg text-white/70">
                  Обработка {loadingCount} {loadingCount === 1 ? 'файла' : 'файлов'}
                </p>
              </>
            ) : (
              <>
                <h2 className="text-4xl font-bold text-white">
                  Отпустите файлы здесь
                </h2>
                <p className="text-lg text-white/70">
                  Отпустите для загрузки изображений
                </p>
              </>
            )}
          </div>

          {!isLoading && (
            <div className="flex items-center justify-center gap-4 pt-4">
              {['JPEG', 'PNG', 'HEIC'].map((format) => (
                <div
                  key={format}
                  className="bg-white/10 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/20"
                >
                  <span className="text-sm font-medium text-white">{format}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
