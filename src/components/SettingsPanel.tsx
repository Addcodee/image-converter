import { useImageStore } from '@/store/imageStore';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { FileImage, Sparkles, Database } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SettingsPanel() {
  const settings = useImageStore((state) => state.settings);
  const updateSettings = useImageStore((state) => state.updateSettings);

  const formats = [
    {
      value: 'jpeg',
      label: 'JPEG',
      description: 'Меньший размер',
      icon: FileImage,
      color: 'orange',
    },
    {
      value: 'png',
      label: 'PNG',
      description: 'Без потерь',
      icon: FileImage,
      color: 'blue',
    },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Target Format */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <Label className="text-sm font-semibold">Формат</Label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {formats.map((format) => (
            <button
              key={format.value}
              onClick={() => updateSettings({ targetFormat: format.value })}
              className={cn(
                "relative p-4 rounded-lg border-2 transition-all duration-200 text-left",
                settings.targetFormat === format.value
                  ? `border-${format.color}-500 bg-${format.color}-50 dark:bg-${format.color}-950/20`
                  : "border-muted hover:border-muted-foreground/50 bg-card"
              )}
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center",
                      settings.targetFormat === format.value
                        ? `bg-${format.color}-100 dark:bg-${format.color}-900`
                        : "bg-muted"
                    )}
                  >
                    <format.icon
                      className={cn(
                        "w-4 h-4",
                        settings.targetFormat === format.value
                          ? `text-${format.color}-600 dark:text-${format.color}-400`
                          : "text-muted-foreground"
                      )}
                    />
                  </div>
                  <span className="font-semibold">{format.label}</span>
                </div>
                <p className="text-xs text-muted-foreground">{format.description}</p>
              </div>

              {/* Selection indicator */}
              {settings.targetFormat === format.value && (
                <div className={`absolute top-2 right-2 w-2 h-2 rounded-full bg-${format.color}-500`} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Quality Slider */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="quality" className="text-sm font-semibold">
            Качество
          </Label>
          <span className="text-xl font-bold text-primary tabular-nums">
            {settings.quality}%
          </span>
        </div>
        <Slider
          id="quality"
          min={10}
          max={100}
          step={5}
          value={[settings.quality]}
          onValueChange={([value]) => updateSettings({ quality: value })}
          disabled={settings.targetFormat === 'png'}
          className="py-2"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Минимум</span>
          <span>
            {settings.targetFormat === 'png' ? 'PNG: Всегда 100%' : 'Баланс'}
          </span>
          <span>Максимум</span>
        </div>
      </div>

      {/* Metadata Toggle */}
      <div className="p-4 bg-muted/50 rounded-lg">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center shrink-0 mt-0.5">
              <Database className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="space-y-1 flex-1">
              <Label htmlFor="metadata" className="text-sm font-semibold cursor-pointer">
                Сохранить метаданные
              </Label>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Сохранить EXIF данные, GPS и настройки камеры
              </p>
            </div>
          </div>
          <Switch
            id="metadata"
            checked={settings.preserveMetadata}
            onCheckedChange={(checked) =>
              updateSettings({ preserveMetadata: checked })
            }
            className="shrink-0 mt-1"
          />
        </div>
      </div>
    </div>
  );
}
