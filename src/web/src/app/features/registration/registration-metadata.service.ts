import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TrialRegistrationMetadataDto } from './registration.types';
import { buildRegistrationMetadataMock } from './registration-metadata.mock';

@Injectable({
  providedIn: 'root'
})
export class RegistrationMetadataService {
  private readonly baseUrl = environment.apiBaseUrl ?? '/api';

  constructor(private readonly http: HttpClient) {}

  getRegistrationMetadata(trialId: string): Observable<TrialRegistrationMetadataDto> {
    if (environment.useMocks) {
      return of(buildRegistrationMetadataMock(trialId));
    }

    return this.http.get<TrialRegistrationMetadataDto>(
      `${this.baseUrl}/trials/${trialId}/registration/metadata`
    );
  }
}
