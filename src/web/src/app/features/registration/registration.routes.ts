import { Routes } from '@angular/router';
import { RegistrationPageComponent } from './registration.page';
import { RegistrationConfirmationPageComponent } from './registration-confirmation.page';

export const REGISTRATION_ROUTES: Routes = [
  {
    path: '',
    component: RegistrationPageComponent
  },
  {
    path: 'confirmation',
    component: RegistrationConfirmationPageComponent
  }
];
