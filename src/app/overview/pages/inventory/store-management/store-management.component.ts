import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import { ApiService } from '../../../../services/api.service';
import { ThemeService } from '../../../../services/theme.service';
import { Router } from '@angular/router';
import { NgForm } from '@angular/forms';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

@Component({
  selector: 'app-store-management',
  templateUrl: './store-management.component.html',
  styleUrls: ['./store-management.component.css']
})
export class StoreManagementComponent implements OnInit {

  // Table data properties
  storeList: any[] = [];
  data: any[] = [];
  page: number = 1;
  itemsPerPage: number = 15;
  searchQuery: string = '';
  selectedColumn: string = 'all';
  
  // Loading and response properties
  isLoadingService: boolean = false;
  responseColor = "";
  responseMessage = "";
  showDivUpdatedOut: boolean = false;
  
  // User permissions
  mdUser: boolean = false;
  deleter: boolean = false;
  
  // UI state properties
  isCollapsed = true;
  iconChange: string = "bi bi-chevron-down";
  eyeIcon: string = "bi bi-funnel";
  eyeIconDrop: string = "bi bi-chevron-down";
  isText: boolean = true;
  isDarkMode: boolean = false;
  
  // Form properties
  currentStore: any = {};
  saveButtonStatus: string = "Add New Store";
  isButtonDisabled: boolean = false;
  showDivAddToDataBaseNewStore: boolean = false;
  showDivUpdatedLoaderNewStore: boolean = false;
  isCollapsedNewStore: boolean = true;
  
  // Editing properties
  isEditingStore: boolean = false;
  editingStoreId: number | null = null;
  
  // Delete confirmation modal properties
  showDeleteConfirmModal: boolean = false;
  storeToDelete: any = null;
  
  // ViewChild references
  @ViewChild('htmlData') htmlData!: ElementRef;

  constructor(
    private router: Router,
    private api: ApiService,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    const userRole = sessionStorage.getItem('userrole');
    const username = sessionStorage.getItem('username');

    // Subscribe to theme changes for real-time updates
    this.themeService.isDarkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
    });

    if (userRole === "md") {
      this.mdUser = true;
    }

    if (username === null) {
      this.router.navigate(['/login']);
    } else {
      if (userRole === "CUSTOMER") {
        this.router.navigate(['/products']);
      }
    }
    
    this.initializeTableData();
  }

  initializeTableData() {
    this.isLoadingService = true;
    this.api.getAllStores().subscribe({
      next: (res) => {
        this.isLoadingService = false;
        console.log("Raw stores response:", res);
        
        // Ensure we have an array
        if (Array.isArray(res)) {
          this.storeList = res;
          this.data = res;
        } else if (res && Array.isArray(res.data)) {
          this.storeList = res.data;
          this.data = res.data;
        } else {
          console.warn("Unexpected stores response structure:", res);
          this.storeList = [];
          this.data = [];
        }
      },
      error: (err) => {
        this.isLoadingService = false;
        console.error("Error loading stores:", err);
        this.storeList = [];
        this.data = [];
      }
    });
  }

  get filteredStoreList() {
    if (!this.searchQuery.trim()) {
      return this.storeList;
    }

    const query = this.searchQuery.toLowerCase().trim();
    
    if (this.selectedColumn === 'all') {
      return this.storeList.filter(store => {
        const isDefault = (store.defaultStatus === 'true' || store.defaultStatus === true);
        const defaultStatusText = isDefault ? 'default' : 'not default';
        return (store.name && store.name.toLowerCase().includes(query)) ||
               (store.location && store.location.toLowerCase().includes(query)) ||
               (store.description && store.description.toLowerCase().includes(query)) ||
               defaultStatusText.includes(query);
      });
    } else if (this.selectedColumn === 'defaultStatus') {
      return this.storeList.filter(store => {
        const isDefault = (store.defaultStatus === 'true' || store.defaultStatus === true);
        const defaultStatusText = isDefault ? 'default' : 'not default';
        return defaultStatusText.includes(query);
      });
    } else {
      return this.storeList.filter(store => {
        const value = store[this.selectedColumn];
        return value && value.toString().toLowerCase().includes(query);
      });
    }
  }

  // Export methods
  exportToExcel() {
    const dataToExport = this.filteredStoreList.map((store, index) => ({
      'SN': index + 1,
      'Store Name': store.name || 'N/A',
      'Location': store.location || 'N/A',
      'Description': store.description || 'N/A',
      'Default Status': (store.defaultStatus === 'true' || store.defaultStatus === true) ? 'Default' : 'Not Default',
      'Creation Date': store.creationDate || 'N/A'
    }));

    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(dataToExport);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stores');
    XLSX.writeFile(wb, 'stores.xlsx');
  }

  downloadPdf() {
    const data = this.htmlData.nativeElement;
    html2canvas(data).then(canvas => {
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 208;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      pdf.save('stores.pdf');
    });
  }

  // Store modal methods
  openStoreModal() {
    this.clearFormNewStore();
    this.isCollapsedNewStore = false;
    document.body.style.overflow = 'hidden';
  }

  clearFormNewStore() {
    this.currentStore = {
      name: '',
      location: '',
      description: '',
      defaultStatus: false
    };
    this.saveButtonStatus = "Add New Store";
    this.showDivAddToDataBaseNewStore = false;
    this.showDivUpdatedLoaderNewStore = false;
    this.isButtonDisabled = false;
    this.isEditingStore = false;
    this.editingStoreId = null;
  }

  closeStoreModal() {
    this.isCollapsedNewStore = true;
    document.body.style.overflow = '';
    this.clearFormNewStore();
  }

  editStore(store: any) {
    if (!store || !store.id) {
      console.error('Invalid store data for editing');
      return;
    }

    this.isEditingStore = true;
    this.editingStoreId = store.id;
    this.currentStore = {
      name: store.name || '',
      location: store.location || '',
      description: store.description || '',
      defaultStatus: store.defaultStatus === 'true' || store.defaultStatus === true
    };
    this.saveButtonStatus = "Update Store";
    this.showDivAddToDataBaseNewStore = false;
    this.showDivUpdatedLoaderNewStore = false;
    this.isButtonDisabled = false;
    this.isCollapsedNewStore = false;
    document.body.style.overflow = 'hidden';
  }

  deleteStore(store: any) {
    if (!store || !store.id) {
      console.error('Invalid store data for deletion');
      return;
    }

    this.storeToDelete = store;
    this.showDeleteConfirmModal = true;
    document.body.style.overflow = 'hidden';
  }

  confirmDelete() {
    if (!this.storeToDelete || !this.storeToDelete.id) {
      this.closeDeleteConfirmModal();
      return;
    }

    this.isButtonDisabled = true;
    this.showDivUpdatedLoaderNewStore = true;
    this.showDivAddToDataBaseNewStore = false;
    this.showDeleteConfirmModal = false;

    this.api.deleteStore(this.storeToDelete.id).subscribe({
      next: (res: any) => {
        this.showDivUpdatedLoaderNewStore = false;
        this.isButtonDisabled = false;
        this.responseColor = 'rgb(11, 155, 112)';
        this.responseMessage = res?.message || "Store deleted successfully!";
        this.showDivAddToDataBaseNewStore = true;

        setTimeout(() => {
          this.initializeTableData();
          this.showDivAddToDataBaseNewStore = false;
          this.closeDeleteConfirmModal();
        }, 1000);
      },
      error: (err) => {
        this.showDivUpdatedLoaderNewStore = false;
        this.isButtonDisabled = false;
        this.responseColor = 'rgb(238, 16, 16)';
        this.responseMessage = err.error?.message || "Error deleting store. Please try again.";
        this.showDivAddToDataBaseNewStore = true;
        console.error("Error deleting store: ", err);
        
        setTimeout(() => {
          this.showDivAddToDataBaseNewStore = false;
        }, 4000);
        this.closeDeleteConfirmModal();
      }
    });
  }

  closeDeleteConfirmModal() {
    this.showDeleteConfirmModal = false;
    this.storeToDelete = null;
    this.isButtonDisabled = false;
    document.body.style.overflow = '';
  }

  saveStore(data: any) {
    this.showDivUpdatedLoaderNewStore = true;
    this.isButtonDisabled = true;
    this.showDivAddToDataBaseNewStore = false;

    // Ensure defaultStatus is always a boolean
    const storeData = {
      name: data.name || '',
      location: data.location || '',
      description: data.description || '',
      defaultStatus: data.defaultStatus === true || data.defaultStatus === 'true'
    };

    console.log("Store data to save:", storeData);

    if (this.isEditingStore && this.editingStoreId) {
      // Update existing store
      this.api.updateStore(this.editingStoreId, storeData).subscribe({
        next: (response) => {
          console.log("Store updated successfully:", response);

          this.showDivUpdatedLoaderNewStore = false;
          
          if (response && response.message) {
            this.responseColor = "rgb(11, 155, 112)";
            this.responseMessage = response.message;
          } else {
            this.responseColor = "rgb(11, 155, 112)";
            this.responseMessage = "Store updated successfully!";
          }

          this.showDivAddToDataBaseNewStore = true;
          
          this.initializeTableData();

          setTimeout(() => {
            this.showDivAddToDataBaseNewStore = false;
            this.closeStoreModal();
            this.isButtonDisabled = false;
          }, 2500);
        },
        error: (error) => {
          console.error("Error updating store:", error);
          console.error("Error details:", JSON.stringify(error, null, 2));
          console.error("Store data that was sent:", storeData);
          
          this.showDivUpdatedLoaderNewStore = false;
          let errorMessage = "An unexpected error occurred. Please try again.";
          
          if (error.error) {
            if (error.error.message) {
              errorMessage = error.error.message;
            } else if (typeof error.error === 'string') {
              errorMessage = error.error;
            } else if (error.error.error) {
              errorMessage = error.error.error;
            }
          } else if (error.message) {
            errorMessage = error.message;
          }
          
          this.responseMessage = errorMessage;
          this.responseColor = "rgb(238, 16, 16)";
          this.showDivAddToDataBaseNewStore = true;
          this.isButtonDisabled = false;

          setTimeout(() => {
            this.showDivAddToDataBaseNewStore = false;
          }, 4000);
        }
      });
    } else {
      // Create new store
      this.api.createStore(storeData).subscribe({
        next: (response) => {
          console.log("Store saved successfully:", response);

          this.showDivUpdatedLoaderNewStore = false;
          
          if (response && response.message) {
            this.responseColor = "rgb(11, 155, 112)";
            this.responseMessage = response.message;
          } else {
            this.responseColor = "rgb(11, 155, 112)";
            this.responseMessage = "Store added successfully!";
          }

          this.showDivAddToDataBaseNewStore = true;
          
          this.initializeTableData();

          setTimeout(() => {
            this.showDivAddToDataBaseNewStore = false;
            this.closeStoreModal();
            this.isButtonDisabled = false;
          }, 2500);
        },
        error: (error) => {
          console.error("Error saving store:", error);
          console.error("Error details:", JSON.stringify(error, null, 2));
          console.error("Store data that was sent:", storeData);
          
          this.showDivUpdatedLoaderNewStore = false;
          let errorMessage = "An unexpected error occurred. Please try again.";
          
          if (error.error) {
            if (error.error.message) {
              errorMessage = error.error.message;
            } else if (typeof error.error === 'string') {
              errorMessage = error.error;
            } else if (error.error.error) {
              errorMessage = error.error.error;
            }
          } else if (error.message) {
            errorMessage = error.message;
          }
          
          this.responseMessage = errorMessage;
          this.responseColor = "rgb(238, 16, 16)";
          this.showDivAddToDataBaseNewStore = true;
          this.isButtonDisabled = false;

          setTimeout(() => {
            this.showDivAddToDataBaseNewStore = false;
          }, 4000);
        }
      });
    }
  }
}
