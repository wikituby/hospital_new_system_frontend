import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ApiService } from '../services/api.service';
import { CartapiService } from '../services/cartapi.service'; // Import the CartapiService (assuming it's correct)
import { DataService } from '../services/data.service';
import { Router } from '@angular/router';


@Component({
  selector: 'app-products',
  templateUrl: './products.component.html',
  styleUrls: ['./products.component.css']
})
export class ProductsComponent implements OnInit {
  productList: any;
  itemman: any;
  dialog: any;

  page: number = 1;


  constructor(private router:Router, private api: ApiService, private cartApi: CartapiService,private dataService: DataService) {}

  ngOnInit(): void {
    this.api.getItems().subscribe((res:any) => {
      this.productList = res;
      this.productList.forEach((a: any) => {
        Object.assign(a, { quantity: 1, total: a.price });
        //console.log("grandqn is:"+this.cartApi.getTotalqnt());
      });
    });
    
  }

  addtoCart(item: any) {
    this.itemman = item;
    this.cartApi.addToCart(item);
  }

  addtoCartExist(item: any){
    this.api.addToCartDb(item);
    this.cartApi.addToCartExist(item);
    
  }

  addtoCartDataBase(item: any){
    console.log("tt is: " + item);
    //this.cartApi.addToCartExist(item);

    
  }

      //console.log("tt is: " + grandTotalqn);


  addtoDetails(item: any) {
    this.router.navigate(['/product-details']);
    this.dataService.setSharedVariable1(item);
    this.dataService.setSharedVariable2(this.productList); 
    
  }

  addNewProduct(){

  }



}
