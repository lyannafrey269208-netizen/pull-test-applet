import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ImageEditorService } from '../../services/image-editor.service';
import { DrawingPath, DrawingPoint, TextOverlay } from '../../models/image-editor.models';

@Component({
  selector: 'app-canvas',
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './canvas.html',
  styleUrl: './canvas.css',
})
export class CanvasComponent implements AfterViewInit {
  readonly editor = inject(ImageEditorService);

  @ViewChild('canvasElement') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('canvasContainer') containerRef!: ElementRef<HTMLDivElement>;

  // Interactive Drawing State
  private isDrawing = false;
  private currentPath: DrawingPath | null = null;

  // Dragging Text State
  readonly draggingTextId = signal<string | null>(null);
  private dragOffset = { x: 0, y: 0 };

  // Computed CSS Filter string for preview
  readonly cssFilter = computed(() => {
    const adj = this.editor.adjustments();
    const brightnessVal = 100 + adj.brightness + adj.exposure * 0.5;
    const contrastVal = 100 + adj.contrast;
    const saturateVal = Math.max(0, 100 + adj.saturation + adj.vibrance * 0.5);
    const sepiaVal = adj.sepia;
    const hueVal = adj.hueShift;
    const blurVal = adj.blur;
    const invertVal = adj.invert;
    const grayscaleVal = adj.grayscale;

    return `brightness(${brightnessVal}%) contrast(${contrastVal}%) saturate(${saturateVal}%) sepia(${sepiaVal}%) hue-rotate(${hueVal}deg) blur(${blurVal}px) invert(${invertVal}%) grayscale(${grayscaleVal}%)`;
  });

  // Computed CSS transform style for rotation & flip
  readonly canvasTransformStyle = computed(() => {
    const t = this.editor.transform();
    const zoom = this.editor.zoomLevel() / 100;
    const pan = this.editor.panOffset();
    const scaleX = t.flipH ? -1 : 1;
    const scaleY = t.flipV ? -1 : 1;
    const totalRotation = t.rotation + t.fineAngle;

    return `translate(${pan.x}px, ${pan.y}px) scale(${scaleX * zoom}, ${scaleY * zoom}) rotate(${totalRotation}deg)`;
  });

  constructor() {
    // Redraw canvas whenever base image, drawings, or key states change
    effect(() => {
      const src = this.editor.loadedImageSrc();
      // Track signals to trigger effect on changes
      this.editor.drawings();
      this.editor.adjustments();
      this.editor.activeFilter();
      this.editor.transform();

      if (src && this.canvasRef?.nativeElement) {
        this.renderCanvas();
      }
    });
  }

  ngAfterViewInit(): void {
    this.renderCanvas();
  }

  renderCanvas(): void {
    if (typeof window === 'undefined') return;
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const src = this.editor.isComparingOriginal()
      ? this.editor.originalImageSrc()
      : this.editor.loadedImageSrc();

    if (!src) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Save context state
      ctx.save();

      // Apply CSS-like canvas filters if not comparing original
      if (!this.editor.isComparingOriginal()) {
        ctx.filter = this.cssFilter();
      } else {
        ctx.filter = 'none';
      }

      // Draw base image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      // Vignette effect if specified
      const vignetteStrength = this.editor.adjustments().vignette;
      if (vignetteStrength > 0 && !this.editor.isComparingOriginal()) {
        ctx.save();
        const outerRadius = Math.sqrt(Math.pow(canvas.width / 2, 2) + Math.pow(canvas.height / 2, 2));
        const gradient = ctx.createRadialGradient(
          canvas.width / 2,
          canvas.height / 2,
          canvas.width * 0.3,
          canvas.width / 2,
          canvas.height / 2,
          outerRadius
        );
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, `rgba(0,0,0,${vignetteStrength / 100})`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }

      // Render Drawings overlay
      if (!this.editor.isComparingOriginal()) {
        this.renderDrawingsOnCanvas(ctx, canvas.width, canvas.height);
      }
    };
    img.src = src;
  }

  private renderDrawingsOnCanvas(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {
    const paths = this.editor.drawings();
    paths.forEach((path) => {
      if (path.points.length < 2) return;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo((path.points[0].x * width) / 100, (path.points[0].y * height) / 100);

      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo((path.points[i].x * width) / 100, (path.points[i].y * height) / 100);
      }

      if (path.isEraser) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = path.size * (width / 800);
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = path.color;
        ctx.lineWidth = path.size * (width / 800);
        ctx.globalAlpha = path.opacity;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
      ctx.stroke();
      ctx.restore();
    });
  }

  // Mouse & Touch Drawing Handlers
  onCanvasMouseDown(event: MouseEvent): void {
    if (this.editor.activeTool() !== 'draw') return;

    this.isDrawing = true;
    const point = this.getNormalizedPoint(event);

    this.currentPath = {
      id: 'path_' + Date.now(),
      points: [point],
      color: this.editor.brushColor(),
      size: this.editor.brushSize(),
      opacity: this.editor.brushOpacity(),
      isEraser: this.editor.isEraser(),
    };
  }

  onCanvasMouseMove(event: MouseEvent): void {
    if (!this.isDrawing || !this.currentPath) return;

    const point = this.getNormalizedPoint(event);
    this.currentPath.points.push(point);

    // Live update drawing signal
    this.editor.drawings.update((paths) => {
      const filtered = paths.filter((p) => p.id !== this.currentPath!.id);
      return [...filtered, this.currentPath!];
    });
  }

  @HostListener('window:mouseup')
  onCanvasMouseUp(): void {
    if (this.isDrawing && this.currentPath) {
      this.isDrawing = false;
      this.editor.saveStateToHistory();
      this.currentPath = null;
    }
  }

  private getNormalizedPoint(event: MouseEvent): DrawingPoint {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const clientX = event.clientX - rect.left;
    const clientY = event.clientY - rect.top;

    const x = Math.max(0, Math.min(100, (clientX / rect.width) * 100));
    const y = Math.max(0, Math.min(100, (clientY / rect.height) * 100));
    return { x, y };
  }

  // Text Item Dragging
  startTextDrag(event: MouseEvent, item: TextOverlay): void {
    event.stopPropagation();
    this.editor.selectedTextId.set(item.id);
    this.draggingTextId.set(item.id);
    this.dragOffset = {
      x: event.clientX,
      y: event.clientY,
    };
  }

  @HostListener('window:mousemove', ['$event'])
  onWindowMouseMove(event: MouseEvent): void {
    const textId = this.draggingTextId();
    if (!textId) return;

    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dx = ((event.clientX - this.dragOffset.x) / rect.width) * 100;
    const dy = ((event.clientY - this.dragOffset.y) / rect.height) * 100;

    this.dragOffset = { x: event.clientX, y: event.clientY };

    this.editor.textItems.update((items) =>
      items.map((t) => {
        if (t.id === textId) {
          const newX = Math.max(0, Math.min(100, t.x + dx));
          const newY = Math.max(0, Math.min(100, t.y + dy));
          return { ...t, x: newX, y: newY };
        }
        return t;
      })
    );
  }

  @HostListener('window:mouseup')
  onWindowMouseUp(): void {
    if (this.draggingTextId()) {
      this.draggingTextId.set(null);
      this.editor.saveStateToHistory();
    }
  }

  // Zoom / Pan Helpers
  zoomIn(): void {
    this.editor.zoomLevel.update((z) => Math.min(400, z + 25));
  }

  zoomOut(): void {
    this.editor.zoomLevel.update((z) => Math.max(25, z - 25));
  }

  resetZoom(): void {
    this.editor.zoomLevel.set(100);
    this.editor.panOffset.set({ x: 0, y: 0 });
  }
}
