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
});
