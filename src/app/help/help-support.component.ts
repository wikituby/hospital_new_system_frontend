import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService } from '../services/api.service';
import { ThemeService } from '../services/theme.service';
import {
  CUSTOMER_CARE_CATEGORIES,
  DEFAULT_CUSTOMER_CARE,
  HELP_FAQ_ITEMS,
  HelpFaqItem,
} from '../config/help-faq.config';

type HelpSection = 'faq' | 'contact' | 'message';

@Component({
  selector: 'app-help-support',
  templateUrl: './help-support.component.html',
  styleUrls: ['./help-support.component.css'],
})
export class HelpSupportComponent implements OnInit, OnDestroy {
  readonly faqItems = HELP_FAQ_ITEMS;
  readonly careCategories = CUSTOMER_CARE_CATEGORIES;
  readonly tabs: { id: HelpSection; label: string; icon: string }[] = [
    { id: 'faq', label: 'FAQ', icon: 'bi-question-circle' },
    { id: 'contact', label: 'Contact', icon: 'bi-telephone' },
    { id: 'message', label: 'Message care', icon: 'bi-envelope-paper' },
  ];

  activeSection: HelpSection = 'faq';
  faqSearch = '';
  expandedFaqId: string | null = null;
  isDarkMode = false;
  private themeSub?: Subscription;
  private fragmentSub?: Subscription;

  contact = { ...DEFAULT_CUSTOMER_CARE };
  facilityName = '';

  accountName = '';
  accountEmail = '';
  accountRole = '';

  careForm = {
    subject: '',
    category: 'technical',
    message: '',
  };
  careSubmitting = false;
  careSuccess = '';
  careError = '';

  constructor(
    private api: ApiService,
    private route: ActivatedRoute,
    private router: Router,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.themeSub = this.themeService.isDarkMode$.subscribe((isDark) => {
      this.isDarkMode = isDark;
    });
    this.accountName = sessionStorage.getItem('username') || '';
    this.accountEmail = sessionStorage.getItem('useremail') || '';
    this.accountRole = sessionStorage.getItem('userrole') || '';

    const initial = this.route.snapshot.fragment;
    if (this.isHelpSection(initial)) {
      this.activeSection = initial;
    }

    this.fragmentSub = this.route.fragment.subscribe((fragment) => {
      if (this.isHelpSection(fragment)) {
        this.activeSection = fragment;
      }
    });

    this.loadContactDetails();
  }

  ngOnDestroy(): void {
    this.themeSub?.unsubscribe();
    this.fragmentSub?.unsubscribe();
  }

  get accountInitial(): string {
    const name = (this.accountName || 'U').trim();
    return name.charAt(0).toUpperCase();
  }

  get filteredFaq(): HelpFaqItem[] {
    const q = this.faqSearch.trim().toLowerCase();
    if (!q) {
      return this.faqItems;
    }
    return this.faqItems.filter(
      (item) =>
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q) ||
        item.tags?.some((t) => t.includes(q))
    );
  }

  setSection(section: HelpSection): void {
    this.activeSection = section;
    this.router.navigate([], { fragment: section, replaceUrl: true });
    // Keep focus in the main workspace; do not scrollIntoView (hides under fixed header).
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      /* ignore */
    }
  }

  toggleFaq(id: string): void {
    this.expandedFaqId = this.expandedFaqId === id ? null : id;
  }

  openDocumentation(): void {
    this.router.navigate(['/overview/system-documentation']);
  }

  openMessages(): void {
    this.router.navigate(['/overview/messages']);
  }

  whatsAppHref(): string {
    const digits = (this.contact.whatsapp || this.contact.phone || '').replace(/\D/g, '');
    return digits ? `https://wa.me/${digits}` : '#';
  }

  submitCustomerCare(): void {
    this.careSuccess = '';
    this.careError = '';

    const subject = this.careForm.subject.trim();
    const message = this.careForm.message.trim();
    if (!subject) {
      this.careError = 'Please enter a subject.';
      return;
    }
    if (!message) {
      this.careError = 'Please describe your issue or question.';
      return;
    }

    this.careSubmitting = true;
    this.api
      .submitCustomerCareMessage({
        subject,
        category: this.careForm.category,
        message,
      })
      .subscribe({
        next: (res: any) => {
          const ref = res?.ticketRef || res?.id ? `CC-${res.id}` : '';
          this.careSuccess =
            res?.message ||
            `Thank you. Your message was sent${ref ? ` (reference ${ref})` : ''}. Customer care will respond soon.`;
          this.careForm = { subject: '', category: 'technical', message: '' };
          this.careSubmitting = false;
        },
        error: (err: any) => {
          this.careError =
            err?.error?.message ||
            err?.message ||
            'Could not send your message. Try again or call customer care directly.';
          this.careSubmitting = false;
        },
      });
  }

  private isHelpSection(value: string | null | undefined): value is HelpSection {
    return value === 'faq' || value === 'contact' || value === 'message';
  }

  private loadContactDetails(): void {
    this.api.getBusinessSettings().subscribe({
      next: (data: any) => {
        if (!data) {
          return;
        }
        this.facilityName = data.facilityName || sessionStorage.getItem('facilityName') || '';
        if (data.phonePrimary) {
          this.contact.phone = data.phonePrimary;
        }
        if (data.phoneSecondary) {
          this.contact.whatsapp = data.phoneSecondary;
        }
        if (data.email) {
          this.contact.email = data.email;
        }
        if (data.contactInquiryLine) {
          const line = String(data.contactInquiryLine);
          const phoneMatch = line.match(/(\+?\d[\d\s\-]{8,})/);
          if (phoneMatch && !data.phonePrimary) {
            this.contact.phone = phoneMatch[1].trim();
          }
        }
      },
      error: () => {
        this.facilityName = sessionStorage.getItem('facilityName') || '';
      },
    });
  }
}
