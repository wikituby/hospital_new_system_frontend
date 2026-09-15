import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { DataService } from '../services/data.service'; // Import HttpClient
import { ApiService } from './api.service';

@Injectable({
  providedIn: 'root'
})
export class CartapiService {
  cartDataList: any[] = [];
  productList = new BehaviorSubject<any[]>([]);
  ttqn: number = 0;
  totalSingle: number = 0;
  grandTotalSingle: number = 0;

  constructor(private httpClient: HttpClient, private dataService: DataService, private api: ApiService,
  ) { }

  getProductData() {
    return this.productList.asObservable();
  }

  setProduct(product: any) {
    this.cartDataList.push(product);
    this.productList.next(this.cartDataList);
  }

  addToCart(product: any) {

    this.cartDataList.push(product);
    this.productList.next(this.cartDataList);
    this.getTotalAmount();
    //console.log(this.cartDataList);
  }

  addToCartExist(product: any) {
    // Check if the product already exists in the cart
    const existingProduct = this.cartDataList.find((item: any) => item.id === product.id);

    if (existingProduct) {
      // If the product exists, increase the quantity

      existingProduct.quantity += 1;
      this.productList.next(this.cartDataList);
      this.getTotalAmount();
      this.getTotalqnt();
      existingProduct.total += product.price
      //this.grandTotalAmountSingle();
      //this.getTotalSingleAlternative();

      //this.getTotalqnt();
      //console.log("return on"+this.getTotalqnt());

      //this.newgtotal = this.getTotalqnt();

    } else {
      // If the product is not in the cart, add it with quantity 1

      this.cartDataList.push(product);
      this.productList.next(this.cartDataList);
      this.getTotalAmount();
      this.getTotalqnt();
      //existingProduct.total += product.price

      //this.getTotalSingleAlternative();
      //this.grandTotalAmountSingle();

      //console.log(this.cartDataList);
      //console.log("new " + this.getTotalqnt());
      //console.log("amount" + this.getTotalAmount());
      
    }
  }

  quantityIncrementCart(product: any) {
    //const existingProduct = this.cartDataList.find((item: any) => item.id === product.id);

    product.quantity += 1;
    this.productList.next(this.cartDataList);
    this.getTotalqnt();
    this.getTotalAmount();
    product.total += product.price

  }

  quantitydecrementCart(product: any) {

    if(product.quantity == 1){


    }else{
      product.quantity -= 1;
      this.productList.next(this.cartDataList);
      this.getTotalqnt();
      this.getTotalAmount();
      product.total -= product.price

    }

  }

  getTotalqnt(): any {
    let grandTotalqn = this.ttqn;
    //this.cartDataList.map((a: any) => {
     // grandTotalqn = ;
    //});
    //console.log("tt is: " + grandTotalqn);
    this.ttqn = grandTotalqn;
    console.log("new tttttttttttttqn is : " + this.ttqn);
    //sessionStorage.setItem('ttqn', grandTotalqn);

    this.dataService.setSharedVariable3(this.ttqn);

    return grandTotalqn
  }

  // Assuming cartDataList contains products with a 'quantity' property representing the quantity of each product in the cart.
  // Assuming cartDataList contains products with a 'quantity' property representing the quantity of each product in the cart.
  
  getTotalQuantity(): number {
    let totalQuantity = 0;

    // Iterate through the cartDataList and add up the quantity of each product.
    for (const product of this.cartDataList) {
      if (product.quantity && !isNaN(product.quantity)) {
        totalQuantity += product.quantity;
      }
    }

    return totalQuantity;
  }

  getTotalAmount(): number {
    let grandTotal = 0;
    this.cartDataList.map((a: any) => {
      grandTotal += a.price * a.quantity;
    });
    //console.log("log for grandtotal" + grandTotal);

    return grandTotal
  }

  grandTotalAmountSingle(): number {

    for (const product of this.cartDataList) {
      this.totalSingle = product.quantity * product.price;
    }

    return this.totalSingle
  }

  getTotalSingleAlternative(): number {
    this.cartDataList.map((a: any) => {
      this.grandTotalSingle = a.price * a.quantity;
    });

    return this.grandTotalSingle
  }

  removeCartData(product: any) {
    this.cartDataList.map((a: any, index: number) => {
      if (product.id === a.id) {
        this.cartDataList.splice(index, 1);
      }
    });
    this.productList.next(this.cartDataList)
  }

  removeAllCart() {
    this.cartDataList = [];
    this.productList.next(this.cartDataList);
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

            //this.cartItems = response.data.entity.data.items;
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











}
