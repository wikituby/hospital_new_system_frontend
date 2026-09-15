import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import { ApiService } from '../../../../services/api.service';
import { ThemeService } from '../../../../services/theme.service';
import { Router } from '@angular/router';
import { NgForm } from '@angular/forms';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

@Component({
  selector: 'app-asset-management',
  templateUrl: './asset-management.component.html',
  styleUrls: ['./asset-management.component.css']
})
export class AssetManagementComponent implements OnInit {

  // Table data properties
  assetList: any[] = [];
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
  currentAsset: any = {};
  saveButtonStatus: string = "Add New Asset";
  isButtonDisabled: boolean = false;
  showDivAddToDataBaseNewAsset: boolean = false;
  showDivUpdatedLoaderNewAsset: boolean = false;
  isCollapsedNewAsset: boolean = true;
  
  // Editing properties
  isEditingAsset: boolean = false;
  editingAssetId: number | null = null;
  
  // Delete confirmation modal properties
  showDeleteConfirmModal: boolean = false;
  assetToDelete: any = null;
  
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
    this.api.getAllAssets().subscribe({
      next: (res) => {
        this.isLoadingService = false;
        console.log("Raw assets response:", res);
        
        // Ensure we have an array
        if (Array.isArray(res)) {
          this.assetList = res;
          this.data = res;
        } else if (res && Array.isArray(res.data)) {
          this.assetList = res.data;
          this.data = res.data;
        } else {
          console.warn("Unexpected assets response structure:", res);
          this.assetList = [];
          this.data = [];
        }
        
        console.log("Assets loaded:", this.assetList);
        this.page = 1;
      },
      error: (err) => {
        this.isLoadingService = false;
        console.error("Error loading assets:", err);
        this.assetList = [];
        this.data = [];
        this.responseColor = "#dc2626";
        const errorMsg = err.error?.message || err.message || "Error loading assets. Please try again.";
        this.responseMessage = `Error: ${errorMsg}`;
        this.showDivUpdatedOut = true;
        setTimeout(() => {
          this.showDivUpdatedOut = false;
        }, 5000);
      }
    });
  }

  get filteredAssetList() {
    if (!this.searchQuery.trim()) {
      return this.assetList;
    }

    const query = this.searchQuery.toLowerCase().trim();
    
    if (this.selectedColumn === 'all') {
      return this.assetList.filter(asset => {
        const title = asset.title || asset.name || '';
        return (title && title.toLowerCase().includes(query)) ||
               (asset.description && asset.description.toLowerCase().includes(query)) ||
               (asset.serialNumber && asset.serialNumber.toLowerCase().includes(query));
      });
    } else {
      return this.assetList.filter(asset => {
        const value = asset[this.selectedColumn];
        return value && value.toString().toLowerCase().includes(query);
      });
    }
  }

  get totalItemsCount(): number {
    return this.filteredAssetList.length;
  }

  get activeAssetsCount(): number {
    return this.assetList.length;
  }

  // Export methods
  exportToExcel() {
    const dataToExport = this.filteredAssetList.map((asset, index) => ({
      'SN': index + 1,
      'Title': asset.title || asset.name || 'N/A',
      'Depreciation Rate (%)': asset.depreciationRate || 'N/A',
      'Useful Life (Months)': asset.usefulLifeMonths || 'N/A',
      'Acquisition Date': asset.acquisitionDate || asset.purchaseDate || 'N/A',
      'Serial Number': asset.serialNumber || 'N/A',
      'Description': asset.description || 'N/A'
    }));

    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(dataToExport);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Assets');
    XLSX.writeFile(wb, 'assets.xlsx');
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
      pdf.save('assets.pdf');
    });
  }

  // Asset modal methods
  openAssetModal() {
    this.clearFormNewAsset();
    this.isCollapsedNewAsset = false;
    document.body.style.overflow = 'hidden';
  }

  clearFormNewAsset() {
    this.currentAsset = {
      title: '',
      depreciationRate: null,
      usefulLifeMonths: null,
      acquisitionDate: '',
      serialNumber: '',
      description: ''
    };
    this.saveButtonStatus = "Add New Asset";
    this.showDivAddToDataBaseNewAsset = false;
    this.showDivUpdatedLoaderNewAsset = false;
    this.isButtonDisabled = false;
    this.isEditingAsset = false;
    this.editingAssetId = null;
  }

  closeAssetModal() {
    this.isCollapsedNewAsset = true;
    document.body.style.overflow = '';
    this.clearFormNewAsset();
  }

  editAsset(asset: any) {
    if (!asset || !asset.id) {
      console.error('Invalid asset data for editing');
      return;
    }

    this.isEditingAsset = true;
    this.editingAssetId = asset.id;
    this.currentAsset = {
      title: asset.title || asset.name || '',
      depreciationRate: asset.depreciationRate || null,
      usefulLifeMonths: asset.usefulLifeMonths || null,
      acquisitionDate: asset.acquisitionDate || asset.purchaseDate || '',
      serialNumber: asset.serialNumber || '',
      description: asset.description || ''
    };
    this.saveButtonStatus = "Update Asset";
    this.showDivAddToDataBaseNewAsset = false;
    this.showDivUpdatedLoaderNewAsset = false;
    this.isButtonDisabled = false;
    this.isCollapsedNewAsset = false;
    document.body.style.overflow = 'hidden';
  }

  deleteAsset(asset: any) {
    if (!asset || !asset.id) {
      console.error('Invalid asset data for deletion');
      return;
    }

    this.assetToDelete = asset;
    this.showDeleteConfirmModal = true;
    document.body.style.overflow = 'hidden';
  }

  confirmDelete() {
    if (!this.assetToDelete || !this.assetToDelete.id) {
      this.closeDeleteConfirmModal();
      return;
    }

    this.isButtonDisabled = true;
    this.showDivUpdatedLoaderNewAsset = true;
    this.showDivAddToDataBaseNewAsset = false;
    this.showDeleteConfirmModal = false;

    this.api.deleteAsset(this.assetToDelete.id).subscribe({
      next: (res: any) => {
        this.showDivUpdatedLoaderNewAsset = false;
        this.isButtonDisabled = false;
        this.responseColor = 'rgb(11, 155, 112)';
        this.responseMessage = res?.message || "Asset deleted successfully!";
        this.showDivAddToDataBaseNewAsset = true;

        setTimeout(() => {
          this.initializeTableData();
          this.showDivAddToDataBaseNewAsset = false;
          this.closeDeleteConfirmModal();
        }, 1000);
      },
      error: (err) => {
        this.showDivUpdatedLoaderNewAsset = false;
        this.isButtonDisabled = false;
        this.responseColor = 'rgb(238, 16, 16)';
        this.responseMessage = err.error?.message || "Error deleting asset. Please try again.";
        this.showDivAddToDataBaseNewAsset = true;
        console.error("Error deleting asset: ", err);
        
        setTimeout(() => {
          this.showDivAddToDataBaseNewAsset = false;
        }, 4000);
        this.closeDeleteConfirmModal();
      }
    });
  }

  closeDeleteConfirmModal() {
    this.showDeleteConfirmModal = false;
    this.assetToDelete = null;
    this.isButtonDisabled = false;
    document.body.style.overflow = '';
  }

  saveAsset(form: NgForm) {
    if (form.invalid) {
      this.responseColor = "#dc2626";
      this.responseMessage = "Please fill in all required fields.";
      this.showDivAddToDataBaseNewAsset = true;
      setTimeout(() => {
        this.showDivAddToDataBaseNewAsset = false;
      }, 4000);
      return;
    }

    this.showDivUpdatedLoaderNewAsset = true;
    this.isButtonDisabled = true;
    this.showDivAddToDataBaseNewAsset = false;

    const assetData: any = {
      title: this.currentAsset.title || '',
      depreciationRate: this.currentAsset.depreciationRate ? Number(this.currentAsset.depreciationRate) : 0,
      usefulLifeMonths: this.currentAsset.usefulLifeMonths ? Number(this.currentAsset.usefulLifeMonths) : 0,
      acquisitionDate: this.currentAsset.acquisitionDate || null,
      serialNumber: this.currentAsset.serialNumber || '',
      description: this.currentAsset.description || ''
    };

    console.log("Saving asset data:", assetData);

    if (this.isEditingAsset && this.editingAssetId) {
      // Update existing asset
      this.api.updateAsset(this.editingAssetId, assetData).subscribe({
        next: (response) => {
          console.log("Asset updated successfully:", response);

          this.showDivUpdatedLoaderNewAsset = false;
          
          if (response && response.message) {
            this.responseColor = "rgb(11, 155, 112)";
            this.responseMessage = response.message;
          } else {
            this.responseColor = "rgb(11, 155, 112)";
            this.responseMessage = "Asset updated successfully!";
          }

          this.showDivAddToDataBaseNewAsset = true;
          
          this.initializeTableData();

          setTimeout(() => {
            this.showDivAddToDataBaseNewAsset = false;
            this.closeAssetModal();
            this.isButtonDisabled = false;
          }, 2500);
        },
        error: (error) => {
          console.error("Error updating asset:", error);
          
          this.showDivUpdatedLoaderNewAsset = false;
          let errorMessage = "An unexpected error occurred. Please try again.";
          
          if (error.error) {
            if (error.error.message) {
              errorMessage = error.error.message;
            } else if (typeof error.error === 'string') {
              errorMessage = error.error;
            }
          }
          
          this.responseColor = "rgb(238, 16, 16)";
          this.responseMessage = errorMessage;
          this.showDivAddToDataBaseNewAsset = true;
          this.isButtonDisabled = false;

          setTimeout(() => {
            this.showDivAddToDataBaseNewAsset = false;
          }, 4000);
        }
      });
    } else {
      // Add new asset
      this.api.addAsset(assetData).subscribe({
        next: (response) => {
          console.log("Asset added successfully:", response);

          this.showDivUpdatedLoaderNewAsset = false;
          
          if (response && response.message) {
            this.responseColor = "rgb(11, 155, 112)";
            this.responseMessage = response.message;
          } else {
            this.responseColor = "rgb(11, 155, 112)";
            this.responseMessage = "Asset added successfully!";
          }

          this.showDivAddToDataBaseNewAsset = true;
          
          this.initializeTableData();

          setTimeout(() => {
            this.showDivAddToDataBaseNewAsset = false;
            this.closeAssetModal();
            this.isButtonDisabled = false;
          }, 2500);
        },
        error: (error) => {
          console.error("Error adding asset:", error);
          
          this.showDivUpdatedLoaderNewAsset = false;
          let errorMessage = "An unexpected error occurred. Please try again.";
          
          if (error.error) {
            if (error.error.message) {
              errorMessage = error.error.message;
            } else if (typeof error.error === 'string') {
              errorMessage = error.error;
            }
          }
          
          this.responseColor = "rgb(238, 16, 16)";
          this.responseMessage = errorMessage;
          this.showDivAddToDataBaseNewAsset = true;
          this.isButtonDisabled = false;

          setTimeout(() => {
            this.showDivAddToDataBaseNewAsset = false;
          }, 4000);
        }
      });
    }
  }

  onPageChange(pageNumber: number) {
    this.page = pageNumber;
  }

  onSearchQueryChange(value: string) {
    this.searchQuery = value;
  }

  onSelectedColumnChange(value: string) {
    this.selectedColumn = value;
  }

  onItemsPerPageChange(value: number) {
    this.itemsPerPage = value;
    this.page = 1; // Reset to first page when changing items per page
  }
}
