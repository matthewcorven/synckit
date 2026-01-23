import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { MockDataService } from './mock-data.service';
import { environment } from '../../../environments/environment';
import { TrialSummaryDto } from '../models/trial.model';
import { FormMetadataDto } from '../models/form-metadata.model';
import { firstValueFrom } from 'rxjs';

describe('MockDataService', () => {
  let service: MockDataService;
  let httpMock: HttpTestingController;
  let originalUseMocks: boolean;

  beforeEach(() => {
    originalUseMocks = environment.useMocks;
    environment.useMocks = true;

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [MockDataService]
    });

    service = TestBed.inject(MockDataService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    environment.useMocks = originalUseMocks;
    httpMock.verify();
  });

  it('loads trial fixtures from the mocks folder', () => {
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
      }
    ];

    let response: TrialSummaryDto[] | undefined;

    service.getTrials().subscribe((trials) => {
      response = trials;
    });

    const req = httpMock.expectOne('/mocks/trials.mock.json');
    req.flush(mockTrials);

    expect(response).toEqual(mockTrials);
  });

  it('builds registration metadata from form metadata fixtures', () => {
    const formMetadata: FormMetadataDto = {
      formTemplate: {
        organizationCode: 'ASCA',
        sportCode: 'StockDog',
        formCode: 'TrialEntry',
        version: '2020-10-08'
      },
      grids: [
        {
          grid: 'Upper',
          rows: ['Sheep'],
          cols: ['STD'],
          disabledCells: []
        }
      ]
    };

    let responseTrialId: string | undefined;
    let responseFormMetadata: FormMetadataDto | undefined;

    service.getRegistrationMetadata('trial-123').subscribe((metadata) => {
      responseTrialId = metadata.trialId;
      responseFormMetadata = metadata.formMetadata;
    });

    const req = httpMock.expectOne('/mocks/formMetadata.mock.json');
    req.flush(formMetadata);

    expect(responseTrialId).toBe('trial-123');
    expect(responseFormMetadata).toEqual(formMetadata);
  });

  it('rejects when mocks are disabled', async () => {
    environment.useMocks = false;

    await expect(firstValueFrom(service.getTrials())).rejects.toBeTruthy();
  });
});
