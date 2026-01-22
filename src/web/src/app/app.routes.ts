import { Routes } from '@angular/router';
import { LayoutComponent } from './core/layout/layout.component';

export const routes: Routes = [
	{
		path: '',
		component: LayoutComponent,
		children: [
			{
				path: '',
				pathMatch: 'full',
				redirectTo: 'trials'
			},
			{
				path: 'trials',
				loadChildren: () =>
					import('./features/trials/trials.routes').then((m) => m.TRIALS_ROUTES)
			},
			{
				path: 'register/:trialId',
				loadChildren: () =>
					import('./features/registration/registration.routes').then(
						(m) => m.REGISTRATION_ROUTES
					)
			},
			{
				path: 'secretary',
				loadChildren: () =>
					import('./features/secretary/secretary.routes').then(
						(m) => m.SECRETARY_ROUTES
					)
			}
		]
	},
	{
		path: '**',
		redirectTo: 'trials'
	}
];
