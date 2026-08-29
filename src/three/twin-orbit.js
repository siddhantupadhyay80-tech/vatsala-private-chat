import * as THREE from 'three';

/**
 * Creates 3D Twin Celestial Orbiting Star Cores & Glowing 3D Heart Mesh
 */
export class TwinOrbitVisual {
  constructor(scene) {
    this.scene = scene;
    this.orbitGroup = new THREE.Group();
    this.angle = 0;
    this.speed = 0.012;
    this.pulseScale = 1.0;
    this.partnerConnected = false;

    this.initCores();
    this.init3DHeartMesh();
    this.initOrbitRings();
    this.initCosmicRays();
    this.scene.add(this.orbitGroup);
  }

  initCores() {
    // Partner 1: Cyan Starlight Core
    const geo1 = new THREE.SphereGeometry(1.6, 32, 32);
    const mat1 = new THREE.MeshStandardMaterial({
      color: 0x00f5d4,
      emissive: 0x00f5d4,
      emissiveIntensity: 0.9,
      roughness: 0.1,
      metalness: 0.9
    });
    this.core1 = new THREE.Mesh(geo1, mat1);

    // Glow aura 1
    const auraGeo1 = new THREE.SphereGeometry(2.4, 32, 32);
    const auraMat1 = new THREE.MeshBasicMaterial({
      color: 0x00f5d4,
      transparent: true,
      opacity: 0.35,
      side: THREE.BackSide
    });
    this.aura1 = new THREE.Mesh(auraGeo1, auraMat1);
    this.core1.add(this.aura1);

    // Partner 2: Rose Cyber-Love Core
    const geo2 = new THREE.SphereGeometry(1.6, 32, 32);
    const mat2 = new THREE.MeshStandardMaterial({
      color: 0xff3366,
      emissive: 0xff3366,
      emissiveIntensity: 0.9,
      roughness: 0.1,
      metalness: 0.9
    });
    this.core2 = new THREE.Mesh(geo2, mat2);

    // Glow aura 2
    const auraGeo2 = new THREE.SphereGeometry(2.4, 32, 32);
    const auraMat2 = new THREE.MeshBasicMaterial({
      color: 0xff3366,
      transparent: true,
      opacity: 0.35,
      side: THREE.BackSide
    });
    this.aura2 = new THREE.Mesh(auraGeo2, auraMat2);
    this.core2.add(this.aura2);

    this.orbitGroup.add(this.core1);
    this.orbitGroup.add(this.core2);
  }

  init3DHeartMesh() {
    // Parametric 3D Heart Curve
    const heartShape = new THREE.Shape();
    const x = 0, y = 0;
    heartShape.moveTo(x + 2.5, y + 2.5);
    heartShape.bezierCurveTo(x + 2.5, y + 2.5, x + 2.0, y, x, y);
    heartShape.bezierCurveTo(x - 3.0, y, x - 3.0, y + 3.5, x - 3.0, y + 3.5);
    heartShape.bezierCurveTo(x - 3.0, y + 5.5, x - 1.0, y + 7.7, x + 2.5, y + 9.5);
    heartShape.bezierCurveTo(x + 6.0, y + 7.7, x + 8.0, y + 5.5, x + 8.0, y + 3.5);
    heartShape.bezierCurveTo(x + 8.0, y + 3.5, x + 8.0, y, x + 5.0, y);
    heartShape.bezierCurveTo(x + 3.5, y, x + 2.5, y + 2.5, x + 2.5, y + 2.5);

    const extrudeSettings = {
      depth: 1.2,
      bevelEnabled: true,
      bevelSegments: 8,
      steps: 4,
      bevelSize: 0.6,
      bevelThickness: 0.6
    };

    const geometry = new THREE.ExtrudeGeometry(heartShape, extrudeSettings);
    geometry.center();

    const material = new THREE.MeshPhysicalMaterial({
      color: 0xff3366,
      emissive: 0x8a2be2,
      emissiveIntensity: 0.5,
      roughness: 0.15,
      metalness: 0.4,
      transmission: 0.6,
      thickness: 1.5,
      transparent: true,
      opacity: 0.75
    });

    this.heartMesh = new THREE.Mesh(geometry, material);
    this.heartMesh.scale.set(0.65, 0.65, 0.65);
    this.heartMesh.rotation.x = Math.PI;
    this.orbitGroup.add(this.heartMesh);
  }

  initOrbitRings() {
    const curve = new THREE.EllipseCurve(0, 0, 9, 5, 0, 2 * Math.PI, false, 0);
    const points = curve.getPoints(120);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    const material = new THREE.LineBasicMaterial({
      color: 0x00f5d4,
      transparent: true,
      opacity: 0.45
    });

    this.orbitLine = new THREE.Line(geometry, material);
    this.orbitLine.rotation.x = Math.PI / 2.6;
    this.orbitGroup.add(this.orbitLine);
  }

  initCosmicRays() {
    const rayCount = 400;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(rayCount * 3);

    for (let i = 0; i < rayCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const radius = 6 + Math.random() * 8;
      pos[i * 3] = Math.cos(theta) * radius;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 4;
      pos[i * 3 + 2] = Math.sin(theta) * radius;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xff758c,
      size: 0.18,
      transparent: true,
      opacity: 0.6
    });

    this.rays = new THREE.Points(geo, mat);
    this.orbitGroup.add(this.rays);
  }

  setPartnerOnline(isOnline) {
    this.partnerConnected = isOnline;
    this.speed = isOnline ? 0.022 : 0.012;
    if (this.aura1) this.aura1.material.opacity = isOnline ? 0.55 : 0.25;
    if (this.aura2) this.aura2.material.opacity = isOnline ? 0.55 : 0.25;
  }

  pulse() {
    this.pulseScale = 1.6;
  }

  update(delta = 0.016) {
    this.angle += this.speed;

    // Elliptical Orbit Paths
    const a = 7.5;
    const b = 4.2;

    this.core1.position.x = Math.cos(this.angle) * a;
    this.core1.position.z = Math.sin(this.angle) * b;
    this.core1.position.y = Math.sin(this.angle * 2) * 1.5;

    this.core2.position.x = Math.cos(this.angle + Math.PI) * a;
    this.core2.position.z = Math.sin(this.angle + Math.PI) * b;
    this.core2.position.y = -Math.sin(this.angle * 2) * 1.5;

    // Heart rotation & pulse
    if (this.heartMesh) {
      this.heartMesh.rotation.y += 0.015;
      this.heartMesh.rotation.z = Math.sin(this.angle) * 0.15;

      if (this.pulseScale > 1.0) {
        this.pulseScale = THREE.MathUtils.lerp(this.pulseScale, 1.0, 0.05);
      }
      const baseScale = (this.partnerConnected ? 0.75 : 0.60) * this.pulseScale;
      this.heartMesh.scale.set(baseScale, baseScale, baseScale);
    }

    if (this.rays) {
      this.rays.rotation.y -= 0.005;
    }

    this.orbitGroup.rotation.y += 0.003;
  }
}
