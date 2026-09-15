import { Component, Input } from '@angular/core';

export type HmsLoadingMode = 'page' | 'inline' | 'button';
export type HmsLoadingSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-hms-loading',
  templateUrl: './hms-loading.component.html',
  styleUrls: ['./hms-loading.component.css']
})
export class HmsLoadingComponent {
  @Input() mode: HmsLoadingMode = 'inline';
  @Input() size: HmsLoadingSize = 'md';
  @Input() label = 'Loading...';
  @Input() visible = true;
  @Input() inlineVariant: 'default' | 'table' = 'default';
}
