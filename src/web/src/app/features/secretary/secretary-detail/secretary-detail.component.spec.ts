import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { SecretaryDetailComponent } from './secretary-detail.component';
import { SecretaryEntriesService } from '../secretary-entries.service';
import { EntryDetailDto } from '../secretary.types';

const ENTRY: EntryDetailDto = {
  entryId: 'd7b99d91-2c6a-4fd0-9d4f-7c49d88c7b10',
  entryNumber: 'ENTRY-0001',
  submittedAtUtc: '2026-01-20T15:22:11Z',
  trial: {
    trialId: 'trial-1',
    name: 'Spring Stockdog Trial',
    formTemplate: {
      organizationCode: 'ASCA',
      sportCode: 'StockDog',
      formCode: 'TrialEntry',
      version: '2020-10-08'
    },
    organizerSlug: 'ORG',
    eventSlug: 'EVENT',
    trackingSlug: 'ORG-EVENT',
    hostClub: 'Host Club',
    startDate: '2026-05-02',
    endDate: '2026-05-03',
    location: 'Austin, TX',
    secretaryEmail: 'secretary@example.com',
    isActive: true
  },
  status: 'Submitted',
  formTemplate: {
    organizationCode: 'ASCA',
    sportCode: 'StockDog',
    formCode: 'TrialEntry',
    version: '2020-10-08'
  },
  dog: {
    callName: 'Ranger',
    registeredName: 'Ranger Blue Sky'
  },
  contact: {
    owners: 'Owner One'
  },
  fees: {
    totalEntryFees: 25,
    currency: 'USD'
  },
  emergencyContact: {
    name: 'Emergency Contact',
    phoneOrNumber: '555-111-2222'
  },
  selections: {
    upper: [{ row: 'Sheep', col: 'STD', value: 'X' }],
    lower: []
  },
  terms: {
    version: 'v1',
    acceptedAtUtc: '2026-01-20T15:20:00Z',
    acceptedByUserId: 'user-1'
  },
  processing: {
    pdfStatus: 'Success',
    generatedPdf: {
      downloadUrl: 'data:application/pdf;base64,JVBERi0xLjQK'
    },
    emailNotifications: [
      {
        recipientType: 'Handler',
        status: 'Success',
        sentAtUtc: '2026-01-20T15:22:30Z',
        lastError: null
      }
    ],
    lastError: null
  }
};

describe('SecretaryDetailComponent', () => {
  it('renders entry data', () => {
    const entriesService = {
      getEntryDetail: vi.fn().mockReturnValue(of(ENTRY)),
      getPdfDownloadUrl: vi.fn().mockReturnValue(of({ downloadUrl: 'data:application/pdf;base64,JVBERi0xLjQK' })),
      retryPdf: vi.fn().mockReturnValue(of(void 0))
    };

    const fixture = TestBed.configureTestingModule({
      imports: [SecretaryDetailComponent, NoopAnimationsModule],
      providers: [
        {
          provide: SecretaryEntriesService,
          useValue: entriesService
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ entryId: ENTRY.entryId })
            }
          }
        }
      ]
    }).createComponent(SecretaryDetailComponent);

    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Entry Detail');
    expect(text).toContain('Ranger');
  });

  it('triggers PDF download on click', () => {
    const entriesService = {
      getEntryDetail: vi.fn().mockReturnValue(of(ENTRY)),
      getPdfDownloadUrl: vi.fn().mockReturnValue(of({ downloadUrl: 'data:application/pdf;base64,JVBERi0xLjQK' })),
      retryPdf: vi.fn().mockReturnValue(of(void 0))
    };

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click');

    const fixture = TestBed.configureTestingModule({
      imports: [SecretaryDetailComponent, NoopAnimationsModule],
      providers: [
        {
          provide: SecretaryEntriesService,
          useValue: entriesService
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ entryId: ENTRY.entryId })
            }
          }
        }
      ]
    }).createComponent(SecretaryDetailComponent);

    fixture.detectChanges();
    fixture.componentInstance.downloadPdf();

    expect(entriesService.getPdfDownloadUrl).toHaveBeenCalledWith(ENTRY.entryId);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('displays processing status', () => {
    const entriesService = {
      getEntryDetail: vi.fn().mockReturnValue(of(ENTRY)),
      getPdfDownloadUrl: vi.fn().mockReturnValue(of({ downloadUrl: 'data:application/pdf;base64,JVBERi0xLjQK' })),
      retryPdf: vi.fn().mockReturnValue(of(void 0))
    };

    const fixture = TestBed.configureTestingModule({
      imports: [SecretaryDetailComponent, NoopAnimationsModule],
      providers: [
        {
          provide: SecretaryEntriesService,
          useValue: entriesService
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ entryId: ENTRY.entryId })
            }
          }
        }
      ]
    }).createComponent(SecretaryDetailComponent);

    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('PDF Generated');
    expect(text).toContain('Handler');
  });
});
