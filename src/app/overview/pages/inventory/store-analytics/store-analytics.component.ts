import { Component, OnInit } from '@angular/core';
import { ThemeService } from '../../../../services/theme.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-store-analytics',
  templateUrl: './store-analytics.component.html',
  styleUrls: ['./store-analytics.component.css']
})
export class StoreAnalyticsComponent implements OnInit {
  isDarkMode: boolean = false;

  constructor(
    private themeService: ThemeService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const username = sessionStorage.getItem('username');
    if (username === null) {
      this.router.navigate(['/login']);
    }

    // Subscribe to theme changes
    this.themeService.isDarkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
    });
  }
}












