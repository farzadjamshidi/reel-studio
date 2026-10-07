import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { selectActivePanel } from '../../state/selectors';
import { UiActions } from '../../state/ui.state';
import { Icon } from '../../ui/icon/icon';
import { BackgroundPanel } from '../panels/background-panel/background-panel';
import { FiltersPanel } from '../panels/filters-panel/filters-panel';
import { MediaPanel } from '../panels/media-panel/media-panel';
import { TextPanel } from '../panels/text-panel/text-panel';

@Component({
  selector: 'app-side-panel',
  imports: [Icon, MediaPanel, TextPanel, FiltersPanel, BackgroundPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './side-panel.html',
  styleUrl: './side-panel.scss',
})
export class SidePanel {
  private readonly store = inject(Store);
  protected readonly panel = this.store.selectSignal(selectActivePanel);

  protected close(): void {
    this.store.dispatch(UiActions.closePanel());
  }
}
