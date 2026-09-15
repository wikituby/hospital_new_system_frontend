import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-pd-dsp-adm',
  templateUrl: './pd-dsp-adm-cell.component.html',
  styleUrls: ['./pd-dsp-adm-cell.component.css'],
})
export class PdDspAdmCellComponent {
  @Input() item: any;
  @Input() disabled = false;
  @Input() inputIdPrefix = 'pd-dsp-adm';
  /** When `dispensed-only`, hide PD and ADM checkboxes. */
  @Input() mode: 'full' | 'dispensed-only' = 'full';
  /** DSP is set only by pharmacy dispense / reverse — not manually. */
  @Input() dispensedReadonly = false;
  /** ADM is set only by treatment chart completion / takeaway — not manually. */
  @Input() administeredReadonly = false;
  @Output() paidChange = new EventEmitter<boolean>();
  @Output() dispensedChange = new EventEmitter<boolean>();
  @Output() administeredChange = new EventEmitter<boolean>();

  get showPaid(): boolean {
    return this.mode === 'full';
  }

  get showAdministered(): boolean {
    return this.mode === 'full';
  }

  get paid(): boolean {
    return this.item?.paid !== false;
  }

  get dispensed(): boolean {
    return this.item?.dispensed === true;
  }

  get administered(): boolean {
    return this.item?.administered === true;
  }

  get dispensedDisabled(): boolean {
    return this.disabled || this.dispensedReadonly;
  }

  get administeredDisabled(): boolean {
    return this.disabled || this.administeredReadonly;
  }

  onPaid(event: Event): void {
    this.paidChange.emit((event.target as HTMLInputElement).checked);
  }

  onDispensed(event: Event): void {
    if (this.dispensedReadonly) {
      event.preventDefault();
      (event.target as HTMLInputElement).checked = this.dispensed;
      return;
    }
    this.dispensedChange.emit((event.target as HTMLInputElement).checked);
  }

  onAdministered(event: Event): void {
    if (this.administeredReadonly) {
      event.preventDefault();
      (event.target as HTMLInputElement).checked = this.administered;
      return;
    }
    this.administeredChange.emit((event.target as HTMLInputElement).checked);
  }
}
