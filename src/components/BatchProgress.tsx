import { useImageStore } from '@/store/imageStore';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

export function BatchProgress() {
  const files = useImageStore((state) => state.files);

  const totalFiles = files.length;
  const completedFiles = files.filter((f) => f.status === 'completed').length;
  const processingFiles = files.filter((f) => f.status === 'processing').length;
  const failedFiles = files.filter((f) => f.status === 'error').length;
  const pendingFiles = files.filter((f) => f.status === 'pending').length;

  const progress = totalFiles > 0 ? (completedFiles / totalFiles) * 100 : 0;

  if (processingFiles === 0) return null;

  return (
    <Card className="p-4 bg-primary/5 border-primary/20">
      <div className="flex items-center gap-4">
        <Loader2 className="w-6 h-6 animate-spin text-primary shrink-0" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="font-semibold text-sm">
                Converting {completedFiles} of {totalFiles} images
              </p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                {processingFiles > 0 && (
                  <span className="flex items-center gap-1">
                    <Loader2 className="w-3 h-3" />
                    {processingFiles} processing
                  </span>
                )}
                {pendingFiles > 0 && (
                  <span>• {pendingFiles} pending</span>
                )}
                {failedFiles > 0 && (
                  <span className="flex items-center gap-1 text-destructive">
                    <XCircle className="w-3 h-3" />
                    {failedFiles} failed
                  </span>
                )}
              </div>
            </div>
            <span className="text-2xl font-bold text-primary tabular-nums">
              {Math.round(progress)}%
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </div>
    </Card>
  );
}
