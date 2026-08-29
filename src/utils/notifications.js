/**
 * Vatsala — High Reliability Notification & Web Push Engine
 * Web Push API, Background Push, Ringtone & Haptic Audio Synthesis
 */

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export class NotificationEngine {
  constructor() {
    this.audioCtx = null;
    this.swRegistration = null;
    this.callRingtoneInterval = null;
    this.isPushSubscribed = false;
    this.currentPin = null;

    this.initAudioContext();
    this.setupAutoUnlock();
    this.initServiceWorker();
    this.setupVisibilitySync();
  }

  initAudioContext() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass && !this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }
    } catch (e) {
      console.warn('AudioContext init warning:', e);
    }
  }

  setupAutoUnlock() {
    const unlock = () => {
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
    };
    window.addEventListener('click', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
  }

  setupVisibilitySync() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.currentPin) {
        this.subscribeToPush(this.currentPin);
      }
    });
  }

  async initServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        this.swRegistration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        console.log('[Vatsala Service Worker] Active & Registered');

        if (Notification.permission === 'granted') {
          const profile = localStorage.getItem('agy_duo_my_profile');
          if (profile) {
            const parsed = JSON.parse(profile);
            if (parsed.pin) {
              this.currentPin = parsed.pin;
              this.subscribeToPush(parsed.pin);
            }
          }
        }
      } catch (err) {
        console.warn('Service Worker registration warning:', err);
      }
    }
  }

  async requestPermission(userPin = null) {
    if ('Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          this.playPingRing();
          if (userPin) {
            this.currentPin = userPin;
            await this.subscribeToPush(userPin);
          }
          this.showToast('🔔 Notifications Active', 'Aapko har call, message aur alert ka guaranteed notification milega!', 'check');
          return true;
        }
      } catch (e) {
        console.warn('Permission error:', e);
      }
    }
    return false;
  }

  async subscribeToPush(userPin) {
    if (!userPin) return;
    this.currentPin = userPin.toUpperCase().trim();

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push Notifications not supported by browser.');
      return;
    }

    try {
      const reg = await navigator.serviceWorker.ready;
      this.swRegistration = reg;

      // 1. Fetch VAPID Public Key from Server
      const res = await fetch('/api/vapid-public-key');
      const { publicKey } = await res.json();
      if (!publicKey) return;

      const applicationServerKey = urlBase64ToUint8Array(publicKey);

      // 2. Subscribe to PushManager
      let subscription = await reg.pushManager.getSubscription();
      if (!subscription) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey
        });
      }

      // 3. Save PushSubscription on persistent server DB
      await fetch('/api/save-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin: this.currentPin,
          userId: `user_${Math.random().toString(36).substring(2, 8)}`,
          subscription
        })
      });

      this.isPushSubscribed = true;
      console.log(`[Vatsala Web Push] Subscribed to push service for PIN ${this.currentPin}`);
    } catch (err) {
      console.warn('Push subscription failed:', err);
    }
  }

  playChimeTone() {
    try {
      if (!this.audioCtx) this.initAudioContext();
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
      osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.30);

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.6);
    } catch (err) {}
  }

  playPingRing() {
    try {
      if (!this.audioCtx) this.initAudioContext();
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;
      const osc1 = this.audioCtx.createOscillator();
      const osc2 = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc1.type = 'triangle';
      osc2.type = 'sine';

      osc1.frequency.setValueAtTime(523.25, now);
      osc1.frequency.setValueAtTime(659.25, now + 0.15);
      osc1.frequency.setValueAtTime(783.99, now + 0.30);
      osc1.frequency.setValueAtTime(1046.50, now + 0.45);

      osc2.frequency.setValueAtTime(1046.50, now);
      osc2.frequency.setValueAtTime(1318.51, now + 0.30);

      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.1);
      osc2.stop(now + 1.1);
    } catch (err) {}
  }

  startIncomingCallRingtone() {
    this.stopIncomingCallRingtone();
    this.playPingRing();
    this.vibrate([500, 200, 500, 200, 800]);

    this.callRingtoneInterval = setInterval(() => {
      this.playPingRing();
      this.vibrate([500, 200, 500, 200, 800]);
    }, 2500);
  }

  stopIncomingCallRingtone() {
    if (this.callRingtoneInterval) {
      clearInterval(this.callRingtoneInterval);
      this.callRingtoneInterval = null;
    }
  }

  vibrate(pattern = [400, 150, 400, 150, 600]) {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {}
    }
  }

  showToast(title, message, icon = 'bell', onClick = null) {
    this.playChimeTone();
    this.vibrate([400, 150, 400]);

    if (this.swRegistration && 'Notification' in window && Notification.permission === 'granted') {
      try {
        this.swRegistration.showNotification(title, {
          body: message,
          icon: '/favicon.svg',
          badge: '/favicon.svg',
          tag: 'vatsala-toast',
          vibrate: [400, 150, 400, 150, 600],
          renotify: true,
          requireInteraction: false,
          data: { url: '/' }
        });
      } catch (e) {
        try {
          new Notification(title, { body: message, icon: '/favicon.svg' });
        } catch (e2) {}
      }
    }

    const existing = document.querySelectorAll('.inapp-toast-alert');
    existing.forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = 'inapp-toast-alert';
    toast.innerHTML = `
      <div class="toast-icon-wrap">
        <i data-lucide="${icon}"></i>
      </div>
      <div style="flex:1; min-width: 0;">
        <div style="font-weight:700; font-size:0.90rem; color:#fff;">${title}</div>
        <div style="font-size:0.78rem; color:var(--text-secondary); margin-top:2px;">${message}</div>
      </div>
      <button class="toast-close-btn" id="btn-close-toast">
        <i data-lucide="x" style="width: 14px; height: 14px;"></i>
      </button>
    `;

    document.body.appendChild(toast);
    if (window.renderIcons) window.renderIcons();

    if (onClick) {
      toast.style.cursor = 'pointer';
      toast.addEventListener('click', (e) => {
        if (!e.target.closest('#btn-close-toast')) {
          onClick();
          toast.remove();
        }
      });
    }

    toast.querySelector('#btn-close-toast')?.addEventListener('click', () => {
      toast.remove();
    });

    setTimeout(() => {
      if (document.body.contains(toast)) {
        toast.style.animation = 'fadeOutUp 0.3s forwards';
        setTimeout(() => toast.remove(), 300);
      }
    }, 6000);
  }
}

export const notificationEngine = new NotificationEngine();
