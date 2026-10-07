import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { selectActivePanel } from '../../state/selectors';
import { PanelId, UiActions } from '../../state/ui.state';
import { Icon, IconName } from '../../ui/icon/icon';

const TOOLS: { id: PanelId; label: string; icon: IconName }[] = [
  { id: 'media', label: 'Media', icon: 'media' },
  { id: 'text', label: 'Text', icon: 'text' },
  { id: 'filters', label: 'Filters', icon: 'filters' },
  { id: 'background', label: 'BG', icon: 'background' },
];

@Component({
  selector: 'app-tool-rail',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tool-rail.html',
  styleUrl: './tool-rail.scss',
})
export class ToolRail {
  private readonly store = inject(Store);
  protected readonly tools = TOOLS;
  protected readonly active = this.store.selectSignal(selectActivePanel);

  protected toggle(panel: PanelId): void {
    this.store.dispatch(UiActions.togglePanel({ panel }));
  }
}
