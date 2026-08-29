import * as THREE from 'three';
import { TwinOrbitVisual } from './twin-orbit.js';

export class Cosmos3DScene {
  constructor(canvasId = 'cosmos-canvas') {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x07080c, 0.032);

    this.camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 2, 18);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
    this.isDragging = false;
    this.previousMousePosition = { x: 0, y: 0 };

    this.initLights();
    this.initStars();
    this.twinOrbit = new TwinOrbitVisual(this.scene);

    this.initEvents();
    this.animate();
  }

  initLights() {
    const ambientLight = new THREE.AmbientLight(0x22223b, 1.4);
    this.scene.add(ambientLight);

    const rosePointLight = new THREE.PointLight(0xff3366, 3.5, 60);
    rosePointLight.position.set(12, 12, 12);
    this.scene.add(rosePointLight);

    const cyanPointLight = new THREE.PointLight(0x00f5d4, 3.5, 60);
    cyanPointLight.position.set(-12, -12, 12);
    this.scene.add(cyanPointLight);

    const violetLight = new THREE.PointLight(0x8a2be2, 2.5, 50);
    violetLight.position.set(0, -10, -5);
    this.scene.add(violetLight);
  }

  initStars() {
    const starCount = 3000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    const colorPalette = [
      new THREE.Color(0xffffff),
      new THREE.Color(0xff758c),
      new THREE.Color(0x00f5d4),
      new THREE.Color(0x8a2be2),
      new THREE.Color(0xffb703)
    ];

    for (let i = 0; i < starCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 90;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 90;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 90;

      const col = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.24,
      vertexColors: true,
      transparent: true,
      opacity: 0.85
    });

    this.starPoints = new THREE.Points(geometry, material);
    this.scene.add(this.starPoints);
  }

  initEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Touch & Mouse 3D Interactive Parallax
    window.addEventListener('mousemove', (e) => {
      this.mouse.targetX = (e.clientX / window.innerWidth - 0.5) * 2;
      this.mouse.targetY = (e.clientY / window.innerHeight - 0.5) * 2;
    });

    window.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        this.mouse.targetX = (e.touches[0].clientX / window.innerWidth - 0.5) * 2.5;
        this.mouse.targetY = (e.touches[0].clientY / window.innerHeight - 0.5) * 2.5;
      }
    }, { passive: true });
  }

  setPartnerOnline(isOnline) {
    if (this.twinOrbit) {
      this.twinOrbit.setPartnerOnline(isOnline);
    }
  }

  triggerHeartPulse() {
    if (this.twinOrbit) {
      this.twinOrbit.pulse();
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    this.mouse.x = THREE.MathUtils.lerp(this.mouse.x, this.mouse.targetX, 0.05);
    this.mouse.y = THREE.MathUtils.lerp(this.mouse.y, this.mouse.targetY, 0.05);

    this.camera.position.x = this.mouse.x * 2.5;
    this.camera.position.y = 2 - this.mouse.y * 2.0;
    this.camera.lookAt(0, 0, 0);

    if (this.starPoints) {
      this.starPoints.rotation.y += 0.0004;
      this.starPoints.rotation.x += 0.0002;
    }

    if (this.twinOrbit) {
      this.twinOrbit.update();
    }

    this.renderer.render(this.scene, this.camera);
  }
}
