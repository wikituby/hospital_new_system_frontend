import { Component, OnInit } from '@angular/core';
import { CartapiService } from '../services/cartapi.service';


@Component({
  selector: 'app-cart',
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.css']
})
export class CartComponent implements OnInit{
  products:any = [];
  allProducts:any =0;
  genqn:any;
  p: number = 1;

  

  constructor(private cartApi:CartapiService){}

  ngOnInit(): void {
    this.cartApi.getProductData().subscribe(res=>{
    this.products=res;
    this.allProducts = this.cartApi.getTotalAmount();
    this.genqn = this.cartApi.getTotalqnt();
    //console.log("genqn"+this.genqn);
    
    
    })
    
  }
  removeProduct(item:any){
    this.cartApi.removeCartData(item);

  }
  removeAllProduct(){
    this.cartApi.removeAllCart();
  }

  incrementQuantity(item: any) {
    this.cartApi.quantityIncrementCart(item)
  }

  decrementQuantity(item: any) {
    this.cartApi.quantitydecrementCart(item)
  }
}
