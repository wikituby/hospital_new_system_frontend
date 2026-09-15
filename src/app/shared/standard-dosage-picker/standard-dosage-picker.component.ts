import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  ViewChild,
} from '@angular/core';
import { ApiService, StockDosageRule } from '../../services/api.service';
import { PatientWeightVitalsService } from '../../services/patient-weight-vitals.service';
import { formatTreatmentPeriodUnit } from '../../utils/prescribing-prefill.util';
import {
  buildStandardDosageOptionsFromRules,
  formatStandardDosagePatientSummary,
  isPatientWeightMissing,
  StandardDosageContext,
  StandardDosageOption,
} from '../../utils/standard-dosage.util';

@Component({
  selector: 'app-standard-dosage-picker',
  templateUrl: './standard-dosage-picker.component.html',
  styleUrls: ['./standard-dosage-picker.component.css'],
})
export class StandardDosagePickerComponent implements OnDestroy {
  @Input() stockItemId: number | null = null;
  @Input() shopItemId: number | null = null;
  @Input() drugLabel = '';
  @Input() lastUnitValue = 1;
  @Input() unitOfMeasure = '';
  @Input() patientAgeYears: number | null = null;
  @Input() patientWeightKg: number | null = null;
  @Input() visitId: number | null = null;
  @Input() currentDoseValue: number | null = null;
  @Input() defaultRoute = 'Oral';
  @Input() defaultDoseUnit = '';
  @Input() disabled = false;

  @Output() optionApplied = new EventEmitter<StandardDosageOption>();
  @Output() patientWeightUpdated = new EventEmitter<number>();

  @ViewChild('modalOverlay') modalOverlay?: ElementRef<HTMLElement>;

  showModal = false;
  showRecordWeightModal = false;
  recordWeightValue: number | null = null;
  recordWeightSaving = false;
  recordWeightError = '';
  options: StandardDosageOption[] = [];
  message = '';
  loading = false;

  private ruleCache = new Map<string, StockDosageRule[]>();
  private bodyScrollLocked = false;
  private recordedWeightKg: number | null = null;

  constructor(
    private api: ApiService,
    private patientWeightVitals: PatientWeightVitalsService
  ) {}

  openModal(): void {
    const source = this.activeDosageSource();
    if (!source) {
      this.message = 'Select a drug first to see standard dosage options.';
      this.options = [];
      this.showModal = true;
      this.scheduleOverlayAttach();
      return;
    }

    this.showModal = true;
    this.options = [];
    this.message = 'Loading standard dosage rules...';
    this.scheduleOverlayAttach();
    this.loadOptions(source);
  }

  closeModal(): void {
    this.showModal = false;
    this.unlockBodyScroll();
  }

  applyOption(option: StandardDosageOption): void {
    this.optionApplied.emit(option);
    this.closeModal();
  }

  patientSummary(): string {
    return formatStandardDosagePatientSummary(this.buildContext());
  }

  showRecordWeightButton(): boolean {
    return isPatientWeightMissing(this.buildContext()) && this.canRecordWeight();
  }

  canRecordWeight(): boolean {
    const visitId = Number(this.visitId);
    return Number.isFinite(visitId) && visitId > 0;
  }

  openRecordWeightDialog(): void {
    if (!this.canRecordWeight()) {
      return;
    }
    this.recordWeightValue = this.patientWeightKg != null && this.patientWeightKg > 0
      ? this.patientWeightKg
      : null;
    this.recordWeightError = '';
    this.showRecordWeightModal = true;
  }

  closeRecordWeightDialog(): void {
    if (this.recordWeightSaving) {
      return;
    }
    this.showRecordWeightModal = false;
    this.recordWeightError = '';
  }

  saveRecordedWeight(): void {
    const visitId = Number(this.visitId);
    const weight = Number(this.recordWeightValue);
    if (!Number.isFinite(visitId) || visitId <= 0) {
      this.recordWeightError = 'Visit is required to save weight.';
      return;
    }
    if (!Number.isFinite(weight) || weight <= 0) {
      this.recordWeightError = 'Enter a valid weight in kg.';
      return;
    }

    this.recordWeightSaving = true;
    this.recordWeightError = '';
    this.patientWeightVitals.saveWeightForVisit(visitId, weight).subscribe({
      next: (savedWeight) => {
        this.recordWeightSaving = false;
        this.showRecordWeightModal = false;
        this.recordedWeightKg = savedWeight;
        this.patientWeightUpdated.emit(savedWeight);
        this.reloadOptionsAfterWeightSaved();
      },
      error: () => {
        this.recordWeightSaving = false;
        this.recordWeightError = 'Could not save weight. Try again.';
      },
    });
  }

  formatPeriodUnit(unit: unknown): string {
    return formatTreatmentPeriodUnit(unit);
  }

  ngOnDestroy(): void {
    this.unlockBodyScroll();
  }

  private scheduleOverlayAttach(): void {
    setTimeout(() => this.attachOverlayToBody(), 0);
  }

  private attachOverlayToBody(): void {
    const overlay = this.modalOverlay?.nativeElement;
    if (!overlay || overlay.parentElement === document.body) {
      return;
    }

    document.body.appendChild(overlay);
    if (!this.bodyScrollLocked) {
      document.body.style.overflow = 'hidden';
      this.bodyScrollLocked = true;
    }
  }

  private unlockBodyScroll(): void {
    if (!this.bodyScrollLocked) {
      return;
    }
    document.body.style.overflow = '';
    this.bodyScrollLocked = false;
  }

  private activeDosageSource(): { kind: 'shop' | 'stock'; id: number } | null {
    const shopItemId = Number(this.shopItemId);
    if (Number.isFinite(shopItemId) && shopItemId > 0) {
      return { kind: 'shop', id: shopItemId };
    }
    const stockItemId = Number(this.stockItemId);
    if (Number.isFinite(stockItemId) && stockItemId > 0) {
      return { kind: 'stock', id: stockItemId };
    }
    return null;
  }

  private cacheKey(source: { kind: string; id: number }): string {
    return `${source.kind}:${source.id}`;
  }

  private loadOptions(source: { kind: 'shop' | 'stock'; id: number }): void {
    const key = this.cacheKey(source);
    const cached = this.ruleCache.get(key);
    if (cached) {
      this.applyRules(cached);
      return;
    }

    this.loading = true;
    const req = source.kind === 'shop'
      ? this.api.getShopItemDosageRules(source.id)
      : this.api.getStockItemDosageRules(source.id);
    req.subscribe({
      next: (rules) => {
        const activeRules = Array.isArray(rules) ? rules : [];
        this.ruleCache.set(key, activeRules);
        this.applyRules(activeRules);
        this.loading = false;
      },
      error: () => {
        this.options = buildStandardDosageOptionsFromRules([], this.buildContext());
        this.message = this.options.length
          ? ''
          : 'No standard dosage preset has been prepared for this drug yet. Use the manual fields for now.';
        this.loading = false;
      },
    });
  }

  private applyRules(rules: StockDosageRule[]): void {
    this.options = buildStandardDosageOptionsFromRules(rules, this.buildContext());
    this.message = this.options.length
      ? ''
      : 'No standard dosage preset has been prepared for this drug yet. Use the manual fields for now.';
  }

  private buildContext(): StandardDosageContext {
    return {
      drugName: this.drugLabel,
      lastUnitValue: Number(this.lastUnitValue) || 1,
      unitOfMeasure: this.unitOfMeasure,
      patientAgeYears: this.patientAgeYears,
      patientWeightKg: this.recordedWeightKg ?? this.patientWeightKg,
      currentDoseValue: this.currentDoseValue,
      defaultRoute: this.defaultRoute,
      defaultDoseUnit: this.defaultDoseUnit,
    };
  }

  private reloadOptionsAfterWeightSaved(): void {
    const source = this.activeDosageSource();
    if (!source) {
      return;
    }
    const cached = this.ruleCache.get(this.cacheKey(source));
    if (cached) {
      this.applyRules(cached);
      return;
    }
    this.loadOptions(source);
  }
}
