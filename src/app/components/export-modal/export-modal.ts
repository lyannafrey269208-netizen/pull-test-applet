import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ImageEditorService } from '../../services/image-editor.service';

@Component({
  selector: 'app-export-modal',
  imports: [CommonModule, FormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './export-modal.html',
  styleUrl: './export-modal.css',
})
export class ExportModalComponent {
  readonly editor = inject(ImageEditorService);
  readonly closeModal = output<void>();

  readonly format = signal<'image/png' | 'image/jpeg' | 'image/webp'>('image/jpeg');
  readonly quality = signal<number>(92); // 92%
  readonly scale = signal<number>(1); // 1x

  downloadImage(): void {
    const dataUrl = this.getProcessedExportDataUrl();
    if (!dataUrl) return;

    const ext = this.format() === 'image/png' ? 'png' : this.format() === 'image/webp' ? 'webp' : 'jpg';
    const filename = `edited_${Date.now()}.${ext}`;

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.editor.showToast(`Exported ${filename}`, 'success');
    this.closeModal.emit();
  }

  async copyImageToClipboard(): Promise<void> {
    const dataUrl = this.getProcessedExportDataUrl();
    if (!dataUrl) return;

    try {
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob })
      ]);
      this.editor.showToast('Copied image to clipboard!', 'success');
      this.closeModal.emit();
    } catch (err: unknown) {
      console.error('Copy to clipboard failed:', err);
      this.editor.showToast('Could not copy image to clipboard in this browser', 'error');
    }
  }

  private getProcessedExportDataUrl(): string {
    const canvas = document.querySelector('canvas');
    if (!canvas) return this.editor.loadedImageSrc();

    // Render export canvas with requested scaling
    const scaleFactor = this.scale();
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width * scaleFactor;
    exportCanvas.height = canvas.height * scaleFactor;

    const ctx = exportCanvas.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(canvas, 0, 0, exportCanvas.width, exportCanvas.height);
      return exportCanvas.toDataURL(this.format(), this.quality() / 100);
    }
    return canvas.toDataURL(this.format(), this.quality() / 100);
  }
}
