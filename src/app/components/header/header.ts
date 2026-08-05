import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ImageEditorService } from '../../services/image-editor.service';

@Component({
  selector: 'app-header',
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class HeaderComponent {
  readonly editor = inject(ImageEditorService);

  readonly openSampleGallery = output<void>();
  readonly openWebcamModal = output<void>();
  readonly openExportModal = output<void>();

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.editor.loadUserFile(input.files[0]);
      input.value = ''; // reset input
    }
  }

  toggleCompare(): void {
    this.editor.isComparingOriginal.update((v) => !v);
  }
}
