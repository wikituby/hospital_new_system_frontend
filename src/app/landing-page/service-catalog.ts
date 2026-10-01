export interface LandingServiceItem {
  slug: string;
  image: string;
  title: string;
  description: string;
  imagePosition?: string;
  category: 'offered' | 'upcoming';
  details: string[];
  highlights: string[];
}

export const LANDING_SERVICES: LandingServiceItem[] = [
  {
    slug: 'maternity',
    image: 'assets/images/hero/dashboard_obgyn.jpg',
    title: 'Maternity',
    description: 'Antenatal care, delivery support, and maternal health services for expectant mothers.',
    imagePosition: '45% 20%',
    category: 'offered',
    details: [
      'Our maternity service supports mothers through pregnancy, delivery planning, and early postnatal care. Antenatal visits help track mother and baby wellbeing, answer questions, and prepare families for a safe birth.',
      'You can book appointments for routine check-ups, discuss warning signs, and receive guidance on nutrition, birth plans, and follow-up after delivery. Our team works closely with the doctor and scan services when further assessment is needed.',
      'Whether you are coming for your first visit or continuing care, we aim to make every step clear, respectful, and focused on both mother and baby.'
    ],
    highlights: [
      'Antenatal check-ups and counselling',
      'Delivery support and maternal follow-up',
      'Coordination with ultrasound and laboratory',
      'Family-centred guidance throughout pregnancy'
    ]
  },
  {
    slug: 'paediatrics',
    image: 'assets/images/hero/dashboard_pediatrics.jpg',
    title: 'Paediatrics',
    description: 'Care for infants, children, and adolescents — from common illnesses to growth check-ups.',
    imagePosition: '45% 20%',
    category: 'offered',
    details: [
      'Paediatric care at Veneranda Hospital covers infants, children, and adolescents. We assess common illnesses, growth progress, and day-to-day concerns that parents want answered quickly.',
      'Appointments can include review of fever, cough, feeding issues, immunisation counselling, and follow-up after earlier visits. Where needed, we connect care with laboratory tests or imaging for clearer diagnosis.',
      'Our goal is calm, practical care that helps families understand what is happening and what to do next at home.'
    ],
    highlights: [
      'Child illness assessment and treatment',
      'Growth and development check-ups',
      'Parent counselling and follow-up plans',
      'Referral to lab or scan when required'
    ]
  },
  {
    slug: 'ultrasound-scans',
    image: 'assets/images/hero/dashboard_scan_slide.jpg',
    title: 'Ultrasound & scans',
    description: 'Ultrasound and a range of imaging / scan services for accurate clinical assessment.',
    imagePosition: '45% 20%',
    category: 'offered',
    details: [
      'Ultrasound and scan services help clinicians see what cannot be judged by examination alone. This supports maternity care, abdominal assessment, and other diagnostic needs requested by the doctor.',
      'During a session, images are captured and reviewed to guide next steps — whether that is reassurance, further tests, or treatment planning. Results are shared in a way patients and clinicians can act on.',
      'Having imaging on site means fewer delays and better coordination with consultation, maternity, and laboratory services.'
    ],
    highlights: [
      'Ultrasound sessions for clinical assessment',
      'Support for maternity and general diagnostics',
      'On-site imaging that speeds decision-making',
      'Clear reporting back to the consulting clinician'
    ]
  },
  {
    slug: 'general-doctor-consultation',
    image: 'assets/images/hero/dashboard_doctors_hero.jpg',
    title: 'General doctor consultation',
    description: 'Walk-in and booked appointments with a full-time doctor ready to see you.',
    imagePosition: '45% 20%',
    category: 'offered',
    details: [
      'A full-time doctor is available for general consultation — for new concerns, follow-up visits, and clinical review. You can book an appointment or enquire about walk-in availability depending on the day.',
      'Consultations may include history, examination, prescriptions, and requests for laboratory or scan work when needed. The doctor coordinates with pharmacy, dental, and other departments so care stays connected.',
      'This is the starting point for most patients who need clinical advice without waiting for specialised pathways alone.'
    ],
    highlights: [
      'Full-time doctor for appointments',
      'Walk-in and booked visit options',
      'Prescriptions and investigation requests',
      'Coordination across hospital departments'
    ]
  },
  {
    slug: 'pharmacy',
    image: 'assets/images/hero/dashboard_pharmacy_dispense.jpg',
    title: 'Pharmacy',
    description: 'On-site pharmacy for prescribed medicines and essential medical supplies.',
    imagePosition: '45% 20%',
    category: 'offered',
    details: [
      'Our on-site pharmacy dispenses prescribed medicines and essential medical supplies so patients can complete care before leaving the facility.',
      'Pharmacists and dispensing staff help verify prescriptions, explain how medicines should be taken, and flag anything that needs clarification with the doctor.',
      'Keeping pharmacy close to consultation and laboratory services reduces the need for separate trips and supports safer, faster treatment.'
    ],
    highlights: [
      'Dispensing of prescribed medicines',
      'Essential medical supplies on site',
      'Guidance on how to take medicines',
      'Linked to doctor and clinical workflows'
    ]
  },
  {
    slug: 'laboratory-services',
    image: 'assets/images/hero/dashboard_lab_cutout.jpg',
    title: 'Laboratory services',
    description: 'Full laboratory testing to guide diagnosis, treatment, and follow-up.',
    imagePosition: '45% 20%',
    category: 'offered',
    details: [
      'Laboratory services provide the tests clinicians need to confirm diagnosis, monitor treatment, and guide follow-up. Samples are collected and processed according to the doctor’s request.',
      'Results feed back into consultation and other care pathways so decisions are based on clear evidence rather than guesswork alone.',
      'From routine blood work to broader diagnostic panels, the lab is a core part of care at Veneranda Hospital.'
    ],
    highlights: [
      'Diagnostic testing for clinical decisions',
      'Support for treatment monitoring',
      'Results shared with consulting clinicians',
      'Integrated with pharmacy and consultation'
    ]
  },
  {
    slug: 'dental-services',
    image: 'assets/images/hero/dashboard_dental_slide.jpg',
    title: 'Dental services',
    description: 'Dental care with a full-time dentist available for appointments and treatment.',
    imagePosition: '45% 20%',
    category: 'offered',
    details: [
      'Dental services are led by a full-time dentist available for appointments and treatment. Care ranges from check-ups and pain assessment to planned dental procedures.',
      'Patients can book dental visits the same way they book other clinical appointments, and receive clear advice about treatment options and follow-up.',
      'Having dental care on site means oral health is part of the same trusted place families already use for medical care.'
    ],
    highlights: [
      'Full-time dentist available',
      'Check-ups and treatment appointments',
      'Pain assessment and procedure planning',
      'Convenient on-site dental clinic'
    ]
  },
  {
    slug: 'emergency-oxygen',
    image: 'assets/images/hero/dashboard_emergency.jpg',
    title: 'Emergency oxygen',
    description: 'Oxygen support available for emergencies and critical respiratory needs.',
    imagePosition: '45% 20%',
    category: 'offered',
    details: [
      'Emergency oxygen support is available for urgent respiratory needs and critical situations. Families and referring clinicians can call for guidance when immediate help is required.',
      'This service sits alongside our emergency readiness so staff can respond quickly while arranging further clinical care.',
      'If you need urgent support, use the emergency contact numbers on our landing page and describe the situation clearly so the team can guide next steps.'
    ],
    highlights: [
      'Oxygen ready for emergencies',
      'Support for critical respiratory needs',
      'Rapid response coordination',
      'Clear contact path for urgent enquiry'
    ]
  },
  {
    slug: 'theatre-surgery',
    image: 'assets/images/hero/dashboard_theatre.jpg',
    title: 'Theatre & surgery',
    description: 'Common surgeries coming soon — including caesarean section (CS), laparoscopies, and more.',
    category: 'upcoming',
    details: [
      'Theatre and surgical services are being developed to support common procedures, including caesarean section, laparoscopies, and related surgical care.',
      'When live, this pathway will connect preoperative assessment, theatre scheduling, and postoperative follow-up with the rest of hospital care.',
      'We are expanding capacity so patients who need planned or urgent surgery can receive it closer to home with trusted clinical oversight.'
    ],
    highlights: [
      'Planned theatre capacity expansion',
      'Support for CS and common surgeries',
      'Laparoscopy pathway in development',
      'Integrated pre- and post-operative care'
    ]
  },
  {
    slug: 'theatre-services',
    image: 'assets/images/hero/dashboard_theatre.jpg',
    title: 'Theatre services',
    description: 'Expanded operating theatre capacity for planned and urgent surgical procedures.',
    category: 'upcoming',
    details: [
      'Expanded theatre services will strengthen both planned and urgent surgical procedures at Veneranda Hospital.',
      'This includes better readiness for surgical teams, clearer scheduling, and safer handoff between wards, theatre, and recovery.',
      'As this service comes online, patients will have more options to complete surgical care within the same facility network.'
    ],
    highlights: [
      'Expanded operating theatre capacity',
      'Planned and urgent procedure support',
      'Stronger surgical team readiness',
      'Safer recovery and follow-up pathways'
    ]
  },
  {
    slug: 'blood-bank',
    image: 'assets/images/hero/dashboard_icu.jpg',
    title: 'Blood bank',
    description: 'On-site blood bank services coming soon to support emergencies and surgery.',
    category: 'upcoming',
    details: [
      'An on-site blood bank is coming soon to support emergencies, theatre cases, and patients who need timely transfusion support.',
      'Having blood services closer to care will reduce transfer delays and strengthen emergency and surgical readiness.',
      'This addition is part of our broader growth in critical and surgical capacity for the community.'
    ],
    highlights: [
      'On-site blood bank in development',
      'Support for emergencies and surgery',
      'Faster transfusion readiness',
      'Stronger critical-care capacity'
    ]
  },
  {
    slug: 'ambulance',
    image: 'assets/images/hero/dashboard_ambulance.jpg',
    title: 'Ambulance',
    description: 'Ambulance response coming soon for patient transfer and emergency transport.',
    category: 'upcoming',
    details: [
      'Ambulance services are coming soon to support patient transfer and emergency transport.',
      'This will help move patients safely between facilities or from the community when urgent care is needed.',
      'Together with emergency oxygen and expanding theatre capacity, ambulance response completes a stronger emergency chain of care.'
    ],
    highlights: [
      'Emergency transport coming soon',
      'Patient transfer support',
      'Faster access to urgent care',
      'Part of our emergency growth plan'
    ]
  }
,
  {
    slug: 'ophthalmology',
    image: 'assets/images/hero/dashboard_ophthalmology.jpg',
    title: 'Ophthalmology',
    description: 'Eye care and vision clinics for exams and follow-up.',
    category: 'offered',
    details: [
      'Our ophthalmology pathway supports eye exams, vision clinics, and follow-up for patients needing specialised eye care.',
      'Patients and partners can learn more here and contact Veneranda Hospital to ask about availability, bookings, or funding support linked to this area of care.',
      'Our teams coordinate across departments so this service connects with consultation, diagnostics, and follow-up whenever needed.'
    ],
    highlights: [
      'Eye exams and vision clinics',
      'Follow-up for eye conditions',
      'Referral coordination with general consultation',
      'Clear appointment pathways'
    ]
  },
  {
    slug: 'xray',
    image: 'assets/images/hero/dashboard_xray.jpg',
    title: 'X-ray imaging',
    description: 'On-site X-ray imaging so clinicians can confirm a diagnosis without sending you away.',
    category: 'offered',
    details: [
      'X-ray imaging supports diagnosis by capturing studies requested by clinicians and returning clear results for treatment decisions.',
      'Patients and partners can learn more here and contact Veneranda Hospital to ask about availability, bookings, or funding support linked to this area of care.',
      'Our teams coordinate across departments so this service connects with consultation, diagnostics, and follow-up whenever needed.'
    ],
    highlights: [
      'X-ray ordering and capture',
      'Review and reporting support',
      'Faster diagnostic decisions',
      'Linked to consultation workflows'
    ]
  },
  {
    slug: 'ct-scan',
    image: 'assets/images/hero/dashboard_ct.jpg',
    title: 'CT scan imaging',
    description: 'Detailed CT imaging for complex diagnosis — not yet open to patients.',
    category: 'upcoming',
    details: [
      'CT imaging capacity is part of our growth in advanced diagnostics, helping clinicians coordinate requests and results more quickly.',
      'Patients and partners can learn more here and contact Veneranda Hospital to ask about availability, bookings, or funding support linked to this area of care.',
      'Our teams coordinate across departments so this service connects with consultation, diagnostics, and follow-up whenever needed.'
    ],
    highlights: [
      'CT request coordination',
      'Faster diagnostic turnaround',
      'Support for complex cases',
      'Growth in advanced imaging'
    ]
  },
  {
    slug: 'mri',
    image: 'assets/images/hero/dashboard_mri.jpg',
    title: 'MRI imaging',
    description: 'MRI scanning and reporting — planned as part of our advanced imaging expansion.',
    category: 'upcoming',
    details: [
      'MRI services are planned to expand advanced imaging options for patients who need detailed scans and clear clinical reporting.',
      'Patients and partners can learn more here and contact Veneranda Hospital to ask about availability, bookings, or funding support linked to this area of care.',
      'Our teams coordinate across departments so this service connects with consultation, diagnostics, and follow-up whenever needed.'
    ],
    highlights: [
      'MRI scheduling support',
      'Clinical reporting pathways',
      'Advanced imaging readiness',
      'Better continuity for complex diagnosis'
    ]
  },
  {
    slug: 'inpatient',
    image: 'assets/images/hero/dashboard_inpatient.jpg',
    title: 'Inpatient care',
    description: 'Ward admission and inpatient stays when you need care beyond a clinic visit.',
    category: 'offered',
    details: [
      'Inpatient care covers ward admissions, bed occupancy, and stay management so patients receive continuous care after consultation or emergency review.',
      'Patients and partners can learn more here and contact Veneranda Hospital to ask about availability, bookings, or funding support linked to this area of care.',
      'Our teams coordinate across departments so this service connects with consultation, diagnostics, and follow-up whenever needed.'
    ],
    highlights: [
      'Ward admissions and bed tracking',
      'Inpatient stay management',
      'Coordination with doctors and nursing',
      'Clear handover from outpatient care'
    ]
  },
  {
    slug: 'emergency-care',
    image: 'assets/images/hero/dashboard_emergency.jpg',
    title: 'Emergency care',
    description: 'Urgent assessment and oxygen-ready support when a case cannot wait.',
    category: 'offered',
    details: [
      'Emergency care at Veneranda Hospital focuses on triage, urgent assessment, and oxygen-ready response so critical needs are handled quickly.',
      'Patients and partners can learn more here and contact Veneranda Hospital to ask about availability, bookings, or funding support linked to this area of care.',
      'Our teams coordinate across departments so this service connects with consultation, diagnostics, and follow-up whenever needed.'
    ],
    highlights: [
      'Emergency triage and assessment',
      'Oxygen-ready support',
      'Rapid clinical decision-making',
      'Coordination with ambulance and theatre growth'
    ]
  },
  {
    slug: 'reports',
    image: 'assets/images/hero/dashboard_reports.jpg',
    title: 'Clinical & operational reports',
    description: 'Reports that help teams review performance and care quality daily.',
    category: 'offered',
    details: [
      'Reporting supports clinical and operational review so leadership and departments can see what is working and where support is needed.',
      'Patients and partners can learn more here and contact Veneranda Hospital to ask about availability, bookings, or funding support linked to this area of care.',
      'Our teams coordinate across departments so this service connects with consultation, diagnostics, and follow-up whenever needed.'
    ],
    highlights: [
      'Clinical performance visibility',
      'Operational review tools',
      'Daily insight for teams',
      'Data to guide improvement'
    ]
  },
  {
    slug: 'finance',
    image: 'assets/images/hero/dashboard_finance.jpg',
    title: 'Accounting & finance',
    description: 'Track billing, expenses, and financial health of the facility.',
    category: 'offered',
    details: [
      'Finance services keep billing, expenses, and revenue control organised so the hospital can sustain quality care for the community.',
      'Patients and partners can learn more here and contact Veneranda Hospital to ask about availability, bookings, or funding support linked to this area of care.',
      'Our teams coordinate across departments so this service connects with consultation, diagnostics, and follow-up whenever needed.'
    ],
    highlights: [
      'Billing and revenue control',
      'Expense tracking',
      'Facility financial health',
      'Transparent operational support'
    ]
  },
  {
    slug: 'insurance',
    image: 'assets/images/hero/dashboard_insurance.jpg',
    title: 'Insurance schemes',
    description: 'Help with insurance scheme eligibility and covered care.',
    category: 'offered',
    details: [
      'Insurance support helps patients and the facility navigate scheme eligibility, cover, and claims so care remains accessible.',
      'Patients and partners can learn more here and contact Veneranda Hospital to ask about availability, bookings, or funding support linked to this area of care.',
      'Our teams coordinate across departments so this service connects with consultation, diagnostics, and follow-up whenever needed.'
    ],
    highlights: [
      'Scheme eligibility support',
      'Claims and billing workflows',
      'Cover guidance for patients',
      'Smoother insurance processes'
    ]
  },
  {
    slug: 'icu',
    image: 'assets/images/hero/dashboard_icu.jpg',
    title: 'ICU critical care',
    description: 'Intensive monitoring for critically ill patients — opening as capacity is ready.',
    category: 'upcoming',
    details: [
      'ICU capacity is part of our critical-care growth plan, strengthening monitoring and resources for patients who need intensive support.',
      'Patients and partners can learn more here and contact Veneranda Hospital to ask about availability, bookings, or funding support linked to this area of care.',
      'Our teams coordinate across departments so this service connects with consultation, diagnostics, and follow-up whenever needed.'
    ],
    highlights: [
      'Critical patient monitoring',
      'ICU resource readiness',
      'Support for high-acuity care',
      'Linked emergency and theatre pathways'
    ]
  },
  {
    slug: 'nicu',
    image: 'assets/images/hero/dashboard_nicu.jpg',
    title: 'NICU for newborns',
    description: 'Specialist care for newborns who need intensive support — coming soon.',
    category: 'upcoming',
    details: [
      'NICU services will expand newborn intensive care so vulnerable infants can receive specialised support closer to home.',
      'Patients and partners can learn more here and contact Veneranda Hospital to ask about availability, bookings, or funding support linked to this area of care.',
      'Our teams coordinate across departments so this service connects with consultation, diagnostics, and follow-up whenever needed.'
    ],
    highlights: [
      'Neonatal intensive care readiness',
      'Incubator-side workflows',
      'Family-centred newborn support',
      'Growth in maternal-child capacity'
    ]
  },
  {
    slug: 'nutrition',
    image: 'assets/images/hero/dashboard_nutrition.jpg',
    title: 'Diet & nutrition',
    description: 'Plan therapeutic diets and nutrition support for patients.',
    category: 'offered',
    details: [
      'Nutrition services help plan therapeutic diets and feeding support that complements medical treatment and recovery.',
      'Patients and partners can learn more here and contact Veneranda Hospital to ask about availability, bookings, or funding support linked to this area of care.',
      'Our teams coordinate across departments so this service connects with consultation, diagnostics, and follow-up whenever needed.'
    ],
    highlights: [
      'Therapeutic diet planning',
      'Nutrition counselling',
      'Support for recovery and chronic care',
      'Coordination with clinical teams'
    ]
  },
  {
    slug: 'physiotherapy',
    image: 'assets/images/hero/dashboard_physiotherapy.jpg',
    title: 'Physiotherapy',
    description: 'Rehabilitation sessions to restore movement, strength, and independence.',
    category: 'offered',
    details: [
      'Physiotherapy supports recovery through scheduled sessions and progress tracking after illness, injury, or inpatient care.',
      'Patients and partners can learn more here and contact Veneranda Hospital to ask about availability, bookings, or funding support linked to this area of care.',
      'Our teams coordinate across departments so this service connects with consultation, diagnostics, and follow-up whenever needed.'
    ],
    highlights: [
      'Rehab session scheduling',
      'Progress tracking',
      'Recovery after illness or surgery',
      'Support for mobility and function'
    ]
  }
];

export function getLandingServiceBySlug(slug: string): LandingServiceItem | undefined {
  return LANDING_SERVICES.find((s) => s.slug === slug);
}

export function getOfferedServices(): LandingServiceItem[] {
  return LANDING_SERVICES.filter((s) => s.category === 'offered');
}

export function getUpcomingServices(): LandingServiceItem[] {
  return LANDING_SERVICES.filter((s) => s.category === 'upcoming');
}

/** Internal modules that are not patient-facing hospital services. */
const STAFF_ONLY_SLUGS = new Set(['reports', 'finance']);

/** Upcoming entries that repeat another public service. */
const DUPLICATE_PUBLIC_SLUGS = new Set(['theatre-services']);

export function getPublicOfferedServices(): LandingServiceItem[] {
  return getOfferedServices().filter((s) => !STAFF_ONLY_SLUGS.has(s.slug));
}

export function getPublicUpcomingServices(): LandingServiceItem[] {
  return getUpcomingServices().filter((s) => !DUPLICATE_PUBLIC_SLUGS.has(s.slug));
}
