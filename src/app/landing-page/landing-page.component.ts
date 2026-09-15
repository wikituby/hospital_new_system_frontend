import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { trigger, transition, style, animate } from '@angular/animations';
import { ApiService } from '../services/api.service';
import { getOfferedServices, getUpcomingServices } from './service-catalog';

export interface TeamMemberCard {
  name: string;
  description: string;
  image: string;
  social?: { twitter: boolean; instagram: boolean; facebook: boolean; linkedin: boolean };
}

@Component({
  selector: 'app-landing-page',
  templateUrl: './landing-page.component.html',
  styleUrls: ['./landing-page.component.css'],
  animations: [
    trigger('fadeIn', [
      transition('* => *', [
        style({ opacity: 0, transform: 'translateY(20px)' }),
        animate('800ms ease-in-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class LandingPageComponent implements OnInit, OnDestroy {
  currentSlide = 0;
  autoSlideInterval: any;

  /** Same department hero set as the mobile dashboard. */
  slides = [
    {
      image: 'assets/images/hero/dashboard_doctors_hero.jpg',
      serviceSlug: 'general-doctor-consultation',
      ctaLabel: 'Book an appointment',
      ctaRoute: '/book-appointment',
      eyebrow: 'Doctors & consultation',
      title: 'Doctors &\nappointments',
      description: 'Schedule visits, see doctors, and run consultation modules.',
      icon: 'bi-stethoscope',
      cardTitle: 'Doctors & appointments',
      cardDescription: 'Book visits and manage doctor consultation workflows.'
    },
    {
      image: 'assets/images/hero/dashboard_appointments_hero.jpg',
      serviceSlug: 'general-doctor-consultation',
      eyebrow: 'Care pathways',
      title: 'Appointments &\nconsultations',
      description: 'Manage doctor visits and consultation workflows from one place.',
      icon: 'bi-calendar2-check',
      cardTitle: 'Appointments & consultations',
      cardDescription: 'Keep clinics flowing with clear appointment pathways.'
    },
    {
      image: 'assets/images/hero/dashboard_lab_cutout.jpg',
      serviceSlug: 'laboratory-services',
      eyebrow: 'Medical laboratory',
      title: 'Lab tests &\nresults',
      description: 'Order tests, track samples, and complete every lab workflow.',
      icon: 'bi-clipboard2-pulse',
      cardTitle: 'Laboratory',
      cardDescription: 'Full lab testing to guide diagnosis and follow-up.'
    },
    {
      image: 'assets/images/hero/dashboard_pharmacy_dispense.jpg',
      serviceSlug: 'pharmacy',
      eyebrow: 'Pharmacy',
      title: 'Dispense drugs\nwith confidence',
      description: 'Fill prescriptions and dispense medicines from the pharmacy desk.',
      icon: 'bi-capsule',
      cardTitle: 'Pharmacy',
      cardDescription: 'On-site dispensing for prescribed medicines.'
    },
    {
      image: 'assets/images/hero/dashboard_dental_slide.jpg',
      serviceSlug: 'dental-services',
      eyebrow: 'Dental clinic',
      title: 'Dental care\nin session',
      description: 'Chart treatments and manage dental visits while work is underway.',
      icon: 'bi-tooth',
      cardTitle: 'Dental',
      cardDescription: 'Dental check-ups and treatment with a dedicated clinic.',
      imagePosition: '45% 30%'
    },
    {
      image: 'assets/images/hero/dashboard_scan_slide.jpg',
      serviceSlug: 'ultrasound-scans',
      eyebrow: 'Imaging & scan',
      title: 'Ultrasound &\nscan sessions',
      description: 'Capture and review scans during an active ultrasound session.',
      icon: 'bi-soundwave',
      cardTitle: 'Ultrasound & scans',
      cardDescription: 'Imaging sessions that support timely clinical decisions.'
    },
    {
      image: 'assets/images/hero/dashboard_theatre.jpg',
      serviceSlug: 'theatre-surgery',
      eyebrow: 'Operating theatre',
      title: 'Theatre &\nsurgery',
      description: 'Plan procedures and support surgical teams in theatre.',
      icon: 'bi-scissors',
      cardTitle: 'Theatre',
      cardDescription: 'Surgical planning and operating theatre support.'
    },
    {
      image: 'assets/images/hero/dashboard_ambulance.jpg',
      serviceSlug: 'ambulance',
      eyebrow: 'Ambulance services',
      title: 'Emergency\nresponse on wheels',
      description: 'Dispatch ambulances and track pre-hospital emergency care.',
      icon: 'bi-ambulance',
      cardTitle: 'Ambulance',
      cardDescription: 'Emergency transport and pre-hospital response.'
    },
    {
      image: 'assets/images/hero/dashboard_ophthalmology.jpg',
      serviceSlug: 'ophthalmology',
      eyebrow: 'Ophthalmology',
      title: 'Eye care &\nvision clinics',
      description: 'Manage eye exams, clinics, and ophthalmology visits.',
      icon: 'bi-eye',
      cardTitle: 'Ophthalmology',
      cardDescription: 'Eye clinics and vision care pathways.'
    },
    {
      image: 'assets/images/hero/dashboard_obgyn.jpg',
      serviceSlug: 'maternity',
      eyebrow: 'Obstetrics & gynaecology',
      title: 'Maternity &\nwomen\'s health',
      description: 'Support antenatal care, delivery, and gynaecology consultations.',
      icon: 'bi-gender-female',
      cardTitle: 'Obstetrics & gynaecology',
      cardDescription: 'Maternity and women\'s health services.',
      imagePosition: '45% 30%'
    },
    {
      image: 'assets/images/hero/dashboard_xray.jpg',
      serviceSlug: 'xray',
      eyebrow: 'Radiology · X-ray',
      title: 'X-ray\nimaging',
      description: 'Order, capture, and review X-ray studies in one flow.',
      icon: 'bi-radioactive',
      cardTitle: 'X-ray',
      cardDescription: 'Radiology X-ray ordering and review.'
    },
    {
      image: 'assets/images/hero/dashboard_ct.jpg',
      serviceSlug: 'ct-scan',
      eyebrow: 'Radiology · CT',
      title: 'CT scan\nimaging',
      description: 'Coordinate CT requests and results for faster diagnosis.',
      icon: 'bi-circle-half',
      cardTitle: 'CT scan',
      cardDescription: 'CT imaging coordination and reporting.'
    },
    {
      image: 'assets/images/hero/dashboard_mri.jpg',
      serviceSlug: 'mri',
      eyebrow: 'Radiology · MRI',
      title: 'MRI\nimaging',
      description: 'Schedule and follow through MRI scans with clear reporting.',
      icon: 'bi-magnet',
      cardTitle: 'MRI',
      cardDescription: 'MRI scheduling and clinical reporting.'
    },
    {
      image: 'assets/images/hero/dashboard_inpatient.jpg',
      serviceSlug: 'inpatient',
      eyebrow: 'Inpatient care',
      title: 'Beds &\nward admissions',
      description: 'Track bed occupancy and manage inpatient stays across wards.',
      icon: 'bi-door-open',
      cardTitle: 'Inpatient beds',
      cardDescription: 'Ward admissions and bed occupancy.'
    },
    {
      image: 'assets/images/hero/dashboard_emergency.jpg',
      serviceSlug: 'emergency-care',
      eyebrow: 'Emergency',
      title: 'Casualty &\nemergency desk',
      description: 'Triage urgent cases and keep the emergency bay moving.',
      icon: 'bi-heart-pulse',
      cardTitle: 'Emergency',
      cardDescription: 'Triage and emergency bay workflows.'
    },
    {
      image: 'assets/images/hero/dashboard_reports.jpg',
      serviceSlug: 'reports',
      eyebrow: 'Reports',
      title: 'Clinical &\noperational reports',
      description: 'Generate reports that help teams review performance daily.',
      icon: 'bi-file-earmark-bar-graph',
      cardTitle: 'Reports',
      cardDescription: 'Clinical and operational reporting.'
    },
    {
      image: 'assets/images/hero/dashboard_finance.jpg',
      serviceSlug: 'finance',
      eyebrow: 'Accounting & finance',
      title: 'Finance &\nrevenue control',
      description: 'Track billing, expenses, and financial health of the facility.',
      icon: 'bi-cash-stack',
      cardTitle: 'Accounting & finance',
      cardDescription: 'Billing, expenses, and revenue control.'
    },
    {
      image: 'assets/images/hero/dashboard_insurance.jpg',
      serviceSlug: 'insurance',
      eyebrow: 'Insurance schemes',
      title: 'Cover &\nclaim support',
      description: 'Manage scheme eligibility and insurance billing workflows.',
      icon: 'bi-shield-check',
      cardTitle: 'Insurance',
      cardDescription: 'Scheme cover and claims support.'
    },
    {
      image: 'assets/images/hero/dashboard_icu.jpg',
      serviceSlug: 'icu',
      eyebrow: 'Intensive care',
      title: 'ICU\ncritical care',
      description: 'Monitor critical patients and ICU resources with clarity.',
      icon: 'bi-activity',
      cardTitle: 'ICU',
      cardDescription: 'Critical care monitoring and ICU resources.'
    },
    {
      image: 'assets/images/hero/dashboard_nicu.jpg',
      serviceSlug: 'nicu',
      eyebrow: 'Neonatal care',
      title: 'NICU\nfor newborns',
      description: 'Support neonatal intensive care and incubator-side workflows.',
      icon: 'bi-balloon-heart',
      cardTitle: 'NICU',
      cardDescription: 'Neonatal intensive care workflows.',
      imagePosition: '45% 22%'
    },
    {
      image: 'assets/images/hero/dashboard_pediatrics.jpg',
      serviceSlug: 'paediatrics',
      eyebrow: 'Pediatrics',
      title: 'Children\'s\ncare',
      description: 'Manage pediatric visits, wards, and child-focused care.',
      icon: 'bi-emoji-smile',
      cardTitle: 'Pediatrics',
      cardDescription: 'Child-focused clinics and ward care.'
    },
    {
      image: 'assets/images/hero/dashboard_nutrition.jpg',
      serviceSlug: 'nutrition',
      eyebrow: 'Nutrition',
      title: 'Diet &\nnutrition services',
      description: 'Plan therapeutic diets and nutrition support for patients.',
      icon: 'bi-egg-fried',
      cardTitle: 'Nutrition',
      cardDescription: 'Therapeutic diets and nutrition support.'
    },
    {
      image: 'assets/images/hero/dashboard_physiotherapy.jpg',
      serviceSlug: 'physiotherapy',
      eyebrow: 'Physiotherapy',
      title: 'Rehab &\nphysiotherapy',
      description: 'Schedule sessions and track rehabilitation progress.',
      icon: 'bi-person-walking',
      cardTitle: 'Physiotherapy',
      cardDescription: 'Rehab sessions and progress tracking.'
    }
  ];

  readonly venerandaLogo = 'assets/images/veneranda-logo.png';

  contactDetails = {
    phones: ['+256 784 411 848', '+256 704 968 736'],
    phoneLinks: ['tel:+256784411848', 'tel:+256704968736'],
    email: 'venerandahospital@gmail.com',
    location: 'H5VH+6R, Lukwemigo'
  };

  leadership = [
    {
      name: 'Dr. Kabugo Nicholas',
      role: 'Medical Director & Supervising Doctor',
      description: 'Leads clinical care and oversees medical standards at Veneranda Hospital.',
      image: 'assets/images/dr-kabugo.jpg'
    },
    {
      name: 'Mr. Colin Bwambale',
      role: 'Human Resources',
      description: 'Supports our people and day-to-day staff coordination.'
    },
    {
      name: 'Mr. Clyton Tumwesigye',
      role: 'Administrator',
      description: 'Manages facility administration and hospital operations.'
    },
    {
      name: 'Aiden Tumwesigye',
      role: 'Director',
      description: 'Board leadership guiding growth and community service.'
    },
    {
      name: 'Benjamin Tumwesigye',
      role: 'Director',
      description: 'Board leadership supporting hospital development.'
    }
  ];

  boardOfAdvisors = [
    { name: 'Dr. Festo', role: 'Board Advisor' },
    { name: 'Dr. Gyavira', role: 'Board Advisor' },
    { name: 'Dr. Apulr Gerald Humble', role: 'Board Advisor' }
  ];

  readonly defaultPersonImage = 'assets/images/default-person.svg';

  personImage(person: { image?: string }): string {
    return person.image || this.defaultPersonImage;
  }

  get activeSlide() {
    return this.slides[this.currentSlide];
  }

  servicesOffered = getOfferedServices();

  upcomingServices = getUpcomingServices();

  successStories = [
    {
      tag: 'Maternity',
      title: 'Safer antenatal follow-up close to home',
      summary:
        'Expectant mothers now complete routine antenatal visits and ultrasound guidance without long travel, improving continuity of care before delivery.',
      image: 'assets/images/hero/dashboard_obgyn.jpg',
      imagePosition: '45% 20%'
    },
    {
      tag: 'Diagnostics',
      title: 'Faster answers from lab and scans',
      summary:
        'Having laboratory and ultrasound on site means clinicians can act on results the same day, reducing delays that used to push families to distant facilities.',
      image: 'assets/images/hero/dashboard_lab_cutout.jpg',
      imagePosition: '45% 20%'
    },
    {
      tag: 'Dental & pharmacy',
      title: 'Complete care in one visit',
      summary:
        'Patients see the doctor or dentist and leave with medicines from the on-site pharmacy — a practical win for working families in the community.',
      image: 'assets/images/hero/dashboard_pharmacy_dispense.jpg',
      imagePosition: '45% 20%'
    }
  ];

  pendingProjects = [
    {
      title: 'Operating theatre & surgical capacity',
      description:
        'Equip and commission theatre services for common surgeries including caesarean section and laparoscopies, so urgent cases are handled locally.',
      goal: 'Capital support',
      image: 'assets/images/hero/dashboard_theatre.jpg',
      needs: [
        'Theatre equipment and sterile supplies',
        'Surgical readiness for CS and emergency procedures',
        'Training and staffing support for theatre teams'
      ]
    },
    {
      title: 'Blood bank establishment',
      description:
        'Set up an on-site blood bank to support emergencies, theatre cases, and life-saving transfusion without long referral delays.',
      goal: 'Infrastructure + supplies',
      image: 'assets/images/hero/dashboard_icu.jpg',
      needs: [
        'Cold-chain and storage equipment',
        'Screening and safety systems',
        'Startup stock and technician capacity'
      ]
    },
    {
      title: 'Ambulance & emergency transport',
      description:
        'Fund ambulance response for patient transfer and community emergencies linking Bugogo to higher-level care when needed.',
      goal: 'Vehicle + operations',
      image: 'assets/images/hero/dashboard_ambulance.jpg',
      needs: [
        'Ambulance vehicle and medical kit',
        'Fuel and maintenance seed funding',
        'Emergency dispatch readiness'
      ]
    },
    {
      title: 'Critical care & oxygen expansion',
      description:
        'Strengthen emergency oxygen and critical-care readiness for respiratory emergencies while surgical and blood services come online.',
      goal: 'Equipment upgrade',
      image: 'assets/images/hero/dashboard_emergency.jpg',
      needs: [
        'Oxygen delivery systems',
        'Monitoring equipment',
        'Emergency bay upgrades'
      ]
    }
  ];

  fundingMailLink(projectTitle: string): string {
    return `mailto:${this.contactDetails.email}?subject=${encodeURIComponent('Support: ' + projectTitle)}`;
  }

  currentTeamIndex = 0;
  teamMembers: TeamMemberCard[] = [];
  teamLoading = true;

  private readonly emptySocial = {
    twitter: false,
    instagram: false,
    facebook: false,
    linkedin: false
  };

  constructor(
    private router: Router,
    private api: ApiService
  ) {}

  ngOnInit() {
    this.startAutoSlide();
    this.loadTeamMembersFromUsers();
  }

  private loadTeamMembersFromUsers(): void {
    this.teamLoading = true;
    this.api.getPublicUsers().subscribe({
      next: (users) => {
        const mapped = (users || [])
          .map((user) => this.mapUserToTeamCard(user))
          .filter((member): member is TeamMemberCard => !!member);
        this.teamMembers = mapped;
        this.currentTeamIndex = 0;
        this.teamLoading = false;
      },
      error: () => {
        this.teamMembers = [];
        this.teamLoading = false;
      }
    });
  }

  private mapUserToTeamCard(user: any): TeamMemberCard | null {
    const name = String(user?.username || '').trim();
    if (!name) {
      return null;
    }
    const qualification = String(user?.qualification || '').trim();
    const role = String(user?.role || '').trim();
    const description = qualification || role || 'Care team member';
    const pic = String(user?.profilePic || '').trim();
    return {
      name,
      description,
      image: pic || this.defaultPersonImage,
      social: { ...this.emptySocial }
    };
  }

  onTeamImageError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (img && img.src !== this.defaultPersonImage) {
      img.src = this.defaultPersonImage;
    }
  }

  ngOnDestroy() {
    if (this.autoSlideInterval) {
      clearInterval(this.autoSlideInterval);
    }
  }

  startAutoSlide() {
    if (this.autoSlideInterval) {
      clearInterval(this.autoSlideInterval);
    }
    this.autoSlideInterval = setInterval(() => {
      this.nextSlide();
    }, 5000);
  }

  pauseAutoSlide() {
    if (this.autoSlideInterval) {
      clearInterval(this.autoSlideInterval);
      this.autoSlideInterval = null;
    }
  }

  resumeAutoSlide() {
    this.startAutoSlide();
  }

  /** Depth 0 = front of stack. Kept for compatibility; hero now shows the active slide card. */
  stackDepth(cardIndex: number): number {
    return cardIndex === this.currentSlide ? 0 : 1;
  }

  focusHeroCard(cardIndex: number): void {
    if (cardIndex >= 0 && cardIndex < this.slides.length) {
      this.currentSlide = cardIndex;
    }
  }

  nextSlide() {
    this.currentSlide = (this.currentSlide + 1) % this.slides.length;
  }

  previousSlide() {
    this.currentSlide = this.currentSlide === 0 ? this.slides.length - 1 : this.currentSlide - 1;
  }

  goToSlide(index: number) {
    this.currentSlide = index;
  }

  navigateToOverview() {
    this.router.navigate(['/login']);
  }

  nextTeamMember() {
    if (!this.teamMembers.length) {
      return;
    }
    this.currentTeamIndex = (this.currentTeamIndex + 1) % this.teamMembers.length;
  }

  previousTeamMember() {
    if (!this.teamMembers.length) {
      return;
    }
    this.currentTeamIndex =
      this.currentTeamIndex === 0 ? this.teamMembers.length - 1 : this.currentTeamIndex - 1;
  }
}
