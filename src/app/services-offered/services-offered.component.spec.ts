import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ServicesOfferedComponent } from './services-offered.component';

describe('ServicesOfferedComponent', () => {
  let component: ServicesOfferedComponent;
  let fixture: ComponentFixture<ServicesOfferedComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ServicesOfferedComponent]
    });
    fixture = TestBed.createComponent(ServicesOfferedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
