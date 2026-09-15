import { Injectable } from '@angular/core';
import { NgForm } from '@angular/forms';

@Injectable({
  providedIn: 'root'
})
export class DataService {
  private sharedVariable1: any;
  private sharedVariable2: any;
  private sharedVariable3: number=0;
  private sharedVariable4!: NgForm;
  private sharedCartList: any;
  private shareCartTotalQuantity: number=0;

  // Replace 'any' with the actual type of your variables

  setSharedVariable1(data: any) {
    this.sharedVariable1 = data;
  }

  getSharedVariable1(): any {
    return this.sharedVariable1;
  }

  setSharedVariable2(data: any) {
    this.sharedVariable2 = data;
  }

  getSharedVariable2(): any {
    return this.sharedVariable2;
  }

  setSharedVariable3(data: any) {
    this.sharedVariable3 = data;
  }

  getSharedVariable3(): any {
    return this.sharedVariable3;
  }

  setSharedVariable4(data: any) {
    this.sharedVariable4 = data;
  }

  getSharedVariable4(): any {
    return this.sharedVariable4;
  }



  setsharedCartList(data: any) {
    this.sharedCartList = data;
  }

  getsharedCartList(): any {
    return this.sharedCartList;
  }


  setshareCartTotalQuantity(data: any) {
    this.shareCartTotalQuantity = data;
  }

  getshareCartTotalQuantity(): any {
    return this.shareCartTotalQuantity;
  }

}
