import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ThemeService } from '../../../../services/theme.service';

@Component({
  selector: 'app-patient-billing',
  templateUrl: './patient-billing.component.html',
  styleUrls: ['./patient-billing.component.css']
})
export class PatientBillingComponent implements OnInit {
  isDarkMode: boolean = false;
  patientSearch: string = '';
  selectedPatient: any = null;
  selectedCategory: string = 'all';
  selectedPaymentMethod: string = 'cash';
  amountReceived: number = 0;
  insuranceProvider: string = '';
  policyNumber: string = '';
  discount: number = 0;
  taxRate: number = 16;

  todayRevenue: number = 12500;
  pendingBills: number = 12;
  paidBills: number = 45;
  outstandingAmount: number = 8500;

  billNumber: string = 'BILL-2024-001';
  currentDate: string = new Date().toLocaleDateString();
  billItems: any[] = [];

  serviceCategories = [
    { id: 'all', name: 'All Services', icon: 'bi bi-grid' },
    { id: 'consultation', name: 'Consultation', icon: 'bi bi-clipboard-pulse' },
    { id: 'laboratory', name: 'Laboratory', icon: 'bi bi-flask' },
    { id: 'radiology', name: 'Radiology', icon: 'bi bi-camera-reels' },
    { id: 'pharmacy', name: 'Pharmacy', icon: 'bi bi-capsule' },
    { id: 'procedure', name: 'Procedures', icon: 'bi bi-scissors' }
  ];

  services = [
    { id: 1, name: 'General Consultation', code: 'CONS-001', category: 'consultation', price: 50 },
    { id: 2, name: 'Specialist Consultation', code: 'CONS-002', category: 'consultation', price: 100 },
    { id: 3, name: 'Complete Blood Count', code: 'LAB-001', category: 'laboratory', price: 25 },
    { id: 4, name: 'Blood Glucose Test', code: 'LAB-002', category: 'laboratory', price: 15 },
    { id: 5, name: 'Chest X-Ray', code: 'RAD-001', category: 'radiology', price: 80 },
    { id: 6, name: 'Ultrasound', code: 'RAD-002', category: 'radiology', price: 120 },
    { id: 7, name: 'CT Scan', code: 'RAD-003', category: 'radiology', price: 300 },
    { id: 8, name: 'Amoxicillin 500mg', code: 'PHAR-001', category: 'pharmacy', price: 2.50 },
    { id: 9, name: 'Paracetamol 500mg', code: 'PHAR-002', category: 'pharmacy', price: 0.50 }
  ];

  paymentMethods = [
    { id: 'cash', name: 'Cash', icon: 'bi bi-cash' },
    { id: 'card', name: 'Card', icon: 'bi bi-credit-card' },
    { id: 'insurance', name: 'Insurance', icon: 'bi bi-shield-check' },
    { id: 'mobile', name: 'Mobile Money', icon: 'bi bi-phone' }
  ];

  get filteredServices(): any[] {
    if (this.selectedCategory === 'all') {
      return this.services;
    }
    return this.services.filter(service => service.category === this.selectedCategory);
  }

  get subtotal(): number {
    return this.billItems.reduce((sum, item) => sum + item.total, 0);
  }

  get taxAmount(): number {
    return (this.subtotal * this.taxRate) / 100;
  }

  get grandTotal(): number {
    return this.subtotal + this.taxAmount - this.discount;
  }

  constructor(
    private router: Router,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.themeService.isDarkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
    });
    
    // Sample patient for demo
    this.selectedPatient = {
      name: 'John Doe',
      initials: 'JD',
      fileNo: 'P001234',
      age: 45,
      gender: 'Male',
      balance: 250
    };
  }

  createNewBill(): void {
    this.billItems = [];
    this.selectedPatient = null;
    this.patientSearch = '';
    this.discount = 0;
    this.amountReceived = 0;
  }

  selectCategory(categoryId: string): void {
    this.selectedCategory = categoryId;
  }

  addService(service: any): void {
    const existingItem = this.billItems.find(item => item.id === service.id);
    if (existingItem) {
      existingItem.quantity++;
      existingItem.total = existingItem.quantity * existingItem.price;
    } else {
      this.billItems.push({
        id: service.id,
        name: service.name,
        code: service.code,
        price: service.price,
        quantity: 1,
        total: service.price
      });
    }
  }

  increaseQuantity(index: number): void {
    this.billItems[index].quantity++;
    this.billItems[index].total = this.billItems[index].quantity * this.billItems[index].price;
  }

  decreaseQuantity(index: number): void {
    if (this.billItems[index].quantity > 1) {
      this.billItems[index].quantity--;
      this.billItems[index].total = this.billItems[index].quantity * this.billItems[index].price;
    }
  }

  removeItem(index: number): void {
    this.billItems.splice(index, 1);
  }

  selectPaymentMethod(methodId: string): void {
    this.selectedPaymentMethod = methodId;
  }

  applyDiscount(): void {
    const discountAmount = prompt('Enter discount amount:');
    if (discountAmount) {
      this.discount = parseFloat(discountAmount);
    }
  }

  saveDraft(): void {
    console.log('Save draft:', this.billItems);
  }

  processPayment(): void {
    console.log('Process payment:', {
      billItems: this.billItems,
      total: this.grandTotal,
      paymentMethod: this.selectedPaymentMethod
    });
  }

  printBill(): void {
    window.print();
  }
}
