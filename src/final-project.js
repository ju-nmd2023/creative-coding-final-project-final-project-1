let seed = 0;
let layers = [];
let lineWeights = [];

const centerX = innerWidth / 2;
const centerY = innerHeight / 2;
const w = 500;
const h = 400;
const spacing = 15;
const segmentSize = 5;
const baseWeight = 1.5;
const maxExtra = 8;
const lineCount = h / spacing;
let segmentCount;

function setup() {
  createCanvas(innerWidth, innerHeight);
  colorMode(HSB, 360, 255, 255, 255);
  noiseSeed(seed);
  generateLayers();

  const startPoint = centerX - w / 2;
  const endPoint = centerX + w / 2;
  segmentCount = Math.ceil((endPoint - startPoint) / segmentSize); 
  for (let i = 0; i < lineCount; i++) {
    lineWeights[i] = new Array(segmentCount).fill(baseWeight);
  }

  noStroke();
}

class Point {
  constructor(x, y, noise) {
    this.x = x;
    this.y = y;
    this.noise = noise;
  }
}

function generateHorizon(base, maxHeight, offset) {
  let points = [];
  for (let i = 0; i < width; i++) {
    const noiseValue = noise(i / 100, offset);
    const y = base + noiseValue * maxHeight;
    const point = new Point(i, y, noiseValue);
    points.push(point);
  }
  return points;
}

function generateLayers() {
  let h = height * 0.8;
  let maxHeight = 60;
  let offset = 0;
  layers = [];
  while (h > 0) {
    layers.push({
      base: h,
      maxHeight: maxHeight,
      offset: offset,
    });
    h -= 120;
    offset += 1000;
  }
}

function draw() {
  background(230, 20, 10);

  for (let i = 0; i < layers.length; i++) {
    let layer = layers[i];
    let t = frameCount * 0.01;
    let horizon = generateHorizon(layer.base, layer.maxHeight, t + layer.offset);

    let hue = map(i, 0, layers.length, 120, 180);
    fill(hue, 200, 200, 40);
    noStroke();

    beginShape();
    vertex(0, height);
    for (let p of horizon) {
      vertex(p.x, p.y);
    }
    vertex(width, height);
    endShape(CLOSE);
  }

  for (let i = 0; i < lineCount; i++) {
    const y = centerY - h / 2 + i * spacing;
    const startX = centerX - w / 2;

    for (let s = 0; s < segmentCount; s++) {
      const segX = startX + s * segmentSize + segmentSize / 2;

      const d = dist(mouseX, mouseY, segX, y);
      
      if (d < spacing) {
        // Calculate target thickness: closer mouse --> thicker line
        const targetWeight = baseWeight + (1 - d / spacing) * (maxExtra - baseWeight);
      lineWeights[i][s] = lerp(lineWeights[i][s], targetWeight, 0.07);
      }

      // Farbvariation abhängig von Nähe zu Noise-Landschaft
      let heightBelow = 0;
      for (let L of layers) {
        let noiseVal = noise(segX / 100, (frameCount * 0.01) + L.offset);
        let yVal = L.base + noiseVal * L.maxHeight;
        if (abs(y - yVal) < 10) heightBelow += 1;
      }

      let hue = map(heightBelow, 0, layers.length, 200, 330);
      stroke(hue, 200, 255, 150);
      strokeWeight(lineWeights[i][s]);
      line(segX - segmentSize / 2, y, segX + segmentSize / 2, y);
    }
  }
}
