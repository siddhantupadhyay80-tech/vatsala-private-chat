import { cryptoEngine } from '../security/crypto.js';
import { renderIcons } from '../utils/icons.js';
import confetti from 'canvas-confetti';

export class CoupleSanctuaryView {
  constructor(socket, userSession, onSendHeart) {
    this.socket = socket;
    this.session = userSession;
    this.onSendHeart = onSendHeart;
    this.container = document.getElementById('sanctuary-component-mount');

    this.anniversaryDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000 * 1.5); // Default 1.5 years ago
    this.notes = [
      { id: 'note_1', text: '🌌 First stargazing night under the zero-gravity sky', done: true },
      { id: 'note_2', text: '✈️ Trip to the Northern Lights & Arctic Glass Igloos', done: false },
      { id: 'note_3', text: '🔒 Our private memories stay forever safe in AntiGravity Duo', done: true }
    ];

    this.render();
    this.startCounterTimer();
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="sanctuary-container">
        <!-- Left Column: Counter & Radar -->
        <div class="sanctuary-col">
          
          <!-- Days Together Counter -->
          <div class="widget-love-counter glass-card">
            <div class="counter-glow-ring"></div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span class="counter-header">✨ In Orbit Together</span>
              <button id="btn-edit-anniversary" class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.72rem;">
                <i data-lucide="calendar"></i> Set Date
              </button>
            </div>

            <div class="counter-digits-grid">
              <div class="counter-digit-box">
                <div class="counter-num" id="cnt-days">0</div>
                <div class="counter-lbl">Days</div>
              </div>
              <div class="counter-digit-box">
                <div class="counter-num" id="cnt-hours">00</div>
                <div class="counter-lbl">Hours</div>
              </div>
              <div class="counter-digit-box">
                <div class="counter-num" id="cnt-mins">00</div>
                <div class="counter-lbl">Minutes</div>
              </div>
              <div class="counter-digit-box">
                <div class="counter-num" id="cnt-secs">00</div>
                <div class="counter-lbl">Seconds</div>
              </div>
            </div>

            <p style="font-size: 0.8rem; color: var(--text-secondary); text-align: center;">
              "Every second in zero gravity feels infinite with you."
            </p>
          </div>

          <!-- Distance & Heartbeat Sync Radar -->
          <div class="widget-distance-radar glass-card">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span class="counter-header" style="color: var(--accent-cyan);">
                <i data-lucide="radio" style="width: 14px; height: 14px; vertical-align: middle;"></i>
                Orbital Resonance & Sync
              </span>
              <span style="font-size: 0.75rem; font-family: var(--font-mono); color: var(--accent-green);">
                ● Synchronized
              </span>
            </div>

            <div class="radar-visual">
              <div class="radar-line"></div>
              <div class="radar-orb partner-1" title="You">💫</div>
              
              <div style="text-align: center; z-index: 3; background: rgba(10,13,20,0.85); padding: 6px 14px; border-radius: var(--radius-full); border: 1px solid rgba(255,255,255,0.1);">
                <div style="font-size: 0.85rem; font-weight: 700; color: #fff;">0 ms Latency</div>
                <div style="font-size: 0.7rem; color: var(--accent-rose-light);">Hearts Aligned</div>
              </div>

              <div class="radar-orb partner-2" title="Partner">💖</div>
            </div>

            <button id="btn-pulse-sync" class="btn btn-primary" style="width: 100%;">
              <i data-lucide="heart"></i> Send Mutual Heartbeat Pulse
            </button>
          </div>
        </div>

        <!-- Right Column: Secret Notes & Shared Bucket List -->
        <div class="sanctuary-col">
          <div class="widget-secret-notes glass-card" style="height: 100%;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span class="counter-header" style="color: var(--accent-violet);">
                <i data-lucide="sparkles" style="width: 14px; height: 14px; vertical-align: middle;"></i>
                Secret Orbit Bucket List
              </span>
              <span style="font-size: 0.72rem; font-family: var(--font-mono); color: var(--text-muted);">
                🔒 E2EE Encrypted
              </span>
            </div>

            <div style="display: flex; gap: 8px; margin-top: 10px;">
              <input type="text" id="input-new-note" class="chat-input-field" placeholder="Add a shared dream or secret note..." style="font-size: 0.85rem;" />
              <button id="btn-add-note" class="btn btn-primary" style="padding: 0 16px;">
                <i data-lucide="plus"></i>
              </button>
            </div>

            <div class="notes-list" id="notes-list" style="margin-top: 14px; overflow-y: auto; max-height: 380px;">
              <!-- Dynamically populated -->
            </div>
          </div>
        </div>
      </div>
    `;

    renderIcons();
    this.attachEvents();
    this.renderNotes();
  }

  attachEvents() {
    const btnPulse = document.getElementById('btn-pulse-sync');
    const btnAddNote = document.getElementById('btn-add-note');
    const inputNote = document.getElementById('input-new-note');
    const btnEditDate = document.getElementById('btn-edit-anniversary');

    if (btnPulse) {
      btnPulse.addEventListener('click', () => {
        confetti({
          particleCount: 80,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#ff3366', '#00f5d4', '#8a2be2']
        });
        if (this.onSendHeart) this.onSendHeart();
      });
    }

    if (btnAddNote && inputNote) {
      const addAction = () => {
        const text = inputNote.value.trim();
        if (!text) return;
        this.notes.unshift({
          id: `note_${Date.now()}`,
          text,
          done: false
        });
        inputNote.value = '';
        this.renderNotes();
      };

      btnAddNote.addEventListener('click', addAction);
      inputNote.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addAction();
      });
    }

    if (btnEditDate) {
      btnEditDate.addEventListener('click', () => {
        const input = prompt('Enter your relationship start date (YYYY-MM-DD):', this.anniversaryDate.toISOString().split('T')[0]);
        if (input) {
          const parsed = new Date(input);
          if (!isNaN(parsed.getTime())) {
            this.anniversaryDate = parsed;
            this.updateCounter();
          }
        }
      });
    }
  }

  renderNotes() {
    const list = document.getElementById('notes-list');
    if (!list) return;

    list.innerHTML = '';
    this.notes.forEach((note) => {
      const item = document.createElement('div');
      item.className = 'note-item';
      item.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          <input type="checkbox" ${note.done ? 'checked' : ''} style="accent-color: var(--accent-rose); cursor: pointer;" id="chk-${note.id}" />
          <span class="note-content" style="${note.done ? 'text-decoration: line-through; opacity: 0.6;' : ''}">${note.text}</span>
        </div>
        <button class="btn-icon-action" id="del-${note.id}" style="height: 28px; width: 28px; padding: 0; color: var(--text-muted);">
          <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i>
        </button>
      `;

      item.querySelector(`#chk-${note.id}`)?.addEventListener('change', (e) => {
        note.done = e.target.checked;
        this.renderNotes();
      });

      item.querySelector(`#del-${note.id}`)?.addEventListener('click', () => {
        this.notes = this.notes.filter((n) => n.id !== note.id);
        this.renderNotes();
      });

      list.appendChild(item);
    });

    renderIcons();
  }

  startCounterTimer() {
    this.updateCounter();
    setInterval(() => this.updateCounter(), 1000);
  }

  updateCounter() {
    const now = new Date();
    const diff = Math.max(0, now - this.anniversaryDate);

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const mins = Math.floor((diff / 1000 / 60) % 60);
    const secs = Math.floor((diff / 1000) % 60);

    const dEl = document.getElementById('cnt-days');
    const hEl = document.getElementById('cnt-hours');
    const mEl = document.getElementById('cnt-mins');
    const sEl = document.getElementById('cnt-secs');

    if (dEl) dEl.textContent = days;
    if (hEl) hEl.textContent = String(hours).padStart(2, '0');
    if (mEl) mEl.textContent = String(mins).padStart(2, '0');
    if (sEl) sEl.textContent = String(secs).padStart(2, '0');
  }
}
