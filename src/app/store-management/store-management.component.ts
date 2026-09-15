import { Component, OnDestroy, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ThemeService } from '../services/theme.service';
import { defaultContactValue } from '../utils/phone-contact.util';

@Component({
  selector: 'app-store-management',
  templateUrl: './store-management.component.html',
  styleUrls: ['./store-management.component.css']
})
export class StoreManagementComponent implements OnInit, OnDestroy {
  showForm = false;
  isEditing = false;
  saveButtonLabel = 'Save Store';
  searchText = '';
  isDarkMode = false;
  private themeSub?: Subscription;

  stores: any[] = [];
  currentStore: any = {
    id: null,
    name: '',
    code: '',
    location: '',
    manager: '',
    phone: defaultContactValue(),
    status: 'Active'
  };

  constructor(private themeService: ThemeService) {}

  ngOnInit(): void {
    this.themeSub = this.themeService.isDarkMode$.subscribe((isDark) => {
      this.isDarkMode = isDark;
    });
  }

  ngOnDestroy(): void {
    this.themeSub?.unsubscribe();
  }

  openAddStoreForm(): void {
    this.isEditing = false;
    this.saveButtonLabel = 'Save Store';
    this.currentStore = {
      id: null,
      name: '',
      code: '',
      location: '',
      manager: '',
      phone: defaultContactValue(),
      status: 'Active'
    };
    this.showForm = true;
  }

  openEditStoreForm(store: any): void {
    this.isEditing = true;
    this.saveButtonLabel = 'Update Store';
    this.currentStore = { ...store };
    this.showForm = true;
  }

  cancelForm(form?: NgForm): void {
    if (form) {
      form.resetForm();
    }
    this.showForm = false;
    this.isEditing = false;
  }

  saveStore(form: NgForm): void {
    if (!form.valid) {
      return;
    }

    if (this.isEditing) {
      const idx = this.stores.findIndex((s) => s.id === this.currentStore.id);
      if (idx > -1) {
        this.stores[idx] = { ...this.currentStore };
      }
    } else {
      const nextId = this.stores.length
        ? Math.max(...this.stores.map((s) => s.id || 0)) + 1
        : 1;
      this.stores.unshift({ ...this.currentStore, id: nextId });
    }

    form.resetForm();
    this.showForm = false;
    this.isEditing = false;
  }

  deleteStore(store: any): void {
    if (!confirm(`Delete store "${store.name}"?`)) {
      return;
    }
    this.stores = this.stores.filter((s) => s.id !== store.id);
  }

  get filteredStores(): any[] {
    const query = (this.searchText || '').toLowerCase().trim();
    if (!query) {
      return this.stores;
    }
    return this.stores.filter((s) =>
      (s.name || '').toLowerCase().includes(query) ||
      (s.code || '').toLowerCase().includes(query) ||
      (s.location || '').toLowerCase().includes(query) ||
      (s.manager || '').toLowerCase().includes(query) ||
      (s.phone || '').toLowerCase().includes(query) ||
      (s.status || '').toLowerCase().includes(query)
    );
  }
}
