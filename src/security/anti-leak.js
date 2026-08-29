/**
 * AntiGravity Duo — Anti-Leak & Screen Security Engine
 * Zero-Knowledge Privacy Shield, Dynamic Watermark & Panic Camouflage
 */

export class AntiLeakSuite {
  constructor() {
    this.isCamouflageActive = false;
    this.isShieldActive = false;
    this.spaceId = 'AG-UNVERIFIED';
    this.watermarkEl = document.getElementById('session-watermark');
    this.shieldEl = document.getElementById('privacy-shield');
    this.camouflageEl = document.getElementById('camouflage-screen');
    this.appRootEl = document.getElementById('app');

    this.initListeners();
    this.initCalculator();
  }

  setSpaceId(spaceId) {
    this.spaceId = spaceId;
    this.updateWatermark();
  }

  updateWatermark() {
    if (!this.watermarkEl) return;
    this.watermarkEl.innerHTML = '';
    const text = `🔒 E2EE ORBIT • ${this.spaceId} • ${new Date().toISOString().split('T')[0]}`;
    
    // Create multiple repeating watermark chips
    for (let i = 0; i < 28; i++) {
      const span = document.createElement('span');
      span.textContent = text;
      span.style.padding = '25px 40px';
      this.watermarkEl.appendChild(span);
    }
  }

  initListeners() {
    // 1. Keyboard Shortcuts (Escape for Panic Mode, Alt+S for stealth return)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.toggleCamouflage();
      } else if (e.altKey && (e.key === 's' || e.key === 'S')) {
        this.toggleCamouflage(false);
      }
    });

    // 2. Panic Button Click
    const btnPanic = document.getElementById('btn-panic-mode');
    if (btnPanic) {
      btnPanic.addEventListener('click', () => this.toggleCamouflage(true));
    }

    // 3. Exit Camouflage Click
    const btnExitCamouflage = document.getElementById('btn-exit-camouflage');
    if (btnExitCamouflage) {
      btnExitCamouflage.addEventListener('click', () => this.toggleCamouflage(false));
      btnExitCamouflage.addEventListener('dblclick', () => this.toggleCamouflage(false));
    }

    // 4. Auto-Blur Privacy Shield on Window Blur / Tab Switch (only if user is logged in)
    window.addEventListener('blur', () => {
      const session = sessionStorage.getItem('ag_duo_session');
      if (session && !this.isCamouflageActive) {
        this.showPrivacyShield();
      }
    });

    // 5. Unblur Button
    const btnUnblur = document.getElementById('btn-unblur-screen');
    if (btnUnblur) {
      btnUnblur.addEventListener('click', () => this.hidePrivacyShield());
    }

    // 6. Prevent context menu on sensitive media
    document.addEventListener('contextmenu', (e) => {
      if (e.target.closest('.vault-media-card') || e.target.closest('#media-viewer-container') || e.target.closest('.chat-messages-feed')) {
        e.preventDefault();
        return false;
      }
    });

    // 7. Prevent dragging images/media
    document.addEventListener('dragstart', (e) => {
      if (e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO') {
        e.preventDefault();
      }
    });
  }

  toggleCamouflage(forceState) {
    this.isCamouflageActive = forceState !== undefined ? forceState : !this.isCamouflageActive;
    if (this.isCamouflageActive) {
      this.camouflageEl.classList.add('active');
      this.appRootEl.style.display = 'none';
      document.title = 'Monthly_Budget_Analysis_2026.xlsx - Microsoft Excel';
    } else {
      this.camouflageEl.classList.remove('active');
      this.appRootEl.style.display = 'flex';
      document.title = 'AntiGravity Duo — Zero-Knowledge Private Space';
    }
  }

  showPrivacyShield() {
    this.isShieldActive = true;
    if (this.shieldEl) this.shieldEl.classList.add('active');
  }

  hidePrivacyShield() {
    this.isShieldActive = false;
    if (this.shieldEl) this.shieldEl.classList.remove('active');
  }

  initCalculator() {
    const display = document.getElementById('calc-display');
    const buttons = document.querySelectorAll('.calc-btn');
    let expr = '';

    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = btn.textContent;
        if (val === '=') {
          try {
            expr = String(Function(`'use strict'; return (${expr})`)());
          } catch {
            expr = 'Error';
          }
        } else if (val === 'C') {
          expr = '';
        } else {
          if (expr === 'Error') expr = '';
          expr += val;
        }
        if (display) display.textContent = expr || '0';
      });
    });
  }
}

export const antiLeakSuite = new AntiLeakSuite();
