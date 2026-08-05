import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ImageEditorService } from '../../services/image-editor.service';
import { ActiveTool } from '../../models/image-editor.models';

@Component({
  selector: 'app-left-toolbar',
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './left-toolbar.html',
  styleUrl: './left-toolbar.css',
})
export class LeftToolbarComponent {
  readonly editor = inject(ImageEditorService);

  setTool(tool: ActiveTool): void {
    this.editor.activeTool.set(tool);
  }
}
