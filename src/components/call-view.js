import { renderIcons } from '../utils/icons.js';
import { notificationEngine } from '../utils/notifications.js';

export class CallView {
  constructor(callManager) {
    this.callManager = callManager;
    this.container = document.getElementById('call-modal-container');
    this.callTimerInterval = null;
    this.callSeconds = 0;

    this.initCallManagerCallbacks();
  }

  initCallManagerCallbacks() {
    this.callManager.onLocalStreamReady = (stream, isVideo) => {
      this.attachLocalStream(stream, isVideo);
    };

    this.callManager.onRemoteStreamReady = (stream, isVideo) => {
      this.attachRemoteStream(stream, isVideo);
      this.startCallTimer();
    };

    this.callManager.onCallEnded = () => {
      this.closeCallUI();
    };
  }

  showIncomingCall(callerName, isVideo, onAccept, onDecline) {
    if (!this.container) return;

    // Start loud incoming call ringtone & continuous vibration
    notificationEngine.startIncomingCallRingtone();
    notificationEngine.showToast(
      isVideo ? '📹 Incoming Video Call' : '📞 Incoming Voice Call',
      `${callerName} is calling you right now!`,
      'phone-incoming'
    );

    this.container.innerHTML = `
      <div class="call-fullscreen-modal" style="justify-content: center; gap: 30px;">
        <div style="text-align: center;">
          <div class="audio-pulse-avatar-wrap" style="margin: 0 auto 16px auto;">
            <div class="audio-wave-circle"></div>
            <div class="audio-avatar-orb" style="width: 100px; height: 100px; font-size: 2.2rem;">
              <i data-lucide="${isVideo ? 'video' : 'phone-call'}" style="width: 44px; height: 44px;"></i>
            </div>
          </div>
          <h2 style="color: #fff; font-size: 1.4rem; font-family: var(--font-display);">${callerName}</h2>
          <p style="color: var(--accent-cyan); font-size: 0.90rem; margin-top: 4px;">
            Incoming ${isVideo ? 'Encrypted Video Call' : 'Encrypted Voice Call'}...
          </p>
        </div>

        <div style="display: flex; gap: 24px; align-items: center; justify-content: center;">
          <!-- Decline Button -->
          <button id="btn-decline-call" class="btn-call-ctrl btn-end-call" style="width: 60px; height: 60px;" title="Decline Call">
            <i data-lucide="phone-off" style="width: 26px; height: 26px;"></i>
          </button>

          <!-- Accept Button -->
          <button id="btn-accept-call" class="btn-call-ctrl" style="width: 66px; height: 66px; background: var(--accent-green); box-shadow: 0 0 20px var(--accent-green);" title="Accept Call">
            <i data-lucide="phone" style="width: 28px; height: 28px;"></i>
          </button>
        </div>
      </div>
    `;

    renderIcons();

    document.getElementById('btn-accept-call')?.addEventListener('click', () => {
      notificationEngine.stopIncomingCallRingtone();
      this.renderActiveCall(isVideo);
      if (onAccept) onAccept();
    });

    document.getElementById('btn-decline-call')?.addEventListener('click', () => {
      notificationEngine.stopIncomingCallRingtone();
      this.closeCallUI();
      if (onDecline) onDecline();
    });
  }

  renderActiveCall(isVideo) {
    if (!this.container) return;

    this.callSeconds = 0;

    this.container.innerHTML = `
      <div class="call-fullscreen-modal">
        <!-- Call Header -->
        <div class="call-header-status">
          <div class="call-title">${isVideo ? '🔒 Video Orbit' : '🔒 Voice Orbit'}</div>
          <div class="call-duration-tag" id="call-duration-timer">Connecting...</div>
        </div>

        <!-- Stage Body -->
        ${isVideo ? `
          <div class="video-stage">
            <video id="remote-video" class="video-feed-remote" autoplay playsinline></video>
            <video id="local-video" class="video-feed-local" autoplay playsinline muted></video>
          </div>
        ` : `
          <div class="audio-call-stage">
            <div class="audio-pulse-avatar-wrap">
              <div class="audio-wave-circle"></div>
              <div class="audio-avatar-orb">
                <i data-lucide="phone" style="width: 36px; height: 36px;"></i>
              </div>
            </div>
            <audio id="remote-audio" autoplay></audio>
            <canvas id="audio-visualizer-canvas" class="audio-visualizer-canvas"></canvas>
          </div>
        `}

        <!-- Call Control Bar -->
        <div class="call-controls-bar">
          <button id="btn-toggle-mic" class="btn-call-ctrl" title="Mute Microphone">
            <i data-lucide="mic" id="icon-mic-call"></i>
          </button>

          ${isVideo ? `
            <button id="btn-toggle-camera" class="btn-call-ctrl" title="Toggle Camera">
              <i data-lucide="video" id="icon-cam-call"></i>
            </button>
          ` : ''}

          <button id="btn-end-active-call" class="btn-call-ctrl btn-end-call" title="End Call">
            <i data-lucide="phone-off"></i>
          </button>
        </div>
      </div>
    `;

    renderIcons();
    this.attachActiveCallControls(isVideo);
  }

  attachActiveCallControls(isVideo) {
    const btnMic = document.getElementById('btn-toggle-mic');
    const btnCam = document.getElementById('btn-toggle-camera');
    const btnEnd = document.getElementById('btn-end-active-call');

    let micMuted = false;
    let camMuted = false;

    if (btnMic) {
      btnMic.addEventListener('click', () => {
        micMuted = !micMuted;
        this.callManager.toggleAudio(!micMuted);
        btnMic.classList.toggle('active-mute', micMuted);
        btnMic.innerHTML = `<i data-lucide="${micMuted ? 'mic-off' : 'mic'}"></i>`;
        renderIcons();
      });
    }

    if (btnCam && isVideo) {
      btnCam.addEventListener('click', () => {
        camMuted = !camMuted;
        this.callManager.toggleVideo(!camMuted);
        btnCam.classList.toggle('active-mute', camMuted);
        btnCam.innerHTML = `<i data-lucide="${camMuted ? 'video-off' : 'video'}"></i>`;
        renderIcons();
      });
    }

    if (btnEnd) {
      btnEnd.addEventListener('click', () => {
        this.callManager.endCall();
        this.closeCallUI();
      });
    }
  }

  attachLocalStream(stream, isVideo) {
    if (isVideo) {
      const localVid = document.getElementById('local-video');
      if (localVid) localVid.srcObject = stream;
    }
  }

  attachRemoteStream(stream, isVideo) {
    if (isVideo) {
      const remoteVid = document.getElementById('remote-video');
      if (remoteVid) remoteVid.srcObject = stream;
    } else {
      const remoteAud = document.getElementById('remote-audio');
      if (remoteAud) remoteAud.srcObject = stream;
    }
  }

  startCallTimer() {
    if (this.callTimerInterval) clearInterval(this.callTimerInterval);
    this.callSeconds = 0;

    const timerEl = document.getElementById('call-duration-timer');
    this.callTimerInterval = setInterval(() => {
      this.callSeconds++;
      const mins = Math.floor(this.callSeconds / 60).toString().padStart(2, '0');
      const secs = (this.callSeconds % 60).toString().padStart(2, '0');
      if (timerEl) timerEl.textContent = `${mins}:${secs}`;
    }, 1000);
  }

  closeCallUI() {
    notificationEngine.stopIncomingCallRingtone();
    if (this.callTimerInterval) {
      clearInterval(this.callTimerInterval);
      this.callTimerInterval = null;
    }
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}
