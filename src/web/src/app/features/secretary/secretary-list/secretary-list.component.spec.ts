import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { provideRouter } from '@angular/router';
import { SecretaryListComponent } from './secretary-list.component';
import { TrialService } from '../../trials/trial.service';
import { SecretaryEntriesService } from '../secretary-entries.service';
import { EntrySummaryDto, PaginatedEntrySummaryResponse } from '../secretary.types';

const TRIALS = [
  {
    trialId: 'trial-1',
    name: 'Mock Trial',
    organizationName: 'ASCA',
    sportName: 'Stock Dog',
    formName: 'Trial Entry Form',
    organizerSlug: 'ORG',
    eventSlug: 'EVENT',
    trackingSlug: 'ORG-EVENT',
    hostClub: 'Host Club',
    startDate: '2026-01-10',
    endDate: '2026-01-11',
    location: 'Austin, TX',
    secretaryEmail: 'secretary@example.com',
    isActive: true,
    formTemplate: {
      organizationCode: 'ASCA',
      sportCode: 'StockDog',
      formCode: 'TrialEntry',
      version: '2020-10-08'
    }
  }
];

const ENTRIES: EntrySummaryDto[] = [
  {
    entryId: 'entry-1',
    trialId: 'trial-1',
    status: 'Submitted',
    submittedAtUtc: '2026-01-20T00:00:00Z',
    handlerEmail: 'handler@example.com',
    dogCallName: 'Ranger',
    dogRegisteredName: 'Ranger Blue Sky',
    pdfStatus: 'Success'
  }
];

const RESPONSE: PaginatedEntrySummaryResponse = {
  items: ENTRIES,
  page: 1,
  pageSize: 10,
  total: 1
};

describe('SecretaryListComponent', () => {
  it('renders the entries table', () => {
    const trialService = {
      getTrials: vi.fn().mockReturnValue(of(TRIALS))
    };

    const entriesService = {
      getEntries: vi.fn().mockReturnValue(of(RESPONSE))
    };

    const fixture = TestBed.configureTestingModule({
      imports: [SecretaryListComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: TrialService, useValue: trialService },
        { provide: SecretaryEntriesService, useValue: entriesService }
      ]
    }).createComponent(SecretaryListComponent);

    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Secretary Portal');
    expect(text).toContain('handler@example.com');
  });

  it('reloads entries when pagination changes', () => {
    const trialService = {
      getTrials: vi.fn().mockReturnValue(of(TRIALS))
    };

    const entriesService = {
      getEntries: vi.fn().mockReturnValue(of(RESPONSE))
    };

    const fixture = TestBed.configureTestingModule({
      imports: [SecretaryListComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: TrialService, useValue: trialService },
        { provide: SecretaryEntriesService, useValue: entriesService }
      ]
    }).createComponent(SecretaryListComponent);

    fixture.detectChanges();
    entriesService.getEntries.mockClear();

    fixture.componentInstance.onPageChange({
      pageIndex: 1,
      pageSize: 10,
      length: 1
    } as unknown as import('@angular/material/paginator').PageEvent);

    expect(entriesService.getEntries).toHaveBeenCalledWith({
      trialId: 'trial-1',
      status: 'Submitted',
      page: 2,
      pageSize: 10
    });
  });

  it('reloads entries when trial changes', () => {
    const trialService = {
      getTrials: vi.fn().mockReturnValue(of(TRIALS))
    };

    const entriesService = {
      getEntries: vi.fn().mockReturnValue(of(RESPONSE))
    };

    const fixture = TestBed.configureTestingModule({
      imports: [SecretaryListComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: TrialService, useValue: trialService },
        { provide: SecretaryEntriesService, useValue: entriesService }
      ]
    }).createComponent(SecretaryListComponent);

    fixture.detectChanges();
    entriesService.getEntries.mockClear();

    fixture.componentInstance.onTrialChange('trial-1');

    expect(entriesService.getEntries).toHaveBeenCalled();
    expect(entriesService.getEntries.mock.calls[0][0].trialId).toBe('trial-1');
  });
});
