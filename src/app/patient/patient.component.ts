import { Component, OnInit, TemplateRef, ViewChild, PipeTransform, ElementRef, inject } from '@angular/core';
import { ApiService } from '../services/api.service';
import { CartapiService } from '../services/cartapi.service';
import { DataService } from '../services/data.service';
import { MatDialog, MatDialogContent } from '@angular/material/dialog';
import { HttpClient, HttpParams } from '@angular/common/http';
import { NgForm } from '@angular/forms';
import { PopupComponent } from '../popup/popup.component';
import { HeaderComponent } from '../header/header.component';
import { Router } from '@angular/router';
import { Product } from '../interfaces/product';
import { MatPaginatorModule } from '@angular/material/paginator';
import { NgxPaginationModule } from 'ngx-pagination';

import { HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';


import { NgbCalendar, NgbCollapseModule, NgbDate, NgbDateParserFormatter } from '@ng-bootstrap/ng-bootstrap';
import { AuthenticationService } from '../services/authentication.service';
import { AccessControlService } from '../services/access-control.service';
import { defaultContactValue } from '../utils/phone-contact.util';
import { BLOOD_GROUP_OPTIONS } from '../utils/blood-group.util';

import { NgbAlertModule, NgbDatepickerModule, NgbDateStruct } from '@ng-bootstrap/ng-bootstrap';
import { FormsModule } from '@angular/forms';
import { JsonPipe } from '@angular/common';


import { AsyncPipe, DecimalPipe, NgFor } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { NgbTypeaheadModule } from '@ng-bootstrap/ng-bootstrap';

import { Ng2SearchPipeModule } from 'ng2-search-filter';
import { FilterPipeModule } from 'ngx-filter-pipe';

import * as XLSX from 'xlsx';

import html2canvas from 'html2canvas';

import jsPDF from 'jspdf';

import { Storage, getDownloadURL, ref, uploadBytesResumable } from '@angular/fire/storage';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FileresourceService } from '../fileservice/fileresource.service';

declare var $: any;

@Component({
  selector: 'app-patient',
  templateUrl: './patient.component.html',
  styleUrls: ['./patient.component.css']
})
export class PatientComponent implements OnInit {

  jsonData: any[] = [];

  private readonly storage: Storage = inject(Storage);
  serverDirectoryName:string='';
  image:string=''
  imgSrc: any = '/assets/imgplaceholder.jpg';
  selectedFile: any;

  cartItems: any = [];

  showDivNull: boolean = false;

  hoveredDate: NgbDate | null = null;

  fromDate: NgbDate | null;

  showDivAddToDataBaseNewItemOut:boolean = false;
  toDate: NgbDate | null;

  actionButton:string="Action Button"


  title = "Angular Server Post Data Test"

  page: number = 1;

  pageItemUsed: number = 1;


  patientGroupList: any[] = []; // Initialize to hold patient groups


  productList: any[] = [];
  data: any[] = [];

  productList2: any[] = [];
  data2: any[] = [];

  patientGroup: any;
  totalAmountDue:any;


  isCollapsedItemsUsedShow = true;

  isCollapsedItemsUsed = true;


  filteredUsers: any[] = [];
  procedureItemUsedList: any[] = [];

  category: any;
  saveButtonStatus = "save"

  saveButtonStatusGroup = "Save Group"

  showDivAddToDataBaseNewItemseparate: boolean = false;
  showDivUpdatedLoaderNewService: boolean = false
  isLoadingNewService: boolean = true;


  

  itemman: any;
  editModal: boolean = false;
  currentProductId: any;

  idSingleItem: any;

  totalCartNumber: number = 0;

  titleSingleItem: any;

  tableUpdater: boolean = false;

  showDiv: boolean = false;

  showDivAll: boolean = false;

  showDivAddToDataBase: boolean = false;
  showDivAddToDataBaseDelete: boolean = false;


  responseColor = "";

  responseMessage = "";

  showDivUpdated: boolean = false;


  showDivUpdatedLoaderNewPatient: boolean = false;

  showDivUpdatedLoaderDeletePatient: boolean = false;

  isLoadingNewPatient: boolean = true;


  showDivUpdatedOut: boolean = false;

  closeModalAdd: boolean = false;

  closeModalUpdate: boolean = false;

  testmethod: boolean = false;

  isButtonDisabled: boolean = false;

  searchTerm: any = '';

  UploadToBackend:string = "Upload To DataBase";

  jwt: any;
  modelTitle:string="Model Title"

  searchQuery: string = '';

  param1Value: string = '';

  param2Value: string = '';

  param3Value: string = '';

  currentPage: number = 1;

  itemsPerPage: number = 12; // Adjust as needed 

  itemsPerPageItemUsed: number = 9; // Adjust as needed 

  myModelValue: string = ""

  itemsPerPageNav: number = 1; // Adjust as needed 

  isCollapsed = true;

  initialPatientVisit: any = {};

  isCollapsedNewPatient = true;
  isCollapsedNewPatientBulk = true;

  isCollapsedDrop = false;

  iconChange: string = "bi bi-chevron-down"

  isText: boolean = true;

  eyeIcon: string = "bi bi-funnel";

  eyeIconDrop: string = "bi bi-chevron-down"

  selectedColumn: string = 'all'; // Initialize selectedColumn to 'all'

  dataSource: any;
  searchText: string = '';

  patientId: any;

  userRole:any;

  isLoadingPatient: boolean = false;


  isLoading: boolean = false;

  currentPatientGroup: string = "Group Name";

  currentPatientGroupId = null;
  
  mdUser: boolean = false;


  fakeUrl:any;

  storedFilter: any;

  currentPatient: any = {
    patientContact: defaultContactValue(),
    nextOfKinContact: defaultContactValue(),
    bloodGroup: '',
  };

  readonly bloodGroupOptions = BLOOD_GROUP_OPTIONS;

  currentGroup: any = {
    groupContact: defaultContactValue(),
  };

  patientGender: string = "gender";

  relationship: string = "relationship"

  


  displayedColumns: string[] = ["patientFirstName", "patientSecondName", "patientContact", "patientAddress", "patientGender", "patientAge", "patientDateOfBirth", "nextOfKinName", "nextOfKinContact", "relationship","nextOfKinAddress","patientGroupId"]

  @ViewChild('usersForm') form!: NgForm;

  @ViewChild('usersFormNewGroup') usersFormNewGroup!: NgForm;

  @ViewChild('htmlData') htmlData!: ElementRef;

  constructor(
    private router: Router,
    private api: ApiService,
    private cartApi: CartapiService,
    private dataService: DataService, 
    private dialog: MatDialog, 
    private http: HttpClient, 
    private authService: AuthenticationService,
    private calendar: NgbCalendar, 
    public formatter: NgbDateParserFormatter,
    private fileserver: FileresourceService,
    private accessControl: AccessControlService
    ) {
    this.fromDate = calendar.getToday();
    this.toDate = calendar.getNext(calendar.getToday(), 'd', 10);
  }

  ngOnInit(): void {
    const userRole = sessionStorage.getItem('userrole');

    const username = sessionStorage.getItem('username');

    this.userRole = userRole;


    if (userRole === "md") {
      this.mdUser = true;
 
    }

    if (username === null) {
      this.router.navigate(['/login']);
    }else{
      if (userRole === "customer"){
        this.router.navigate(['/products']);

      }
    }

    this.api.getTotalPatientBalanceDue(this.patientId).subscribe((res) => {

      console.log('patientId for totalDebt:',this.patientId);
  
      
      this.totalAmountDue = res.TotalAmountDue;
  
  
      console.log('total costs:',res.TotalAmountDue);
      console.log('total costs front:',this.totalAmountDue);
  
    });


    this.initializeTableData();
    this.loadPatientGroups();
  };


// bulk



// load bulk

onFileChange(event: any): void {
  const target: DataTransfer = <DataTransfer>(event.target);
  if (target.files.length !== 1) {
    console.error('Only one file at a time!');
    return;
  }
  const reader: FileReader = new FileReader();
  reader.onload = (e: any) => {
    const bstr: string = e.target.result;
    const wb: XLSX.WorkBook = XLSX.read(bstr, { type: 'binary' });

    const wsname: string = wb.SheetNames[0];
    const ws: XLSX.WorkSheet = wb.Sheets[wsname];

    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(ws);
    this.jsonData = this.mapToShopItemRequest(data);
  };
  reader.readAsBinaryString(target.files[0]);
}
  // Map Excel headers to ShopItemRequest structure

 

 // Map Excel headers to ShopItemRequest structure
mapToShopItemRequest(data: any[]): any[] {
  return data.map(row => ({
    //category: row['category'],
    patientFirstName: row['patientFirstName'],
    patientSecondName: row['patientSecondName'],
    //unitOfMeasure: row['unitOfMeasure'],
    
    // Number conversion with fallback to 0
    //costPrice: Number(row['costPrice']) || 0,
    //sellingPrice: Number(row['sellingPrice']) || 0,
    //stockAtHand: Number(row['stockAtHand']) || 0,
    
    // OR if you're using decimal.js for high-precision
    //costPrice: new Decimal(row['costPrice'] || 0),
    //sellingPrice: new Decimal(row['sellingPrice'] || 0),
    // stockAtHand: new Decimal(row['stockAtHand'] || 0),
  }));
}



//delete item
deleteItemUsed(id: any) {

  this.showDivUpdatedLoaderNewPatient = true;


  this.api.deleteGroupById(id).subscribe(
    (response) => {
      console.log("response", response);


      if (response && response.message) {
        this.responseColor = "rgb(238, 16, 16)";
        console.log("Message:", response.message);
        this.responseMessage = response.message;
      } else {
        console.log("Message not found!");
              this.responseColor = "rgb(238, 16, 16)";
              this.responseMessage = "Internal server error; Failed to Update"
      }

      this.showDivUpdatedLoaderNewPatient = false;


      this.showDivAddToDataBaseNewItemOut = true;
      setTimeout(() => {
        this.showDivAddToDataBaseNewItemOut = false;
        this.clearFormShowNewPatientGroup();

      }, 3000); 



    },
    (error) => {
      console.error("Error deleting item", error);

      this.responseColor = "rgb(238, 16, 16)";
      this.responseMessage = error.error.message;


      this.showDivUpdatedLoaderNewPatient = false;


      this.showDivAddToDataBaseNewItemOut = true;
      setTimeout(() => {
        this.showDivAddToDataBaseNewItemOut = false;
      }, 3000); 

    }
  );
}

uploadToBackend() {

  this.UploadToBackend = "Loading Please Wait..."
  this.isLoading = true;

  this.api.addBulkPatients(this.jsonData).subscribe({
    next: (res: any) => {
      this.UploadToBackend = "Upload To DataBase"
      this.isLoading = false;
      console.log('Uploaded successfully', res);

      if (res && res.message) {
        this.responseColor = "rgb(11, 155, 112)"; // Green for success
        this.responseMessage = res.message;
      } else {
        this.responseColor = "rgb(238, 16, 16)"; // Red for unexpected response
        this.responseMessage = "Unexpected response from server";
      }

      this.showDivUpdatedOut = true;
      //this.showDivNull = false;
      this.reopen();

      setTimeout(() => {
        this.showDivUpdatedOut = false;
        this.isCollapsedNewPatientBulk = !this.isCollapsedNewPatientBulk;
      }, 2000);
    },

    error: (err: any) => {
      console.error('Upload failed', err);
      this.responseColor = "rgb(238, 16, 16)"; // Red for error
      this.responseMessage = err?.error?.message || "Internal server error";

      this.showDivUpdatedOut = true;
      //this.showDivNull = false;

      this.reopen();

      setTimeout(() => {
        this.showDivUpdatedOut = false;

      }, 2000);
    }
  });
}


debtedPatients(){
      this.showDivUpdatedLoaderDeletePatient = true;

      this.api.getPatientsWithDebt().subscribe((res) => {
      this.isLoadingPatient = false;
      this.productList = res;
      this.showDivUpdatedLoaderDeletePatient = false;

      this.data = res;
      //console.log("this this the response "+ res);
      //console.log("this this the data "+ this.data);
      //.slice((this.currentPage - 1) * this.itemsPerPage, this.currentPage * this.itemsPerPage);
      this.currentPage = 1;
      //console.log(this.editModal);
    });
}


groupedPatients(){
      this.showDivUpdatedLoaderDeletePatient = true;

      this.api.getPatientsInGroup(this.currentPatientGroupId).subscribe((res) => {
      this.isLoadingPatient = false;
      this.productList = res;
      this.showDivUpdatedLoaderDeletePatient = false;

      this.data = res;
      //console.log("this this the response "+ res);
      //console.log("this this the data "+ this.data);
      //.slice((this.currentPage - 1) * this.itemsPerPage, this.currentPage * this.itemsPerPage);
      this.currentPage = 1;
      //console.log(this.editModal);
    });
}









  getAllPatientGroupsForShow() {
    this.showDivUpdatedLoaderNewService = true;
    this.api.getAllPatientGroups().subscribe((res) => {

      this.showDivUpdatedLoaderNewService = false;
      this.procedureItemUsedList = res;

   
      //this.data = res;
      console.log("this this the response "+ res);
      //console.log("this this the data "+ this.data);
      //.slice((this.currentPage - 1) * this.itemsPerPage, this.currentPage * this.itemsPerPage);
      this.currentPage = 1;
      //console.log(this.editModal);
    });
  }






  


  filteredPatientGroupList() {
    let filteredGroupList = this.accessControl.filterAssignablePatientGroups(this.patientGroupList ?? []);
  
    // Filter based on search text
    if (this.searchText) {
      filteredGroupList = filteredGroupList.filter((patientGroup) =>
        (patientGroup.groupNameShortName || patientGroup.groupNameShortForm || patientGroup.groupName || '')
          .toLowerCase()
          .includes(this.searchText.toLowerCase())
      );
    }
  
    // Sort in descending order by visitNumber
    return filteredGroupList.sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
  }
  




  
  downloadPdf() {

    console.log(this.storedFilter);
    if (this.storedFilter===undefined){
      this.api.getItemsAdvancedSearchDteEmptyPdfUndefined();
    }else{
    

    if (this.storedFilter.datefrom === "" || this.storedFilter.dateto === "") {

      this.api.getItemsAdvancedSearchDteEmpty(this.storedFilter);
          // Handle any errors that occur during the API request
    
    } else {
      // Make an API request using this.api.getItemsAdvancedSearch(data)
      this.api.getItemsAdvancedSearchPdf(this.storedFilter);
    }
  }}

  showPreview($event: any) {
    const reader = new FileReader();
    const fileInput = $event.target;
    const file = fileInput.files[0];
    if (file) {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      if (fileExtension) {
        if (fileExtension === 'pdf') {
          this.imgSrc = '/assets/imgplaceholder.jpg';
        } else if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(fileExtension)) {
          const reader = new FileReader();
          reader.onload = (e) => {
            this.imgSrc = e.target?.result;
          };
          reader.readAsDataURL(file);
        } else {
          this.imgSrc = '/assets/imgplaceholder.jpg';
        }
      }
    }

    reader.readAsDataURL($event.target.files[0]);
    this.selectedFile = $event.target.files[0];
    console.log(this.selectedFile);
    this.serverDirectoryName = "images";
    this.fileserver.uploadFileMethod(this.serverDirectoryName, this.selectedFile)
      .then((downloadURL) => {
        // Convert downloadURL to a string
        const downloadURLString = String(downloadURL);
        this.image = downloadURLString;
        console.log('Download URL as a string2222222:', downloadURLString);
        console.log(downloadURLString);
        console.log('new variable :', this.image);
        // Now you can use downloadURLString as a string
      })
      .catch((error) => {
        // Handle any errors
        console.error('Error:', error);
      });
  }



  exportToExcel(): void {
    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(this.filteredProductList);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, 'table-data.xlsx');
  }



  getUserFormDataForAdvancedSearch(data: any) {
    console.log(data);
    this.storedFilter = data;
  
      this.api.getItemsAdvancedSearchDteEmpty(data).subscribe(
        (response) => {
          this.productList = response;
          // Update 'productList' property with the response data
          this.data = response;

          console.log(this.productList);
        },
        (error) => {
          // Handle any errors that occur during the API request
          console.error('API request error:', error);
        }
      );

    
  }

  initializeTableData() {
    this.isLoadingPatient = true;
    this.api.getItems().subscribe((res) => {
      this.isLoadingPatient = false;
      this.productList = res;
      this.data = res;
      //console.log("this this the response "+ res);
      //console.log("this this the data "+ this.data);
      //.slice((this.currentPage - 1) * this.itemsPerPage, this.currentPage * this.itemsPerPage);
      this.currentPage = 1;
      //console.log(this.editModal);
    });
  }

  get filteredProductList3(): any[] {
    if (!this.productList || !this.searchQuery?.trim()) return this.productList;
  
    const query = this.searchQuery.toLowerCase().trim();
  
    return this.productList.filter(item => {
      if (!item) return false;
  
      const firstName = item.patientFirstName?.toLowerCase() || '';
      const lastName = item.patientSecondName?.toLowerCase() || '';
      const fullName = `${firstName} ${lastName}`.trim();
  
      switch (this.selectedColumn) {
        case 'patientFirstName':
          return firstName.includes(query);
        case 'patientSecondName':
          return lastName.includes(query);
        case 'patientName':
          return fullName.includes(query);
        case 'all':
          return firstName.includes(query) || lastName.includes(query) || fullName.includes(query);
        default:
          return false;
      }
    });
  }
  

  get filteredProductList(): any[] {
    return this.productList.filter((item) =>
      item.title.toLowerCase().includes(this.searchQuery.toLowerCase())
    );
  }

  get filteredProductList2(): any[] {
    return this.productList.filter((item) => {
      const query = this.searchQuery.toLowerCase();
      // Check if the selectedColumn is 'all' or a specific column
      switch (this.selectedColumn) {
        case 'title':
          return item.patientFirstName.toLowerCase().includes(query);
        case 'number':
          return item.patientFileNo.toLowerCase().includes(query);
        case 'category':
          return item.patientSecondName.toLowerCase().includes(query);
        case 'description':
          return item.nextOfKinName.toLowerCase().includes(query);
        case 'price':
          return item.patientGender.toLowerCase().includes(query);
        // Add cases for other columns as needed
        default:
          // If 'all' or an invalid column is selected, search in all columns
          return (
            item.patientFirstName.toLowerCase().includes(query) ||
            item.patientFileNo.toLowerCase().includes(query) ||
            item.patientSecondName.toLowerCase().includes(query) ||
            item.nextOfKinName.toLowerCase().includes(query) ||
            item.patientGender.toLowerCase().includes(query)

            // Add conditions for other columns as needed
          );
      }
    });
  }

  Search() {
    if (this.category == "") {
      this.ngOnInit();

    } else {
      this.productList = this.productList.filter(res => {
        return res.category.toLocaleLowerCase().match(this.category.toLocaleLowerCase());
      });
    }
  }

  isCollapsedMethod() {
    this.isCollapsed = false;
    this.isText = !this.isText;
    this.isText ? this.eyeIcon = "bi bi-funnel" : this.eyeIcon = "bi bi-x-square";
    this.isText ? this.eyeIconDrop = "bi bi-chevron-down" : this.eyeIconDrop = "bi bi-chevron-up";
  }

  hideShowPassword() {
    this.isText = !this.isText;
    this.isText ? this.eyeIcon = "bi bi-funnel" : this.eyeIcon = "bi bi-x-square";
    this.isText ? this.eyeIconDrop = "bi bi-chevron-down" : this.eyeIconDrop = "bi bi-chevron-up";
  }

  buttonClickIconChange() {
    this.isText = !this.isText;
    this.isText ? this.iconChange = "bi bi-chevron-down" : this.iconChange = "bi bi-chevron-up";
  }

  toggleCollapse() {
    this.isCollapsed = true;
    //this.isCollapsed = false;
    setTimeout(() => {
      this.isCollapsed = false;
    }, 0.0); // 2000 milliseconds = 2 seconds
  }



  toggleCollapseNewGroup() {
    this.saveButtonStatus = "Save Patient";
    this.currentPatientGroup = "Chose Group Name";
    this.patientGender = "gender";
    this.relationship = "Relationship";
    if (this.form) {
      this.form.resetForm();  // Reset the form to clear all fields
    }}

  

  toggleCollapseNewPatient() {
    this.saveButtonStatus = "Save Patient";
    this.currentPatientGroup = "Chose Group Name";
    this.patientGender = "gender";
    this.relationship = "Relationship";
    if (this.form) {
      this.form.resetForm();  // Reset the form to clear all fields
    }

    this.form.setValue({
      patientFirstName: null,
      patientSecondName: null,
      patientContact: defaultContactValue(),
      patientAddress: null,
      patientGender: null,
      patientAge: null,
      patientDateOfBirth: null,
      nextOfKinName: null,
      nextOfKinContact: defaultContactValue(),
      relationship: null,
      nextOfKinAddress: null,
      patientGroupId: null,

    })
  }

  toggleDropdown() {
    this.isCollapsedDrop = false;
  }

  handleClick() {
    if (!this.isButtonDisabled) {
      this.isButtonDisabled = true;
      const customDelayInMilliseconds = 300000;
      setTimeout(() => {
        this.isButtonDisabled = false;
      }, customDelayInMilliseconds);
    }
  }

  opennew() {
    this.testmethod = true;
    console.log(this.testmethod);
    //$('#myModalx').modal('show');
  }

  reopen() {
    this.isLoadingPatient = true;
    //this.isButtonDisabled = false;
    this.api.getItems().subscribe((res) => {
      this.isLoadingPatient = false;
      this.productList = res;
      this.data = res;
    });
  }

  reopenClose() {
    this.isButtonDisabled = false;
    this.api.getItems().subscribe((res) => {
      this.productList = res;
      this.data = res;
    });
  }

  openModalDeleteWarning() {
    this.showDivAll = false;
    //$('#myModalDeleteWarning').modal('show');
  }
  closeModalDeleteWarning() {
    $('#myModalDeleteWarning').modal('hide');
    this.reopen();
    this.isButtonDisabled = false;
    // Use Angular method to hide the modal
  }

  openMyModalDeleteWarningSingleItem(id: string, title: string) {
    this.showDiv = false;
    //console.log(id + title);
    this.idSingleItem = id;
    this.titleSingleItem = title;
    //$('#myModalDeleteWarningSingleItem').modal('show');

  }
  closeMyModalDeleteWarningSingleItem() {
    this.showDiv = false;
    $('#myModalDeleteWarningSingleItem').modal('hide');
    this.reopen();
    this.isButtonDisabled = false;

  }
  clearFormAdvancedSearch() {
    this.form.setValue({
      title: "",
      category: "",
      description: "",
      date: "",
      price: "",
      categoryman: "",
      priceman: "",
    })
  }

  closeModalForUpdate() {
    this.showDivUpdated = false;
    $('#myModal').modal('hide');
    this.reopen();
    this.isButtonDisabled = false;
    // Use Angular method to hide the modal
  }

  openModalEdit() {
    $('#myModal').modal('show');
    this.closeModalAdd = false;
  }

  openModalAddNewItem() {

    console.log("modeltitlenewitem before " + this.modelTitle);

    this.form.setValue({
      title: "",
      category: "",
      description: "",
      price: "",
      image: "",
    })

    this.modelTitle = "Add New Item"
    this.imgSrc = '/assets/imgplaceholder.jpg';
    this.actionButton = "Add New Item"
    this.closeModalAdd = true;
    this.closeModalUpdate = false;

    console.log("modeltitlenewitem after " + this.modelTitle);

  }
//////////////////////////////////////////////////////////////////////////////////////////////

  clearForm() {
    this.form.setValue({
      number: "",
      title: "",
      category: "",
      description: "",
      price: "",
      image: "",
    })
    this.editModal = false;
    this.showDivUpdated = false;
    this.showDivAddToDataBase = false;
    this.closeModalUpdate = false,
    this.closeModalAdd = true;
    this.image = "";
    this.imgSrc = '/assets/imgplaceholder.jpg';

    //console.log(this.editModal);
    //this.number = ''; // Clear the form field values
    // You can clear other form fields in a similar way
    this.form.resetForm(); // Reset the entire form
  }

  closeModal() {
    $('#myModal').modal('hide');
    this.reopen();
    this.isButtonDisabled = false;
    // Use Angular method to hide the modal
  }

  closeModalForAdd() {
    this.showDivAddToDataBase = false;
    $('#myModal').modal('hide');
    this.reopen();
    this.isButtonDisabled = false;
  }

  //getUserFormDataForAdvancedSearch(data: any) {
  //console.log(data);
  //this.api.getItemsAdvancedSearch(data).subscribe((res) => {
  //this.productList = res;
  //this.data = res;
  //});
  //this.api.getItems()
  // Make an HTTP GET request with the query parameters
  //console.log(data.category);
  //this.api.getItemsAdvancedSearch(data).subscribe((result) => {
  //console.log(data);
  //console.log(result);
  //this.showDivAddToDataBase = true;
  //this.showDivUpdated = false;
  //this.reopen();
  //this.handleClick();
  //console.log("search query submited successfully");
  //});
  //}

  clearFormShowSavePatient(){


    this.patientGender = "gender";
    this.relationship = "Relationship";

    this.saveButtonStatus = "Save Patient"
    this.showDivAddToDataBase = false;
    this.currentPatientGroup = "Chose Group Name";

    //this.currentPatientGroup = "Chose Group Name";
    if (this.form) {
      this.form.resetForm();  // Reset the form to clear all fields

    }
    console.log("drop nature:", this.isCollapsedNewPatient);
    

    this.form.setValue({
      patientFirstName: null,
      patientSecondName: null,
      patientContact: defaultContactValue(),
      patientAddress: null,
      patientGender: "gender",
      patientAge: null,
      patientDateOfBirth: null,
      nextOfKinName: null,
      nextOfKinContact: defaultContactValue(),
      relationship: "Relationship",
      nextOfKinAddress: null,
      patientGroupId: null,

    })


  }



  clearFormShowNewPatientGroup(){

    this.getAllPatientGroupsForShow();

    this.currentGroup = {
      groupContact: defaultContactValue(),
    };

    //this.currentPatientGroup = "Chose Group Name";
    if (this.usersFormNewGroup) {
      this.usersFormNewGroup.resetForm();  // Reset the form to clear all fields

    }
    
  }


  


  clearFields(){
    this.saveButtonStatus = "Save Patient"
    this.currentPatientGroup = "Chose Group Name";
  }





  getUserFormDataNewGroup(data: any) {

    this.showDivUpdatedLoaderNewPatient = true;

     console.log("Original data:", data);
  
    
  
    if (this.saveButtonStatusGroup == "Save Group") {
      this.api.createPatientGroup(data).subscribe(
        (response) => {
          console.log("Data sent to API:", data);
          console.log("res all", response);
  
          if (response && response.message) {
            this.responseColor = "rgb(11, 155, 112)"; // Green for success
            console.log("Message:", response.message);
            this.responseMessage = response.message;
          } else {
            this.responseColor = "rgb(238, 16, 16)"; // Red for error
            this.responseMessage = "Internal server error";
          
          }
  
          this.showDivUpdatedLoaderNewPatient = false;

          this.showDivAddToDataBaseDelete = true;
  
          setTimeout(() => {
            this.showDivAddToDataBaseDelete = false;
            this.clearFormShowNewPatientGroup();
          }, 3000);
  
        },
        (error) => {
          console.error("Error saving group:", error);
  
          // Log the full error object for debugging
          console.error("Full error details:", error);
  
          // Extract the error message from the server response
          if (error.error && error.error.message) {
            this.responseMessage = error.error.message; // Use the error message from the server
          } else if (error.error && error.error.error) {
            this.responseMessage = error.error.error; // Fallback to error.error.error
          } else {
            this.responseMessage = "An unexpected error occurred. Please try again.";
          }
          this.responseColor = "rgb(238, 16, 16)"; // Red for error

          this.showDivUpdatedLoaderNewPatient = false;

  
          this.showDivAddToDataBaseDelete = true;
  
          setTimeout(() => {
            this.showDivAddToDataBaseDelete = false;
          }, 4000);
        }
      );
    } else if (this.saveButtonStatus == "UpDate") {
      console.log("patient id", this.patientId);
      console.log("confirm data before sending to api", data);
  
      this.api.updateItem(this.patientId, data).subscribe(
        (response) => {
          console.log("res all", response);
  
          if (response && response.message) {
            this.responseColor = "rgb(11, 155, 112)"; // Green for success
            console.log("Message:", response.message);
            this.responseMessage = response.message;
          } else {
            this.responseColor = "rgb(238, 16, 16)"; // Red for error
            this.responseMessage = "Internal server error";
          }

          this.showDivUpdatedLoaderNewPatient = false;

  
          this.showDivAddToDataBase = false;
          this.showDivUpdated = true;
          this.showDivNull = false;
  
          // Reload the patient list
          this.api.getItems().subscribe((res) => {
            this.productList = res;
            this.data = res;
            this.initializeTableData();
            console.log("Patient list reloaded");
          });
  
          setTimeout(() => {
            this.showDivUpdated = false;
            this.showDivNull = false;
            this.saveButtonStatus = "Save Patient";
            this.toggleCollapseNewPatient();
            this.isCollapsedNewPatient = false;
            this.patientId = "";
          }, 2000);
        },
        (error) => {
          console.error("Error updating patient:", error);
  
          // Log the full error object for debugging
          console.error("Full error details:", error);
  
          // Extract the error message from the server response
          if (error.error && error.error.message) {
            this.responseMessage = error.error.message; // Use the error message from the server
          } else if (error.error && error.error.error) {
            this.responseMessage = error.error.error; // Fallback to error.error.error
          } else {
            this.responseMessage = "An unexpected error occurred. Please try again.";
          }
          this.responseColor = "rgb(238, 16, 16)"; // Red for error

          this.showDivUpdatedLoaderNewPatient = false;

  
          this.showDivAddToDataBaseDelete = true;
  
          setTimeout(() => {
            this.showDivAddToDataBaseDelete = false;
          }, 4000);
        }
      );
    }
  }





  getUserFormData(data: any) {

    this.showDivUpdatedLoaderNewPatient = true;

 
    console.log("Original id:", data.id);
    console.log("Original data:", data);

    if (
      (data.patientAge === undefined ||
        data.patientAge === null ||
        data.patientAge === '') &&
      this.currentPatient?.patientAge != null &&
      this.currentPatient.patientAge !== ''
    ) {
      data.patientAge = this.coercePatientAgeForForm(this.currentPatient.patientAge);
    }

    const rawGender = data.patientGender;
    if (
      rawGender === undefined ||
      rawGender === null ||
      rawGender === '' ||
      rawGender === 'gender'
    ) {
      if (this.patientGender != null && this.patientGender !== 'gender') {
        data.patientGender = this.patientGender;
      } else if (this.currentPatient?.patientGender != null) {
        data.patientGender = this.normalizeGenderForSelect(this.currentPatient.patientGender);
      }
    } else {
      data.patientGender = this.normalizeGenderForSelect(rawGender);
    }
  
    // ✅ Convert patientDateOfBirth (Object → String "YYYY-MM-DD") or set to null
    if (data.patientDateOfBirth && typeof data.patientDateOfBirth === 'object') {
      const { year, month, day } = data.patientDateOfBirth;
      data.patientDateOfBirth = `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
    } else {
      data.patientDateOfBirth = null; // Handle empty date
    }
  
    // ✅ Convert patientAge to BigDecimal or set to null
    if (data.patientAge !== undefined && data.patientAge !== null && data.patientAge !== '') {
      data.patientAge = Number(data.patientAge).toFixed(2); // Convert to BigDecimal format
    } else {
      data.patientAge = null; // Handle empty age
    }
  
    console.log("Formatted Data:", data);
  
    // ✅ Check for missing names and STOP execution if found
    if (!data.patientFirstName || !data.patientSecondName) {
      this.responseMessage = "First name and second name are required.";
      this.responseColor = "rgb(238, 16, 16)"; // Red for error
      this.showDivUpdatedLoaderNewPatient = false;

      this.showDivUpdated = true;  // Show error message
      setTimeout(() => {
        this.showDivUpdated = false; // Hide after 2 seconds
      }, 2000);
      return;  // 🚨 Stop execution here, preventing save or update
    }

        // ✅ Check for missing names and STOP execution if found
        if (data.patientFirstName == data.patientSecondName) {
          this.responseMessage = "First name and second name can't be the same.";
          this.responseColor = "rgb(238, 16, 16)"; // Red for error
          this.showDivUpdatedLoaderNewPatient = false;

          this.showDivUpdated = true;  // Show error message
          setTimeout(() => {
            this.showDivUpdated = false; // Hide after 2 seconds
          }, 2000);
          return;  // 🚨 Stop execution here, preventing save or update
        }


       
    const groupId =
      this.currentPatientGroupId != null && this.currentPatientGroupId !== ''
        ? this.currentPatientGroupId
        : data.patientGroupId != null && data.patientGroupId !== ''
          ? data.patientGroupId
          : this.currentPatient?.patientGroupId ?? null;

    const requestData = {
      ...data,
      patientGroupId: groupId,
      userRole: this.userRole,
    };
 


  
    if (this.saveButtonStatus == "Save Patient") {
      this.api.addPatient(requestData).subscribe(
        (response) => {
          console.log("Data sent to API:", data);
          console.log("res all", response);


  
          if (response && response.message) {
            this.responseColor = "rgb(11, 155, 112)"; // Green for success
            console.log("Message:", response.message);
            this.responseMessage = response.message;
          } else {
            this.responseColor = "rgb(238, 16, 16)"; // Red for error
            this.responseMessage = "Internal server error";
          
          }
  
          this.showDivUpdatedLoaderNewPatient = false;

          this.showDivUpdated = true;
          this.showDivNull = false;
  
          this.reopen();
          this.handleClick();
  
          setTimeout(() => {
            this.showDivAddToDataBase = false;
            this.showDivNull = false;
            this.showDivUpdated = false;
            this.toggleCollapseNewPatient();
            this.isCollapsedNewPatient = !this.isCollapsedNewPatient;
          }, 3000);
  
    
        },
        (error) => {
          console.error("Error saving patient:", error);
  
          // Log the full error object for debugging
          console.error("Full error details:", error);
  
          // Extract the error message from the server response
          if (error.error && error.error.message) {
            this.responseMessage = error.error.message; // Use the error message from the server
          } else if (error.error && error.error.error) {
            this.responseMessage = error.error.error; // Fallback to error.error.error
          } else {
            this.responseMessage = "An unexpected error occurred. Please try again.";
          }
          this.responseColor = "rgb(238, 16, 16)"; // Red for error

          this.showDivUpdatedLoaderNewPatient = false;

  
          this.showDivUpdated = true;
          this.showDivNull = false;
  
          setTimeout(() => {
            this.showDivUpdated = false;
             this.isCollapsedNewPatient = !this.isCollapsedNewPatient;
          }, 8000);
        }
      );
    } else if (this.saveButtonStatus == "UpDate") {
      console.log("patient id", this.patientId);
      console.log("confirm data before sending to api", data);
  
      this.api.updateItem(this.patientId, requestData).subscribe(
        (response) => {
          console.log("res all", response);
  
          if (response && response.message) {
            this.responseColor = "rgb(11, 155, 112)"; // Green for success
            console.log("Message:", response.message);
            this.responseMessage = response.message;
          } else {
            this.responseColor = "rgb(238, 16, 16)"; // Red for error
            this.responseMessage = "Internal server error";
          }

          this.showDivUpdatedLoaderNewPatient = false;

  
          this.showDivAddToDataBase = false;
          this.showDivUpdated = true;
          this.showDivNull = false;
  
          // Reload the patient list
          this.api.getItems().subscribe((res) => {
            this.productList = res;
            this.data = res;
            this.initializeTableData();
            console.log("Patient list reloaded");
          });
  
          setTimeout(() => {
            this.showDivUpdated = false;
            this.showDivNull = false;
            this.saveButtonStatus = "Save Patient";
            this.toggleCollapseNewPatient();
            this.isCollapsedNewPatient = false;
            this.patientId = "";
             this.isCollapsedNewPatient = !this.isCollapsedNewPatient;
          }, 8000);
        },
        (error) => {
          console.error("Error updating patient:", error);
  
          // Log the full error object for debugging
          console.error("Full error details:", error);
  
          // Extract the error message from the server response
          if (error.error && error.error.message) {
            this.responseMessage = error.error.message; // Use the error message from the server
          } else if (error.error && error.error.error) {
            this.responseMessage = error.error.error; // Fallback to error.error.error
          } else {
            this.responseMessage = "An unexpected error occurred. Please try again.";
          }
          this.responseColor = "rgb(238, 16, 16)"; // Red for error

          this.showDivUpdatedLoaderNewPatient = false;

  
          this.showDivUpdated = true;
          this.showDivNull = false;
  
          setTimeout(() => {
            this.showDivUpdated = false;
             this.isCollapsedNewPatient = !this.isCollapsedNewPatient;
          }, 6000);
        }
      );
    }
  }





    deletePatient(id: any) {

      this.showDivUpdatedLoaderDeletePatient = true;
      this.api.deletePatientById(id).subscribe(
        (response) => {
          console.log("response", response);

          if (response && response.message) {
            this.responseColor = "rgb(238, 16, 16)"; // Green for success
            console.log("Message:", response.message);
            this.responseMessage = response.message;
          } else {
            this.responseColor = "rgb(238, 16, 16)"; // Red for error
            this.responseMessage = "Internal server error";
          }
          this.showDivUpdatedLoaderDeletePatient = false;

  
          this.showDivAddToDataBaseDelete = true;

          // Reload the patient list
          this.api.getItems().subscribe((res) => {
            this.productList = res;
            this.data = res;
            this.initializeTableData();
            console.log("Patient list reloaded");
          });

          setTimeout(() => {
            this.showDivAddToDataBaseDelete = false;
          }, 2000);
    
    
        },
        (error) => {
          console.error("Error deleting patient:", error);
  
          // Log the full error object for debugging
          console.error("Full error details:", error);
  
          // Extract the error message from the server response
          if (error.error && error.error.message) {
            this.responseMessage = error.error.message; // Use the error message from the server
          } else if (error.error && error.error.error) {
            this.responseMessage = error.error.error; // Fallback to error.error.error
          } else {
            this.responseMessage = "An unexpected error occurred. Please try again.";
          }
          this.responseColor = "rgb(238, 16, 16)"; // Red for error

          this.showDivUpdatedLoaderDeletePatient = false;

  
          this.showDivAddToDataBaseDelete = true;

  
          setTimeout(() => {
            this.showDivAddToDataBaseDelete = false;
          }, 3000);
        }
      );
    }

    changeCurrentGroup(patientGroup: any) {
      if (patientGroup && !this.accessControl.canAssignPatientToGroup(patientGroup)) {
        alert('You need admin approval to add any patient in Veneranda Hospital group.');
        return;
      }
      if (patientGroup) {
        this.currentPatientGroup = patientGroup.groupNameShortForm || 'Unknown Group';
        this.currentPatientGroupId = patientGroup.id || null;
        if (this.currentPatient) {
          this.currentPatient.patientGroupId = this.currentPatientGroupId;
        }
        console.log('Selected group name:', this.currentPatientGroup);
        console.log('Selected group ID:', this.currentPatientGroupId);
      } else {
        console.warn('No patient group selected');
        this.currentPatientGroup = 'Choose Group Name';
      }
    }

    /**
     * First letter of the patient's group (patient table name column badge).
     */
    getPatientGroupInitial(item: any): string {
      if (!item) {
        return '';
      }
      const label = this.resolvePatientGroupDisplayName(item);
      let s = String(label || '').trim();
      if (s.length > 0) {
        return s.charAt(0).toUpperCase();
      }
      const gid = item.patientGroupId ?? item.patientGroup?.id;
      if (gid != null && gid !== '' && Array.isArray(this.patientGroupList)) {
        const g = this.patientGroupList.find((pg: any) => String(pg?.id) === String(gid));
        if (g) {
          s = String(
            this.groupRecordDisplayName(g) || ''
          ).trim();
          if (s.length > 0) {
            return s.charAt(0).toUpperCase();
          }
        }
      }
      return '';
    }

    private resolvePatientGroupDisplayName(item: any): string {
      const nested = item.patientGroup ?? item.group;
      return (
        item.groupNameShortForm ||
        nested?.groupNameShortForm ||
        item.groupName ||
        (nested && this.groupRecordDisplayName(nested)) ||
        item.groupNameShortName ||
        item.companyName ||
        ''
      );
    }

    private groupRecordDisplayName(g: any): string {
      if (!g) {
        return '';
      }
      return g.groupNameShortForm || g.groupName || g.groupNameShortName || g.name || '';
    }

    /** Patient registration / creation timestamp from API (field names vary by backend). */
    getPatientCreatedDisplay(item: any): string {
      if (!item) {
        return 'N/A';
      }
      const raw =
        item.creationDate ??
        item.CreationDate ??
        item.createdAt ??
        item.createdDate ??
        item.dateCreated ??
        item.registrationDate ??
        item.registeredAt ??
        item.patientCreatedAt ??
        item.created_at ??
        item.date_created;
      if (raw == null || raw === '') {
        return 'N/A';
      }
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) {
        return String(raw);
      }
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }

    loadPatientGroups(){
      this.api.getPatientGroupList().subscribe((res) => {
        this.patientGroupList = res;
        console.log('group list',this.patientGroupList);
        //console.log(patientId);
  
      });  }

    /**
     * Map API / legacy gender strings to select values: male | female | gender (placeholder).
     * Handles "Male"/"MALE", single-letter M/F, etc. (female checked before male — "female" contains "male").
     */
    private normalizeGenderForSelect(raw: any): string {
      if (raw == null || String(raw).trim() === '') {
        return 'gender';
      }
      const s = String(raw).trim().toLowerCase();
      if (s === 'female' || s.includes('female') || s === 'f' || s === 'woman') {
        return 'female';
      }
      if (s === 'male' || s.includes('male') || s === 'm' || s === 'man') {
        return 'male';
      }
      return 'gender';
    }

    /** Coerce API age (string, decimal, Mongo-style) for number input + update payload. */
    private coercePatientAgeForForm(raw: any): number | null {
      if (raw === undefined || raw === null || raw === '') {
        return null;
      }
      if (typeof raw === 'number' && Number.isFinite(raw)) {
        return raw;
      }
      if (typeof raw === 'string') {
        const n = parseFloat(raw.replace(',', '.'));
        return Number.isFinite(n) ? n : null;
      }
      if (typeof raw === 'object' && raw !== null) {
        if ('$numberDecimal' in raw) {
          return this.coercePatientAgeForForm((raw as any).$numberDecimal);
        }
        if ('value' in raw) {
          return this.coercePatientAgeForForm((raw as any).value);
        }
      }
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    }

    loadPatientGroupByGroupName(id: any) {
      if (id == null || id === '') {
        this.currentPatientGroupId = null;
        this.currentPatientGroup = 'Choose Group';
        return;
      }
      this.currentPatientGroupId = id;
      this.api.getPatientGroupByGroupName(id).subscribe({
        next: (res) => {
          this.patientGroup = res;
          if (res) {
            this.currentPatientGroup =
              res.groupNameShortForm || res.groupName || 'Unknown Group';
            if (res.id != null) {
              this.currentPatientGroupId = res.id;
            }
            if (this.currentPatient) {
              this.currentPatient.patientGroupId = this.currentPatientGroupId;
            }
            console.log('group now', this.currentPatientGroup);
          }
        },
        error: () => {
          this.currentPatientGroup = 'Choose Group';
        },
      });
    }
  
      

  editPatient(item: any) {

    this.initializeTableData()

    this.isCollapsedNewPatient = true;

      this.saveButtonStatus = "UpDate"
   
      console.log('this is the item item :', item);
    
      console.log('plain id:', item.id);
  
      this.patientId = item.id;

      this.patientGender = this.normalizeGenderForSelect(item.patientGender);
      this.currentPatient = { ...item };
      this.currentPatient.patientGender = this.patientGender;

      if (item.relationship != null) {
      this.relationship = item.relationship;
      }

      const ageVal = this.coercePatientAgeForForm(this.currentPatient.patientAge);
      this.currentPatient.patientAge = ageVal;

      if (item.patientGroupId != null && item.patientGroupId !== '') {
        this.loadPatientGroupByGroupName(item.patientGroupId);
      } else {
        this.currentPatientGroupId = null;
        this.currentPatientGroup = 'Choose Group';
        this.currentPatient.patientGroupId = null;
      }
  
      console.log('the save button status:', this.saveButtonStatus);
  
      // Convert patientDateOfBirth to NgbDateStruct
      if (this.currentPatient.patientDateOfBirth != null) {
        const date = new Date(this.currentPatient.patientDateOfBirth);
        if (!Number.isNaN(date.getTime())) {
          this.currentPatient.patientDateOfBirth = {
            year: date.getFullYear(),
            month: date.getMonth() + 1,
            day: date.getDate(),
          };
        }
      }
  
  
      console.log('Converted Date of Birth:', this.currentPatient.patientDateOfBirth);
  
  
      console.log('Editing patient:', this.currentPatient);

      this.isCollapsedNewPatient = false;



  }
    
    

  
  
  



  addtoDetails(item: any) {
    this.dataService.setSharedVariable1(item);
    this.dataService.setSharedVariable2(this.productList);
  }

  deleteProduct() {
    this.showDiv = true;
    this.api.deleteItemById(this.idSingleItem);
    this.reopen();
    console.log("item deleted successfully");
    this.reopen();
    this.handleClick();
  }

  deleteAllProduct() {
    this.showDivAll = true;
    this.api.deleteAllItems();
    this.handleClick();
    this.reopen();
    console.log("all items deleted, therefore your shop is empty");
  }

  editProduct(id: number) {
    console.log("modelTitle before "+ this.modelTitle);

    this.modelTitle="Update Item"
    this.actionButton="Update Item"

   console.log("modelTitle after "+ this.modelTitle);

   console.log("showDivUpdated before "+ this.showDivUpdated);
   console.log("closeModalAdd before "+ this.closeModalAdd);

    this.showDivUpdated = false;
    this.showDivAddToDataBase = false;

    this.closeModalAdd = false;

    this.closeModalUpdate = true;

    console.log("closeupdate after "+ this.closeModalUpdate);
    console.log("closeModalAdd after "+ this.closeModalAdd);


    this.editModal = true;

    console.log(this.editModal);
    this.currentProductId = id;
    let currentProduct = this.filteredProductList3.find((p) => { return p.id === id });
    //this.openModalEdit();
    this.imgSrc = currentProduct.image;
    //console.log(currentProduct);
    this.form.setValue({
      title: currentProduct.title,
      category: currentProduct.category,
      description: currentProduct.description,
      price: currentProduct.price,
      image: currentProduct.image,
    });

    /*this.form.patchValue({
      number: currentProduct.number, // Update field1
      category: currentProduct.category, // Update field2
    });*/
  }


  patientDetails(item: any) {
    this.showDivUpdatedLoaderDeletePatient = true;
    this.api.getInitialVisitForPatientId(item.id).subscribe({
      next: (res) => {
        this.initialPatientVisit = res ?? {};
        console.log('initial patient visit', this.initialPatientVisit);
        console.log(item.id);

        sessionStorage.setItem('item', JSON.stringify(item));
        sessionStorage.setItem('initialPatientVisit', JSON.stringify(this.initialPatientVisit));
        this.showDivUpdatedLoaderDeletePatient = false;
        this.router.navigate(['/overview/consultation-v2']);
      },
      error: () => {
        sessionStorage.setItem('item', JSON.stringify(item));
        sessionStorage.setItem('initialPatientVisit', JSON.stringify({}));
        this.showDivUpdatedLoaderDeletePatient = false;
        this.router.navigate(['/overview/consultation-v2']);
      }
    });
  }
  

 

  














  






  addItemToCart(item:any) {

    //this.cartApi.getTotalqnt(item);

    console.log("This is the product ID: " + item.id);

    // Get the user ID from local storage
    const userId = sessionStorage.getItem('userid');
    console.log("This is the user ID: " + userId);

    // Ensure the userId and itemId are not null, and convert them to numbers (Long)
    if (!userId || !item.id) {
        console.error("User ID or Product ID is missing!");
        return;
    }

    const data = {
        userId: Number(userId), // Convert userId to a number
        shopItemId: Number(item.id) // Convert shopItemId to a number
    };


    this.api.addToCartDb(data).subscribe(
      
        response => {
            console.log("Item added to cart successfully", response);
           // console.log("Item added to cart successfully", response.data.entity.data.items);
            //console.log("Item added to cart successfully", response.data.entity.data.totalQuantity);

            this.cartItems = response.data.entity.data.items;
            //this.totalQuantity = response.data.entity.data.totalQuantity;

            const totalQuantity = Number(response.data.entity.data.totalQuantity); // Convert userId to a number


            this.dataService.setshareCartTotalQuantity(totalQuantity);



            console.log("totalquantity", totalQuantity);



          

            //sessionStorage.setItem('totalQuantity', totalQuantity);


            //this.cartApi.getTotalqnt(this.totalQuantity);

  
            // Log the response to the console
            //console.log('Cart items:', this.cartItems);
            //console.log('Total quantity:', this.totalQuantity);
                        
          },
        error => {
            console.log("Error adding item to cart", error);
        }
    );


}












  openPopup() {
    this.dialog.open(PopupComponent)
  }

  // date fileds here open
  onDateSelection(date: NgbDate) {
    if (!this.fromDate && !this.toDate) {
      this.fromDate = date;
    } else if (this.fromDate && !this.toDate && date && date.after(this.fromDate)) {
      this.toDate = date;
    } else {
      this.toDate = null;
      this.fromDate = date;
    }
  }

  isHovered(date: NgbDate) {
    return (
      this.fromDate && !this.toDate && this.hoveredDate && date.after(this.fromDate) && date.before(this.hoveredDate)
    );
  }

  isInside(date: NgbDate) {
    return this.toDate && date.after(this.fromDate) && date.before(this.toDate);
  }

  isRange(date: NgbDate) {
    return (
      date.equals(this.fromDate) ||
      (this.toDate && date.equals(this.toDate)) ||
      this.isInside(date) ||
      this.isHovered(date)
    );
  }

  validateInput(currentValue: NgbDate | null, input: string): NgbDate | null {
    const parsed = this.formatter.parse(input);
    return parsed && this.calendar.isValid(NgbDate.from(parsed)) ? NgbDate.from(parsed) : currentValue;
  }
  // date fileds here closed
}

