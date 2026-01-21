import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { useImageStore } from '@/store/imageStore';
import { Button } from '@/components/ui/button';
import { Loader2, FolderOpen, ArrowRight, Trash2, CheckCircle2 } from 'lucide-react';
import { join } from '@tauri-apps/api/path';

interface BatchConversionResult {
  file_id: string;
  success: boolean;
  output_path: string | null;
  error: string | null;
}

export function ConversionControls() {
  const files = useImageStore((state) => state.files);
  const settings = useImageStore((state) => state.settings);
  const updateFile = useImageStore((state) => state.updateFile);
  const clearCompleted = useImageStore((state) => state.clearCompleted);
  const clearAll = useImageStore((state) => state.clearAll);
  const [isConverting, setIsConverting] = useState(false);
  const [outputFolder, setOutputFolder] = useState<string | null>(null);

  const handleSelectFolder = async () => {
    const folder = await open({
      directory: true,
      multiple: false,
      title: 'Select output folder',
    });

    if (folder && typeof folder === 'string') {
      setOutputFolder(folder);
    }
  };

  const handleConvertAll = async () => {
    if (!outputFolder) {
      alert('Please select an output folder first');
      return;
    }

    setIsConverting(true);

    const pendingFiles = files.filter((f) => f.status === 'pending');

    // Mark all as processing
    pendingFiles.forEach((file) => {
      updateFile(file.id, { status: 'processing', progress: 0 });
    });

    try {
      // Prepare batch items with output paths
      const items = await Promise.all(
        pendingFiles.map(async (file) => {
          const newFileName = file.name.replace(/\.[^.]+$/, `.${settings.targetFormat}`);
          const outputPath = await join(outputFolder, newFileName);
          return {
            file_id: file.id,
            path: file.path,
            output_path: outputPath,
          };
        })
      );

      // Call batch conversion (parallel processing on backend)
      const results = await invoke<BatchConversionResult[]>('convert_images_batch', {
        items,
        settings: {
          target_format: settings.targetFormat,
          quality: settings.quality,
          preserve_metadata: settings.preserveMetadata,
        },
      });

      // Update file statuses based on results
      results.forEach((result) => {
        if (result.success) {
          updateFile(result.file_id, {
            status: 'completed',
            progress: 100,
            outputPath: result.output_path || undefined,
          });
        } else {
          updateFile(result.file_id, {
            status: 'error',
            error: result.error || 'Unknown error',
          });
        }
      });

      // Auto-clear completed files after a short delay
      const successCount = results.filter(r => r.success).length;
      if (successCount > 0) {
        setTimeout(() => {
          clearCompleted();
        }, 1500);
      }
    } catch (error) {
      // If batch fails completely, mark all as error
      const errorMsg = error instanceof Error ? error.message : 'Batch conversion failed';
      pendingFiles.forEach((file) => {
        updateFile(file.id, { status: 'error', error: errorMsg });
      });
    }

    setIsConverting(false);
  };

  const pendingCount = files.filter((f) => f.status === 'pending').length;
  const completedCount = files.filter((f) => f.status === 'completed').length;

  if (files.length === 0) return null;

  return (
    <div className="flex items-center justify-between gap-4">
      {/* Left side - Output folder */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Button
          onClick={handleSelectFolder}
          variant={outputFolder ? "outline" : "default"}
          size="sm"
          className="shrink-0"
        >
          <FolderOpen className="w-4 h-4 mr-2" />
          {outputFolder ? 'Change Folder' : 'Select Output Folder'}
        </Button>

        {outputFolder && (
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">{outputFolder}</p>
          </div>
        )}
      </div>

      {/* Right side - Status and Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Status */}
        <div className="flex items-center gap-3 text-sm px-3">
          {pendingCount > 0 && (
            <span className="font-medium">
              {pendingCount} ready
            </span>
          )}
          {completedCount > 0 && (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              {completedCount}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        {completedCount > 0 && (
          <Button
            onClick={clearCompleted}
            variant="outline"
            size="sm"
          >
            Clear Done
          </Button>
        )}

        {files.length > 0 && (
          <Button
            onClick={clearAll}
            variant="ghost"
            size="sm"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}

        {pendingCount > 0 && (
          <Button
            onClick={handleConvertAll}
            disabled={isConverting || !outputFolder}
            size="default"
            className="gap-2"
          >
            {isConverting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Converting...
              </>
            ) : (
              <>
                Convert {pendingCount}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
