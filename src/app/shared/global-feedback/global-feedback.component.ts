import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { FeedbackState, GlobalFeedbackService } from '../../services/global-feedback.service';

@Component({
  selector: 'app-global-feedback',
  templateUrl: './global-feedback.component.html',
  styleUrls: ['./global-feedback.component.css']
})
export class GlobalFeedbackComponent implements OnInit, OnDestroy {
  state: FeedbackState = {
    isVisible: false,
    message: '',
    type: 'info'
  };

  private subscription: Subscription | null = null;

  constructor(private globalFeedbackService: GlobalFeedbackService) {}

  ngOnInit(): void {
    this.subscription = this.globalFeedbackService.feedbackState$.subscribe((state) => {
      this.state = state;
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  close(): void {
    this.globalFeedbackService.hide();
  }
}
