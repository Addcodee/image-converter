import { useImageStore } from '@/store/imageStore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { X, Check, AlertCircle, Loader2, Eye, FileImage, Image as ImageIcon } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { useVirtualizer } from '@tanstack/react-virtual';

// Max concurrent preview generations to prevent overload
const MAX_CONCURRENT_PREVIEWS = 4;

export function FileList() {
  const files = useImageStore((state) => state.files);
  const removeFile = useImageStore((state) => state.removeFile);
  const settings = useImageStore((state) => state.settings);
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [heicPreviews, setHeicPreviews] = useState<Map<string, string>>(new Map());
  const [loadingPreviews, setLoadingPreviews] = useState<Set<string>>(new Set());
  const [previewQueue, setPreviewQueue] = useState<string[]>([]);
  const parentRef = useRef<HTMLDivElement>(null);

  // Calculate columns based on container width
  const [columns, setColumns] = useState(4);

  useEffect(() => {
    const updateColumns = () => {
      if (parentRef.current) {
        const width = parentRef.current.offsetWidth;
        // More aggressive column breakpoints for smaller cards
        if (width < 400) setColumns(2);
        else if (width < 600) setColumns(3);
        else if (width < 800) setColumns(4);
        else if (width < 1000) setColumns(5);
        else setColumns(6);
      }
    };

    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  const rowCount = Math.ceil(files.length / columns);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 220, // Smaller row height for compact cards
    overscan: 2,
  });

  // Process preview queue with concurrency limit
  const processPreviewQueue = useCallback(async () => {
    if (loadingPreviews.size >= MAX_CONCURRENT_PREVIEWS) return;

    const availableSlots = MAX_CONCURRENT_PREVIEWS - loadingPreviews.size;
    const filesToProcess = previewQueue.slice(0, availableSlots);

    if (filesToProcess.length === 0) return;

    // Remove from queue
    setPreviewQueue(prev => prev.filter(id => !filesToProcess.includes(id)));

    // Process each file
    filesToProcess.forEach(async (fileId) => {
      const file = files.find(f => f.id === fileId);
      if (!file) return;

      setLoadingPreviews(prev => new Set(prev).add(fileId));

      try {
        const previewPath = await invoke<string>('generate_preview', { path: file.path });
        setHeicPreviews(prev => new Map(prev).set(fileId, previewPath));
      } catch (error) {
        console.error('Failed to generate HEIC preview:', error);
        setImageErrors(prev => new Set(prev).add(fileId));
      } finally {
        setLoadingPreviews(prev => {
          const next = new Set(prev);
          next.delete(fileId);
          return next;
        });
      }
    });
  }, [previewQueue, loadingPreviews, files]);

  // Queue HEIC files for preview generation
  useEffect(() => {
    const heicFiles = files.filter(
      f => ['heic', 'heif'].includes(f.format.toLowerCase()) &&
           !heicPreviews.has(f.id) &&
           !loadingPreviews.has(f.id) &&
           !previewQueue.includes(f.id) &&
           !imageErrors.has(f.id)
    );

    if (heicFiles.length > 0) {
      setPreviewQueue(prev => [...prev, ...heicFiles.map(f => f.id)]);
    }
  }, [files, heicPreviews, loadingPreviews, previewQueue, imageErrors]);

  // Process queue when slots become available
  useEffect(() => {
    processPreviewQueue();
  }, [processPreviewQueue]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFormatColor = (format: string) => {
    const colors: Record<string, { bg: string; text: string; icon: string }> = {
      jpeg: { bg: 'bg-orange-100 dark:bg-orange-950', text: 'text-orange-700 dark:text-orange-300', icon: 'text-orange-600' },
      jpg: { bg: 'bg-orange-100 dark:bg-orange-950', text: 'text-orange-700 dark:text-orange-300', icon: 'text-orange-600' },
      png: { bg: 'bg-blue-100 dark:bg-blue-950', text: 'text-blue-700 dark:text-blue-300', icon: 'text-blue-600' },
      heic: { bg: 'bg-purple-100 dark:bg-purple-950', text: 'text-purple-700 dark:text-purple-300', icon: 'text-purple-600' },
      heif: { bg: 'bg-purple-100 dark:bg-purple-950', text: 'text-purple-700 dark:text-purple-300', icon: 'text-purple-600' },
    };
    return colors[format.toLowerCase()] || { bg: 'bg-gray-100', text: 'text-gray-700', icon: 'text-gray-600' };
  };

  const getPreviewSrc = (file: { id: string; path: string; format: string }) => {
    const isHeic = ['heic', 'heif'].includes(file.format.toLowerCase());
    if (isHeic && heicPreviews.has(file.id)) {
      return convertFileSrc(heicPreviews.get(file.id)!);
    }
    return convertFileSrc(file.path);
  };

  const canPreview = (file: { id: string; format: string }) => {
    const isHeic = ['heic', 'heif'].includes(file.format.toLowerCase());
    return !isHeic || heicPreviews.has(file.id);
  };

  if (files.length === 0) {
    return null;
  }

  return (
    <>
      <div
        ref={parentRef}
        className="h-full overflow-auto"
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const startIndex = virtualRow.index * columns;
            const rowFiles = files.slice(startIndex, startIndex + columns);

            return (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div className="grid gap-4 p-1" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
                  {rowFiles.map((file) => {
                    const formatColors = getFormatColor(file.format);
                    const targetFormatColors = getFormatColor(settings.targetFormat);
                    const isHeic = ['heic', 'heif'].includes(file.format.toLowerCase());
                    const isLoadingPreview = loadingPreviews.has(file.id);
                    const isQueued = previewQueue.includes(file.id);
                    const hasPreview = canPreview(file);

                    return (
                      <Card key={file.id} className="group relative overflow-hidden hover:shadow-lg transition-all duration-200">
                        {/* Image Preview */}
                        <div
                          className={`relative aspect-square bg-muted overflow-hidden ${
                            hasPreview ? 'cursor-pointer' : 'cursor-default'
                          }`}
                          onClick={() => {
                            if (hasPreview) {
                              setPreviewFile(isHeic ? heicPreviews.get(file.id)! : file.path);
                            }
                          }}
                        >
                          {isLoadingPreview || isQueued ? (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-muted gap-2">
                              <Loader2 className="w-12 h-12 text-muted-foreground/50 animate-spin" />
                              <span className="text-xs text-muted-foreground">
                                {isQueued ? `В очереди...` : 'Загрузка...'}
                              </span>
                            </div>
                          ) : imageErrors.has(file.id) ? (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-muted gap-2">
                              <ImageIcon className="w-16 h-16 text-muted-foreground/50" />
                              <span className="text-xs text-muted-foreground">Ошибка превью</span>
                            </div>
                          ) : (
                            <img
                              src={getPreviewSrc(file)}
                              alt={file.name}
                              className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                              loading="lazy"
                              onError={() => {
                                setImageErrors(prev => new Set(prev).add(file.id));
                              }}
                            />
                          )}

                          {/* Hover Overlay */}
                          {hasPreview && !isLoadingPreview && !isQueued && (
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Eye className="w-8 h-8 text-white" />
                            </div>
                          )}

                          {/* Status Badge */}
                          {file.status !== 'pending' && (
                            <div className="absolute top-2 right-2">
                              {file.status === 'completed' && (
                                <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
                                  <Check className="w-5 h-5 text-white" />
                                </div>
                              )}
                              {file.status === 'error' && (
                                <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center shadow-lg">
                                  <AlertCircle className="w-5 h-5 text-white" />
                                </div>
                              )}
                              {file.status === 'processing' && (
                                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-lg">
                                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                                </div>
                              )}
                            </div>
                          )}

                          {/* Remove Button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFile(file.id);
                            }}
                            disabled={file.status === 'processing'}
                            className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 hover:bg-black/70 text-white"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>

                        {/* File Info */}
                        <div className="p-3 space-y-2">
                          <p className="font-medium text-sm truncate" title={file.name}>
                            {file.name}
                          </p>

                          {/* Format Conversion Visual */}
                          <div className="flex items-center gap-2 text-xs">
                            <div className={`flex items-center gap-1 px-2 py-1 rounded ${formatColors.bg} ${formatColors.text}`}>
                              <FileImage className="w-3 h-3" />
                              <span className="font-medium">{file.format.toUpperCase()}</span>
                            </div>
                            <span className="text-muted-foreground">→</span>
                            <div className={`flex items-center gap-1 px-2 py-1 rounded ${targetFormatColors.bg} ${targetFormatColors.text}`}>
                              <FileImage className="w-3 h-3" />
                              <span className="font-medium">{settings.targetFormat.toUpperCase()}</span>
                            </div>
                          </div>

                          {/* File Details */}
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{formatFileSize(file.size)}</span>
                            <span>•</span>
                            <span>{file.width}×{file.height}</span>
                          </div>

                          {/* Progress Bar */}
                          {file.status === 'processing' && file.progress !== undefined && (
                            <Progress value={file.progress} className="h-1.5" />
                          )}

                          {/* Error Message */}
                          {file.error && (
                            <p className="text-xs text-destructive bg-destructive/10 p-2 rounded">{file.error}</p>
                          )}

                          {/* Estimated Size */}
                          {file.estimatedSize && file.status === 'pending' && (
                            <div className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                              Примерный размер: {formatFileSize(file.estimatedSize)}
                            </div>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Image Preview Modal */}
      {previewFile && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-8"
          onClick={() => setPreviewFile(null)}
        >
          <div className="relative w-full h-full flex items-center justify-center">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white border-white/20 z-10"
              onClick={() => setPreviewFile(null)}
            >
              <X className="w-5 h-5" />
            </Button>
            <img
              src={convertFileSrc(previewFile)}
              alt="Preview"
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
}
