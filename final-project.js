let handpose;
let video;
let hands = [];

let agents = [];
let soundAgents = [];
let lineWeights = [];
const spacing = 25;
const segmentSize = 10;
let baseWeight = 1.5;
let maxExtra = 8;

let w, h, centerX, centerY, lineCount, segmentCount;

let synth;
let lastScheduledTime = 0;
const noteCooldown = 300;
// Pentatonik in C (recommendet from ChatGPT)
const scale = ["C4", "D4", "E4", "G4", "A4", "C5", "D5", "E5", "G5", "A5"];

function preload() {
  handpose = ml5.handPose();
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 255, 255, 255);
  background(0);

  document.body.style.margin = '0';
  document.body.style.padding = '0';

  // initializing sound
  synth = new Tone.Synth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.1 }
  }).toDestination();

  // initializing video
  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();
  handpose.detectStart(video, getHandsData);

  w = width;
  h = height;
  centerX = width / 2;
  centerY = height / 2;

  lineCount = Math.ceil(h / spacing);
  const startPoint = 0;
  const endPoint = width;
  segmentCount = Math.ceil((endPoint - startPoint) / segmentSize);

  for (let i = 0; i < lineCount; i++) {
    lineWeights[i] = new Array(segmentCount).fill(baseWeight);
  }

  for (let i = 0; i < 150; i++) {
    let soundBoid = i < 5; // limits the amount of simultaneous notes so the sound stays harmonic
    let agent = new Agent(random(width), random(height), 3, 0.08, soundBoid);
    agents.push(agent);
    if (soundBoid) soundAgents.push(agent);
  }
}

function draw() {
  background(0, 0, 5, 30);

  // draw lines
  for (let i = 0; i < lineCount; i++) {
    const y = centerY - h / 2 + i * spacing;
    const startX = centerX - w / 2;

    for (let s = 0; s < segmentCount; s++) {
      const segX = startX + s * segmentSize + segmentSize / 2;

      // dinstance to agents
      let minDist = Infinity;
      for (let a of agents) {
        // due to perfomance issues we used ChatGPT to help us fix the problem
        if (abs(a.position.x - segX) < 50 && abs(a.position.y - y) < 50) {
          const d = dist(a.position.x, a.position.y, segX, y);
          if (d < minDist) minDist = d;
        }
      }

      if (minDist < 50) {
        const targetWeight = baseWeight + (1 - minDist / 50) * (maxExtra - baseWeight);
        lineWeights[i][s] = lerp(lineWeights[i][s], targetWeight, 0.15);
      } else {
        lineWeights[i][s] = lerp(lineWeights[i][s], baseWeight, 0.1);
      }

      const hue = map(y, centerY - h / 2, centerY + h / 2, 180, 300);
      const alpha = 200;
      stroke(hue, 200, 255, alpha);
      strokeWeight(lineWeights[i][s]);
      line(segX - segmentSize / 2, y, segX + segmentSize / 2, y);
    }
  }

  let target = createVector(width / 2, height / 2);
  if (hands.length > 0) {
    let indexTip = hands[0].index_finger_tip;
    let handX = map(indexTip.x, 0, video.width, width, 0);
    let handY = map(indexTip.y, 0, video.height, 0, height);
    target = createVector(handX, handY);
  }

  // update agents
  for (let agent of agents) {
    let followForce = agent.follow(target);
    let sepForce = agent.separate(agents);
    followForce.mult(1.0);
    sepForce.mult(1.5);

    agent.applyForce(followForce);
    agent.applyForce(sepForce);

    agent.update();
    agent.checkBorders();
    agent.draw();
  }

  for (let sa of soundAgents) {
    for (let i = 0; i < lineCount; i++) {
      const y = centerY - h / 2 + i * spacing;
      if (abs(sa.position.y - y) < 3) { // hits the line
        let now = millis();
        if (!sa.lastNoteTime || now - sa.lastNoteTime > noteCooldown) {
          let noteIndex = floor(map(y, 0, height, scale.length - 1, 0));
          let note = scale[constrain(noteIndex, 0, scale.length - 1)];
          let toneTime = Tone.now();
          if (toneTime <= lastScheduledTime) toneTime = lastScheduledTime + 0.01;
          synth.triggerAttackRelease(note, "8n", toneTime);
          lastScheduledTime = toneTime;
          sa.lastNoteTime = now;
        }
      }
    }
  }

  push();
  let camW = 160;
  let camH = 120;

  if (hands.length > 0) {
    let indexTip = hands[0].index_finger_tip;
    let scaleX = camW / video.width;
    let scaleY = camH / video.height;
    fill(255, 0, 0);
    noStroke();
  }
  pop();
}

function getHandsData(results) {
  hands = results;
}

class Agent {
  constructor(x, y, maxSpeed, maxForce, soundBoid = false) {
    this.position = createVector(x, y);
    this.lastPosition = createVector(x, y);
    this.acceleration = createVector(0, 0);
    this.velocity = createVector(random(-1, 1), random(-1, 1));
    this.maxSpeed = maxSpeed;
    this.maxForce = maxForce;
    this.soundBoid = soundBoid;
    this.lastNoteTime = 0;
    let colors = [
      [196, 159, 235, 100],
      [254, 248, 197, 100],
      [234, 195, 224, 100],
      [250, 186, 118, 100]
    ];
    this.color = random(colors);
  }

  follow(target) {
    let desired = p5.Vector.sub(target, this.position);
    desired.setMag(this.maxSpeed);
    let steer = p5.Vector.sub(desired, this.velocity);
    steer.limit(this.maxForce);
    return steer;
  }

  separate(agents) {
    const desiredSeparation = 20;
    let steer = createVector(0, 0);
    let count = 0;

    for (let other of agents) {
      const distance = p5.Vector.dist(this.position, other.position);
      if (distance > 0 && distance < desiredSeparation) {
        steer.add(
          p5.Vector.sub(this.position, other.position)
            .normalize()
            .div(distance)
        );
        count++;
      }
    }
    if (count > 0) {
      steer.div(count)
           .setMag(this.maxSpeed)
           .sub(this.velocity)
           .limit(this.maxForce);
    }
    return steer;
  }

  applyForce(force) {
    this.acceleration.add(force);
  }

  update() {
    this.lastPosition = this.position.copy();
    this.velocity.add(this.acceleration);
    this.velocity.limit(this.maxSpeed);
    this.position.add(this.velocity);
    this.acceleration.mult(0);
  }

  checkBorders() {
    if (this.position.x < 0) this.position.x = width;
    if (this.position.x > width) this.position.x = 0;
    if (this.position.y < 0) this.position.y = height;
    if (this.position.y > height) this.position.y = 0;
  }

  draw() {
    stroke(this.color);
    strokeWeight(this.soundBoid ? 3 : 2);
    line(this.lastPosition.x, this.lastPosition.y, this.position.x, this.position.y);
  }
}
