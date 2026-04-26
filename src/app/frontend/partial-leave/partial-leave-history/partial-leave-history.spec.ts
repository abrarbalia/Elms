import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PartialLeaveHistory } from './partial-leave-history';

describe('PartialLeaveHistory', () => {
  let component: PartialLeaveHistory;
  let fixture: ComponentFixture<PartialLeaveHistory>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PartialLeaveHistory]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PartialLeaveHistory);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
