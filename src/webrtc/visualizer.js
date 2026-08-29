/**
 * AntiGravity Duo — Neon Audio Visualizer for Encrypted Voice Calls
 */

export class AudioVisualizer {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvas ? canvas.getContext('2d') : null;
    this.audioCtx = null;
    this.analyser = null;
    this.source = null;
    this.animationId = null;
    this.isRunning = false;
  }

  attachStream(stream) {
    if (!this.canvas) return;
    try {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 64;

      this.source = this.audioCtx.createMediaStreamSource(stream);
      this.source.connect(this.analyser);

      this.isRunning = true;
      this.draw();
    } catch (e) {
      console.warn('Could not initialize audio visualizer context:', e);
    }
  }

  draw = () => {
    if (!this.isRunning || !this.ctx || !this.analyser) return;
    this.animationId = requestAnimationFrame(this.draw);

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);

    const width = this.canvas.width;
    const height = this.canvas.height;
    this.ctx.clearRect(0, 0, width, height);

    const barWidth = (width / bufferLength) * 1.5;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * height;

      // Neon Gradient
      const gradient = this.ctx.createLinearGradient(0, height, 0, height - barHeight);
      gradient.addColorStop(0, '#ff3366');
      gradient.addColorStop(0.5, '#8a2be2');
      gradient.addColorStop(1, '#00f5d4');

      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(x, height - barHeight, barWidth - 2, barHeight);

      x += barWidth;
    }
  };

  stop() {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close().catch(() => {});
    }
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }
}
