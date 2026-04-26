import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PartialReport } from './partial-report';

describe('PartialReport', () => {
  let component: PartialReport;
  let fixture: ComponentFixture<PartialReport>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PartialReport]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PartialReport);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
