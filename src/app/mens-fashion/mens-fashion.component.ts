import { Component, OnInit } from '@angular/core';
import { ApiService } from '../services/api.service';
import { CartapiService } from '../services/cartapi.service'; // Import the CartapiService (assuming it's correct)
import { DataService } from '../services/data.service';

@Component({
  selector: 'app-mens-fashion',
  templateUrl: './mens-fashion.component.html',
  styleUrls: ['./mens-fashion.component.css']
})
export class MensFashionComponent implements OnInit{
  productList: any;
  itemman: any;
  parentMessage:string="from parent";
  storedUserName: any;


  constructor(private api: ApiService, private cartApi: CartapiService,private dataService: DataService) {}

  ngOnInit(): void {

    this.storedUserName = sessionStorage.getItem('username');

    if (this.storedUserName===null) {
      this.storedUserName="Account";
      
    }

      this.api.getItems().subscribe((res) => {
      this.productList = res;
      this.productList.forEach((a: any) => {
        Object.assign(a, { quantity: 1, total: a.price });
        //console.log("grandqn is:"+this.cartApi.getTotalqnt());
      });
    });
    
  }

  addtoCart(item: any) {
    this.itemman = item;
//this.cartApi.addToCart(item);
  }

  addtoCartExist(item: any){
    //this.cartApi.addToCartExist(item);
    
  }


  addtoDetails(item: any) {
    this.dataService.setSharedVariable1(item);
    this.dataService.setSharedVariable2(this.productList); 
    
  }

  


}