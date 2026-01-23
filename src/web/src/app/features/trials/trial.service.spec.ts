import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TrialService } from './trial.service';
import { MockDataService } from '../../shared/mocks/mock-data.service';
import { environment } from '../../../environments/environment';
import { TrialSummaryDto } from './trial.types';

describe('TrialService', () => {
  let service: TrialService;
  let httpMock: HttpTestingController;
  let originalUseMocks: boolean;

  beforeEach(() => {
    originalUseMocks = environment.useMocks;

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [TrialService, MockDataService]
    });

    service = TestBed.inject(TrialService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    environment.useMocks = originalUseMocks;
    httpMock.verify();
  });

  it('uses mock data when enabled', () => {
    environment.useMocks = true;

    const mockTrials: TrialSummaryDto[] = [
      {
        trialId: 'trial-1',
        name: 'Mock Trial',
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
      {
        trialId: 'trial-2',
        name: 'Inactive Trial',
        formTemplate: {
          organizationCode: 'ASCA',
          sportCode: 'StockDog',
          formCode: 'TrialEntry',
          version: '2020-10-08'
        },
        organizerSlug: 'ORG',
        eventSlug: 'EVENT-2',
        trackingSlug: 'ORG-EVENT-2',
        hostClub: 'Host Club',
        startDate: '2026-06-02',
        endDate: '2026-06-03',
        location: null,
        secretaryEmail: 'secretary@example.com',
        isActive: false
      }
    ];

    let response: TrialSummaryDto[] | undefined;

    service.getTrials().subscribe((trials) => {
      response = trials;
    });

    const req = httpMock.expectOne('/mocks/trials.mock.json');
    req.flush(mockTrials);

    expect(response).toEqual([mockTrials[0]]);
  });

  it('uses live API when mocks are disabled', () => {
    environment.useMocks = false;

    const mockTrials: TrialSummaryDto[] = [
      {
        trialId: 'trial-1',
        name: 'Live Trial',
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
        location: null,
        secretaryEmail: 'secretary@example.com',
        isActive: true
      }
    ];

    let response: TrialSummaryDto[] | undefined;

    service.getTrials().subscribe((trials) => {
      response = trials;
    });

    const req = httpMock.expectOne('/api/trials');
    req.flush(mockTrials);

    expect(response).toEqual(mockTrials);
  });
});
