import * as THREE from "./libs/three.module.js";
import { GLTFLoader } from "./libs/GLTFLoader.js";
import { OrbitControls } from "./libs/OrbitControls.js";
import { EXRLoader } from "./libs/EXRLoader.js";
import * as fflate from "./libs/fflate.module.js";

// ======================================================
// ✅ 基本設定
// ======================================================
const settings = {
  rotateSpeed: 0,
  ambientIntensity: 1
};

// ======================================================
// ✅ 建立場景
// ======================================================
const scene = new THREE.Scene();

// ======================================================
// ✅ Renderer
// ======================================================
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// ✅ 曝光調整（背景不會過亮）
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.85;

// ✅ 視窗縮放
window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// ======================================================
// ✅ 相機設定（手機與桌機）
// ======================================================
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);

const isMobile = window.innerWidth <= 768;

const cameraZ = isMobile ? 3.0 : 0.9;
const cameraY = -0.15;
const cameraX = -0.3;

camera.position.set(cameraX, cameraY, cameraZ);
camera.lookAt(0, 0, 0);

// ======================================================
// ✅ OrbitControls
// ======================================================
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 1;
controls.maxDistance = 10;

// ======================================================
// ✅ 環境光
// ======================================================
const ambientLight = new THREE.AmbientLight(0xffffff, settings.ambientIntensity);
scene.add(ambientLight);

// ======================================================
// ✅ UI 滑桿事件
// ======================================================
document.getElementById("rotateSpeed").addEventListener("input", e => {
  settings.rotateSpeed = parseFloat(e.target.value);
});

document.getElementById("ambientIntensity").addEventListener("input", e => {
  const val = parseFloat(e.target.value);

  ambientLight.intensity = val;

  // ✅ 同步背景 EXR 亮度
  renderer.toneMappingExposure = val;
});

document.getElementById("cameraFov").addEventListener("input", e => {
  camera.fov = parseFloat(e.target.value);
  camera.updateProjectionMatrix();
});

// ======================================================
// ✅ 載入 HDRI（EXR）
// ======================================================
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

let envMesh;

new EXRLoader()
  .setPath("./hdr/")
  .load("lebombo.exr", function (texture) {
    const envMap = pmremGenerator.fromEquirectangular(texture).texture;

    scene.environment = envMap;
    scene.background = envMap;



    texture.dispose();
    pmremGenerator.dispose();
  });

// ======================================================
// ✅ 模型切換系統（保持當下視角與背景）
// ======================================================
let currentModel = null;
let isFirstLoad = true;

// ✅ 舊模型旋轉離場
function rotateOut(model, onComplete) {
  let progress = 0;

  function animate() {
    progress += 0.05;

    model.rotation.y += 0.08;
    model.position.y -= 0.01;

    if (progress >= 1) {
      scene.remove(model);
      onComplete();
      return;
    }

    requestAnimationFrame(animate);
  }

  animate();
}

// ✅ 新模型旋轉進場
function rotateIn(model) {
  model.rotation.y = Math.PI;
  model.position.y = -0.2;

  let progress = 0;

  function animate() {
    progress += 0.05;

    model.rotation.y -= 0.08;
    model.position.y += 0.01;

    if (progress >= 1) return;

    requestAnimationFrame(animate);
  }

  animate();
}

// ✅ 載入模型（不再重置視角）
function loadModel(modelPath) {
  const loader = new GLTFLoader();

  loader.load(modelPath, (gltf) => {
    const newModel = gltf.scene;

    // ✅ 統一模型中心點
    newModel.position.set(0, 0, 0);
    newModel.rotation.set(0, 0, 0);

    if (currentModel && !isFirstLoad) {
      rotateOut(currentModel, () => {
        currentModel = newModel;
        scene.add(currentModel);

        // ✅ 不重置視角、不改背景
        rotateIn(currentModel);
      });

    } else {
      // ✅ 第一次載入
      currentModel = newModel;
      scene.add(currentModel);

      isFirstLoad = false;
    }
  });
}


// ======================================================
// ✅ 左下角按鈕事件
// ======================================================
const modelButtons = document.querySelectorAll(".model-btn");

modelButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    modelButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    const modelPath = btn.getAttribute("data-model");
    loadModel(modelPath);
  });
});

// ✅ 預設載入
loadModel("./model/BL-360.glb");

// ======================================================
// ✅ 動畫迴圈
// ======================================================
function animate() {
  requestAnimationFrame(animate);

  if (currentModel) {
    currentModel.rotation.y += settings.rotateSpeed;
  }

  controls.update();
  renderer.render(scene, camera);
}
animate();
