import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ImageEditorService } from '../../services/image-editor.service';

@Component({
  selector: 'app-webcam-modal',
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './webcam-modal.html',
  styleUrl: './webcam-modal.css',
})
export class WebcamModalComponent implements AfterViewInit, OnDestroy {
  readonly editor = inject(ImageEditorService);
  readonly closeModal = output<void>();

  @ViewChild('videoElement') videoRef!: ElementRef<HTMLVideoElement>;

  readonly hasPermission = signal<boolean>(true);
  readonly errorMessage = signal<string>('');

  private mediaStream: MediaStream | null = null;

  ngAfterViewInit(): void {
    this.startCamera();
  }

  async startCamera(): Promise<void> {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      if (this.videoRef?.nativeElement) {
        this.videoRef.nativeElement.srcObject = this.mediaStream;
      }
    } catch (err: unknown) {
      console.error('Camera access error:', err);
      this.hasPermission.set(false);
      this.errorMessage.set('Could not access camera. Please check browser permissions.');
    }
  }

  captureSnapshot(): void {
    const video = this.videoRef?.nativeElement;
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      this.editor.loadSampleImage(dataUrl, 'webcam-photo.jpg');
      this.editor.showToast('Webcam snapshot captured!', 'success');
      this.closeModal.emit();
    }
  }

  stopCamera(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }
}
