import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FormarrayexampleComponent } from './formarrayexample.component';

describe('FormarrayexampleComponent', () => {
  let component: FormarrayexampleComponent;
  let fixture: ComponentFixture<FormarrayexampleComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [FormarrayexampleComponent]
    });
    fixture = TestBed.createComponent(FormarrayexampleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
