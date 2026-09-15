import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  getLandingServiceBySlug,
  getOfferedServices,
  getUpcomingServices,
  LandingServiceItem
} from '../landing-page/service-catalog';

@Component({
  selector: 'app-service-detail',
  templateUrl: './service-detail.component.html',
  styleUrls: ['./service-detail.component.css']
})
export class ServiceDetailComponent implements OnInit {
  service: LandingServiceItem | undefined;
  related: LandingServiceItem[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug') || '';
      this.service = getLandingServiceBySlug(slug);
      if (!this.service) {
        this.router.navigate(['/landingpage']);
        return;
      }
      const pool =
        this.service.category === 'offered'
          ? getOfferedServices()
          : getUpcomingServices();
      this.related = pool.filter((s) => s.slug !== this.service!.slug).slice(0, 3);
    });
  }

  goBack(): void {
    const anchor = this.service?.category === 'upcoming' ? 'upcoming' : 'services';
    this.router.navigate(['/landingpage'], { fragment: anchor });
  }
}
