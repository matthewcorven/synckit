import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  readonly useMocks = environment.useMocks;
  readonly baseUrl = environment.apiBaseUrl ?? '/api';

  constructor(private readonly http: HttpClient) {}
}
