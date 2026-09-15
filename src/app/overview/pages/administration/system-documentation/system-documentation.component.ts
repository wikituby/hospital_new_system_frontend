import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import {
  SYSTEM_DOCUMENTATION_CATALOG,
  SystemDocumentationEntry,
} from '../../../../config/system-documentation.catalog';
import { ThemeService } from '../../../../services/theme.service';
import { AccessControlService } from '../../../../services/access-control.service';
import { markdownToHtml } from '../../../../utils/markdown-doc.util';

@Component({
  selector: 'app-system-documentation',
  templateUrl: './system-documentation.component.html',
  styleUrls: ['./system-documentation.component.css'],
  encapsulation: ViewEncapsulation.None,
})
export class SystemDocumentationComponent implements OnInit {
  isDarkMode = false;
  isLoading = false;
  loadError = '';
  docSearch = '';

  readonly catalog = [...SYSTEM_DOCUMENTATION_CATALOG].sort((a, b) => a.order - b.order);
  selectedId = this.catalog[0]?.id ?? 'index';
  docHtml: SafeHtml | null = null;
  activeTitle = '';
  activeFile = '';

  constructor(
    private http: HttpClient,
    private sanitizer: DomSanitizer,
    private router: Router,
    private themeService: ThemeService,
    private accessControl: AccessControlService
  ) {}

  ngOnInit(): void {
    if (!sessionStorage.getItem('username')) {
      this.router.navigate(['/login']);
      return;
    }
    if (!this.accessControl.canAccessPage('system-documentation')) {
      this.router.navigate(['/overview/main-dashboard']);
      return;
    }

    this.themeService.isDarkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
    });

    this.loadDocument(this.selectedId);
  }

  get filteredCatalog(): SystemDocumentationEntry[] {
    const q = this.docSearch.trim().toLowerCase();
    if (!q) {
      return this.catalog;
    }
    return this.catalog.filter(
      e =>
        e.title.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.file.toLowerCase().includes(q)
    );
  }

  selectDocument(entry: SystemDocumentationEntry): void {
    if (entry.id === this.selectedId && this.docHtml) {
      return;
    }
    this.selectedId = entry.id;
    this.loadDocument(entry.id);
  }

  private loadDocument(id: string): void {
    const entry = this.catalog.find(e => e.id === id) ?? this.catalog[0];
    if (!entry) {
      this.loadError = 'No documentation configured.';
      return;
    }

    this.isLoading = true;
    this.loadError = '';
    this.activeTitle = entry.title;
    this.activeFile = entry.file;

    this.http
      .get(`assets/documentation/${entry.file}`, { responseType: 'text' })
      .pipe(
        map(text => this.sanitizer.bypassSecurityTrustHtml(markdownToHtml(text))),
        catchError(() => {
          this.loadError = `Could not load ${entry.file}. Ensure the file exists under assets/documentation.`;
          return of(null);
        })
      )
      .subscribe(html => {
        this.isLoading = false;
        this.docHtml = html;
      });
  }

}
