import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ImageEditorService } from '../../services/image-editor.service';
import { SAMPLE_IMAGES } from '../../constants/editor.constants';
import { SampleImage } from '../../models/image-editor.models';

@Component({
  selector: 'app-sample-modal',
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sample-modal.html',
  styleUrl: './sample-modal.css',
})
export class SampleModalComponent {
  readonly editor = inject(ImageEditorService);
  readonly closeModal = output<void>();
  readonly samples = SAMPLE_IMAGES;

  selectSample(sample: SampleImage): void {
    this.editor.loadSampleImage(sample.url, sample.name);
    this.closeModal.emit();
  }
}
