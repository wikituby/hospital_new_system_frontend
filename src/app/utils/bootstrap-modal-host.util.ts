declare var $: any;

/** Keeps Bootstrap/jQuery modals on document.body so overview-shell backdrops do not cover them. */
export class BootstrapModalHost {
  private mounted: HTMLElement[] = [];

  constructor(private readonly hostSelector: string) {}

  /** Remove stray Bootstrap backdrops that block overview sidebar navigation. */
  cleanupStrayLayers(): void {
    document.querySelectorAll('body > .modal-backdrop').forEach((node) => node.remove());
    if (typeof $ !== 'undefined') {
      $('body').removeClass('modal-open').css({ overflow: '', paddingRight: '' });
    } else {
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    }
    document.querySelectorAll('body > .modal').forEach((node) => {
      const modal = node as HTMLElement;
      if (!modal.classList.contains('show')) {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
      }
    });
  }

  mountAll(): void {
    this.cleanupStrayLayers();
    const host = document.querySelector(this.hostSelector);
    if (!host) {
      return;
    }
    host.querySelectorAll('.modal').forEach((node) => {
      this.ensureElementOnBody(node as HTMLElement);
    });
  }

  ensureElementOnBody(modalEl: HTMLElement | null | undefined): void {
    if (!modalEl || modalEl.parentElement === document.body) {
      return;
    }
    document.body.appendChild(modalEl);
    if (!this.mounted.includes(modalEl)) {
      this.mounted.push(modalEl);
    }
  }

  ensureById(modalId: string): void {
    this.cleanupStrayLayers();
    this.ensureElementOnBody(document.getElementById(modalId));
  }

  /** Move modal to body then open — keeps it above overview-shell backdrop. */
  showModal(modalId: string): void {
    this.ensureById(modalId);
    if (typeof $ === 'undefined') {
      return;
    }
    setTimeout(() => {
      $(`#${modalId}`).modal('show');
    }, 0);
  }

  hideModal(modalId: string): void {
    if (typeof $ !== 'undefined') {
      $(`#${modalId}`).modal('hide');
    }
    this.cleanupStrayLayers();
  }

  teardown(): void {
    if (typeof $ !== 'undefined') {
      $('.modal-backdrop').remove();
      $('body').removeClass('modal-open').css('padding-right', '');
    }
    this.mounted.forEach((el) => el.remove());
    this.mounted = [];
  }
}
