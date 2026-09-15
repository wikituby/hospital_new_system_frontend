import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Login3Component } from './login3.component';

describe('Login3Component', () => {
  let component: Login3Component;
  let fixture: ComponentFixture<Login3Component>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [Login3Component]
    });
    fixture = TestBed.createComponent(Login3Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
