import { TestBed } from '@angular/core/testing';

import { FileresourceService } from './fileresource.service';

describe('FileresourceService', () => {
  let service: FileresourceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FileresourceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
