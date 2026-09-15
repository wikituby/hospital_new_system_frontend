/// <reference types="@angular/localize" />

import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';

import { enableProdMode } from '@angular/core';

import { environment } from './environments/environment';

// Import Firebase
import { initializeApp } from 'firebase/app';


if (environment.production) {
  enableProdMode();
}

// Initialize Firebase with your Firebase config
initializeApp(environment.firebaseConfig);



platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.error(err));
