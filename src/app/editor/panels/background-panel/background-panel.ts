import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { ProjectActions } from '../../../state/project.actions';
import { selectBackground } from '../../../state/selectors';

const BACKGROUNDS = ['#111827', '#000000', '#ffffff', '#f5f5f4', '#1e3a8a', '#065f46', '#7c2d12', '#581c87', '#be123c', '#facc15', '#22c55e', '#38bdf8'];

@Component({
  selector: 'app-background-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './background-panel.html',
  styleUrls: ['../panel.scss', './background-panel.scss'],
})
export class BackgroundPanel {
  private readonly store = inject(Store);
  protected readonly background = this.store.selectSignal(selectBackground);
  protected readonly colors = BACKGROUNDS;

  protected set(color: string): void {
    this.store.dispatch(ProjectActions.setBackground({ color }));
  }
}
