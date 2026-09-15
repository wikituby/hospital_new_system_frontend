import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StockReceiveComponent } from './stock-receive.component';

describe('StockReceiveComponent', () => {
  let component: StockReceiveComponent;
  let fixture: ComponentFixture<StockReceiveComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [StockReceiveComponent]
    });
    fixture = TestBed.createComponent(StockReceiveComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
