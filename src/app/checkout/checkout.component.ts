import { Component, OnInit } from '@angular/core';
import { CartapiService } from '../services/cartapi.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-checkout',
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.css']
})
export class CheckoutComponent implements OnInit {
  products:any = [];

  constructor(private router: Router,private cartApi: CartapiService ){}

  ngOnInit(): void {
    const username = sessionStorage.getItem('username');

    if (username===null) {
      this.router.navigate(['/login']);
    }
    
  }

  removeProduct(item:any){
    this.cartApi.removeCartData(item);

  }





}
