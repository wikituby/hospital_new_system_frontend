import { Component, OnInit, Input } from '@angular/core';
import { ProductService } from '../services/product.service';
import { CartapiService } from '../services/cartapi.service';
import { DataService } from '../services/data.service';
import { ApiService } from '../services/api.service';


@Component({
  selector: 'app-product-details',
  templateUrl: './product-details.component.html',
  styleUrls: ['./product-details.component.css']
})
export class ProductDetailsComponent implements OnInit {
  ProductDetails: any;
  productList: any;
  sharedValue: any;
  sharedValue2: any;
  parentMessage:string="from parent"

  constructor(private api: ApiService,private dataService: DataService,private cartApi: CartapiService) {}

  ngOnInit(): void {
    this.sharedValue = this.dataService.getSharedVariable1();
    this.sharedValue2 = this.dataService.getSharedVariable2();
    console.log(this.sharedValue);

  }

  addtoCart(item: any) {
    this.cartApi.addToCartExist(item);
    
  }
  addtoDetails(item: any) {
    this.dataService.setSharedVariable1(item);
    this.dataService.setSharedVariable2(this.productList); 
    
  }

}



