import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TermsModalComponent } from './terms-modal.component';

const mockTerms = {
  version: 'v1',
  html: '<h1>Terms</h1><p>Sample</p>'
};

describe('TermsModalComponent', () => {
  it('renders terms HTML content', async () => {
    await TestBed.configureTestingModule({
      imports: [TermsModalComponent, NoopAnimationsModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: mockTerms },
        { provide: MatDialogRef, useValue: { close: vi.fn() } }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(TermsModalComponent);
    fixture.detectChanges();

    const content = fixture.nativeElement.querySelector('.terms-modal__content') as HTMLElement;
    expect(content.innerHTML).toContain('Terms');
    expect(content.textContent).toContain('Sample');
  });
});
