import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';

export interface SearchableSelectOption {
  value: any;
  label: string;
}

@Component({
  selector: 'app-searchable-select',
  templateUrl: './searchable-select.component.html',
  styleUrls: ['./searchable-select.component.css'],
})
export class SearchableSelectComponent implements OnChanges {
  @Input() label = '';
  @Input() placeholder = 'Select…';
  @Input() options: SearchableSelectOption[] = [];
  @Input() value: any = null;
  @Input() disabled = false;
  @Input() allowAdd = true;
  @Input() addButtonLabel = 'Add';
  @Input() isAdding = false;
  @Input() emptyLabel = 'No options found';
  @Input() searchPlaceholder = 'Search…';
  @Input() optional = false;
  @Input() optionalLabel = 'None';
  /** When true, keep the order passed in `options` (e.g. latest-first). */
  @Input() preserveOptionOrder = false;
  /** Focus the search input as soon as the dropdown opens. */
  @Input() focusSearchOnOpen = false;

  @Output() valueChange = new EventEmitter<any>();
  @Output() addNew = new EventEmitter<string>();

  open = false;
  search = '';
  newName = '';
  filtered: SearchableSelectOption[] = [];
  innerValue: any = null;
  private selectedLabel = '';

  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  constructor(
    private host: ElementRef<HTMLElement>,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value']) {
      this.innerValue = this.value;
      this.syncSelectedLabel();
    }
    if (changes['options']) {
      this.refreshFiltered();
      this.syncSelectedLabel();
    }
  }

  @HostListener('document:mousedown', ['$event'])
  onDocumentMouseDown(event: MouseEvent): void {
    if (!this.open) {
      return;
    }
    const target = event.target as Node | null;
    if (target && !this.host.nativeElement.contains(target)) {
      this.closeMenu();
      this.cdr.markForCheck();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) {
      this.closeMenu();
      this.cdr.markForCheck();
    }
  }

  toggle(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.disabled) {
      return;
    }
    this.open = !this.open;
    if (this.open) {
      this.search = '';
      this.newName = '';
      this.refreshFiltered();
      if (this.focusSearchOnOpen) {
        this.focusSearchInput();
      }
    }
  }

  onSearchChange(value: string): void {
    this.search = value ?? '';
    this.refreshFiltered();
  }

  onNewNameChange(value: string): void {
    this.newName = value ?? '';
  }

  displayLabel(): string {
    if (this.optional && (this.innerValue == null || this.innerValue === '')) {
      return this.optionalLabel;
    }
    if (this.selectedLabel) {
      return this.selectedLabel;
    }
    const selected = (this.options || []).find((opt) => this.sameValue(opt.value, this.innerValue));
    return selected?.label ?? this.placeholder;
  }

  selectOption(option: SearchableSelectOption | null, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.disabled) {
      return;
    }
    this.innerValue = option?.value ?? null;
    this.selectedLabel = option?.label ?? '';
    this.valueChange.emit(this.innerValue);
    this.closeMenu();
    this.cdr.detectChanges();
  }

  submitAdd(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.canAdd() || this.isAdding || this.disabled) {
      return;
    }
    this.addNew.emit(this.resolveAddName());
  }

  canAdd(): boolean {
    if (!this.allowAdd || this.disabled) {
      return false;
    }
    const name = this.resolveAddName();
    if (!name) {
      return false;
    }
    return !(this.options || []).some(
      (opt) => String(opt.label || '').trim().toLowerCase() === name.toLowerCase()
    );
  }

  valueMatches(candidate: any): boolean {
    return this.sameValue(candidate, this.innerValue);
  }

  visibleOptions(): SearchableSelectOption[] {
    if (this.filtered.length || this.search.trim()) {
      return this.filtered;
    }
    return this.options || [];
  }

  private refreshFiltered(): void {
    const q = this.search.trim().toLowerCase();
    let list = [...(this.options || [])];
    if (q) {
      list = list.filter((opt) => String(opt.label || '').toLowerCase().includes(q));
    }
    if (!this.preserveOptionOrder) {
      list = list.sort((a, b) =>
        String(a.label || '').localeCompare(String(b.label || ''), undefined, { sensitivity: 'base' })
      );
    }
    this.filtered = list;
  }

  private syncSelectedLabel(): void {
    if (this.innerValue == null || this.innerValue === '') {
      this.selectedLabel = '';
      return;
    }
    const selected = (this.options || []).find((opt) => this.sameValue(opt.value, this.innerValue));
    this.selectedLabel = selected?.label ?? this.selectedLabel;
  }

  private resolveAddName(): string {
    const fromAdd = String(this.newName || '').trim();
    if (fromAdd) {
      return fromAdd;
    }
    return String(this.search || '').trim();
  }

  private closeMenu(): void {
    this.open = false;
    this.search = '';
    this.newName = '';
  }

  private focusSearchInput(): void {
    setTimeout(() => {
      const input = this.searchInput?.nativeElement;
      if (input) {
        input.focus();
      }
    }, 0);
  }

  private sameValue(a: any, b: any): boolean {
    if (a == null && b == null) {
      return true;
    }
    if (a == null || b == null) {
      return false;
    }
    return String(a) === String(b);
  }
}
