import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from './components/header/header';
import { LeftToolbarComponent } from './components/left-toolbar/left-toolbar';
import { CanvasComponent } from './components/canvas/canvas';
import { SidebarComponent } from './components/sidebar/sidebar';
import { StatusBarComponent } from './components/status-bar/status-bar';
import { SampleModalComponent } from './components/sample-modal/sample-modal';
import { WebcamModalComponent } from './components/webcam-modal/webcam-modal';
import { ExportModalComponent } from './components/export-modal/export-modal';

@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
    HeaderComponent,
    LeftToolbarComponent,
    CanvasComponent,
    SidebarComponent,
    StatusBarComponent,
    SampleModalComponent,
    WebcamModalComponent,
    ExportModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly isSampleModalOpen = signal<boolean>(false);
  readonly isWebcamModalOpen = signal<boolean>(false);
  readonly isExportModalOpen = signal<boolean>(false);
}
