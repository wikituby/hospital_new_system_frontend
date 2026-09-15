import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class UserdataService {

  url ="http://192.168.100.9:8080/course/shop-item";


  constructor(private http: HttpClient) { }

  addItem(data: any){
    return this.http.post(this.url,data);
  }

  /*addItem(data: any){
    return this.http.post(this.url,data);
  }*/

}
