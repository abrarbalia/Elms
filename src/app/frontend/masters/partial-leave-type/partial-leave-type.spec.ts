import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PartialLeaveType } from './partial-leave-type';

describe('PartialLeaveType', () => {
  let component: PartialLeaveType;
  let fixture: ComponentFixture<PartialLeaveType>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PartialLeaveType]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PartialLeaveType);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
