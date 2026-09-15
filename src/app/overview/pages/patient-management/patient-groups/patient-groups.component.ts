import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import { ApiService } from '../../../../services/api.service';
import { ThemeService } from '../../../../services/theme.service';
import { AccessControlService } from '../../../../services/access-control.service';
import { FacilityBrandingService } from '../../../../services/facility-branding.service';
import { Router } from '@angular/router';
import { NgForm } from '@angular/forms';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

@Component({
  selector: 'app-patient-groups',
  templateUrl: './patient-groups.component.html',
  styleUrls: ['./patient-groups.component.css']
})
export class PatientGroupsComponent implements OnInit {

  // Table data properties
  patientGroupList: any[] = [];
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
  currentPatientGroup: any = {};
  saveButtonStatus: string = "Add New Patient Group";
  isButtonDisabled: boolean = false;
  showDivAddToDataBaseNewGroup: boolean = false;
  showDivUpdatedLoaderNewGroup: boolean = false;
  isCollapsedNewGroup: boolean = true;
  
  // Editing properties
  isEditingGroup: boolean = false;
  editingGroupId: number | null = null;
  
  // Delete confirmation modal properties
  showDeleteConfirmModal: boolean = false;
  groupToDelete: any = null;
  
  // ViewChild references
  @ViewChild('htmlData') htmlData!: ElementRef;

  constructor(
    private router: Router,
    private api: ApiService,
    private themeService: ThemeService,
    private accessControl: AccessControlService,
    private facilityBranding: FacilityBrandingService
  ) {}

  get canManageCreditGroupRights(): boolean {
    return this.accessControl.canManageCreditGroupRights();
  }

  ngOnInit(): void {
    const userRole = sessionStorage.getItem('userrole');
    const username = sessionStorage.getItem('username');

    // Subscribe to theme changes for real-time updates
    this.themeService.isDarkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
    });
    this.facilityBranding.load().subscribe({ next: () => {}, error: () => {} });

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
    this.api.getPatientGroupList().subscribe({
      next: (res) => {
        this.isLoadingService = false;
        console.log("Raw patient groups response:", res);
        
        // Ensure we have an array
        if (Array.isArray(res)) {
          this.patientGroupList = res;
          this.data = res;
        } else if (res && Array.isArray(res.data)) {
          this.patientGroupList = res.data;
          this.data = res.data;
        } else {
          console.warn("Unexpected patient groups response structure:", res);
          this.patientGroupList = [];
          this.data = [];
        }
      },
      error: (err: any) => {
        this.isLoadingService = false;
        console.error("Error loading patient groups:", err);
        this.patientGroupList = [];
        this.data = [];
      }
    });
  }

  get filteredPatientGroupList() {
    if (!this.searchQuery.trim()) {
      return this.patientGroupList;
    }

    const query = this.searchQuery.toLowerCase().trim();
    
    if (this.selectedColumn === 'all') {
      return this.patientGroupList.filter(group => {
        return (group.groupName && group.groupName.toLowerCase().includes(query)) ||
               (group.groupNameShortForm && group.groupNameShortForm.toLowerCase().includes(query)) ||
               (group.description && group.description.toLowerCase().includes(query));
      });
    } else {
      return this.patientGroupList.filter(group => {
        const value = group[this.selectedColumn];
        return value && value.toString().toLowerCase().includes(query);
      });
    }
  }

  // Export methods
  exportToExcel() {
    const dataToExport = this.filteredPatientGroupList.map((group, index) => ({
      'SN': index + 1,
      'Group Name': group.groupName || 'N/A',
      'Short Form': group.groupNameShortForm || 'N/A',
      'Description': group.description || 'N/A'
    }));

    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(dataToExport);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Patient Groups');
    XLSX.writeFile(wb, 'patient-groups.xlsx');
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
      pdf.save('patient-groups.pdf');
    });
  }

  // Patient Group modal methods
  openGroupModal() {
    this.clearFormNewGroup();
    this.isCollapsedNewGroup = false;
    document.body.style.overflow = 'hidden';
  }

  clearFormNewGroup() {
    this.currentPatientGroup = {
      groupName: '',
      groupNameShortForm: '',
      description: '',
      allowsCreditDespiteUnpaidBalance: false
    };
    this.saveButtonStatus = "Add New Patient Group";
    this.showDivAddToDataBaseNewGroup = false;
    this.showDivUpdatedLoaderNewGroup = false;
    this.isButtonDisabled = false;
    this.isEditingGroup = false;
    this.editingGroupId = null;
  }

  closeGroupModal() {
    this.isCollapsedNewGroup = true;
    document.body.style.overflow = '';
    this.clearFormNewGroup();
  }

  editGroup(group: any) {
    if (!group || !group.id) {
      console.error('Invalid patient group data for editing');
      return;
    }

    this.isEditingGroup = true;
    this.editingGroupId = group.id;
    this.currentPatientGroup = {
      groupName: group.groupName || '',
      groupNameShortForm: group.groupNameShortForm || '',
      description: group.description || '',
      allowsCreditDespiteUnpaidBalance: !!group.allowsCreditDespiteUnpaidBalance
    };
    this.saveButtonStatus = "Update Patient Group";
    this.showDivAddToDataBaseNewGroup = false;
    this.showDivUpdatedLoaderNewGroup = false;
    this.isButtonDisabled = false;
    this.isCollapsedNewGroup = false;
    document.body.style.overflow = 'hidden';
  }

  deleteGroup(group: any) {
    if (!group || !group.id) {
      console.error('Invalid patient group data for deletion');
      return;
    }

    this.groupToDelete = group;
    this.showDeleteConfirmModal = true;
    document.body.style.overflow = 'hidden';
  }

  confirmDelete() {
    // Note: Delete functionality needs to be implemented in the backend API
    this.responseColor = 'rgb(238, 16, 16)';
    this.responseMessage = "Delete functionality is not yet implemented in the backend API.";
    this.showDivAddToDataBaseNewGroup = true;
    this.closeDeleteConfirmModal();
    
    setTimeout(() => {
      this.showDivAddToDataBaseNewGroup = false;
    }, 4000);
  }

  closeDeleteConfirmModal() {
    this.showDeleteConfirmModal = false;
    this.groupToDelete = null;
    this.isButtonDisabled = false;
    document.body.style.overflow = '';
  }

  saveGroup(data: any) {
    this.showDivUpdatedLoaderNewGroup = true;
    this.isButtonDisabled = true;
    this.showDivAddToDataBaseNewGroup = false;

    const groupData: any = {
      groupName: data.groupName || '',
      groupNameShortForm: data.groupNameShortForm || '',
      description: data.description || ''
    };
    if (this.canManageCreditGroupRights) {
      groupData.allowsCreditDespiteUnpaidBalance = !!data.allowsCreditDespiteUnpaidBalance;
    }

    console.log("Patient group data to save:", groupData);

    if (this.isEditingGroup && this.editingGroupId) {
      this.api.updatePatientGroup(this.editingGroupId, groupData).subscribe({
        next: (response) => {
          this.showDivUpdatedLoaderNewGroup = false;
          this.isButtonDisabled = false;
          this.responseColor = 'rgb(11, 155, 112)';
          this.responseMessage = response?.message || 'Patient group updated successfully.';
          this.showDivAddToDataBaseNewGroup = true;
          this.initializeTableData();
          setTimeout(() => {
            this.showDivAddToDataBaseNewGroup = false;
            this.closeGroupModal();
          }, 1500);
        },
        error: (error) => {
          console.error('Error updating patient group:', error);
          this.showDivUpdatedLoaderNewGroup = false;
          this.isButtonDisabled = false;
          this.responseColor = 'rgb(238, 16, 16)';
          this.responseMessage = error?.error?.message || 'Error updating patient group.';
          this.showDivAddToDataBaseNewGroup = true;
          setTimeout(() => {
            this.showDivAddToDataBaseNewGroup = false;
          }, 4000);
        }
      });
    } else {
      // Create new group
      this.api.createPatientGroup(groupData).subscribe({
        next: (response) => {
          console.log("Patient group saved successfully:", response);

          this.showDivUpdatedLoaderNewGroup = false;
          
          if (response && response.message) {
            this.responseColor = "rgb(11, 155, 112)";
            this.responseMessage = response.message;
          } else {
            this.responseColor = "rgb(11, 155, 112)";
            this.responseMessage = "Patient group added successfully!";
          }

          this.showDivAddToDataBaseNewGroup = true;
          
          this.initializeTableData();

          setTimeout(() => {
            this.showDivAddToDataBaseNewGroup = false;
            this.closeGroupModal();
            this.isButtonDisabled = false;
          }, 2500);
        },
        error: (error: any) => {
          console.error("Error saving patient group:", error);
          console.error("Error details:", JSON.stringify(error, null, 2));
          console.error("Patient group data that was sent:", groupData);
          
          this.showDivUpdatedLoaderNewGroup = false;
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
          this.showDivAddToDataBaseNewGroup = true;
          this.isButtonDisabled = false;

          setTimeout(() => {
            this.showDivAddToDataBaseNewGroup = false;
          }, 4000);
        }
      });
    }
  }

  onPageChange(page: number) {
    this.page = page;
  }

  onSearchQueryChange(query: string) {
    this.searchQuery = query;
    this.page = 1; // Reset to first page when searching
  }

  onSelectedColumnChange(column: string) {
    this.selectedColumn = column;
    this.page = 1; // Reset to first page when filtering
  }

  onItemsPerPageChange(itemsPerPage: number) {
    this.itemsPerPage = itemsPerPage;
    this.page = 1; // Reset to first page when changing items per page
  }

  get totalItemsCount(): number {
    return this.patientGroupList.length;
  }
}



