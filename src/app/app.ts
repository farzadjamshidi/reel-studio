import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Editor } from './editor/editor/editor';

@Component({
  selector: 'app-root',
  imports: [Editor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
})
export class App {}
