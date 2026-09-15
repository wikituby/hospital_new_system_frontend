import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService, StockDosageRule, StockDosageRulePayload } from '../../services/api.service';

interface ShopDosageRuleRow {
  id?: number | null;
  title: string;
  matchLabel: string;
  ruleLabel: string;
  doseCalculationType: string;
  fixedDoseValue: number | null;
  fixedDoseUnit: string;
  weightDoseValue: number | null;
  weightDoseUnit: string;
  maxDoseValue: number | null;
  maxDoseUnit: string;
  minAgeYears: number | null;
  maxAgeYears: number | null;
  minWeightKg: number | null;
  maxWeightKg: number | null;
  route: string;
  frequencyValue: number | null;
  frequencyUnit: number;
  durationValue: number | null;
  durationUnit: number;
  instructions: string;
  warning: string;
  active: boolean;
  sortOrder: number | null;
  expanded: boolean;
}

@Component({
  selector: 'app-shop-item-dosage-rules-editor',
  templateUrl: './shop-item-dosage-rules-editor.component.html',
  styleUrls: ['./shop-item-dosage-rules-editor.component.css'],
})
export class ShopItemDosageRulesEditorComponent implements OnChanges {
  @Input() itemId: number | null = null;

  rows: ShopDosageRuleRow[] = [];
  loading = false;
  saving = false;
  message = '';
  deletedIds: number[] = [];

  calculationTypes = [
    { value: 'FIXED', label: 'Fixed dose' },
    { value: 'WEIGHT_PER_DOSE', label: 'Weight per dose' },
    { value: 'WEIGHT_PER_DAY', label: 'Weight per day' },
  ];
  periodUnits = [
    { value: 1 / 1440, label: 'Minute(s)' },
    { value: 1 / 24, label: 'Hour(s)' },
    { value: 1, label: 'Day' },
    { value: 7, label: 'Week' },
    { value: 30, label: 'Month' },
  ];

  constructor(private api: ApiService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['itemId']) {
      this.loadRules();
    }
  }

  addRow(): void {
    this.rows = [
      ...this.rows,
      {
        title: '',
        matchLabel: '',
        ruleLabel: '',
        doseCalculationType: 'FIXED',
        fixedDoseValue: null,
        fixedDoseUnit: 'mg',
        weightDoseValue: null,
        weightDoseUnit: 'mg/kg',
        maxDoseValue: null,
        maxDoseUnit: '',
        minAgeYears: null,
        maxAgeYears: null,
        minWeightKg: null,
        maxWeightKg: null,
        route: 'Oral',
        frequencyValue: 1,
        frequencyUnit: 1,
        durationValue: 3,
        durationUnit: 1,
        instructions: '',
        warning: '',
        active: true,
        sortOrder: this.rows.length + 1,
        expanded: true,
      },
    ];
  }

  toggleRow(index: number): void {
    this.rows = this.rows.map((row, i) => ({
      ...row,
      expanded: i === index ? !row.expanded : row.expanded,
    }));
  }

  removeRow(index: number): void {
    const row = this.rows[index];
    const id = Number(row?.id);
    if (Number.isFinite(id) && id > 0) {
      this.deletedIds.push(id);
    }
    this.rows = this.rows.filter((_, i) => i !== index);
  }

  async saveRules(): Promise<void> {
    const itemId = Number(this.itemId);
    if (!Number.isFinite(itemId) || itemId <= 0) {
      this.message = 'Save the item first, then add standard dosages.';
      return;
    }
    this.saving = true;
    this.message = '';
    try {
      for (const ruleId of this.deletedIds) {
        await firstValueFrom(this.api.deleteShopItemDosageRule(ruleId));
      }
      this.deletedIds = [];

      for (let i = 0; i < this.rows.length; i++) {
        const payload = this.toPayload(this.rows[i], i);
        if (!payload) {
          continue;
        }
        const id = Number(this.rows[i].id);
        if (Number.isFinite(id) && id > 0) {
          const res: any = await firstValueFrom(this.api.updateShopItemDosageRule(id, payload));
          const saved = res?.data;
          if (saved?.id) {
            this.rows[i] = { ...this.rows[i], id: saved.id, expanded: this.rows[i].expanded };
          }
        } else {
          const res: any = await firstValueFrom(this.api.createShopItemDosageRule(itemId, payload));
          const saved = res?.data;
          if (saved?.id) {
            this.rows[i] = { ...this.rows[i], id: saved.id, expanded: this.rows[i].expanded };
          }
        }
      }
      this.message = 'Standard dosages saved.';
    } catch {
      this.message = 'Could not save standard dosages. Try again.';
    } finally {
      this.saving = false;
    }
  }

  periodLabel(value: number | null | undefined): string {
    const unit = this.periodUnits.find((u) => Math.abs(Number(u.value) - Number(value)) < 0.000001);
    return unit?.label || 'Day';
  }

  private loadRules(): void {
    const itemId = Number(this.itemId);
    this.rows = [];
    this.deletedIds = [];
    this.message = '';
    if (!Number.isFinite(itemId) || itemId <= 0) {
      return;
    }
    this.loading = true;
    this.api.getShopItemDosageRules(itemId, false).subscribe({
      next: (rules) => {
        this.rows = (Array.isArray(rules) ? rules : []).map((rule) => this.fromApi(rule));
        this.loading = false;
      },
      error: () => {
        this.rows = [];
        this.loading = false;
      },
    });
  }

  private fromApi(rule: StockDosageRule): ShopDosageRuleRow {
    return {
      id: rule.id,
      title: rule.title || '',
      matchLabel: rule.matchLabel || '',
      ruleLabel: rule.ruleLabel || '',
      doseCalculationType: rule.doseCalculationType || 'FIXED',
      fixedDoseValue: this.num(rule.fixedDoseValue),
      fixedDoseUnit: rule.fixedDoseUnit || 'mg',
      weightDoseValue: this.num(rule.weightDoseValue),
      weightDoseUnit: rule.weightDoseUnit || 'mg/kg',
      maxDoseValue: this.num(rule.maxDoseValue),
      maxDoseUnit: rule.maxDoseUnit || '',
      minAgeYears: this.num(rule.minAgeYears),
      maxAgeYears: this.num(rule.maxAgeYears),
      minWeightKg: this.num(rule.minWeightKg),
      maxWeightKg: this.num(rule.maxWeightKg),
      route: rule.route || '',
      frequencyValue: this.num(rule.frequencyValue) ?? 1,
      frequencyUnit: this.num(rule.frequencyUnit) ?? 1,
      durationValue: this.num(rule.durationValue) ?? 3,
      durationUnit: this.num(rule.durationUnit) ?? 1,
      instructions: rule.instructions || '',
      warning: rule.warning || '',
      active: rule.active !== false,
      sortOrder: this.num(rule.sortOrder),
      expanded: false,
    };
  }

  private toPayload(row: ShopDosageRuleRow, index: number): StockDosageRulePayload | null {
    const title = String(row.title || '').trim();
    if (!title) {
      return null;
    }
    const type = row.doseCalculationType || 'FIXED';
    return {
      title,
      matchLabel: this.blank(row.matchLabel),
      ruleLabel: this.blank(row.ruleLabel),
      doseCalculationType: type,
      fixedDoseValue: type === 'FIXED' ? row.fixedDoseValue : null,
      fixedDoseUnit: type === 'FIXED' ? this.blank(row.fixedDoseUnit) : null,
      weightDoseValue: type !== 'FIXED' ? row.weightDoseValue : null,
      weightDoseUnit: type !== 'FIXED' ? this.blank(row.weightDoseUnit) : null,
      maxDoseValue: row.maxDoseValue,
      maxDoseUnit: this.blank(row.maxDoseUnit),
      minAgeYears: row.minAgeYears,
      maxAgeYears: row.maxAgeYears,
      minWeightKg: row.minWeightKg,
      maxWeightKg: row.maxWeightKg,
      route: this.blank(row.route),
      frequencyValue: row.frequencyValue,
      frequencyUnit: row.frequencyUnit,
      durationValue: row.durationValue,
      durationUnit: row.durationUnit,
      instructions: this.blank(row.instructions),
      warning: this.blank(row.warning),
      active: row.active !== false,
      sortOrder: row.sortOrder || index + 1,
    };
  }

  private num(value: unknown): number | null {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  private blank(value: string | null | undefined): string | null {
    const text = String(value ?? '').trim();
    return text ? text : null;
  }
}
