// Google MediaPipe Pose Model Tester (33 Landmarks)
// Pure Model Testing Playground without exercise rules

const LANDMARK_NAMES = [
  "Nose (จมูก)",
  "Left Eye Inner (ตาซ้ายใน)",
  "Left Eye (ตาซ้าย)",
  "Left Eye Outer (ตาซ้ายนอก)",
  "Right Eye Inner (ตาขวาใน)",
  "Right Eye (ตาขวา)",
  "Right Eye Outer (ตาขวานอก)",
  "Left Ear (หูซ้าย)",
  "Right Ear (หูขวา)",
  "Mouth Left (ปากซ้าย)",
  "Mouth Right (ปากขวา)",
  "Left Shoulder (ไหล่ซ้าย)",
  "Right Shoulder (ไหล่ขวา)",
  "Left Elbow (ข้อศอกซ้าย)",
  "Right Elbow (ข้อศอกขวา)",
  "Left Wrist (ข้อมือซ้าย)",
  "Right Wrist (ข้อมือขวา)",
  "Left Pinky (นิ้วก้อยซ้าย)",
  "Right Pinky (นิ้วก้อยขวา)",
  "Left Index (นิ้วชี้ซ้าย)",
  "Right Index (นิ้วชี้ขวา)",
  "Left Thumb (นิ้วโป้งซ้าย)",
  "Right Thumb (นิ้วโป้งขวา)",
  "Left Hip (สะโพกซ้าย)",
  "Right Hip (สะโพกขวา)",
  "Left Knee (หัวเข่าซ้าย)",
  "Right Knee (หัวเข่าขวา)",
  "Left Ankle (ข้อเท้าซ้าย)",
  "Right Ankle (ข้อเท้าขวา)",
  "Left Heel (ส้นเท้าซ้าย)",
  "Right Heel (ส้นเท้าขวา)",
  "Left Foot Index (ปลายเท้าซ้าย)",
  "Right Foot Index (ปลายเท้าขวา)"
];

let poseInstance = null;
let currentFacingMode = 'user'; // 'user' (front) or 'environment' (back)
let isPaused = false;
let isProcessingFrame = false;
let lastProcessTimestamp = 0;
let videoLoopAnimId = null;
let activeSource = 'camera'; // 'camera', 'sample', 'upload'

let drawConnectionsOption = true;
let drawDotsOption = true;
let drawIndicesOption = false;
let mirrorModeOption = true;
let modelComplexityOption = 0; // 0 = Lite, 1 = Full

// Performance metrics
let lastFrameTime = performance.now();
let frameCount = 0;
let fps = 0;

// DOM Elements
const videoElement = document.getElementById('webcam-video');
const canvasElement = document.getElementById('output-canvas');
const canvasCtx = canvasElement.getContext('2d');
const loadingBox = document.getElementById('loading-box');
const loadingTitle = document.getElementById('loading-title');
const loadingDesc = document.getElementById('loading-desc');

const fpsVal = document.getElementById('fps-val');
const landmarksCountVal = document.getElementById('landmarks-count');
const confidenceVal = document.getElementById('confidence-val');
const resolutionVal = document.getElementById('resolution-val');
const bannerStatus = document.getElementById('banner-status');
const landmarksTbody = document.getElementById('landmarks-tbody');

const btnSrcCamera = document.getElementById('btn-src-camera');
const btnSwitchCamera = document.getElementById('btn-switch-camera');
const btnSrcSample = document.getElementById('btn-src-sample');
const btnSrcUpload = document.getElementById('btn-src-upload');
const videoFileInput = document.getElementById('video-file-input');

const toggleConnections = document.getElementById('toggle-connections');
const toggleDots = document.getElementById('toggle-dots');
const toggleIndices = document.getElementById('toggle-indices');
const toggleMirror = document.getElementById('toggle-mirror');
const btnPauseResume = document.getElementById('btn-pause-resume');
const btnPauseText = document.getElementById('btn-pause-text');

const btnComp0 = document.getElementById('btn-comp-0');
const btnComp1 = document.getElementById('btn-comp-1');

// Process Pose Detection Results
function onPoseResults(results) {
  if (loadingBox.style.display !== 'none') {
    loadingBox.style.display = 'none';
  }

  // Calculate FPS
  const now = performance.now();
  frameCount++;
  if (now - lastFrameTime >= 1000) {
    fps = Math.round((frameCount * 1000) / (now - lastFrameTime));
    fpsVal.innerText = fps;
    frameCount = 0;
    lastFrameTime = now;
  }

  // Match canvas dimensions to video feed
  if (videoElement.videoWidth > 0 && (canvasElement.width !== videoElement.videoWidth || canvasElement.height !== videoElement.videoHeight)) {
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;
    resolutionVal.innerText = `${videoElement.videoWidth} x ${videoElement.videoHeight}`;
  }

  const width = canvasElement.width;
  const height = canvasElement.height;

  canvasCtx.save();
  canvasCtx.clearRect(0, 0, width, height);

  // Draw current video frame onto canvas
  canvasCtx.drawImage(results.image, 0, 0, width, height);

  if (results.poseLandmarks && results.poseLandmarks.length > 0) {
    const lm = results.poseLandmarks;
    landmarksCountVal.innerText = `${lm.length} / 33`;

    // Average confidence
    let sumVis = 0;
    for (let i = 0; i < lm.length; i++) sumVis += (lm[i].visibility || 1);
    const avgConfidence = Math.round((sumVis / lm.length) * 100);
    confidenceVal.innerText = `${avgConfidence}%`;

    bannerStatus.className = 'banner-status active';
    bannerStatus.innerText = `✅ ตรวจจับร่างกายมนุษย์สำเร็จ (33 จุดครบสมบูรณ์)`;

    // 1. Draw Skeleton Connections
    if (drawConnectionsOption) {
      drawConnectors(canvasCtx, lm, POSE_CONNECTIONS, {
        color: '#10b981',
        lineWidth: 4
      });
    }

    // 2. Draw Landmark Dots
    if (drawDotsOption) {
      drawLandmarks(canvasCtx, lm, {
        color: '#38bdf8',
        fillColor: '#ffffff',
        lineWidth: 2,
        radius: 4
      });
    }

    // 3. Draw Landmark Index Numbers (Optional)
    if (drawIndicesOption) {
      canvasCtx.font = 'bold 12px Chakra Petch, monospace';
      canvasCtx.fillStyle = '#facc15';
      canvasCtx.strokeStyle = '#000000';
      canvasCtx.lineWidth = 3;

      for (let i = 0; i < lm.length; i++) {
        if (!lm[i] || (lm[i].visibility && lm[i].visibility < 0.3)) continue;
        const x = lm[i].x * width;
        const y = lm[i].y * height;
        canvasCtx.strokeText(i, x + 6, y - 6);
        canvasCtx.fillText(i, x + 6, y - 6);
      }
    }

    // Update Live Coordinates Table (Throttle DOM updates every ~150ms)
    if (frameCount % 5 === 0) {
      updateLandmarksTable(lm);
    }

  } else {
    landmarksCountVal.innerText = '0 / 33';
    confidenceVal.innerText = '0%';
    bannerStatus.className = 'banner-status';
    bannerStatus.innerText = 'กำลังสแกนค้นหาร่างกายมนุษย์ในเฟรมภาพ...';
  }

  canvasCtx.restore();
}

// Update Table Inspector with live X, Y, Z, Vis
function updateLandmarksTable(lm) {
  let html = '';
  // Highlight important joints
  const priorityIndices = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32];

  for (let idx of priorityIndices) {
    const pt = lm[idx];
    if (!pt) continue;
    const name = LANDMARK_NAMES[idx] || `Point ${idx}`;
    const vis = Math.round((pt.visibility || 1) * 100);
    const visColor = vis > 70 ? '#34d399' : vis > 40 ? '#facc15' : '#f87171';

    html += `
      <tr>
        <td style="color: #64748b; font-family: monospace;">${idx}</td>
        <td style="font-weight: 500;">${name}</td>
        <td class="num-font" style="color: #38bdf8;">${pt.x.toFixed(3)}</td>
        <td class="num-font" style="color: #818cf8;">${pt.y.toFixed(3)}</td>
        <td class="num-font" style="color: #c084fc;">${pt.z.toFixed(3)}</td>
        <td class="num-font" style="color: ${visColor};">${vis}%</td>
      </tr>
    `;
  }
  landmarksTbody.innerHTML = html;
}

// Video Frame Processing Loop (Runs on both camera and video files)
async function runVideoFrameLoop() {
  if (isPaused || videoElement.paused || videoElement.ended || videoElement.readyState < 2) {
    videoLoopAnimId = requestAnimationFrame(runVideoFrameLoop);
    return;
  }

  const now = performance.now();
  // Throttle to 30 FPS (every 33ms) to prevent WASM SIMD memory overflow
  if (now - lastProcessTimestamp >= 33 && !isProcessingFrame && poseInstance) {
    if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
      isProcessingFrame = true;
      lastProcessTimestamp = now;
      try {
        await poseInstance.send({ image: videoElement });
      } catch (err) {
        console.warn('Frame dropped:', err);
      } finally {
        isProcessingFrame = false;
      }
    }
  }

  videoLoopAnimId = requestAnimationFrame(runVideoFrameLoop);
}

// Start Live Camera
async function startCamera(facingMode = 'user') {
  currentFacingMode = facingMode;
  activeSource = 'camera';
  updateSourceButtons(btnSrcCamera);

  if (videoLoopAnimId) {
    cancelAnimationFrame(videoLoopAnimId);
    videoLoopAnimId = null;
  }
  if (videoElement.srcObject) {
    try {
      videoElement.srcObject.getTracks().forEach(t => t.stop());
    } catch(e) {}
    videoElement.srcObject = null;
  }

  videoElement.pause();
  videoElement.src = '';

  applyMirrorTransform();

  loadingBox.style.display = 'flex';
  loadingTitle.innerText = 'กำลังเปิดกล้อง... (กดยอมรับ Allow บนเบราว์เซอร์)';
  loadingDesc.innerText = facingMode === 'user' ? 'กล้องหน้า (Front Camera)' : 'กล้องหลัง (Back Camera)';

  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('อุปกรณ์ไม่รองรับ getUserMedia');
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: facingMode
      },
      audio: false
    });

    videoElement.srcObject = stream;
    await videoElement.play();
    isPaused = false;
    btnPauseText.innerText = 'หยุดชั่วคราว';
    runVideoFrameLoop();
    document.getElementById('status-text').innerText = 'กล้องสดพร้อมทำงาน (Active)';

  } catch (err) {
    console.warn('Camera failed, switching to sample video:', err);
    loadingTitle.innerText = 'ไม่สามารถเปิดกล้องได้';
    loadingDesc.innerText = 'สลับไปเล่นวิดีโอตัวอย่างอัตโนมัติ...';
    setTimeout(() => {
      loadVideoSource('/samples/squat.mp4', btnSrcSample);
    }, 1200);
  }
}

// Load Video (Sample or Custom Upload)
function loadVideoSource(url, activeBtn) {
  activeSource = 'video';
  updateSourceButtons(activeBtn);

  if (videoElement.srcObject) {
    try {
      videoElement.srcObject.getTracks().forEach(t => t.stop());
    } catch(e) {}
    videoElement.srcObject = null;
  }
  if (videoLoopAnimId) {
    cancelAnimationFrame(videoLoopAnimId);
    videoLoopAnimId = null;
  }

  applyMirrorTransform();

  loadingBox.style.display = 'flex';
  loadingTitle.innerText = 'กำลังโหลดไฟล์วิดีโอ...';
  loadingDesc.innerText = 'เตรียมส่งเฟรมภาพเข้าโมเดล MediaPipe';

  videoElement.pause();
  videoElement.src = url;
  videoElement.loop = true;
  videoElement.muted = true;
  videoElement.playsInline = true;

  videoElement.onloadeddata = async () => {
    loadingBox.style.display = 'none';
    try {
      await videoElement.play();
      isPaused = false;
      btnPauseText.innerText = 'หยุดชั่วคราว';
      runVideoFrameLoop();
      document.getElementById('status-text').innerText = 'กำลังวิเคราะห์คลิปวิดีโอ (Video Loop)';
    } catch (err) {
      console.warn('Auto play failed:', err);
    }
  };
}

function applyMirrorTransform() {
  if (mirrorModeOption && activeSource === 'camera' && currentFacingMode === 'user') {
    canvasElement.style.transform = 'scaleX(-1)';
  } else {
    canvasElement.style.transform = 'none';
  }
}

function updateSourceButtons(activeBtn) {
  [btnSrcCamera, btnSrcSample, btnSrcUpload].forEach(b => {
    if (b) b.classList.remove('active');
  });
  if (activeBtn) activeBtn.classList.add('active');
}

// Initialize MediaPipe Pose Engine
async function initPoseEngine(complexity = 0) {
  try {
    modelComplexityOption = complexity;
    loadingBox.style.display = 'flex';
    loadingTitle.innerText = 'กำลังโหลดและคอมไพล์ MediaPipe Pose...';
    loadingDesc.innerText = `โมเดลเวอร์ชัน: ${complexity === 0 ? 'Lite (เร็วสุด)' : 'Full (มาตรฐาน)'}`;

    if (poseInstance) {
      try { poseInstance.close(); } catch(e) {}
    }

    poseInstance = new Pose({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${file}`;
      }
    });

    poseInstance.setOptions({
      modelComplexity: complexity,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    poseInstance.onResults(onPoseResults);

    await poseInstance.initialize();
    document.getElementById('status-text').innerText = 'โมเดล MediaPipe พร้อมใช้งาน (Ready)';

    // Start with camera by default
    await startCamera('user');

  } catch (err) {
    console.error('Initialization error:', err);
    loadVideoSource('/samples/squat.mp4', btnSrcSample);
  }
}

// UI Event Listeners
btnSrcCamera.addEventListener('click', () => {
  startCamera(currentFacingMode);
});

btnSwitchCamera.addEventListener('click', () => {
  const nextMode = currentFacingMode === 'user' ? 'environment' : 'user';
  startCamera(nextMode);
});

btnSrcSample.addEventListener('click', () => {
  loadVideoSource('/samples/squat.mp4', btnSrcSample);
});

btnSrcUpload.addEventListener('click', () => {
  videoFileInput.click();
});

videoFileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    const videoUrl = URL.createObjectURL(file);
    loadVideoSource(videoUrl, btnSrcUpload);
  }
});

btnComp0.addEventListener('click', () => {
  btnComp0.classList.add('active');
  btnComp1.classList.remove('active');
  initPoseEngine(0);
});

btnComp1.addEventListener('click', () => {
  btnComp1.classList.add('active');
  btnComp0.classList.remove('active');
  initPoseEngine(1);
});

toggleConnections.addEventListener('change', (e) => {
  drawConnectionsOption = e.target.checked;
});

toggleDots.addEventListener('change', (e) => {
  drawDotsOption = e.target.checked;
});

toggleIndices.addEventListener('change', (e) => {
  drawIndicesOption = e.target.checked;
});

toggleMirror.addEventListener('change', (e) => {
  mirrorModeOption = e.target.checked;
  applyMirrorTransform();
});

btnPauseResume.addEventListener('click', () => {
  isPaused = !isPaused;
  if (isPaused) {
    btnPauseText.innerText = 'เริ่มต่อ';
    if (activeSource === 'video') videoElement.pause();
  } else {
    btnPauseText.innerText = 'หยุดชั่วคราว';
    if (activeSource === 'video') videoElement.play();
  }
});

// Launch on page load
window.addEventListener('DOMContentLoaded', () => {
  initPoseEngine(0);
});
