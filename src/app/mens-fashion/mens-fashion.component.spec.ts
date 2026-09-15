import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MensFashionComponent } from './mens-fashion.component';

describe('MensFashionComponent', () => {
  let component: MensFashionComponent;
  let fixture: ComponentFixture<MensFashionComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [MensFashionComponent]
    });
    fixture = TestBed.createComponent(MensFashionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
