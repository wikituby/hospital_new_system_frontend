import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import { ApiService } from '../../../../services/api.service';
import { ThemeService } from '../../../../services/theme.service';
import { Router } from '@angular/router';
import { NgForm } from '@angular/forms';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

@Component({
  selector: 'app-service-types',
  templateUrl: './service-types.component.html',
  styleUrls: ['./service-types.component.css']
})
export class ServiceTypesComponent implements OnInit {

  // Table data properties
  typeList: any[] = [];
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
  currentType: any = {};
  saveButtonStatus: string = "Add New Type";
  isButtonDisabled: boolean = false;
  showDivAddToDataBaseNewType: boolean = false;
  showDivUpdatedLoaderNewType: boolean = false;
  isCollapsedNewType: boolean = true;
  
  // Editing properties
  isEditingType: boolean = false;
  editingTypeId: number | null = null;
  
  // Delete confirmation modal properties
  showDeleteConfirmModal: boolean = false;
  typeToDelete: any = null;
  
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
    this.api.getAllTypes().subscribe({
      next: (res) => {
        this.isLoadingService = false;
        console.log("Raw types response:", res);
        
        // Ensure we have an array
        if (Array.isArray(res)) {
          this.typeList = res;
          this.data = res;
        } else if (res && Array.isArray(res.data)) {
          this.typeList = res.data;
          this.data = res.data;
        } else {
          console.warn("Unexpected types response structure:", res);
          this.typeList = [];
          this.data = [];
        }
        
        console.log("Types loaded:", this.typeList);
        this.page = 1;
      },
      error: (err: any) => {
        this.isLoadingService = false;
        console.error("Error loading types:", err);
        this.typeList = [];
        this.data = [];
        this.responseColor = "#dc2626";
        const errorMsg = err.error?.message || err.message || "Error loading types. Please try again.";
        this.responseMessage = `Error: ${errorMsg}`;
        this.showDivUpdatedOut = true;
        setTimeout(() => {
          this.showDivUpdatedOut = false;
        }, 5000);
      }
    });
  }

  get filteredTypeList() {
    if (!this.searchQuery.trim()) {
      return this.typeList;
    }

    const query = this.searchQuery.toLowerCase().trim();
    
    if (this.selectedColumn === 'all') {
      return this.typeList.filter(type => {
        return (type.procedureType && type.procedureType.toLowerCase().includes(query)) ||
               (type.name && type.name.toLowerCase().includes(query)) ||
               (type.description && type.description.toLowerCase().includes(query));
      });
    } else {
      return this.typeList.filter(type => {
        const value = type[this.selectedColumn];
        return value && value.toString().toLowerCase().includes(query);
      });
    }
  }

  get totalItemsCount(): number {
    return this.filteredTypeList.length;
  }

  // Export methods
  exportToExcel() {
    const dataToExport = this.filteredTypeList.map((type, index) => ({
      'SN': index + 1,
      'Type Name': type.procedureType || type.name || 'N/A',
      'Description': type.description || 'N/A'
    }));

    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(dataToExport);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Types');
    XLSX.writeFile(wb, 'service-types.xlsx');
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
      pdf.save('service-types.pdf');
    });
  }

  // Type modal methods
  openTypeModal() {
    this.clearFormNewType();
    this.isCollapsedNewType = false;
    document.body.style.overflow = 'hidden';
  }

  clearFormNewType() {
    this.currentType = {
      procedureType: '',
      description: ''
    };
    this.saveButtonStatus = "Add New Type";
    this.showDivAddToDataBaseNewType = false;
    this.showDivUpdatedLoaderNewType = false;
    this.isButtonDisabled = false;
    this.isEditingType = false;
    this.editingTypeId = null;
  }

  closeTypeModal() {
    this.isCollapsedNewType = true;
    document.body.style.overflow = '';
    this.clearFormNewType();
  }

  editType(type: any) {
    if (!type || !type.id) {
      console.error('Invalid type data for editing');
      return;
    }

    this.isEditingType = true;
    this.editingTypeId = type.id;
    this.currentType = {
      procedureType: type.procedureType || type.name || '',
      description: type.description || ''
    };
    
    this.saveButtonStatus = "Update Type";
    this.showDivAddToDataBaseNewType = false;
    this.showDivUpdatedLoaderNewType = false;
    this.isButtonDisabled = false;
    this.isCollapsedNewType = false;
    document.body.style.overflow = 'hidden';
  }

  deleteType(type: any) {
    if (!type || !type.id) {
      console.error('Invalid type data for deletion');
      return;
    }

    this.typeToDelete = type;
    this.showDeleteConfirmModal = true;
    document.body.style.overflow = 'hidden';
  }

  confirmDelete() {
    if (!this.typeToDelete || !this.typeToDelete.id) {
      this.closeDeleteConfirmModal();
      return;
    }

    this.isButtonDisabled = true;
    this.showDivUpdatedLoaderNewType = true;
    this.showDivAddToDataBaseNewType = false;
    this.showDeleteConfirmModal = false;

    // Note: Delete endpoint may need to be added to API service
    // For now, we'll show an error if delete is attempted
    this.showDivUpdatedLoaderNewType = false;
    this.isButtonDisabled = false;
    this.responseColor = 'rgb(238, 16, 16)';
    this.responseMessage = "Delete functionality not yet implemented. Please contact administrator.";
    this.showDivAddToDataBaseNewType = true;

    setTimeout(() => {
      this.showDivAddToDataBaseNewType = false;
      this.closeDeleteConfirmModal();
    }, 3000);
  }

  closeDeleteConfirmModal() {
    this.showDeleteConfirmModal = false;
    this.typeToDelete = null;
    this.isButtonDisabled = false;
    document.body.style.overflow = '';
  }

  saveType(form: NgForm) {
    if (form.invalid) {
      this.responseColor = "#dc2626";
      this.responseMessage = "Please fill in all required fields.";
      this.showDivAddToDataBaseNewType = true;
      setTimeout(() => {
        this.showDivAddToDataBaseNewType = false;
      }, 4000);
      return;
    }

    this.showDivUpdatedLoaderNewType = true;
    this.isButtonDisabled = true;
    this.showDivAddToDataBaseNewType = false;

    const typeData: any = {
      procedureType: this.currentType.procedureType || '',
      description: this.currentType.description || ''
    };

    console.log("Saving type data:", typeData);

    if (this.isEditingType && this.editingTypeId) {
      // Update existing type
      this.api.updateTypeById(this.editingTypeId, typeData).subscribe({
        next: (response) => {
          console.log("Type updated successfully:", response);

          this.showDivUpdatedLoaderNewType = false;
          
          if (response && response.message) {
            this.responseColor = "rgb(11, 155, 112)";
            this.responseMessage = response.message;
          } else {
            this.responseColor = "rgb(11, 155, 112)";
            this.responseMessage = "Type updated successfully!";
          }

          this.showDivAddToDataBaseNewType = true;
          
          this.initializeTableData();

          setTimeout(() => {
            this.showDivAddToDataBaseNewType = false;
            this.closeTypeModal();
            this.isButtonDisabled = false;
          }, 2500);
        },
        error: (error: any) => {
          console.error("Error updating type:", error);
          
          this.showDivUpdatedLoaderNewType = false;
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
          this.showDivAddToDataBaseNewType = true;
          this.isButtonDisabled = false;

          setTimeout(() => {
            this.showDivAddToDataBaseNewType = false;
          }, 4000);
        }
      });
    } else {
      // Add new type
      this.api.saveNewType(typeData).subscribe({
        next: (response) => {
          console.log("Type added successfully:", response);

          this.showDivUpdatedLoaderNewType = false;
          
          if (response && response.message) {
            this.responseColor = "rgb(11, 155, 112)";
            this.responseMessage = response.message;
          } else {
            this.responseColor = "rgb(11, 155, 112)";
            this.responseMessage = "Type added successfully!";
          }

          this.showDivAddToDataBaseNewType = true;
          
          this.initializeTableData();

          setTimeout(() => {
            this.showDivAddToDataBaseNewType = false;
            this.closeTypeModal();
            this.isButtonDisabled = false;
          }, 2500);
        },
        error: (error: any) => {
          console.error("Error adding type:", error);
          
          this.showDivUpdatedLoaderNewType = false;
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
          this.showDivAddToDataBaseNewType = true;
          this.isButtonDisabled = false;

          setTimeout(() => {
            this.showDivAddToDataBaseNewType = false;
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
    this.page = 1;
  }
}

