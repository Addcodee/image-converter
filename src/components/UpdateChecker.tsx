import { useEffect, useState } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { Button } from './ui/button';
import { Download, RefreshCw, X } from 'lucide-react';

type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error';

export function UpdateChecker() {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [version, setVersion] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check for updates on app start
    checkForUpdates();
  }, []);

  const checkForUpdates = async (showError = false) => {
    setStatus('checking');
    setError('');

    try {
      const update = await check();

      if (update) {
        setVersion(update.version);
        setStatus('available');
      } else {
        setStatus('idle');
      }
    } catch (err) {
      console.error('Update check failed:', err);
      // Silently fail on initial check - only show error if user manually retried
      if (showError) {
        setError(err instanceof Error ? err.message : 'Не удалось проверить обновления');
        setStatus('error');
      } else {
        setStatus('idle');
      }
    }
  };

  const downloadAndInstall = async () => {
    setStatus('downloading');
    setProgress(0);

    try {
      const update = await check();

      if (!update) {
        setStatus('idle');
        return;
      }

      let downloaded = 0;
      let contentLength = 0;

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength || 0;
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            if (contentLength > 0) {
              setProgress(Math.round((downloaded / contentLength) * 100));
            }
            break;
          case 'Finished':
            setStatus('ready');
            break;
        }
      });

      // Relaunch the app to apply update
      await relaunch();
    } catch (err) {
      console.error('Update failed:', err);
      setError(err instanceof Error ? err.message : 'Ошибка обновления');
      setStatus('error');
    }
  };

  if (dismissed || status === 'idle') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-card border rounded-lg shadow-lg p-4 max-w-sm">
        {status === 'checking' && (
          <div className="flex items-center gap-3">
            <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
            <span className="text-sm">Проверка обновлений...</span>
          </div>
        )}

        {status === 'available' && (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">Доступно обновление</p>
                <p className="text-sm text-muted-foreground">
                  Версия {version} готова к загрузке
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 -mt-1 -mr-1"
                onClick={() => setDismissed(true)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <Button onClick={downloadAndInstall} className="w-full gap-2">
              <Download className="w-4 h-4" />
              Скачать и установить
            </Button>
          </div>
        )}

        {status === 'downloading' && (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Download className="w-5 h-5 text-primary" />
              <span className="text-sm">Загрузка обновления...</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-right">{progress}%</p>
          </div>
        )}

        {status === 'ready' && (
          <div className="flex items-center gap-3">
            <RefreshCw className="w-5 h-5 text-green-500" />
            <span className="text-sm">Перезапуск для применения обновления...</span>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-destructive">Ошибка обновления</p>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 -mt-1 -mr-1"
                onClick={() => setDismissed(true)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <Button variant="outline" onClick={() => checkForUpdates(true)} className="w-full">
              Повторить
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
