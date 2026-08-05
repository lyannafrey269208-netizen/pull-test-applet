import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ImageEditorService } from '../../services/image-editor.service';
import { ActiveTool, FilterId } from '../../models/image-editor.models';
import { FILTER_PRESETS } from '../../constants/editor.constants';

@Component({
  selector: 'app-sidebar',
  imports: [CommonModule, FormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class SidebarComponent {
  readonly editor = inject(ImageEditorService);
  readonly filterPresets = FILTER_PRESETS;

  // AI Inputs
  readonly magicPromptInput = signal<string>('');
  readonly aiGenPromptInput = signal<string>('');

  // Prompt chips
  readonly quickPrompts = [
    'Retro 1970s Warm Film',
    'Cyberpunk Neon Magenta',
    'Cinematic Teal & Orange',
    'Golden Hour Glow',
    'Dramatic Noir B&W',
    'Pastel Soft Watercolor',
  ];

  setTool(tool: ActiveTool): void {
    this.editor.activeTool.set(tool);
  }

  setFilter(id: FilterId): void {
    this.editor.setFilter(id);
  }

  setAspectRatio(aspectRatio: 'free' | '1:1' | '16:9' | '9:16' | '4:3' | '3:2'): void {
    this.editor.transform.update((t) => ({ ...t, aspectRatio }));
  }

  onMagicPromptSubmit(): void {
    if (!this.magicPromptInput().trim()) return;
    this.editor.runMagicPromptEdit(this.magicPromptInput());
  }

  useQuickPrompt(prompt: string): void {
    this.magicPromptInput.set(prompt);
    this.editor.runMagicPromptEdit(prompt);
  }

  onAiGenerateSubmit(): void {
    if (!this.aiGenPromptInput().trim()) return;
    this.editor.generateAiImage(this.aiGenPromptInput());
  }

  copyCaptionToClipboard(text: string): void {
    navigator.clipboard.writeText(text);
    this.editor.showToast('Caption copied to clipboard!', 'success');
  }
}
