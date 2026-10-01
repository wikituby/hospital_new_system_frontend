import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../services/api.service';
import { getPublicOfferedServices, getPublicUpcomingServices } from './service-catalog';

export interface HeroSlide {
  image: string;
  serviceSlug: string;
  ctaRoute?: string;
  ctaLabel: string;
  title: string;
  description: string;
  cardTitle: string;
  clientNeed: string;
  imagePosition?: string;
  upcoming?: boolean;
}

export interface TeamMemberCard {
  name: string;
  description: string;
  image: string;
  social?: { twitter: boolean; instagram: boolean; facebook: boolean; linkedin: boolean };
}

@Component({
  selector: 'app-landing-page',
  templateUrl: './landing-page.component.html',
  styleUrls: ['./landing-page.component.css']
})
export class LandingPageComponent implements OnInit, OnDestroy {
  currentSlide = 0;
  sliderPaused = false;
  private autoSlideInterval: ReturnType<typeof setInterval> | null = null;

  /** Same department photos as before, written for patients rather than staff software. */
  slides: HeroSlide[] = [
    {
      image: 'assets/images/hero/dashboard_doctors_hero.jpg',
      serviceSlug: 'general-doctor-consultation',
      ctaRoute: '/book-appointment',
      ctaLabel: 'Book a doctor',
      title: 'See a doctor without leaving Bugogo',
      description: 'Bring a new illness, a follow-up, or a question you have been putting off. A full-time doctor is here for appointments and walk-in visits.',
      cardTitle: 'Doctor consultation',
      clientNeed: 'You leave with a clear plan, a prescription if you need one, and tests arranged on the same visit.'
    },
    {
      image: 'assets/images/hero/dashboard_appointments_hero.jpg',
      serviceSlug: 'general-doctor-consultation',
      ctaRoute: '/book-appointment',
      ctaLabel: 'Book your visit',
      title: 'Book the visit that fits your day',
      description: 'Reserve time with the doctor or the dentist so you are not guessing whether someone can see you.',
      cardTitle: 'Appointments',
      clientNeed: 'Call, email, or book online. We confirm the service that matches what you came for.'
    },
    {
      image: 'assets/images/hero/dashboard_lab_cutout.jpg',
      serviceSlug: 'laboratory-services',
      ctaLabel: 'Laboratory for patients',
      title: 'Get your tests done here',
      description: 'Blood work and other lab tests are taken on site, then used by your doctor so you are not sent to another town for results.',
      cardTitle: 'Laboratory',
      clientNeed: 'Bring the request from your clinician, or ask during your consultation. Results come back to the doctor treating you.'
    },
    {
      image: 'assets/images/hero/dashboard_pharmacy_dispense.jpg',
      serviceSlug: 'pharmacy',
      ctaLabel: 'Pharmacy for patients',
      title: 'Collect your medicine before you go home',
      description: 'The pharmacy is in the hospital. After the doctor or dentist prescribes, you can pick up the medicine and ask how to take it.',
      cardTitle: 'Pharmacy',
      clientNeed: 'No extra trip for common prescribed medicines and essential supplies.'
    },
    {
      image: 'assets/images/hero/dashboard_dental_slide.jpg',
      serviceSlug: 'dental-services',
      ctaRoute: '/book-appointment',
      ctaLabel: 'Book the dentist',
      title: 'Tooth pain and check-ups, on site',
      description: 'A full-time dentist sees patients for pain, check-ups, and planned treatment. Book it the same way you book the doctor.',
      cardTitle: 'Dental care',
      clientNeed: 'Come in when a tooth hurts, or book a check-up before the pain starts.'
    },
    {
      image: 'assets/images/hero/dashboard_scan_slide.jpg',
      serviceSlug: 'ultrasound-scans',
      ctaLabel: 'Ultrasound for patients',
      title: 'An ultrasound when you need to see more',
      description: 'Pregnancy scans and other ultrasound sessions happen here, so your doctor can decide with pictures instead of sending you away.',
      cardTitle: 'Ultrasound and scans',
      clientNeed: 'Ask during antenatal care or a consultation. You stay in the same hospital for the scan.'
    },
    {
      image: 'assets/images/hero/dashboard_obgyn.jpg',
      serviceSlug: 'maternity',
      ctaLabel: 'Maternity for mothers',
      title: 'Pregnancy care close to home',
      description: 'Antenatal visits, delivery planning, and early care after birth for mothers in Bugogo and Kyegegwa.',
      cardTitle: 'Maternity',
      clientNeed: 'Come for check-ups through pregnancy and ask what to watch for before labour.'
    },
    {
      image: 'assets/images/hero/dashboard_pediatrics.jpg',
      serviceSlug: 'paediatrics',
      ctaLabel: 'Care for your child',
      title: 'A place to bring a sick child',
      description: 'Fever, cough, feeding worries, and growth check-ups for infants, children, and adolescents.',
      cardTitle: 'Children’s care',
      clientNeed: 'Parents get a practical plan for home, and tests if the doctor needs them.'
    },
    {
      image: 'assets/images/hero/dashboard_ophthalmology.jpg',
      serviceSlug: 'ophthalmology',
      ctaLabel: 'Eye care for patients',
      title: 'Have your eyes examined here',
      description: 'Vision checks and eye follow-up, so you do not wait until sight problems become an emergency.',
      cardTitle: 'Eye clinic',
      clientNeed: 'Book if vision is blurring, an eye hurts, or you were told to come back for review.'
    },
    {
      image: 'assets/images/hero/dashboard_xray.jpg',
      serviceSlug: 'xray',
      ctaLabel: 'X-ray for patients',
      title: 'X-ray without another journey',
      description: 'If the doctor needs an X-ray, it can be taken here and used for the same visit’s decision.',
      cardTitle: 'X-ray',
      clientNeed: 'Useful after injury, chest illness, and other problems your clinician wants to see.'
    },
    {
      image: 'assets/images/hero/dashboard_inpatient.jpg',
      serviceSlug: 'inpatient',
      ctaLabel: 'Staying in hospital',
      title: 'A bed if you need to stay',
      description: 'When a clinic visit is not enough, you can be admitted to the ward and looked after until you are ready to go home.',
      cardTitle: 'Inpatient care',
      clientNeed: 'Families know where the patient is, and the same hospital continues the treatment.'
    },
    {
      image: 'assets/images/hero/dashboard_emergency.jpg',
      serviceSlug: 'emergency-care',
      ctaLabel: 'Emergency help',
      title: 'Call when someone cannot wait',
      description: 'Urgent assessment and oxygen are available for emergencies. Phone us and say what is happening.',
      cardTitle: 'Emergency',
      clientNeed: 'Breathing trouble, collapse, bleeding, or a child who is getting worse quickly.'
    },
    {
      image: 'assets/images/hero/dashboard_nutrition.jpg',
      serviceSlug: 'nutrition',
      ctaLabel: 'Diet help for patients',
      title: 'Eating advice that matches your illness',
      description: 'If diet is part of recovery — pregnancy, a child who is not feeding well, or a long illness — ask for nutrition support.',
      cardTitle: 'Diet and nutrition',
      clientNeed: 'You get a meal plan you can follow at home, not only a list of foods to avoid.'
    },
    {
      image: 'assets/images/hero/dashboard_physiotherapy.jpg',
      serviceSlug: 'physiotherapy',
      ctaLabel: 'Rehab for patients',
      title: 'Get moving again after illness or injury',
      description: 'Physiotherapy sessions help you walk, use an arm, or recover strength after being unwell.',
      cardTitle: 'Physiotherapy',
      clientNeed: 'Book if pain, weakness, or stiffness is stopping daily work.'
    },
    {
      image: 'assets/images/hero/dashboard_insurance.jpg',
      serviceSlug: 'insurance',
      ctaLabel: 'Insurance questions',
      title: 'Ask if your scheme can cover the visit',
      description: 'Bring your insurance details. We help check whether the scheme can be used for the care you need.',
      cardTitle: 'Insurance',
      clientNeed: 'Know what is covered before you are surprised by a bill.'
    },
    {
      image: 'assets/images/hero/dashboard_theatre.jpg',
      serviceSlug: 'theatre-surgery',
      upcoming: true,
      ctaLabel: 'Surgery — not open yet',
      title: 'Surgery closer to home, coming soon',
      description: 'Caesarean section, laparoscopy, and other common operations are not available to book yet. We are preparing theatre so fewer families have to travel.',
      cardTitle: 'Theatre and surgery',
      clientNeed: 'If you need an operation today, call us. We will tell you honestly where to go until theatre opens.'
    },
    {
      image: 'assets/images/hero/dashboard_ambulance.jpg',
      serviceSlug: 'ambulance',
      upcoming: true,
      ctaLabel: 'Ambulance — not open yet',
      title: 'An ambulance for the journey, coming soon',
      description: 'Emergency transport is not running yet. Until it is, call the hospital and we will guide you on how to get here or to the next facility.',
      cardTitle: 'Ambulance',
      clientNeed: 'For a collapse or a patient who cannot sit in a car, phone first so we can advise the safest move.'
    },
    {
      image: 'assets/images/hero/dashboard_ct.jpg',
      serviceSlug: 'ct-scan',
      upcoming: true,
      ctaLabel: 'CT scan — not open yet',
      title: 'CT scans are planned, not offered today',
      description: 'If you need a CT now, we cannot do it here yet. Your doctor can still see you and explain where the scan should be done.',
      cardTitle: 'CT scan',
      clientNeed: 'Ask during consultation if a CT is necessary, and what to do while this service is still upcoming.'
    },
    {
      image: 'assets/images/hero/dashboard_mri.jpg',
      serviceSlug: 'mri',
      upcoming: true,
      ctaLabel: 'MRI — not open yet',
      title: 'MRI is part of what we are adding',
      description: 'MRI is not open for patients today. Consultation, X-ray, ultrasound, and laboratory are.',
      cardTitle: 'MRI',
      clientNeed: 'Do not delay care that we can already give while waiting for MRI to open.'
    },
    {
      image: 'assets/images/hero/dashboard_icu.jpg',
      serviceSlug: 'icu',
      upcoming: true,
      ctaLabel: 'ICU — not open yet',
      title: 'Intensive care is still being built',
      description: 'We can assess an emergency and give oxygen. A full ICU is not open yet, so the most critical patients may still need transfer.',
      cardTitle: 'Intensive care',
      clientNeed: 'Call immediately. We will say whether we can stabilise here or you should go onward.'
    },
    {
      image: 'assets/images/hero/dashboard_nicu.jpg',
      serviceSlug: 'nicu',
      upcoming: true,
      ctaLabel: 'Newborn ICU — not open yet',
      title: 'Specialist newborn care, coming soon',
      description: 'A neonatal intensive care unit is not open yet. Maternity and paediatric visits are available today.',
      cardTitle: 'Care for newborns',
      clientNeed: 'If a baby is struggling, call us at once so we can direct you to the right help.'
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


  servicesOffered = getPublicOfferedServices();

  upcomingServices = getPublicUpcomingServices();

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

  get activeSlide() {
    return this.slides[this.currentSlide];
  }

  ngOnInit() {
    this.loadTeamMembersFromUsers();
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      this.sliderPaused = true;
    } else {
      this.startAutoSlide();
    }
  }

  ngOnDestroy() {
    this.clearAutoSlide();
  }

  startAutoSlide() {
    this.clearAutoSlide();
    if (this.sliderPaused) {
      return;
    }
    this.autoSlideInterval = setInterval(() => this.nextSlide(), 5000);
  }

  pauseAutoSlide() {
    this.clearAutoSlide();
  }

  resumeAutoSlide() {
    this.startAutoSlide();
  }

  toggleSliderPause() {
    this.sliderPaused = !this.sliderPaused;
    if (this.sliderPaused) {
      this.clearAutoSlide();
    } else {
      this.startAutoSlide();
    }
  }

  nextSlide() {
    this.currentSlide = (this.currentSlide + 1) % this.slides.length;
  }

  previousSlide() {
    this.currentSlide = this.currentSlide === 0 ? this.slides.length - 1 : this.currentSlide - 1;
  }

  private clearAutoSlide() {
    if (this.autoSlideInterval) {
      clearInterval(this.autoSlideInterval);
      this.autoSlideInterval = null;
    }
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
