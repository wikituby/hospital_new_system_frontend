import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import { ApiService } from '../../../../services/api.service';
import { ThemeService } from '../../../../services/theme.service';
import { Router } from '@angular/router';
import { NgForm } from '@angular/forms';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

@Component({
  selector: 'app-service-categories',
  templateUrl: './service-categories.component.html',
  styleUrls: ['./service-categories.component.css']
})
export class ServiceCategoriesComponent implements OnInit {

  // Table data properties
  categoryList: any[] = [];
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
  currentCategory: any = {};
  saveButtonStatus: string = "Add New Category";
  isButtonDisabled: boolean = false;
  showDivAddToDataBaseNewCategory: boolean = false;
  showDivUpdatedLoaderNewCategory: boolean = false;
  isCollapsedNewCategory: boolean = true;
  
  // Editing properties
  isEditingCategory: boolean = false;
  editingCategoryId: number | null = null;
  
  // Delete confirmation modal properties
  showDeleteConfirmModal: boolean = false;
  categoryToDelete: any = null;
  
  // Parent category properties
  parentCategoryList: any[] = [];
  isParentCategoryLoading: boolean = false;
  parentCategoryLoadError: string = '';

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
    this.api.getAllProcedureCategories().subscribe({
      next: (res) => {
        this.isLoadingService = false;
        const categories = this.normalizeCategoryListResponse(res);
        this.categoryList = categories;
        this.data = [...categories];
        this.page = 1;
      },
      error: (err: any) => {
        this.isLoadingService = false;
        console.error('Error loading categories:', err);
        this.categoryList = [];
        this.data = [];
        this.responseColor = '#dc2626';
        const errorMsg =
          err?.error?.message || err?.message || 'Error loading categories. Please try again.';
        this.responseMessage = `Error: ${errorMsg}`;
        this.showDivUpdatedOut = true;
        setTimeout(() => {
          this.showDivUpdatedOut = false;
        }, 5000);
      }
    });
  }

  get filteredCategoryList() {
    if (!this.searchQuery.trim()) {
      return this.categoryList;
    }

    const query = this.searchQuery.toLowerCase().trim();
    
    if (this.selectedColumn === 'all') {
      return this.categoryList.filter(category => {
        const name = this.getCategoryName(category).toLowerCase();
        const parentName = this.getParentCategoryName(category).toLowerCase();
        return name.includes(query) || parentName.includes(query);
      });
    } else {
      return this.categoryList.filter(category => {
        let value: any;

        if (this.selectedColumn === 'category') {
          value = this.getCategoryName(category);
        } else if (this.selectedColumn === 'parentCategory') {
          value = this.getParentCategoryName(category);
        } else {
          value = category[this.selectedColumn];
        }

        return value && value.toString().toLowerCase().includes(query);
      });
    }
  }

  get totalItemsCount(): number {
    return this.filteredCategoryList.length;
  }

  // Helpers to get category fields from DTO
  getCategoryName(category: any): string {
    if (!category) {
      return 'N/A';
    }
    // Use 'name' field from ProcedureCategoryDTO
    return category.name ? category.name.toString() : 'N/A';
  }

  getParentCategoryName(category: any): string {
    if (!category) {
      return 'N/A';
    }
    // Use 'parentName' field from ProcedureCategoryDTO
    return category.parentName ? category.parentName.toString() : 'N/A';
  }

  // Export methods
  exportToExcel() {
    const dataToExport = this.filteredCategoryList.map((category, index) => ({
      'SN': index + 1,
      'Category Name': this.getCategoryName(category),
      'Parent Category Name': this.getParentCategoryName(category)
    }));

    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(dataToExport);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Categories');
    XLSX.writeFile(wb, 'service-categories.xlsx');
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
      pdf.save('service-categories.pdf');
    });
  }

  // Category modal methods
  openCategoryModal() {
    this.clearFormNewCategory();
    this.loadParentCategories();
    this.isCollapsedNewCategory = false;
    document.body.style.overflow = 'hidden';
  }

  clearFormNewCategory() {
    this.currentCategory = {
      name: '',
      parentId: null,
      description: ''
    };
    this.saveButtonStatus = "Add New Category";
    this.showDivAddToDataBaseNewCategory = false;
    this.showDivUpdatedLoaderNewCategory = false;
    this.isButtonDisabled = false;
    this.isEditingCategory = false;
    this.editingCategoryId = null;
  }

  closeCategoryModal() {
    this.isCollapsedNewCategory = true;
    document.body.style.overflow = '';
    this.clearFormNewCategory();
  }

  editCategory(category: any) {
    if (!category) {
      console.error('Invalid category data for editing');
      return;
    }

    const categoryId = category.id ?? category.procedureCategoryId ?? category.categoryId;
    if (!categoryId) {
      console.error('Could not determine category id for editing', category);
      return;
    }

    this.isEditingCategory = true;
    this.editingCategoryId = Number(categoryId);
    this.loadParentCategories();
    this.currentCategory = {
      name: this.getCategoryName(category) !== 'N/A' ? this.getCategoryName(category) : '',
      parentId: category.parentId || null,
      description: category.categoryDescription || category.description || ''
    };
    
    this.saveButtonStatus = "Update Category";
    this.showDivAddToDataBaseNewCategory = false;
    this.showDivUpdatedLoaderNewCategory = false;
    this.isButtonDisabled = false;
    this.isCollapsedNewCategory = false;
    document.body.style.overflow = 'hidden';
  }

  deleteCategory(category: any) {
    if (!category || !category.id) {
      console.error('Invalid category data for deletion');
      return;
    }

    this.categoryToDelete = category;
    this.showDeleteConfirmModal = true;
    document.body.style.overflow = 'hidden';
  }

  confirmDelete() {
    if (!this.categoryToDelete || !this.categoryToDelete.id) {
      this.closeDeleteConfirmModal();
      return;
    }

    this.isButtonDisabled = true;
    this.showDivUpdatedLoaderNewCategory = true;
    this.showDivAddToDataBaseNewCategory = false;
    this.showDeleteConfirmModal = false;

    // Note: Delete endpoint may need to be added to API service
    // For now, we'll show an error if delete is attempted
    this.showDivUpdatedLoaderNewCategory = false;
    this.isButtonDisabled = false;
    this.responseColor = 'rgb(238, 16, 16)';
    this.responseMessage = "Delete functionality not yet implemented. Please contact administrator.";
    this.showDivAddToDataBaseNewCategory = true;

    setTimeout(() => {
      this.showDivAddToDataBaseNewCategory = false;
      this.closeDeleteConfirmModal();
    }, 3000);
  }

  closeDeleteConfirmModal() {
    this.showDeleteConfirmModal = false;
    this.categoryToDelete = null;
    this.isButtonDisabled = false;
    document.body.style.overflow = '';
  }

  saveCategory(form: NgForm) {
    if (form.invalid) {
      this.responseColor = "#dc2626";
      this.responseMessage = "Please fill in all required fields.";
      this.showDivAddToDataBaseNewCategory = true;
      setTimeout(() => {
        this.showDivAddToDataBaseNewCategory = false;
      }, 4000);
      return;
    }

    this.showDivUpdatedLoaderNewCategory = true;
    this.isButtonDisabled = true;
    this.showDivAddToDataBaseNewCategory = false;

    // Build payload according to DTO structure: name, parentId, categoryId
    const categoryData: any = {
      name: this.currentCategory.name || '',
      parentId: this.currentCategory.parentId || null,
      categoryId: this.isEditingCategory && this.editingCategoryId ? this.editingCategoryId : null
    };

    console.log("Saving category data:", categoryData);

    if (this.isEditingCategory && this.editingCategoryId) {
      // Update existing category
      this.api.updateCategoryById(this.editingCategoryId, categoryData).subscribe({
        next: (response) => {
          console.log("Category updated successfully:", response);

          this.showDivUpdatedLoaderNewCategory = false;
          
          if (response && response.message) {
            this.responseColor = "rgb(11, 155, 112)";
            this.responseMessage = response.message;
          } else {
            this.responseColor = "rgb(11, 155, 112)";
            this.responseMessage = "Category updated successfully!";
          }

          this.showDivAddToDataBaseNewCategory = true;
          
          this.initializeTableData();

          setTimeout(() => {
            this.showDivAddToDataBaseNewCategory = false;
            this.closeCategoryModal();
            this.isButtonDisabled = false;
          }, 2500);
        },
        error: (error: any) => {
          console.error("Error updating category:", error);
          
          this.showDivUpdatedLoaderNewCategory = false;
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
          this.showDivAddToDataBaseNewCategory = true;
          this.isButtonDisabled = false;

          setTimeout(() => {
            this.showDivAddToDataBaseNewCategory = false;
          }, 4000);
        }
      });
    } else {
      // Add new category
      this.api.saveNewCategory(categoryData).subscribe({
        next: (response) => {
          console.log("Category added successfully:", response);

          this.showDivUpdatedLoaderNewCategory = false;
          
          if (response && response.message) {
            this.responseColor = "rgb(11, 155, 112)";
            this.responseMessage = response.message;
          } else {
            this.responseColor = "rgb(11, 155, 112)";
            this.responseMessage = "Category added successfully!";
          }

          this.showDivAddToDataBaseNewCategory = true;
          
          this.initializeTableData();

          setTimeout(() => {
            this.showDivAddToDataBaseNewCategory = false;
            this.closeCategoryModal();
            this.isButtonDisabled = false;
          }, 2500);
        },
        error: (error: any) => {
          console.error("Error adding category:", error);
          
          this.showDivUpdatedLoaderNewCategory = false;
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
          this.showDivAddToDataBaseNewCategory = true;
          this.isButtonDisabled = false;

          setTimeout(() => {
            this.showDivAddToDataBaseNewCategory = false;
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

  // Parent category loading methods
  loadParentCategories() {
    this.isParentCategoryLoading = true;
    this.parentCategoryLoadError = '';
    
    this.api.getAllProcedureCategories().subscribe({
      next: (res) => {
        this.isParentCategoryLoading = false;
        const categories = this.normalizeCategoryListResponse(res);
        
        // Filter out the current category being edited to prevent circular references
        if (this.isEditingCategory && this.editingCategoryId) {
          this.parentCategoryList = categories.filter(cat => {
            const catId = cat.id ?? cat.procedureCategoryId ?? cat.categoryId;
            return catId !== this.editingCategoryId;
          });
        } else {
          this.parentCategoryList = categories;
        }
      },
      error: (err: any) => {
        this.isParentCategoryLoading = false;
        console.error("Error loading parent categories:", err);
        this.parentCategoryLoadError = "Failed to load parent categories. Please try again.";
        this.parentCategoryList = [];
      }
    });
  }

  getParentCategoryOptions(): any[] {
    return this.parentCategoryList || [];
  }

  private normalizeCategoryListResponse(res: any): any[] {
    if (Array.isArray(res)) {
      return res;
    }
    if (res && Array.isArray(res.data)) {
      return res.data;
    }
    return [];
  }

  retryParentCategoryLoad() {
    this.loadParentCategories();
  }
}

