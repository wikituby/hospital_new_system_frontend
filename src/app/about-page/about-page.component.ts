import { Component } from '@angular/core';

@Component({
  selector: 'app-about-page',
  templateUrl: './about-page.component.html',
  styleUrls: ['./about-page.component.css']
})
export class AboutPageComponent {
  readonly defaultPersonImage = 'assets/images/default-person.svg';

  leadership = [
    {
      name: 'Dr. Kabugo Nicholas',
      role: 'Medical Director & Supervising Doctor',
      description: 'Leads clinical care and oversees medical standards at Veneranda Hospital.'
    },
    {
      name: 'Mr. Colin Bwambale',
      role: 'Human Resources',
      description: 'Supports our people and day-to-day staff coordination.'
    },
    {
      name: 'Mr. Clyton Tumwesigye',
      role: 'Administrator',
      description: 'Manages facility administration and hospital operations.',
      image: 'assets/images/dr-kabugo.jpg'
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

  personImage(person: { image?: string }): string {
    return person.image || this.defaultPersonImage;
  }
}
