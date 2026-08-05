import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  ActiveTool,
  AiAnalysisResult,
  DrawingPath,
  FilterId,
  HistoryState,
  ImageAdjustments,
  TextOverlay,
  TransformState,
} from '../models/image-editor.models';
import { DEFAULT_ADJUSTMENTS, FILTER_PRESETS, SAMPLE_IMAGES } from '../constants/editor.constants';

@Injectable({
  providedIn: 'root',
})
export class ImageEditorService {
  private http = inject(HttpClient);

  // Core State Signals
  readonly loadedImageSrc = signal<string>('');
  readonly originalImageSrc = signal<string>('');
  readonly imageName = signal<string>('photo.jpg');
  readonly imageWidth = signal<number>(0);
  readonly imageHeight = signal<number>(0);

  readonly activeTool = signal<ActiveTool>('adjust');
  readonly adjustments = signal<ImageAdjustments>({ ...DEFAULT_ADJUSTMENTS });
  readonly activeFilter = signal<FilterId>('none');
  readonly filterIntensity = signal<number>(100);

  readonly transform = signal<TransformState>({
    rotation: 0,
    fineAngle: 0,
    flipH: false,
    flipV: false,
    cropBox: null,
    aspectRatio: 'free',
  });

  readonly drawings = signal<DrawingPath[]>([]);
  readonly textItems = signal<TextOverlay[]>([]);

  // Brush / Annotation Settings
  readonly brushColor = signal<string>('#ef4444');
  readonly brushSize = signal<number>(12);
  readonly brushOpacity = signal<number>(1);
  readonly isEraser = signal<boolean>(false);

  // Active Text Tool Input
  readonly newTextString = signal<string>('DOUBLE CLICK TO EDIT');
  readonly selectedTextId = signal<string | null>(null);

  // View Controls
  readonly zoomLevel = signal<number>(100); // 100%
  readonly panOffset = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  readonly isComparingOriginal = signal<boolean>(false);

  // AI & Processing States
  readonly isAiProcessing = signal<boolean>(false);
  readonly aiStatusMessage = signal<string>('');
  readonly aiAnalysisResult = signal<AiAnalysisResult | null>(null);

  // History Undo/Redo Stack
  readonly history = signal<HistoryState[]>([]);
  readonly historyIndex = signal<number>(-1);

  readonly canUndo = computed(() => this.historyIndex() > 0);
  readonly canRedo = computed(() => this.historyIndex() < this.history().length - 1);

  // Active Toast Signal
  readonly toastMessage = signal<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  constructor() {
    // Load default sample image on start in browser
    if (typeof window !== 'undefined') {
      this.loadSampleImage(SAMPLE_IMAGES[0].url, SAMPLE_IMAGES[0].name);
    }
  }

  showToast(text: string, type: 'success' | 'info' | 'error' = 'info'): void {
    this.toastMessage.set({ text, type });
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        if (this.toastMessage()?.text === text) {
          this.toastMessage.set(null);
        }
      }, 4000);
    }
  }

  loadSampleImage(url: string, name: string): void {
    if (typeof window === 'undefined') return;
    this.imageName.set(name);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 1200;
      canvas.height = img.naturalHeight || 800;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        this.setNewBaseImage(dataUrl, canvas.width, canvas.height);
      }
    };
    img.onerror = () => {
      this.showToast('Failed to load sample image', 'error');
    };
    img.src = url;
  }

  loadUserFile(file: File): void {
    if (!file.type.startsWith('image/')) {
      this.showToast('Please select a valid image file', 'error');
      return;
    }
    this.imageName.set(file.name);
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        this.setNewBaseImage(dataUrl, img.width, img.height);
        this.showToast(`Loaded ${file.name}`, 'success');
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  setNewBaseImage(dataUrl: string, width: number, height: number): void {
    this.loadedImageSrc.set(dataUrl);
    this.originalImageSrc.set(dataUrl);
    this.imageWidth.set(width);
    this.imageHeight.set(height);

    // Reset parameters
    this.resetAdjustmentsAndTransform();
    this.history.set([]);
    this.historyIndex.set(-1);
    this.pushHistoryState();
  }

  resetAdjustmentsAndTransform(): void {
    this.adjustments.set({ ...DEFAULT_ADJUSTMENTS });
    this.activeFilter.set('none');
    this.filterIntensity.set(100);
    this.transform.set({
      rotation: 0,
      fineAngle: 0,
      flipH: false,
      flipV: false,
      cropBox: null,
      aspectRatio: 'free',
    });
    this.drawings.set([]);
    this.textItems.set([]);
    this.zoomLevel.set(100);
    this.panOffset.set({ x: 0, y: 0 });
    this.aiAnalysisResult.set(null);
  }

  updateAdjustment(key: keyof ImageAdjustments, value: number): void {
    this.adjustments.update((adj) => ({ ...adj, [key]: value }));
  }

  setFilter(filterId: FilterId): void {
    this.activeFilter.set(filterId);
    const preset = FILTER_PRESETS.find((p) => p.id === filterId);
    if (preset && filterId !== 'none') {
      // Merge preset default adjustments
      this.adjustments.update(() => ({
        ...DEFAULT_ADJUSTMENTS,
        ...preset.adjustments,
      }));
    } else if (filterId === 'none') {
      this.adjustments.set({ ...DEFAULT_ADJUSTMENTS });
    }
    this.saveStateToHistory();
  }

  rotateRight(): void {
    this.transform.update((t) => ({
      ...t,
      rotation: (t.rotation + 90) % 360,
    }));
    this.saveStateToHistory();
  }

  rotateLeft(): void {
    this.transform.update((t) => ({
      ...t,
      rotation: (t.rotation - 90 + 360) % 360,
    }));
    this.saveStateToHistory();
  }

  toggleFlipH(): void {
    this.transform.update((t) => ({ ...t, flipH: !t.flipH }));
    this.saveStateToHistory();
  }

  toggleFlipV(): void {
    this.transform.update((t) => ({ ...t, flipV: !t.flipV }));
    this.saveStateToHistory();
  }

  addTextOverlay(text: string): void {
    const newText: TextOverlay = {
      id: 'text_' + Date.now(),
      text: text || 'NEW TEXT',
      x: 50, // center
      y: 50,
      color: '#ffffff',
      fontSize: 32,
      fontFamily: 'sans-serif',
      bold: true,
      italic: false,
    };
    this.textItems.update((items) => [...items, newText]);
    this.selectedTextId.set(newText.id);
    this.saveStateToHistory();
  }

  removeTextOverlay(id: string): void {
    this.textItems.update((items) => items.filter((t) => t.id !== id));
    if (this.selectedTextId() === id) {
      this.selectedTextId.set(null);
    }
    this.saveStateToHistory();
  }

  clearDrawings(): void {
    this.drawings.set([]);
    this.saveStateToHistory();
  }

  // History Stack Methods
  saveStateToHistory(): void {
    this.pushHistoryState();
  }

  private pushHistoryState(): void {
    const currentState: HistoryState = {
      adjustments: { ...this.adjustments() },
      filter: this.activeFilter(),
      filterIntensity: this.filterIntensity(),
      transform: { ...this.transform() },
      drawings: [...this.drawings()],
      textItems: [...this.textItems()],
      imageDataUrl: this.loadedImageSrc(),
    };

    const idx = this.historyIndex();
    const truncatedHistory = this.history().slice(0, idx + 1);
    this.history.set([...truncatedHistory, currentState]);
    this.historyIndex.set(this.history().length - 1);
  }

  undo(): void {
    if (!this.canUndo()) return;
    const newIdx = this.historyIndex() - 1;
    this.historyIndex.set(newIdx);
    this.applyHistorySnapshot(this.history()[newIdx]);
    this.showToast('Undo', 'info');
  }

  redo(): void {
    if (!this.canRedo()) return;
    const newIdx = this.historyIndex() + 1;
    this.historyIndex.set(newIdx);
    this.applyHistorySnapshot(this.history()[newIdx]);
    this.showToast('Redo', 'info');
  }

  private applyHistorySnapshot(state: HistoryState): void {
    if (!state) return;
    this.adjustments.set({ ...state.adjustments });
    this.activeFilter.set(state.filter);
    this.filterIntensity.set(state.filterIntensity);
    this.transform.set({ ...state.transform });
    this.drawings.set([...state.drawings]);
    this.textItems.set([...state.textItems]);
    this.loadedImageSrc.set(state.imageDataUrl);
  }

  resetAll(): void {
    this.resetAdjustmentsAndTransform();
    this.saveStateToHistory();
    this.showToast('Reset all edits to original', 'info');
  }

  // AI Service Integrations
  async runAiAutoTune(): Promise<void> {
    if (!this.loadedImageSrc()) return;
    this.isAiProcessing.set(true);
    this.aiStatusMessage.set('Gemini AI is analyzing image lighting, colors, and composition...');

    try {
      const res = await firstValueFrom(
        this.http.post<{ success: boolean; data?: AiAnalysisResult; error?: string }>('/api/ai/analyze-enhance', {
          image: this.loadedImageSrc(),
        })
      );

      if (res.success && res.data) {
        const data: AiAnalysisResult = res.data;
        this.aiAnalysisResult.set(data);

        // Apply recommended adjustments
        this.adjustments.update((adj) => ({
          ...adj,
          brightness: data.brightness ?? adj.brightness,
          contrast: data.contrast ?? adj.contrast,
          saturation: data.saturation ?? adj.saturation,
          exposure: data.exposure ?? adj.exposure,
          warmth: data.warmth ?? adj.warmth,
          vignette: data.vignette ?? adj.vignette,
        }));

        if (data.recommendedFilter && data.recommendedFilter.toLowerCase() !== 'none') {
          const matched = FILTER_PRESETS.find(
            (f) => f.name.toLowerCase() === data.recommendedFilter.toLowerCase() || f.id.toLowerCase() === data.recommendedFilter.toLowerCase()
          );
          if (matched) {
            this.activeFilter.set(matched.id);
          }
        }

        this.saveStateToHistory();
        this.showToast('AI Auto-Tune applied successfully!', 'success');
      } else {
        throw new Error(res.error || 'AI analysis failed');
      }
    } catch (err: unknown) {
      console.error('AI Auto-Tune error:', err);
      const msg = err instanceof Error ? err.message : 'Error';
      this.showToast('AI Auto-Tune failed: ' + msg, 'error');
    } finally {
      this.isAiProcessing.set(false);
      this.aiStatusMessage.set('');
    }
  }

  async runMagicPromptEdit(prompt: string): Promise<void> {
    if (!prompt.trim()) return;
    this.isAiProcessing.set(true);
    this.aiStatusMessage.set(`Applying AI Magic Edit: "${prompt}"...`);

    try {
      const res = await firstValueFrom(
        this.http.post<{ success: boolean; data?: Record<string, any>; error?: string }>('/api/ai/magic-edit-prompt', {
          image: this.loadedImageSrc(),
          prompt,
        })
      );

      if (res.success && res.data) {
        const data = res.data;
        this.adjustments.update((adj) => ({
          ...adj,
          brightness: data['brightness'] ?? adj.brightness,
          contrast: data['contrast'] ?? adj.contrast,
          saturation: data['saturation'] ?? adj.saturation,
          exposure: data['exposure'] ?? adj.exposure,
          warmth: data['warmth'] ?? adj.warmth,
          sepia: data['sepia'] ?? adj.sepia,
          hueShift: data['hueShift'] ?? adj.hueShift,
          vignette: data['vignette'] ?? adj.vignette,
          blur: data['blur'] ?? adj.blur,
        }));

        if (data['suggestedTextOverlay']) {
          this.addTextOverlay(data['suggestedTextOverlay']);
        }

        this.saveStateToHistory();
        this.showToast(`AI Edit applied: ${data['explanation'] || prompt}`, 'success');
      } else {
        throw new Error(res.error || 'Magic edit failed');
      }
    } catch (err: unknown) {
      console.error('Magic prompt edit error:', err);
      const msg = err instanceof Error ? err.message : 'Error';
      this.showToast('Magic edit error: ' + msg, 'error');
    } finally {
      this.isAiProcessing.set(false);
      this.aiStatusMessage.set('');
    }
  }

  async generateAiImage(prompt: string): Promise<void> {
    if (!prompt.trim()) return;
    this.isAiProcessing.set(true);
    this.aiStatusMessage.set(`Generating AI image for "${prompt}"...`);

    try {
      const res = await firstValueFrom(
        this.http.post<{ success: boolean; image?: string; error?: string }>('/api/ai/generate-image', { prompt })
      );

      if (res.success && res.image) {
        this.imageName.set('ai-generated.jpg');
        const img = new Image();
        const base64Img = res.image;
        img.onload = () => {
          this.setNewBaseImage(base64Img, img.width, img.height);
          this.showToast('AI Image generated!', 'success');
        };
        img.src = res.image;
      } else {
        throw new Error(res.error || 'Generation failed');
      }
    } catch (err: unknown) {
      console.error('Generate image error:', err);
      const msg = err instanceof Error ? err.message : 'Service unavailable';
      this.showToast('AI Generation error: ' + msg, 'error');
    } finally {
      this.isAiProcessing.set(false);
      this.aiStatusMessage.set('');
    }
  }
}
