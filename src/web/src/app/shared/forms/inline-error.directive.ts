import {
  Directive,
  DoCheck,
  EmbeddedViewRef,
  Input,
  OnChanges,
  OnDestroy,
  TemplateRef,
  ViewContainerRef
} from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { merge, Subscription } from 'rxjs';

interface InlineErrorContext {
  $implicit: string | null;
}

@Directive({
  selector: '[appInlineError]',
  standalone: true
})
export class InlineErrorDirective implements OnChanges, OnDestroy, DoCheck {
  @Input('appInlineError') control?: AbstractControl | null;
  @Input('appInlineErrorErrorKey') errorKey?: string;

  private viewRef: EmbeddedViewRef<InlineErrorContext> | null = null;
  private subscription: Subscription | null = null;
  private context: InlineErrorContext = { $implicit: null };

  constructor(
    private readonly templateRef: TemplateRef<InlineErrorContext>,
    private readonly viewContainer: ViewContainerRef
  ) {}

  ngOnChanges(): void {
    this.subscription?.unsubscribe();
    this.subscription = null;

    if (this.control) {
      this.subscription = merge(this.control.statusChanges, this.control.valueChanges).subscribe(
        () => this.updateView()
      );
    }

    this.updateView();
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  ngDoCheck(): void {
    this.updateView();
  }

  private updateView(): void {
    if (!this.control || !this.errorKey) {
      this.clearView();
      return;
    }

    const shouldShow =
      this.control.enabled &&
      this.control.hasError(this.errorKey) &&
      (this.control.touched || this.control.dirty);

    if (!shouldShow) {
      this.clearView();
      return;
    }

    const errorValue = this.control.getError(this.errorKey);
    this.context.$implicit = this.normalizeErrorMessage(errorValue);

    if (!this.viewRef) {
      this.viewRef = this.viewContainer.createEmbeddedView(this.templateRef, this.context);
    } else {
      this.viewRef.context.$implicit = this.context.$implicit;
      this.viewRef.detectChanges();
    }
  }

  private clearView(): void {
    if (this.viewRef) {
      this.viewContainer.clear();
      this.viewRef = null;
    }
  }

  private normalizeErrorMessage(errorValue: unknown): string | null {
    if (typeof errorValue === 'string') {
      return errorValue;
    }

    if (Array.isArray(errorValue)) {
      const [first] = errorValue;
      return typeof first === 'string' ? first : null;
    }

    return null;
  }
}
