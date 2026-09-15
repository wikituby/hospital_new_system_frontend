import { Component } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-contact-page',
  templateUrl: './contact-page.component.html',
  styleUrls: ['./contact-page.component.css']
})
export class ContactPageComponent {
  readonly contact = {
    phones: ['+256 784 411 848', '+256 704 968 736'],
    phoneLinks: ['tel:+256784411848', 'tel:+256704968736'],
    email: 'venerandahospital@gmail.com',
    location: 'H5VH+6R, Lukwemigo',
    hours: [
      { day: 'Open 24/7', note: 'Full hospital services every day of the week' }
    ]
  };

  form = {
    fullName: '',
    phone: '',
    email: '',
    subject: 'General enquiry',
    message: ''
  };

  submitted = false;

  readonly subjects = [
    'General enquiry',
    'Book an appointment',
    'Emergency support',
    'Laboratory / scans',
    'Pharmacy',
    'Funding / partnership',
    'Other'
  ];

  readonly mapUrl: SafeResourceUrl;
  readonly mapsSearchUrl: string;

  constructor(private sanitizer: DomSanitizer) {
    const query = encodeURIComponent('H5VH+6R, Lukwemigo');
    this.mapsSearchUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
    this.mapUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://maps.google.com/maps?q=${query}&z=16&output=embed`
    );
  }

  submitContact(): void {
    if (!this.form.fullName.trim() || !this.form.phone.trim() || !this.form.message.trim()) {
      return;
    }

    const subject = encodeURIComponent(
      `Contact Us — ${this.form.subject}: ${this.form.fullName}`
    );
    const body = encodeURIComponent(
      [
        `Name: ${this.form.fullName}`,
        `Phone: ${this.form.phone}`,
        `Email: ${this.form.email || 'Not provided'}`,
        `Subject: ${this.form.subject}`,
        '',
        'Message:',
        this.form.message
      ].join('\n')
    );

    this.submitted = true;
    window.location.href = `mailto:${this.contact.email}?subject=${subject}&body=${body}`;
  }
}
