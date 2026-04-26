import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PartialLeaveApply } from './partial-leave-apply';

describe('PartialLeaveApply', () => {
  let component: PartialLeaveApply;
  let fixture: ComponentFixture<PartialLeaveApply>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PartialLeaveApply]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PartialLeaveApply);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
