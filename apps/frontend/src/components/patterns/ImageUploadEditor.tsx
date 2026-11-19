import { useEffect, useId, useRef, useState } from 'react';
import type { ImageConfig } from '@zenith/shared';
import { Image as ImageIcon, Loader2, RotateCcw, RotateCw, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { uploadMedia } from '@/lib/api';

export interface ImageUploadValue {
  url: string;
  config?: ImageConfig;
}

export interface ImageUploadEditorProps {
  value: ImageUploadValue;
  onChange: (next: ImageUploadValue) => void;
  onCommit?: (next: ImageUploadValue) => Promise<void> | void;
  endpoint: '/upload/avatar' | '/upload/achievement';
  uploadParams?: Record<string, string>;
  label?: string;
}

const ALLOWED_MIME_TYPES = new Set(['image/webp', 'image/png', 'image/jpeg']);
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

function parseAspectRatio(aspect: string): number {
  const [rawW, rawH] = aspect.split(':');
  const w = Number(rawW);
  const h = Number(rawH);
  return Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 ? w / h : 1;
}

function aspectToCss(aspect: string): string {
  const [rawW, rawH] = aspect.split(':');
  const w = Number(rawW);
  const h = Number(rawH);
  return Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 ? `${w} / ${h}` : '1 / 1';
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function normalizeRotate(deg: number): number {
  const normalized = ((Math.round(deg) % 360) + 360) % 360;
  return normalized;
}

function canvasToWebpBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to encode WebP image.'));
          return;
        }
        resolve(blob);
      },
      'image/webp',
      quality,
    );
  });
}

export async function renderCroppedWebp(
  img: HTMLImageElement,
  config: ImageConfig,
  maxEdge?: number,
  quality = 0.82,
): Promise<Blob> {
  const edge = maxEdge ?? (config.aspect === '1:1' ? 1200 : 1600);
  const ratio = parseAspectRatio(config.aspect);
  const outW = ratio >= 1 ? edge : Math.max(1, Math.round(edge * ratio));
  const outH = ratio >= 1 ? Math.max(1, Math.round(edge / ratio)) : edge;

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context is unavailable.');
  }

  const nw = img.naturalWidth || img.width || outW;
  const nh = img.naturalHeight || img.height || outH;
  const baseScale = Math.max(outW / nw, outH / nh);
  const drawW = nw * baseScale * config.zoom;
  const drawH = nh * baseScale * config.zoom;

  const panX = ((50 - config.x) / 100) * Math.max(0, drawW - outW);
  const panY = ((50 - config.y) / 100) * Math.max(0, drawH - outH);

  ctx.save();
  ctx.translate(outW / 2 + panX, outH / 2 + panY);
  ctx.rotate(((config.rotate ?? 0) * Math.PI) / 180);
  ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();

  const qualitySteps = [quality, ...[0.7, 0.55, 0.4].filter((q) => q < quality)];
  for (const stepQuality of qualitySteps) {
    const blob = await canvasToWebpBlob(canvas, stepQuality);
    if (blob.size <= MAX_UPLOAD_BYTES) {
      return blob;
    }
  }

  throw new Error('Image remains larger than 2 MB after compression.');
}

export function ImageUploadEditor({
  value,
  onChange,
  onCommit,
  endpoint,
  uploadParams,
  label,
}: ImageUploadEditorProps): React.JSX.Element {
  const fileInputId = useId();
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const [pendingFileUrl, setPendingFileUrl] = useState<string | null>(null);
  const [needsCommit, setNeedsCommit] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (pendingFileUrl) {
        URL.revokeObjectURL(pendingFileUrl);
      }
    };
  }, [pendingFileUrl]);

  const activeConfig: ImageConfig = {
    x: value.config?.x ?? 50,
    y: value.config?.y ?? 50,
    zoom: value.config?.zoom ?? 1,
    rotate: value.config?.rotate ?? 0,
    aspect: '1:1',
  };

  const previewSrc = pendingFileUrl ?? value.url;
  const rotateDeg = activeConfig.rotate ?? 0;

  function emitConfig(partial: Partial<ImageConfig>) {
    if (!pendingFileUrl && onCommit) {
      setNeedsCommit(true);
    }
    onChange({
      url: value.url,
      config: { ...activeConfig, ...partial, aspect: '1:1' },
    });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      setError('Unsupported file format. Choose WebP, PNG, or JPEG.');
      return;
    }

    setError(null);
    setNeedsCommit(false);
    const objectUrl = URL.createObjectURL(file);
    setPendingFileUrl(objectUrl);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!previewSrc) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: activeConfig.x,
      originY: activeConfig.y,
    };
    setIsDragging(true);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const dxPct = ((e.clientX - drag.startX) / Math.max(1, rect.width)) * 100;
    const dyPct = ((e.clientY - drag.startY) / Math.max(1, rect.height)) * 100;

    emitConfig({
      x: Math.round(clamp(drag.originX - dxPct, 0, 100) * 10) / 10,
      y: Math.round(clamp(drag.originY - dyPct, 0, 100) * 10) / 10,
    });
  }

  function handlePointerEnd(e: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null;
      setIsDragging(false);
    }
  }

  async function handleApplyUpload() {
    if (!pendingFileUrl) return;
    const img = imgRef.current;
    if (!img || !img.complete || img.naturalWidth === 0) {
      setError('Image is still loading. Try again in a moment.');
      return;
    }

    setError(null);
    setIsUploading(true);
    try {
      const blob = await renderCroppedWebp(img, activeConfig);
      const uploaded = await uploadMedia(endpoint, blob, uploadParams);
      const next: ImageUploadValue = {
        url: uploaded.url,
        config: { x: 50, y: 50, zoom: 1, rotate: 0, aspect: activeConfig.aspect },
      };
      onChange(next);
      if (onCommit) {
        await onCommit(next);
      }
      setPendingFileUrl(null);
      setNeedsCommit(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image.');
    } finally {
      setIsUploading(false);
    }
  }

  async function handleCommitCurrent() {
    if (!onCommit) return;
    setError(null);
    setIsUploading(true);
    try {
      await onCommit({ url: value.url, config: activeConfig });
      setNeedsCommit(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save image.');
    } finally {
      setIsUploading(false);
    }
  }

  const panXPercent = (50 - activeConfig.x) * Math.max(0, activeConfig.zoom - 1);
  const panYPercent = (50 - activeConfig.y) * Math.max(0, activeConfig.zoom - 1);

  return (
    <div className="space-y-3">
      {label ? <p className="text-sm font-medium leading-none">{label}</p> : null}

      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        style={{ aspectRatio: aspectToCss(activeConfig.aspect) }}
        className={`relative w-full max-w-sm overflow-hidden rounded-lg border border-border bg-muted select-none ${
          previewSrc ? (isDragging ? 'cursor-grabbing touch-none' : 'cursor-grab touch-none') : ''
        }`}
      >
        {previewSrc ? (
          <img
            ref={imgRef}
            src={previewSrc}
            alt="Crop preview"
            draggable={false}
            style={{
              objectPosition: `${activeConfig.x}% ${activeConfig.y}%`,
              transform: `translate(${panXPercent}%, ${panYPercent}%) scale(${activeConfig.zoom}) rotate(${rotateDeg}deg)`,
            }}
            className="h-full w-full object-cover transition-transform duration-150 motion-reduce:transition-none"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center text-muted-foreground">
            <ImageIcon className="h-6 w-6" aria-hidden="true" />
            <span className="text-xs">Upload an image</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          id={fileInputId}
          type="file"
          accept="image/webp,image/png,image/jpeg"
          aria-label="Choose image file"
          onChange={handleFileChange}
          className="sr-only"
        />
        <Button type="button" variant="outline" size="sm" asChild>
          <label htmlFor={fileInputId} className="cursor-pointer">
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Choose image</span>
          </label>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Rotate 90 degrees"
          onClick={() => emitConfig({ rotate: normalizeRotate(rotateDeg + 90) })}
        >
          <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>

        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Reset position"
          onClick={() => emitConfig({ x: 50, y: 50, zoom: 1, rotate: 0 })}
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>

      <div className="grid max-w-sm gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          <span className="flex items-center justify-between">
            <span>Zoom</span>
            <span className="font-mono tabular-nums">{activeConfig.zoom.toFixed(2)}x</span>
          </span>
          <input
            type="range"
            aria-label="Zoom image"
            min="1"
            max="3"
            step="0.05"
            value={activeConfig.zoom}
            onChange={(e) => emitConfig({ zoom: Number(e.target.value) })}
            className="w-full accent-primary"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          <span className="flex items-center justify-between">
            <span>Rotation</span>
            <span className="font-mono tabular-nums">{rotateDeg}deg</span>
          </span>
          <input
            type="range"
            aria-label="Fine rotation"
            min="0"
            max="360"
            step="1"
            value={rotateDeg}
            onChange={(e) => emitConfig({ rotate: normalizeRotate(Number(e.target.value)) })}
            className="w-full accent-primary"
          />
        </label>
      </div>

      {pendingFileUrl ? (
        <div className="flex max-w-sm items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={isUploading}
            onClick={handleApplyUpload}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                <span>Uploading</span>
              </>
            ) : (
              <span>Apply & upload</span>
            )}
          </Button>
        </div>
      ) : onCommit && needsCommit ? (
        <div className="flex max-w-sm items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={isUploading}
            onClick={handleCommitCurrent}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                <span>Saving</span>
              </>
            ) : (
              <span>Save photo</span>
            )}
          </Button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
