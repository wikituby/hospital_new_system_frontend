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
  /** Show PSD (prescribed) ahead of PD. */
  @Input() showPrescribed = false;
  /** DSP is set only by pharmacy dispense / reverse — not manually. */
  @Input() dispensedReadonly = false;
  /** ADM is set only by treatment chart completion / takeaway — not manually. */
  @Input() administeredReadonly = false;
  /** PD is checked only when this line's payment has been received. */
  @Input() paidReadonly = false;
  @Output() prescribedChange = new EventEmitter<boolean>();
  @Output() paidChange = new EventEmitter<boolean>();
  @Output() dispensedChange = new EventEmitter<boolean>();
  @Output() administeredChange = new EventEmitter<boolean>();

  get prescribed(): boolean {
    return this.item?.prescribed !== false;
  }

  get showPaid(): boolean {
    return this.mode === 'full';
  }

  get showAdministered(): boolean {
    return this.mode === 'full';
  }

  get paid(): boolean {
    if (this.paidReadonly) {
      return this.linePaymentReceived(this.item);
    }
    return this.item?.paid !== false;
  }

  get paidDisabled(): boolean {
    return this.disabled || this.paidReadonly;
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

  onPrescribed(event: Event): void {
    this.prescribedChange.emit((event.target as HTMLInputElement).checked);
  }

  onPaid(event: Event): void {
    if (this.paidReadonly) {
      event.preventDefault();
      (event.target as HTMLInputElement).checked = this.paid;
      return;
    }
    this.paidChange.emit((event.target as HTMLInputElement).checked);
  }

  /** Checked when money received covers this line. */
  private linePaymentReceived(item: any): boolean {
    const total = Number(item?.totalAmount ?? 0);
    const received = Number(item?.amountPaid ?? 0);
    if (!Number.isFinite(total) || total <= 0) {
      return false;
    }
    return Number.isFinite(received) && received + 0.009 >= total;
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
