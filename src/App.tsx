import { DragDropOverlay } from './components/DragDropOverlay';
import { FileList } from './components/FileList';
import { SettingsPanel } from './components/SettingsPanel';
import { ConversionControls } from './components/ConversionControls';
import { BatchProgress } from './components/BatchProgress';
import { UpdateChecker } from './components/UpdateChecker';
import { useImageStore } from './store/imageStore';
import { Upload, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './components/ui/button';
import { useState } from 'react';

function App() {
  const files = useImageStore((state) => state.files);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const processingCount = files.filter(f => f.status === 'processing').length;

  console.log('App: Component rendered, files count:', files.length);

  return (
    <>
      <DragDropOverlay />
      <UpdateChecker />

      <div className="h-screen bg-background flex overflow-hidden">
        {/* Collapsible Settings Sidebar */}
        <div
          className={`
            border-r bg-card transition-all duration-300 ease-in-out relative flex-shrink-0
            ${sidebarOpen ? 'w-80' : 'w-0'}
          `}
        >
          <div className={`w-80 h-full overflow-y-auto ${sidebarOpen ? '' : 'invisible'}`}>
            <div className="p-6 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-lg">Settings</h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(false)}
                className="hover:bg-muted"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-6">
              <SettingsPanel />
            </div>
          </div>
        </div>

        {/* Collapsed sidebar trigger */}
        {!sidebarOpen && (
          <Button
            variant="outline"
            size="icon"
            className="absolute left-4 top-4 z-10 shadow-lg"
            onClick={() => setSidebarOpen(true)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col h-screen overflow-hidden">
          {/* Header */}
          <div className="border-b bg-card px-6 py-4 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">Image Converter</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Convert images locally on your PC
                </p>
              </div>
              {files.length > 0 && (
                <div className="text-right">
                  <p className="text-3xl font-bold text-primary">{files.length}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    {files.length === 1 ? 'image' : 'images'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Batch Progress Indicator */}
          {processingCount > 0 && (
            <div className="px-6 pt-4 flex-shrink-0">
              <BatchProgress />
            </div>
          )}

          {/* Content Area - ONLY THIS SCROLLS */}
          {files.length === 0 ? (
            <div className="flex-1 flex items-center justify-center px-6 overflow-hidden">
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-2xl p-20 text-center bg-gradient-to-br from-muted/20 to-muted/5 w-full max-w-2xl">
                <div className="flex flex-col items-center gap-6">
                  <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                    <Upload className="w-12 h-12 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">Drop your images here</p>
                    <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                      Drag & drop JPEG or PNG files from your desktop
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-hidden">
              <div className="h-full overflow-y-auto px-6 py-6">
                <FileList />
              </div>
            </div>
          )}

          {/* Bottom Action Bar */}
          {files.length > 0 && (
            <div className="border-t bg-card px-6 py-4 flex-shrink-0">
              <ConversionControls />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default App;
