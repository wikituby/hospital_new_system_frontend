import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { ApiService } from '../services/api.service';
import { CartapiService } from '../services/cartapi.service';
import { DataService } from '../services/data.service';
import { MatDialog, MatDialogContent } from '@angular/material/dialog';
import { HttpClient } from '@angular/common/http';
import { NgForm } from '@angular/forms';


declare var $: any;

@Component({
  selector: 'app-popup',
  templateUrl: './popup.component.html',
  styleUrls: ['./popup.component.css']
})
export class PopupComponent implements OnInit {

  title = "Angular Server Post Data Test"

  productList: any[] = [];
  itemman: any;
  data: any[] = [];
  editModal: boolean = false;
  currentProductId: any;
  idSingleItem: any;
  titleSingleItem: any;

  tableUpdater: boolean = false;

  showDiv: boolean = false;
  showDivAll: boolean = false;

  showDivAddToDataBase: boolean = false;
  showDivUpdated: boolean = false;

  closeModalAdd: boolean = false;
  closeModalUpdate: boolean = false;

  testmethod: boolean = false;

  isButtonDisabled: boolean = false;

  @ViewChild('usersForm') form!: NgForm;

  constructor(private api: ApiService, private cartApi: CartapiService, private dataService: DataService, private dialog: MatDialog, private http: HttpClient) { }

  ngOnInit(): void {
    this.api.getItems().subscribe((res:any) => {
      this.productList = res;
      this.data = res;
      console.log(this.editModal);
    });
  };

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
    //this.isButtonDisabled = false;
    this.api.getItems().subscribe((res:any) => {
      this.productList = res;
      this.data = res;
    });
  }

  reopenClose() {
    this.isButtonDisabled = false;
    this.api.getItems().subscribe((res:any) => {
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
    console.log(id + title);
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

  openModal() {
    this.clearForm();
    //$('#myModal').modal('show');
  }
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
    console.log(this.editModal);
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

  getUserFormData(data: any) {
    if (!this.editModal) {
      this.api.addItem(data).subscribe((result:any) => {
        console.log(result);
        this.showDivAddToDataBase = true;
        this.showDivUpdated = false;
        this.reopen();
        this.handleClick();
        console.log("item added successfully");
      });

    } else {
      this.api.updateItem(this.currentProductId, data)
      this.showDivUpdated = true;
      this.reopen();
      this.handleClick();
      console.log("item updated successfully");
    }
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
    this.showDivUpdated = false;
    this.closeModalAdd = false;
    this.closeModalUpdate = true;
    this.editModal = true;
    console.log(this.editModal);
    this.currentProductId = id;
    let currentProduct = this.productList.find((p) => { return p.id === id });
    //this.openModalEdit();
    console.log(currentProduct);

    this.form.setValue({
      number: currentProduct.number,
      title: currentProduct.title,
      category: currentProduct.category,
      description: currentProduct.description,
      price: currentProduct.price,
      image: currentProduct.image
    });
  }

  openPopup() {
    //this.dialog.open(PopupComponent)

  }

}