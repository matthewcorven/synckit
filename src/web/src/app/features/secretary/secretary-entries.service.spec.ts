import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { SecretaryEntriesService } from './secretary-entries.service';

describe('SecretaryEntriesService', () => {
  it('returns paginated results from the mock dataset', async () => {
    const service = TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    }).inject(SecretaryEntriesService);

    const response = await firstValueFrom(
      service.getEntries({
        trialId: '9d4a8d25-2c59-4f1f-8c79-6c63e74f5f49',
        status: 'Submitted',
        page: 1,
        pageSize: 2
      })
    );

    expect(response.items.length).toBeGreaterThan(0);
    expect(response.page).toBe(1);
    expect(response.pageSize).toBe(2);
  });

  it('returns entry detail from mock data', async () => {
    const service = TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    }).inject(SecretaryEntriesService);

    const response = await firstValueFrom(
      service.getEntryDetail('d7b99d91-2c6a-4fd0-9d4f-7c49d88c7b10')
    );

    expect(response.entryId).toBe('d7b99d91-2c6a-4fd0-9d4f-7c49d88c7b10');
    expect(response.dog.callName).toBe('Ranger');
  });

  it('returns PDF download URL from mock data', async () => {
    const service = TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    }).inject(SecretaryEntriesService);

    const response = await firstValueFrom(
      service.getPdfDownloadUrl('d7b99d91-2c6a-4fd0-9d4f-7c49d88c7b10')
    );

    expect(response.downloadUrl).toContain('data:application/pdf');
  });
});
