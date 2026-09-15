import { Component, OnInit } from '@angular/core';
import { ThemeService } from '../../../../services/theme.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-store-reports',
  templateUrl: './store-reports.component.html',
  styleUrls: ['./store-reports.component.css']
})
export class StoreReportsComponent implements OnInit {
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












