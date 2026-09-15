import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { HttpClient } from '@angular/common/http'; // Import HttpClient

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  cartDataList: any[] = [];
  productList = new BehaviorSubject<any[]>([]);

  constructor(private httpClient: HttpClient) { }

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
    console.log(this.cartDataList);
  }

  getTotalAmount():number {
    let grandTotal = 0;
    this.cartDataList.map((a: any) => {
      grandTotal += a.total;
    });
    return grandTotal
  }

  removeCartData(product: any) {
    this.cartDataList.map((a: any, index: number) => {
      if (product.id === a.id) {
        this.cartDataList.splice(index, 1);
      }
    });
    this.productList.next(this.cartDataList)
  }


}
