import { Component } from '@angular/core';
import { SecretaryListComponent } from './secretary-list/secretary-list.component';

@Component({
  selector: 'app-secretary-page',
  standalone: true,
  imports: [SecretaryListComponent],
  template: ` <app-secretary-list></app-secretary-list> `
})
export class SecretaryPageComponent {}
