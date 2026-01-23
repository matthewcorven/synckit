import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TrialSummaryDto } from '../models/trial.model';
import {
  FormMetadataDto,
  TrialRegistrationMetadataDto
} from '../models/form-metadata.model';
import { EntryDetailDto } from '../models/entry.model';
import { TermsDto } from '../models/terms.model';

@Injectable({
  providedIn: 'root'
})
export class MockDataService {
  constructor(private readonly http: HttpClient) {}

  get isEnabled(): boolean {
    return environment.useMocks;
  }

  getTrials(): Observable<TrialSummaryDto[]> {
    return this.loadJson<TrialSummaryDto[]>('trials.mock.json');
  }

  getFormMetadata(): Observable<FormMetadataDto> {
    return this.loadJson<FormMetadataDto>('formMetadata.mock.json');
  }

  getRegistrationMetadata(trialId: string): Observable<TrialRegistrationMetadataDto> {
    return this.getFormMetadata().pipe(
      map((formMetadata) => ({
        trialId,
        formTemplate: formMetadata.formTemplate,
        formMetadata
      }))
    );
  }

  getEntryDetail(): Observable<EntryDetailDto> {
    return this.loadJson<EntryDetailDto>('entry.mock.json');
  }

  getTerms(): Observable<TermsDto> {
    return this.loadJson<TermsDto>('terms.mock.json');
  }

  private loadJson<T>(fileName: string): Observable<T> {
    if (!this.isEnabled) {
      return throwError(() => new Error('Mocks are disabled.'));
    }

    return this.http.get<T>(`/mocks/${fileName}`);
  }
}
