import * as THREE from "./libs/three.module.js";
import { GLTFLoader } from "./libs/GLTFLoader.js";
import { OrbitControls } from "./libs/OrbitControls.js";
import { EXRLoader } from "./libs/EXRLoader.js";


// ======================================================
// 基本設定
// ======================================================

const settings = {
    tiltAngle: 0,
    ambientIntensity: 1
};


// ======================================================
// 建立場景
// ======================================================

const scene = new THREE.Scene();


// ======================================================
// Renderer
// ======================================================

const renderer = new THREE.WebGLRenderer({
    antialias: true
});

renderer.setSize(
    window.innerWidth,
    window.innerHeight
);

renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, 2)
);

document.body.appendChild(
    renderer.domElement
);


// 曝光
renderer.toneMapping =
    THREE.ACESFilmicToneMapping;

renderer.toneMappingExposure = 0.1;


// ======================================================
// Camera
// ======================================================

const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    100
);

const isMobile =
    window.innerWidth <= 768;

const cameraZ =
    isMobile ? 3.0 : 0.9;

// 手機俯視高度；0.8 約為 15 度，可調大或調小
const cameraY =
    isMobile ? 0.8 : 0;

const mobileCameraTiltCompensation =
    isMobile
        ? -Math.atan2(cameraY, cameraZ)
        : 0;


// 保持正面
camera.position.set(
    0,
    cameraY,
    cameraZ
);

camera.lookAt(
    0,
    0,
    0
);


// ======================================================
// Resize
// ======================================================

window.addEventListener(
    "resize",
    () => {

        renderer.setSize(
            window.innerWidth,
            window.innerHeight
        );

        camera.aspect =
            window.innerWidth /
            window.innerHeight;

        camera.updateProjectionMatrix();

    }
);


// ======================================================
// OrbitControls
// ======================================================

const controls =
    new OrbitControls(
        camera,
        renderer.domElement
    );

controls.enableDamping = true;
controls.dampingFactor = 0.05;

const maxOrbitAngle =
    THREE.MathUtils.degToRad(5);

const initialPolarAngle =
    Math.atan2(cameraZ, cameraY);

controls.minAzimuthAngle =
    -maxOrbitAngle;

controls.maxAzimuthAngle =
    maxOrbitAngle;

controls.minPolarAngle =
    initialPolarAngle - maxOrbitAngle;

controls.maxPolarAngle =
    initialPolarAngle + maxOrbitAngle;

controls.minDistance = 1;
controls.maxDistance = 10;


// ======================================================
// Ambient Light
// ======================================================

const ambientLight =
    new THREE.AmbientLight(
        0xffffff,
        settings.ambientIntensity
    );

scene.add(
    ambientLight
);


// ======================================================
// UI：模型前後傾角
// ======================================================

const rotateSpeedUI =
    document.getElementById(
        "rotateSpeed"
    );

if (rotateSpeedUI) {

    rotateSpeedUI.addEventListener(
        "input",
        (e) => {

            settings.tiltAngle =
                -Number(
                    e.target.value
                );

            if (currentModel) {

                currentModel.rotation.x =
                    mobileCameraTiltCompensation +
                    THREE.MathUtils.degToRad(
                        settings.tiltAngle
                    );

            }

        }
    );

}


// ======================================================
// UI：環境光
// ======================================================

const ambientIntensityUI =
    document.getElementById(
        "ambientIntensity"
    );

if (ambientIntensityUI) {

    ambientIntensityUI.addEventListener(
        "input",
        (e) => {

            const val =
                parseFloat(
                    e.target.value
                );

            ambientLight.intensity =
                val;

            renderer.toneMappingExposure =
                val;

        }
    );

}


// ======================================================
// UI：Camera FOV
// ======================================================

const cameraFovUI =
    document.getElementById(
        "cameraFov"
    );

if (cameraFovUI) {

    cameraFovUI.addEventListener(
        "input",
        (e) => {

            camera.fov =
                parseFloat(
                    e.target.value
                );

            camera.updateProjectionMatrix();

        }
    );

}


// ======================================================
// EXR / HDRI
// ======================================================

const pmremGenerator =
    new THREE.PMREMGenerator(
        renderer
    );

pmremGenerator.compileEquirectangularShader();

new EXRLoader()
    .setPath("./hdr/")
    .load(
        "lebombo.exr",

        function (texture) {

            const envMap =
                pmremGenerator
                    .fromEquirectangular(
                        texture
                    )
                    .texture;

            scene.environment =
                envMap;

            scene.background =
                new THREE.Color(0x272727);

            texture.dispose();

            pmremGenerator.dispose();

        }
    );


// ======================================================
// 模型
// ======================================================

let currentModel = null;


// ======================================================
// 遙控器控制系統
// ======================================================

// 0 = 關閉
// 1 = 12.5%
// 2 = 25%
// 3 = 37.5%
// 4 = 50%
// 5 = 62.5%
// 6 = 75%
// 7 = 87.5%
// 8 = 100%

let brightnessLevel = 0;

let savedBrightnessLevel = 4;


// ======================================================
// LED 資料
// ======================================================

const ledData = [];


// ======================================================
// Group 按鈕 LED
// ======================================================

const groupButtonLEDs = [];


// ======================================================
// 額外模型燈具
// ======================================================

const additionalModelLights = [];

const selectedLightingGroups = new Set([1, 2, 3, 4]);

let lastSelectedLightingGroup = null;

const additionalGroupFixtureMaterials = new Map();

const groupLightMarkers = new Map();

const additionalGroupFadeOuts = new Map();

const GROUP_LIGHT_FADE_DURATION = 800;

const FIXTURE_EMISSIVE_FADE_DURATION = 600;


// LED_Button_Group
// Group 1 ~ 4 任一按下時短暫亮起

let groupButtonFlashLED = null;

let groupButtonFlashTimer = null;

let remoteSleepTimer = null;

let isRemoteSleeping = false;

const REMOTE_SLEEP_DELAY = 10000;


// ======================================================
// Button Hit Area
// ======================================================

const buttonHitAreas = [];

const buttonLabelSprites = [];

let areButtonLabelsVisible = true;

const memoryLabelToggle =
    document.getElementById(
        "memory-label-toggle"
    );

const utilityDrawerToggle =
    document.getElementById(
        "utility-drawer-toggle"
    );

const utilityPanel =
    document.getElementById(
        "utility-panel"
    );

if (utilityDrawerToggle && utilityPanel) {

    utilityDrawerToggle.addEventListener(
        "click",
        () => {

            const shouldOpen =
                utilityPanel.hidden;

            utilityPanel.hidden =
                !shouldOpen;

            utilityDrawerToggle.textContent =
                shouldOpen
                    ? ">"
                    : "<";

            utilityDrawerToggle.setAttribute(
                "aria-expanded",
                String(shouldOpen)
            );

            utilityDrawerToggle.setAttribute(
                "aria-label",
                shouldOpen
                    ? "隱藏其他控制"
                    : "顯示其他控制"
            );

        }
    );

}

if (memoryLabelToggle) {

    memoryLabelToggle.addEventListener(
        "click",
        () => {

            areButtonLabelsVisible =
                !areButtonLabelsVisible;

            buttonLabelSprites.forEach(
                (sprite) => {

                    sprite.visible =
                        areButtonLabelsVisible;

                }
            );

            memoryLabelToggle.setAttribute(
                "aria-pressed",
                String(areButtonLabelsVisible)
            );

            const stateLabel =
                memoryLabelToggle.querySelector(
                    ".memory-label-toggle-state"
                );

            if (stateLabel) {
                stateLabel.textContent =
                    areButtonLabelsVisible
                        ? "顯示中"
                        : "已隱藏";
            }

        }
    );

}


const adjustmentsToggle =
    document.getElementById(
        "adjustments-toggle"
    );

const adjustmentsPanel =
    document.getElementById(
        "icon-row"
    );

if (adjustmentsToggle && adjustmentsPanel) {

    adjustmentsToggle.addEventListener(
        "click",
        () => {

            const shouldShow =
                adjustmentsPanel.hidden;

            adjustmentsPanel.hidden =
                !shouldShow;

            adjustmentsToggle.setAttribute(
                "aria-expanded",
                String(shouldShow)
            );

            const stateLabel =
                adjustmentsToggle.querySelector(
                    ".adjustments-toggle-state"
                );

            if (stateLabel) {
                stateLabel.textContent =
                    shouldShow
                        ? "顯示中"
                        : "已隱藏";
            }

        }
    );

}


// ======================================================
// 尺寸參數
// ======================================================

let buttonHitRadius = 0.04;
let ledRadius = 0.012;


function attachAtWorldPosition(parent, object, worldPosition) {

    parent.updateWorldMatrix(
        true,
        true
    );

    object.position.copy(
        parent.worldToLocal(
            worldPosition.clone()
        )
    );

    parent.add(
        object
    );

}


function clearButtonLabels() {

    buttonLabelSprites.forEach(
        (sprite) => {

            sprite.removeFromParent();
            sprite.material.map.dispose();
            sprite.material.dispose();

        }
    );

    buttonLabelSprites.length = 0;

}


function createButtonCallout(
    model,
    button,
    labelText,
    textSide = "left",
    verticalOffset = 0,
    backgroundColor = "#ffffff",
    horizontalReferenceButton = null,
    verticalReferenceButton = null
) {

    const modelBox =
        new THREE.Box3()
            .setFromObject(model);

    const modelSize =
        new THREE.Vector3();

    modelBox.getSize(modelSize);

    const spriteWidth =
        Math.max(modelSize.y * 0.52, 0.28);

    let lineExtensionPixels = 0;
    let horizontalAlignmentOffset = 0;
    let verticalAlignmentPosition = null;

    if (
        horizontalReferenceButton ||
        verticalReferenceButton
    ) {

        model.updateWorldMatrix(true, true);

        const buttonLocalPosition =
            model.worldToLocal(
                button.getWorldPosition(
                    new THREE.Vector3()
                )
            );

        if (horizontalReferenceButton) {

            const referenceLocalPosition =
                model.worldToLocal(
                    horizontalReferenceButton.getWorldPosition(
                        new THREE.Vector3()
                    )
                );

            const horizontalDifference =
                buttonLocalPosition.x -
                referenceLocalPosition.x;

            const alignmentDirection =
                textSide === "left"
                    ? 1
                    : -1;

            lineExtensionPixels =
                Math.max(
                    0,
                    horizontalDifference *
                        alignmentDirection *
                        480 /
                        spriteWidth
                );

            horizontalAlignmentOffset =
                -horizontalDifference / 2;

        }

        if (verticalReferenceButton) {

            const referenceLocalPosition =
                model.worldToLocal(
                    verticalReferenceButton.getWorldPosition(
                        new THREE.Vector3()
                    )
                );

            verticalAlignmentPosition =
                referenceLocalPosition.y;

        }

    }

    const canvas =
        document.createElement("canvas");

    canvas.width =
        480 + lineExtensionPixels;
    canvas.height = 96;

    const context =
        canvas.getContext("2d");

    context.lineCap = "round";
    context.lineWidth = 3;
    context.strokeStyle = "rgba(218, 230, 232, 0.95)";
    context.fillStyle = "rgba(218, 230, 232, 0.95)";

    if (textSide === "left") {

        context.fillStyle = backgroundColor;
        context.beginPath();
        context.moveTo(12, 16);
        context.lineTo(255, 16);
        context.quadraticCurveTo(270, 16, 270, 31);
        context.lineTo(270, 65);
        context.quadraticCurveTo(270, 80, 255, 80);
        context.lineTo(12, 80);
        context.closePath();
        context.fill();

        context.font = "600 34px 'Microsoft JhengHei', sans-serif";
        context.textBaseline = "middle";
        context.fillStyle = "#263238";
        context.fillText(
            labelText,
            25,
            49,
            225
        );

        context.strokeStyle = "rgba(218, 230, 232, 0.95)";
        context.beginPath();
        context.moveTo(270, 48);
        context.lineTo(
            432 + lineExtensionPixels,
            48
        );
        context.stroke();

        context.beginPath();
        context.arc(
            444 + lineExtensionPixels,
            48,
            11,
            0,
            Math.PI * 2
        );
        context.stroke();

    } else {

        context.fillStyle = backgroundColor;
        context.beginPath();
        context.moveTo(225 + lineExtensionPixels, 16);
        context.lineTo(468 + lineExtensionPixels, 16);
        context.lineTo(468 + lineExtensionPixels, 80);
        context.lineTo(225 + lineExtensionPixels, 80);
        context.quadraticCurveTo(
            210 + lineExtensionPixels,
            80,
            210 + lineExtensionPixels,
            65
        );
        context.lineTo(
            210 + lineExtensionPixels,
            31
        );
        context.quadraticCurveTo(
            210 + lineExtensionPixels,
            16,
            225 + lineExtensionPixels,
            16
        );
        context.closePath();
        context.fill();

        context.font = "600 34px 'Microsoft JhengHei', sans-serif";
        context.textBaseline = "middle";
        context.fillStyle = "#263238";
        context.fillText(
            labelText,
            232 + lineExtensionPixels,
            49,
            225
        );

        context.strokeStyle = "rgba(218, 230, 232, 0.95)";
        context.beginPath();
        context.arc(36, 48, 11, 0, Math.PI * 2);
        context.stroke();

        context.beginPath();
        context.moveTo(48, 48);
        context.lineTo(
            210 + lineExtensionPixels,
            48
        );
        context.stroke();

    }

    const texture =
        new THREE.CanvasTexture(canvas);

    texture.colorSpace =
        THREE.SRGBColorSpace;

    const sprite =
        new THREE.Sprite(
            new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                depthTest: false,
                depthWrite: false,
                toneMapped: false
            })
        );

    sprite.visible =
        areButtonLabelsVisible;

    sprite.scale.set(
        spriteWidth * canvas.width / 480,
        spriteWidth * canvas.height / 480,
        1
    );

    const worldPosition =
        new THREE.Vector3();

    button.getWorldPosition(
        worldPosition
    );

    const horizontalOffset =
        textSide === "left"
            ? -spriteWidth * 0.42
            : spriteWidth * 0.42;

    worldPosition.add(
        new THREE.Vector3(
            horizontalOffset,
            verticalOffset,
            buttonHitRadius * 0.15
        )
    );

    model.updateWorldMatrix(true, true);

    sprite.position.copy(
        model.worldToLocal(worldPosition)
    );

    sprite.position.x +=
        horizontalAlignmentOffset;

    if (verticalAlignmentPosition !== null) {
        sprite.position.y =
            verticalAlignmentPosition;
    }

    sprite.userData.buttonName =
        button.name;

    model.add(sprite);

    sprite.renderOrder = 30;
    buttonLabelSprites.push(sprite);

}


function clearAdditionalModelLights() {

    additionalModelLights.forEach(
        (lightInfo) => {

            scene.remove(
                lightInfo.light
            );

        }
    );

    groupLightMarkers.forEach(
        (marker) => {

            marker.sprite.removeFromParent();
            marker.sprite.material.map.dispose();
            marker.sprite.material.dispose();

        }
    );

    additionalModelLights.length = 0;
    groupLightMarkers.clear();
    additionalGroupFadeOuts.clear();

}


function updateGroupLightMarker(groupNumber, isSelected) {

    const marker =
        groupLightMarkers.get(groupNumber);

    if (!marker) {
        return;
    }

    const context =
        marker.canvas.getContext("2d");

    context.clearRect(
        0,
        0,
        marker.canvas.width,
        marker.canvas.height
    );

    context.beginPath();
    context.arc(48, 48, 41, 0, Math.PI * 2);
    context.fillStyle =
        isSelected
            ? "#72c9f0"
            : "rgba(85, 101, 110, 0.72)";
    context.fill();

    context.lineWidth = 5;
    context.strokeStyle =
        isSelected
            ? "#e8f8ff"
            : "rgba(225, 235, 238, 0.75)";
    context.stroke();

    context.fillStyle = "#ffffff";
    context.font = isMobile
        ? "700 78px sans-serif"
        : "700 52px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(
        String(groupNumber),
        48,
        50
    );

    marker.texture.needsUpdate = true;
    marker.sprite.material.opacity =
        isSelected ? 1 : 0.62;

}


function createGroupLightMarker(model, lightNode, groupNumber) {

    const canvas =
        document.createElement("canvas");

    canvas.width = 96;
    canvas.height = 96;

    const texture =
        new THREE.CanvasTexture(canvas);

    texture.colorSpace =
        THREE.SRGBColorSpace;

    const sprite =
        new THREE.Sprite(
            new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                depthTest: false,
                depthWrite: false,
                toneMapped: false
            })
        );

    const markerSize =
        new THREE.Box3()
            .setFromObject(model)
            .getSize(new THREE.Vector3())
            .y * 0.055;

    sprite.scale.set(
        markerSize,
        markerSize,
        1
    );

    const worldPosition =
        new THREE.Vector3();

    lightNode.getWorldPosition(
        worldPosition
    );

    const markerOffsetX =
        groupNumber === 4
            ? markerSize * 1.4
            : markerSize * 0.8;

    const markerOffsetY =
        groupNumber === 2
            ? markerSize * 1.05
            : groupNumber === 4
                ? -markerSize * 0.2
                : markerSize * 0.8;

    worldPosition.add(
        new THREE.Vector3(
            markerOffsetX,
            markerOffsetY,
            0
        )
    );

    attachAtWorldPosition(
        model,
        sprite,
        worldPosition
    );

    sprite.renderOrder = 40;

    groupLightMarkers.set(
        groupNumber,
        {
            canvas,
            texture,
            sprite
        }
    );

    updateGroupLightMarker(
        groupNumber,
        selectedLightingGroups.has(groupNumber)
    );

}


function setupAdditionalModelLights(model) {

    clearAdditionalModelLights();

    additionalGroupFixtureMaterials.clear();

    model.traverse(
        (fixtureNode) => {

            const fixtureMatch =
                fixtureNode.name.match(
                    /^Fixture_Group_(\d+)(?:_|$)/
                );

            if (!fixtureMatch) {
                return;
            }

            const groupNumber =
                Number(fixtureMatch[1]);

            const materials =
                additionalGroupFixtureMaterials.get(
                    groupNumber
                ) || [];

            fixtureNode.traverse(
                (object) => {

                    if (!object.isMesh || !object.material) {
                        return;
                    }

                    const originalMaterials =
                        Array.isArray(object.material)
                            ? object.material
                            : [object.material];

                    const clonedMaterials =
                        originalMaterials.map(
                            (material) => {

                                const clonedMaterial =
                                    material.clone();

                                if (clonedMaterial.emissive) {

                                    materials.push({
                                        material: clonedMaterial,
                                        baseIntensity:
                                            clonedMaterial.emissiveIntensity
                                    });

                                    clonedMaterial.emissiveIntensity = 0;

                                }

                                return clonedMaterial;

                            }
                        );

                    object.material =
                        Array.isArray(object.material)
                            ? clonedMaterials
                            : clonedMaterials[0];

                }
            );

            additionalGroupFixtureMaterials.set(
                groupNumber,
                materials
            );

        }
    );

    const lightNodes = [];

    model.traverse(
        (object) => {

            if (
                /^Light_Group_\d+_\d+$/.test(
                    object.name
                )
            ) {

                lightNodes.push(
                    object
                );

            }

        }
    );

    lightNodes.forEach(
        (lightNode) => {

            const targetName =
                lightNode.name.replace(
                    "Light_Group_",
                    "Target_Group_"
                );

            const targetNode =
                model.getObjectByName(
                    targetName
                );

            if (!targetNode) {

                console.warn(
                    `找不到對應照射面：${targetName}`
                );

                return;

            }

            const groupNumber =
                Number(
                    lightNode.name.match(
                        /^Light_Group_(\d+)_/
                    )[1]
                );

            const markerGroupNumber = {
                Light_Group_1_01: 1,
                Light_Group_2_02: 2,
                Light_Group_3_01: 3,
                Light_Group_4_03: 4
            }[lightNode.name];

            if (markerGroupNumber !== undefined) {

                createGroupLightMarker(
                    model,
                    lightNode,
                    markerGroupNumber
                );

            }

            const lightColor =
                [1, 3, 4].includes(groupNumber)
                    ? 0xffb16e
                    : 0xffffff;

            const light =
                groupNumber === 2 ||
                groupNumber === 4
                    ? new THREE.RectAreaLight(
                        lightColor,
                        groupNumber === 2
                            ? 150
                            : 100,
                        groupNumber === 2
                            ? 0.6
                            : 1.3,
                        groupNumber === 2
                            ? 0.6
                            : 0.08
                    )
                    : new THREE.SpotLight(
                        lightColor,
                        40,
                        4,
                        Math.PI / 3,
                        0.75,
                        2
                    );

            const worldPosition =
                new THREE.Vector3();

            lightNode.getWorldPosition(
                worldPosition
            );

            light.position.copy(
                worldPosition
            );

            if (light.isRectAreaLight) {

                const targetPosition =
                    new THREE.Vector3();

                targetNode.getWorldPosition(
                    targetPosition
                );

                light.lookAt(
                    targetPosition
                );

            } else {

                light.target =
                    targetNode;

            }

            light.castShadow = false;
            light.visible = false;

            const baseIntensity =
                light.intensity;

            light.intensity = 0;

            scene.add(
                light
            );

            additionalModelLights.push(
                {
                    name: lightNode.name,
                    groupNumber,
                    light,
                    baseIntensity,
                    brightnessLevel: 4,
                    isOn: true
                }
            );

            console.log(
                `建立燈具：${lightNode.name} -> ${targetName}`
            );

        }
    );

    console.log(
        `總共建立 ${additionalModelLights.length} 盞額外燈具`
    );

    updateAdditionalModelLighting();
    syncBrightnessFeedback();

}


function applyMemoryOneScene() {

    selectedLightingGroups.clear();

    [1, 2, 3, 4].forEach(
        (groupNumber) => {

            selectedLightingGroups.add(
                groupNumber
            );

        }
    );

    lastSelectedLightingGroup = 4;

    additionalGroupFadeOuts.clear();

    additionalModelLights.forEach(
        (lightInfo) => {

            lightInfo.isOn = true;
            lightInfo.brightnessLevel = 8;

        }
    );

    updateAdditionalModelLighting();
    syncBrightnessFeedback();
    updateGroupButtonIndicators();

    console.log(
        "已套用 Button_Memory_1 情境：Group 1~4 全亮"
    );

}


function applyMemoryTwoScene() {

    selectedLightingGroups.clear();
    selectedLightingGroups.add(2);
    selectedLightingGroups.add(4);

    lastSelectedLightingGroup = 4;

    additionalGroupFadeOuts.clear();

    additionalModelLights.forEach(
        (lightInfo) => {

            const shouldBeOn =
                lightInfo.groupNumber === 2 ||
                lightInfo.groupNumber === 4;

            lightInfo.isOn =
                shouldBeOn;

            if (shouldBeOn) {
                lightInfo.brightnessLevel = 8;
            }

        }
    );

    updateAdditionalModelLighting();
    syncBrightnessFeedback();
    updateGroupButtonIndicators();

    console.log(
        "已套用 Button_Memory_2 情境：Group 2、4 全亮；Group 1、3 關閉"
    );

}


function applyMemoryThreeScene() {

    selectedLightingGroups.clear();
    selectedLightingGroups.add(1);
    selectedLightingGroups.add(3);
    selectedLightingGroups.add(4);

    lastSelectedLightingGroup = 4;

    additionalGroupFadeOuts.clear();

    additionalModelLights.forEach(
        (lightInfo) => {

            const shouldBeOn =
                lightInfo.groupNumber === 1 ||
                lightInfo.groupNumber === 3 ||
                lightInfo.groupNumber === 4;

            lightInfo.isOn =
                shouldBeOn;

            if (shouldBeOn) {
                lightInfo.brightnessLevel = 3;
            }

        }
    );

    updateAdditionalModelLighting();
    syncBrightnessFeedback();
    updateGroupButtonIndicators();

    console.log(
        "已套用 Button_Memory_3 情境：Group 1、3、4 第 3 級；Group 2 關閉"
    );

}


function getSelectedLightingGroup() {

    return additionalModelLights.filter(
        (lightInfo) =>
            selectedLightingGroups.has(
                lightInfo.groupNumber
            )
    );

}


function syncBrightnessFeedback() {

    if (selectedLightingGroups.size === 0) {

        brightnessLevel = 0;
        updateLEDs();
        return;

    }

    const selectedLights =
        getSelectedLightingGroup();

    const activeSelectedLights =
        selectedLights.filter(
            (lightInfo) =>
                lightInfo.isOn
        );

    if (activeSelectedLights.length > 0) {

        brightnessLevel =
            Math.max(
                ...activeSelectedLights.map(
                    (lightInfo) =>
                        lightInfo.brightnessLevel
                )
            );

    } else {

        brightnessLevel = 0;

    }

    updateLEDs();

}


function updateSelectedLightingGroup() {

    updateAdditionalModelLighting();

}


function updateAdditionalModelLighting() {

    const now =
        performance.now();

    const groupLightFadeFactors =
        new Map();

    const groupEmissiveFadeFactors =
        new Map();

    const groupNumbers =
        new Set(
            additionalModelLights.map(
                (lightInfo) =>
                    lightInfo.groupNumber
            )
        );

    groupNumbers.forEach(
        (groupNumber) => {

            const groupLights =
                additionalModelLights.filter(
                    (lightInfo) =>
                        lightInfo.groupNumber ===
                        groupNumber
                );

            const isOn =
                groupLights.some(
                    (lightInfo) =>
                        lightInfo.isOn
                );

            const fadeStart =
                additionalGroupFadeOuts.get(
                    groupNumber
                );

            const elapsed =
                fadeStart === undefined
                    ? 0
                    : now - fadeStart;

            const lightFadeFactor =
                isOn
                    ? 1
                    : fadeStart === undefined
                        ? 0
                        : Math.max(
                            0,
                            1 -
                                elapsed /
                                GROUP_LIGHT_FADE_DURATION
                        );

            const emissiveFadeFactor =
                isOn
                    ? 1
                    : fadeStart === undefined
                        ? 0
                        : Math.max(
                            0,
                            1 -
                                elapsed /
                                FIXTURE_EMISSIVE_FADE_DURATION
                        );

            groupLightFadeFactors.set(
                groupNumber,
                lightFadeFactor
            );

            groupEmissiveFadeFactors.set(
                groupNumber,
                emissiveFadeFactor
            );

            if (
                !isOn &&
                fadeStart !== undefined &&
                lightFadeFactor === 0
            ) {

                additionalGroupFadeOuts.delete(
                    groupNumber
                );

            }

        }
    );

    additionalModelLights.forEach(
        (lightInfo) => {

            const groupNumber =
                lightInfo.groupNumber;

            const fadeFactor =
                groupLightFadeFactors.get(
                    groupNumber
                ) || 0;

            lightInfo.light.visible =
                fadeFactor > 0;

            lightInfo.light.intensity =
                lightInfo.baseIntensity *
                (lightInfo.brightnessLevel / 8) *
                fadeFactor;

        }
    );

    additionalGroupFixtureMaterials.forEach(
        (materials, groupNumber) => {

            const groupLights =
                additionalModelLights.filter(
                    (lightInfo) =>
                        lightInfo.groupNumber ===
                        groupNumber
                );

            const isOn =
                groupLights.some(
                    (lightInfo) =>
                        lightInfo.isOn
                );

            const fadeFactor =
                isOn
                    ? 1
                    : groupEmissiveFadeFactors.get(
                        groupNumber
                    ) || 0;

            const brightnessLevel =
                groupLights.length > 0
                    ? Math.max(
                        ...groupLights.map(
                            (lightInfo) =>
                                lightInfo.brightnessLevel
                        )
                    )
                    : 0;

            materials.forEach(
                (materialInfo) => {

                    materialInfo.material.emissiveIntensity =
                        materialInfo.baseIntensity *
                        (brightnessLevel / 8) *
                        fadeFactor;

                }
            );

        }
    );

}


function selectLightingGroup(groupNumber) {

    if (
        selectedLightingGroups.has(
            groupNumber
        )
    ) {

        selectedLightingGroups.delete(
            groupNumber
        );

    } else {

        selectedLightingGroups.add(
            groupNumber
        );

        lastSelectedLightingGroup =
            groupNumber;

    }

    if (
        selectedLightingGroups.size > 0 &&
        !selectedLightingGroups.has(
            lastSelectedLightingGroup
        )
    ) {

        lastSelectedLightingGroup =
            Array.from(
                selectedLightingGroups
            ).pop();

    }

    syncBrightnessFeedback();

    updateGroupButtonIndicators();

}


function updateGroupButtonIndicators() {

    groupButtonLEDs.forEach(
        (ledInfo) => {

            const isSelected =
                selectedLightingGroups.has(
                    ledInfo.index
                );

            updateGroupLightMarker(
                ledInfo.index,
                isSelected
            );

            const intensity =
                isSelected
                    ? 20
                    : 0;

            const lightIntensity =
                isSelected
                    ? 0.45
                    : 0;

            ledInfo.currentIntensity =
                intensity;

            ledInfo.targetIntensity =
                intensity;

            ledInfo.currentLightIntensity =
                lightIntensity;

            ledInfo.targetLightIntensity =
                lightIntensity;

            ledInfo.ledMesh.visible =
                isSelected;

            ledInfo.ledMesh
                .material
                .emissiveIntensity =
                    intensity;

            ledInfo.pointLight.intensity =
                lightIntensity;

        }
    );

}


function createGlowSprite(color, size) {

    const canvas =
        document.createElement("canvas");

    canvas.width = 64;
    canvas.height = 64;

    const context =
        canvas.getContext("2d");

    const gradient =
        context.createRadialGradient(
            32,
            32,
            0,
            32,
            32,
            32
        );

    const colorObject =
        new THREE.Color(color);

    const colorStyle =
        `rgb(${Math.round(colorObject.r * 255)}, ${Math.round(colorObject.g * 255)}, ${Math.round(colorObject.b * 255)})`;

    gradient.addColorStop(0, "rgba(255, 255, 255, 0.9)");
    gradient.addColorStop(0.2, `${colorStyle.replace("rgb", "rgba").replace(")", ", 0.75)")}`);
    gradient.addColorStop(1, `${colorStyle.replace("rgb", "rgba").replace(")", ", 0)")}`);

    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);

    const texture =
        new THREE.CanvasTexture(canvas);

    const material =
        new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            depthTest: true,
            blending: THREE.AdditiveBlending
        });

    const sprite =
        new THREE.Sprite(material);

    sprite.scale.set(
        size,
        size,
        1
    );

    sprite.visible = false;
    sprite.renderOrder = 1;

    return sprite;

}


// ======================================================
// 建立 Button 點擊區域
// ======================================================

function setupRemoteButtons(model) {

    // 清除舊 Hit Area
    clearButtonLabels();

    buttonHitAreas.forEach(
        (hitArea) => {

            hitArea.removeFromParent();

            if (hitArea.geometry) {
                hitArea.geometry.dispose();
            }

            if (hitArea.material) {
                hitArea.material.dispose();
            }

        }
    );

    buttonHitAreas.length = 0;


    const buttonNames = [

        "Button_Power",

        "Button_Brighten",

        "Button_Dim",

        "Button_Group_1",
        "Button_Group_2",
        "Button_Group_3",
        "Button_Group_4",

        "Button_Memory_1",
        "Button_Memory_2",
        "Button_Memory_3"

    ];

    const buttonLabels = {
        Button_Brighten: {
            text: "調亮",
            color: "#fff0b3"
        },
        Button_Dim: {
            text: "調暗",
            color: "#fff0b3"
        },
        Button_Power: {
            text: "燈具電源",
            color: "#ffb6b6"
        }
    };


    // --------------------------------------------------
    // 根據模型尺寸自動估算按鈕大小
    // --------------------------------------------------

    const box =
        new THREE.Box3()
            .setFromObject(model);

    const size =
        new THREE.Vector3();

    box.getSize(size);


    const estimatedRadius =
        size.y * 0.035;


    buttonHitRadius =
        THREE.MathUtils.clamp(
            estimatedRadius,
            0.02,
            0.07
        );


    console.log(
        "Button Hit Radius：",
        buttonHitRadius
    );


    // --------------------------------------------------
    // 建立透明碰撞區
    // --------------------------------------------------

    buttonNames.forEach(
        (name) => {

            const button =
                model.getObjectByName(
                    name
                );


            if (!button) {

                console.warn(
                    `找不到按鈕座標：${name}`
                );

                return;

            }

            const memoryMatch =
                name.match(
                    /^Button_Memory_(\d+)$/
                );

            if (memoryMatch) {

                const pairedControlButton = [
                    "Button_Brighten",
                    "Button_Dim",
                    "Button_Power"
                ][Number(memoryMatch[1]) - 1];

                createButtonCallout(
                    model,
                    button,
                    `情境切換 ${memoryMatch[1]}`,
                    "left",
                    -buttonHitRadius * 0.35,
                    "#b7e4c7",
                    null,
                    model.getObjectByName(
                        pairedControlButton
                    )
                );

            }

            if (buttonLabels[name]) {

                createButtonCallout(
                    model,
                    button,
                    buttonLabels[name].text,
                    "right",
                    0,
                    buttonLabels[name].color
                );

            }


            const worldPosition =
                new THREE.Vector3();

            button.getWorldPosition(
                worldPosition
            );


            const geometry =
                new THREE.SphereGeometry(
                    buttonHitRadius,
                    16,
                    16
                );


            const material =
                new THREE.MeshBasicMaterial({

                    transparent: true,

                    opacity: 0,

                    depthWrite: false,

                    depthTest: false

                });


            const hitArea =
                new THREE.Mesh(
                    geometry,
                    material
                );


            attachAtWorldPosition(
                model,
                hitArea,
                worldPosition
            );


            hitArea.userData.buttonName =
                name;

            hitArea.userData.originalButton =
                button;


            buttonHitAreas.push(
                hitArea
            );


            console.log(
                `建立按鈕點擊區：${name}`
            );

        }
    );


    console.log(
        `總共建立 ${buttonHitAreas.length} 個按鈕點擊區`
    );

}


// ======================================================
// Button 點擊視覺效果
// ======================================================

function buttonFlash(buttonName) {

    if (!currentModel) {
        return;
    }


    const button =
        currentModel.getObjectByName(
            buttonName
        );


    if (!button) {
        return;
    }


    const worldPosition =
        new THREE.Vector3();

    button.getWorldPosition(
        worldPosition
    );


    const geometry =
        new THREE.SphereGeometry(
            buttonHitRadius * 0.7,
            16,
            16
        );


    const material =
        new THREE.MeshBasicMaterial({

            color: 0xffffff,

            transparent: true,

            opacity: 1,

            depthWrite: false,

            depthTest: false

        });


    const flash =
        new THREE.Mesh(
            geometry,
            material
        );


    attachAtWorldPosition(
        currentModel,
        flash,
        worldPosition
    );

    flash.renderOrder = 20;


    const startTime =
        performance.now();

    const duration = 250;


    function animateFlash(now) {

        const elapsed =
            now - startTime;

        const progress =
            elapsed / duration;


        if (progress >= 1) {

            flash.removeFromParent();

            geometry.dispose();

            material.dispose();

            return;

        }


        flash.scale.setScalar(
            1 + progress * 0.9
        );


        material.opacity =
            1 *
            (1 - progress);


        requestAnimationFrame(
            animateFlash
        );

    }


    requestAnimationFrame(
        animateFlash
    );

}


// ======================================================
// 清除一般 LED
// ======================================================

function clearRemoteLEDs() {

    ledData.forEach(
        (ledInfo) => {

            if (ledInfo.ledMesh) {

                ledInfo.ledMesh.removeFromParent();

                if (ledInfo.ledMesh.geometry) {
                    ledInfo.ledMesh.geometry.dispose();
                }

                if (ledInfo.ledMesh.material) {
                    ledInfo.ledMesh.material.dispose();
                }

            }


            if (ledInfo.pointLight) {

                ledInfo.pointLight.removeFromParent();

            }

            if (ledInfo.glowSprite) {

                ledInfo.glowSprite.removeFromParent();

                ledInfo.glowSprite.material.map.dispose();
                ledInfo.glowSprite.material.dispose();

            }

        }
    );

    ledData.length = 0;

}


// ======================================================
// 清除 Group LED
// ======================================================

function clearGroupLEDs() {

    groupButtonLEDs.forEach(
        (ledInfo) => {

            if (ledInfo.ledMesh) {

                ledInfo.ledMesh.removeFromParent();

                if (ledInfo.ledMesh.geometry) {
                    ledInfo.ledMesh.geometry.dispose();
                }

                if (ledInfo.ledMesh.material) {
                    ledInfo.ledMesh.material.dispose();
                }

            }


            if (ledInfo.pointLight) {

                ledInfo.pointLight.removeFromParent();

            }

            if (ledInfo.glowSprite) {

                ledInfo.glowSprite.removeFromParent();

                ledInfo.glowSprite.material.map.dispose();
                ledInfo.glowSprite.material.dispose();

            }

        }
    );

    groupButtonLEDs.length = 0;


    // 清除 LED_Button_Group

    if (groupButtonFlashLED) {

        if (
            groupButtonFlashLED.ledMesh
        ) {

            groupButtonFlashLED.ledMesh.removeFromParent();

            groupButtonFlashLED
                .ledMesh
                .geometry
                .dispose();

            groupButtonFlashLED
                .ledMesh
                .material
                .dispose();

        }


        if (
            groupButtonFlashLED.pointLight
        ) {

            groupButtonFlashLED.pointLight.removeFromParent();

        }

        if (groupButtonFlashLED.glowSprite) {

            groupButtonFlashLED.glowSprite.removeFromParent();

            groupButtonFlashLED.glowSprite.material.map.dispose();
            groupButtonFlashLED.glowSprite.material.dispose();

        }

    }


    groupButtonFlashLED = null;


    if (groupButtonFlashTimer) {

        clearTimeout(
            groupButtonFlashTimer
        );

        groupButtonFlashTimer = null;

    }

}


// ======================================================
// 建立 LED PointLight
// ======================================================

function setupRemoteLEDs(model) {

    // --------------------------------------------------
    // 清除舊 LED
    // --------------------------------------------------

    clearRemoteLEDs();


    // --------------------------------------------------
    // 根據模型尺寸估算 LED 大小
    // --------------------------------------------------

    const box =
        new THREE.Box3()
            .setFromObject(model);

    const size =
        new THREE.Vector3();

    box.getSize(size);


    ledRadius =
        THREE.MathUtils.clamp(
            size.y * 0.012,
            0.005,
            0.025
        );


    console.log(
        "LED Radius：",
        ledRadius
    );


    // --------------------------------------------------
    // LED 顏色
    // --------------------------------------------------

    const ledColor =
        0x737373;

    const lightColor =
        0xffffff;

    // --------------------------------------------------
    // 建立 8 顆 LED
    // --------------------------------------------------

    for (
        let i = 1;
        i <= 8;
        i++
    ) {

        const led =
            model.getObjectByName(
                `LED_Level_${i}`
            );


        if (!led) {

            console.warn(
                `找不到 LED_Level_${i}`
            );

            continue;

        }


        const worldPosition =
            new THREE.Vector3();

        led.getWorldPosition(
            worldPosition
        );


        // --------------------------------------------------
        // LED 位置微調
        // --------------------------------------------------

        const offsetX = 0.00;
        const offsetY = 0.00;
        const offsetZ = -0.02;


        worldPosition.add(
            new THREE.Vector3(
                offsetX,
                offsetY,
                offsetZ
            )
        );


        // --------------------------------------------------
        // LED 小球
        // --------------------------------------------------

        const ledSize =
            0.02;


        const ledGeometry =
            new THREE.SphereGeometry(
                ledSize,
                16,
                16
            );


        const ledMaterial =
            new THREE.MeshStandardMaterial({

                color:
                    ledColor,

                emissive:
                    lightColor,

                emissiveIntensity:
                    0,

                roughness:
                    1,

                    metalness:
                        0,

                    depthWrite:
                        true,

                    depthTest:
                        true

            });


        const ledMesh =
            new THREE.Mesh(
                ledGeometry,
                ledMaterial
            );


        attachAtWorldPosition(
            model,
            ledMesh,
            worldPosition
        );

        ledMesh.visible = false;

        ledMesh.renderOrder = 0;

        const glowSprite =
            createGlowSprite(
                lightColor,
                ledSize * 4
            );

        attachAtWorldPosition(
            model,
            glowSprite,
            worldPosition
        );


        // --------------------------------------------------
        // PointLight
        // --------------------------------------------------

        const pointLight =
            new THREE.PointLight(
                lightColor,
                0,
                0.02,
                2
            );


        attachAtWorldPosition(
            model,
            pointLight,
            worldPosition
        );


        // --------------------------------------------------
        // 儲存 LED 資料
        // --------------------------------------------------

        ledData.push({

            index:
                i,

            object:
                led,

            ledMesh:
                ledMesh,

            glowSprite:
                glowSprite,

            pointLight:
                pointLight,

            currentIntensity:
                0,

            targetIntensity:
                0,

            currentLightIntensity:
                0,

            targetLightIntensity:
                0,

            isOn:
                false

        });


        console.log(
            `建立 LED：LED_Level_${i}`
        );

    }


    console.log(
        `總共建立 ${ledData.length} 顆 LED`
    );

}


// ======================================================
// 建立 Button_Group_1 ~ 4 底部 LED
// ======================================================

function setupGroupButtonLEDs(model) {

    groupButtonLEDs.length = 0;


    const lightColor =
        0x394fe7;

    const pointLightColor =
        0x394fe7;


    const ledColor =
        0x737373;


    for (
        let i = 1;
        i <= 4;
        i++
    ) {

        const button =
            model.getObjectByName(
                `Button_Group_${i}`
            );


        if (!button) {

            console.warn(
                `找不到 Button_Group_${i}`
            );

            continue;

        }

        createButtonCallout(
            model,
            button,
            `燈具群組 ${i}`,
            i <= 2
                ? "left"
                : "right",
            0,
            "#add8e6",
            i === 2
                ? model.getObjectByName(
                    "Button_Group_1"
                )
                : i === 4
                    ? model.getObjectByName(
                        "Button_Group_3"
                    )
                : null
        );


        const worldPosition =
            new THREE.Vector3();

        button.getWorldPosition(
            worldPosition
        );


        // --------------------------------------------------
        // LED 位置微調
        // --------------------------------------------------

        const offsetX = 0.00;
        const offsetY = 0.00;
        const offsetZ = -0.015;


        worldPosition.add(
            new THREE.Vector3(
                offsetX,
                offsetY,
                offsetZ
            )
        );


        // --------------------------------------------------
        // LED
        // --------------------------------------------------

        const ledSize =
            0.02;


        const ledGeometry =
            new THREE.SphereGeometry(
                ledSize,
                16,
                16
            );


        const ledMaterial =
            new THREE.MeshStandardMaterial({

                color:
                    ledColor,

                emissive:
                    lightColor,

                emissiveIntensity:
                    0,

                roughness:
                    1,

                metalness:
                    0

            });


        const ledMesh =
            new THREE.Mesh(
                ledGeometry,
                ledMaterial
            );


        attachAtWorldPosition(
            model,
            ledMesh,
            worldPosition
        );

        ledMesh.visible = false;

        const glowSprite =
            createGlowSprite(
                lightColor,
                ledSize * 4
            );

        attachAtWorldPosition(
            model,
            glowSprite,
            worldPosition
        );


        // --------------------------------------------------
        // PointLight
        // --------------------------------------------------

        const pointLight =
            new THREE.PointLight(
                pointLightColor,
                0,
                0.02,
                2
            );


        attachAtWorldPosition(
            model,
            pointLight,
            worldPosition
        );


        // --------------------------------------------------
        // 儲存
        // --------------------------------------------------

        groupButtonLEDs.push({

            index:
                i,

            button:
                button,

            ledMesh:
                ledMesh,

            glowSprite:
                glowSprite,

            pointLight:
                pointLight,

            currentIntensity:
                0,

            targetIntensity:
                0,

            currentLightIntensity:
                0,

            targetLightIntensity:
                0

        });


        console.log(
            `建立 Button_Group_${i} LED`
        );

    }


    console.log(
        `總共建立 ${groupButtonLEDs.length} 個 Group LED`
    );

}


// ======================================================
// 建立 LED_Button_Group
// ======================================================

function setupGroupFlashLED(model) {

    const led =
        model.getObjectByName(
            "LED_Button_Group"
        );


    if (!led) {

        console.warn(
            "找不到 LED_Button_Group"
        );

        groupButtonFlashLED =
            null;

        return;

    }


    const worldPosition =
        new THREE.Vector3();

    led.getWorldPosition(
        worldPosition
    );


    // --------------------------------------------------
    // 位置微調
    // --------------------------------------------------

    const offsetX = 0.00;
    const offsetY = 0.00;
    const offsetZ = -0.02;


    worldPosition.add(
        new THREE.Vector3(
            offsetX,
            offsetY,
            offsetZ
        )
    );


    const lightColor =
        0xffffff;

    const ledColor =
        0x737373;

    const ledSize =
        0.02;


    // --------------------------------------------------
    // LED 小球
    // --------------------------------------------------

    const ledGeometry =
        new THREE.SphereGeometry(
            ledSize,
            16,
            16
        );


    const ledMaterial =
        new THREE.MeshStandardMaterial({

            color:
                ledColor,

            emissive:
                lightColor,

            emissiveIntensity:
                0,

            roughness:
                1,

            metalness:
                0

        });


    const ledMesh =
        new THREE.Mesh(
            ledGeometry,
            ledMaterial
        );


    attachAtWorldPosition(
        model,
        ledMesh,
        worldPosition
    );

    ledMesh.visible = false;

    const glowSprite =
        createGlowSprite(
            lightColor,
            ledSize * 4
        );

    attachAtWorldPosition(
        model,
        glowSprite,
        worldPosition
    );


    // --------------------------------------------------
    // PointLight
    // --------------------------------------------------

    const pointLight =
        new THREE.PointLight(
            lightColor,
            0,
            0.02,
            2
        );


    attachAtWorldPosition(
        model,
        pointLight,
        worldPosition
    );


    groupButtonFlashLED = {

        ledMesh:
            ledMesh,

        glowSprite:
            glowSprite,

        pointLight:
            pointLight

    };


    console.log(
        "建立 LED_Button_Group"
    );

}


// ======================================================
// Group LED 閃爍
// ======================================================

function flashGroupLED() {

    if (!groupButtonFlashLED) {
        return;
    }


    groupButtonFlashLED
        .ledMesh
        .visible = true;

    groupButtonFlashLED
        .glowSprite
        .visible = true;

    groupButtonFlashLED
        .glowSprite
        .material
        .opacity = 0.7;

    groupButtonFlashLED
        .ledMesh
        .material
        .emissiveIntensity = 20.0;


    groupButtonFlashLED
        .pointLight
        .intensity = 0.45;


    if (groupButtonFlashTimer) {

        clearTimeout(
            groupButtonFlashTimer
        );

    }


    groupButtonFlashTimer =
        setTimeout(
            () => {

                if (!groupButtonFlashLED) {
                    return;
                }


                groupButtonFlashLED
                    .ledMesh
                    .visible = false;

                groupButtonFlashLED
                    .glowSprite
                    .visible = false;

                groupButtonFlashLED
                    .glowSprite
                    .material
                    .opacity = 0;

                groupButtonFlashLED
                    .ledMesh
                    .material
                    .emissiveIntensity = 0;


                groupButtonFlashLED
                    .pointLight
                    .intensity = 0;


                groupButtonFlashTimer =
                    null;

            },
            200
        );

}


function setRemoteSleeping(sleeping) {

    isRemoteSleeping =
        sleeping;

    ledData.forEach(
        (ledInfo) => {

            if (ledInfo.ledMesh) {
                ledInfo.ledMesh.visible =
                    !sleeping &&
                    ledInfo.currentIntensity > 0.01;
            }

            if (ledInfo.glowSprite) {
                ledInfo.glowSprite.visible =
                    !sleeping &&
                    ledInfo.currentIntensity > 0.01;
            }

            if (ledInfo.pointLight) {
                ledInfo.pointLight.intensity =
                    sleeping
                        ? 0
                        : ledInfo.currentLightIntensity;
            }

        }
    );

    groupButtonLEDs.forEach(
        (ledInfo) => {

            const isSelected =
                selectedLightingGroups.has(
                    ledInfo.index
                );

            if (ledInfo.ledMesh) {
                ledInfo.ledMesh.visible =
                    !sleeping && isSelected;
            }

            if (ledInfo.glowSprite) {
                ledInfo.glowSprite.visible =
                    !sleeping && isSelected;
            }

            if (ledInfo.pointLight) {
                ledInfo.pointLight.intensity =
                    sleeping
                        ? 0
                        : ledInfo.currentLightIntensity;
            }

        }
    );

    if (groupButtonFlashLED) {

        groupButtonFlashLED.ledMesh.visible =
            false;

        groupButtonFlashLED.glowSprite.visible =
            false;

        groupButtonFlashLED.glowSprite.material.opacity =
            0;

        groupButtonFlashLED.ledMesh
            .material
            .emissiveIntensity = 0;

        groupButtonFlashLED.pointLight.intensity =
            0;

    }

}


function resetRemoteSleepTimer() {

    if (remoteSleepTimer) {
        clearTimeout(remoteSleepTimer);
    }

    remoteSleepTimer =
        setTimeout(
            () => {

                setRemoteSleeping(true);
                remoteSleepTimer = null;

            },
            REMOTE_SLEEP_DELAY
        );

}


// ======================================================
// LED 亮度
// ======================================================

function updateLEDs() {

    ledData.forEach(
        (ledInfo) => {

            const shouldBeOn =
                ledInfo.index <=
                brightnessLevel;


            ledInfo.targetIntensity =
                shouldBeOn
                    ? 20.0
                    : 0;


            ledInfo.targetLightIntensity =
                shouldBeOn
                    ? 0.45
                    : 0;

            if (!shouldBeOn) {

                ledInfo.currentIntensity =
                    0;

                ledInfo.currentLightIntensity =
                    0;

                if (ledInfo.ledMesh) {

                    ledInfo.ledMesh.visible =
                        false;

                    ledInfo.ledMesh
                        .material
                        .emissiveIntensity =
                            0;

                }

                if (ledInfo.glowSprite) {
                    ledInfo.glowSprite.visible = false;
                    ledInfo.glowSprite.material.opacity = 0;
                }

                if (ledInfo.pointLight) {

                    ledInfo.pointLight.intensity =
                        0;

                }

            }

        }
    );

}


// ======================================================
// LED 動畫
// ======================================================

function animateLEDs() {

    ledData.forEach(
        (ledInfo) => {

            // LED 發光漸變

            ledInfo.currentIntensity =
                THREE.MathUtils.lerp(
                    ledInfo.currentIntensity,
                    ledInfo.targetIntensity,
                    0.15
                );


            // PointLight 漸變

            ledInfo.currentLightIntensity =
                THREE.MathUtils.lerp(
                    ledInfo.currentLightIntensity,
                    ledInfo.targetLightIntensity,
                    0.15
                );


            // 套用 LED

            if (ledInfo.ledMesh) {

                ledInfo.ledMesh.visible =
                    !isRemoteSleeping &&
                    ledInfo.currentIntensity > 0.01;

                ledInfo.ledMesh
                    .material
                    .emissiveIntensity =
                        ledInfo.currentIntensity;

            }

            if (ledInfo.glowSprite) {

                ledInfo.glowSprite.visible =
                    !isRemoteSleeping &&
                    ledInfo.currentIntensity > 0.01;

                ledInfo.glowSprite.material.opacity =
                    Math.min(
                        ledInfo.currentIntensity / 20,
                        1
                    ) * 0.7;

            }


            // 套用 PointLight

            if (ledInfo.pointLight) {

                ledInfo.pointLight
                    .intensity =
                        isRemoteSleeping
                            ? 0
                            : ledInfo.currentLightIntensity;

            }

        }
    );


    // --------------------------------------------------
    // Group LED
    // --------------------------------------------------

    groupButtonLEDs.forEach(
        (ledInfo) => {

            ledInfo.currentIntensity =
                THREE.MathUtils.lerp(
                    ledInfo.currentIntensity,
                    ledInfo.targetIntensity,
                    0.15
                );


            ledInfo.currentLightIntensity =
                THREE.MathUtils.lerp(
                    ledInfo.currentLightIntensity,
                    ledInfo.targetLightIntensity,
                    0.15
                );


            if (ledInfo.ledMesh) {

                ledInfo.ledMesh.visible =
                    !isRemoteSleeping &&
                    ledInfo.currentIntensity > 0.01;

                ledInfo.ledMesh
                    .material
                    .emissiveIntensity =
                        ledInfo.currentIntensity;

            }

            if (ledInfo.glowSprite) {

                ledInfo.glowSprite.visible =
                    !isRemoteSleeping &&
                    ledInfo.currentIntensity > 0.01;

                ledInfo.glowSprite.material.opacity =
                    Math.min(
                        ledInfo.currentIntensity / 20,
                        1
                    ) * 0.7;

            }


            if (ledInfo.pointLight) {

                ledInfo.pointLight
                    .intensity =
                        isRemoteSleeping
                            ? 0
                            : ledInfo.currentLightIntensity;

            }

        }
    );

}


// ======================================================
// Raycaster
// ======================================================

const raycaster =
    new THREE.Raycaster();

const pointer =
    new THREE.Vector2();


// ======================================================
// Pointer 位置
// ======================================================

function updatePointer(event) {

    const rect =
        renderer.domElement
            .getBoundingClientRect();


    pointer.x =
        (
            (event.clientX - rect.left)
            / rect.width
        ) * 2 - 1;


    pointer.y =
        -(
            (event.clientY - rect.top)
            / rect.height
        ) * 2 + 1;

}


// ======================================================
// 點擊遙控器
// ======================================================

function handleRemotePointer(event) {

    if (!currentModel) {
        return;
    }


    updatePointer(event);


    raycaster.setFromCamera(
        pointer,
        camera
    );


    const intersections =
        raycaster.intersectObjects(
            [
                ...buttonHitAreas,
                ...buttonLabelSprites
            ],
            false
        );


    if (
        intersections.length === 0
    ) {

        return;

    }


    const hit =
        intersections[0].object;


    const buttonName =
        hit.userData.buttonName;


    if (!buttonName) {
        return;
    }

    if (isRemoteSleeping) {

        setRemoteSleeping(false);
        resetRemoteSleepTimer();
        return;

    }

    resetRemoteSleepTimer();


    console.log(
        "按下：",
        buttonName
    );


    buttonFlash(
        buttonName
    );


    handleButton(
        buttonName
    );

}


// ======================================================
// 按鈕功能
// ======================================================

function handleButton(
    buttonName
) {

    if (
        selectedLightingGroups.size === 0 &&
        [
            "Button_Power",
            "Button_Brighten",
            "Button_Dim"
        ].includes(buttonName)
    ) {

        flashGroupLED();

        return;

    }


    // ==================================================
    // Power
    // ==================================================

    if (
        buttonName ===
        "Button_Power"
    ) {

        const selectedLights =
            getSelectedLightingGroup();

        if (selectedLights.length > 0) {

            const turnOn =
                selectedLights.some(
                    (lightInfo) =>
                        !lightInfo.isOn
                );

            const transitionTime =
                performance.now();

            selectedLights.forEach(
                (lightInfo) => {

                    lightInfo.isOn =
                        turnOn;

                    if (turnOn) {

                        additionalGroupFadeOuts.delete(
                            lightInfo.groupNumber
                        );

                    } else {

                        additionalGroupFadeOuts.set(
                            lightInfo.groupNumber,
                            transitionTime
                        );

                    }

                }
            );

            updateSelectedLightingGroup();

        }


        syncBrightnessFeedback();

        flashGroupLED();


        console.log(
            "Power，亮度：",
            brightnessLevel
        );


        return;

    }


    // ==================================================
    // Brighten
    // ==================================================

    if (
        buttonName ===
        "Button_Brighten"
    ) {

        getSelectedLightingGroup().forEach(
            (lightInfo) => {

                lightInfo.brightnessLevel =
                    lightInfo.isOn
                        ? Math.min(
                            lightInfo.brightnessLevel + 1,
                            8
                        )
                        : 1;

                lightInfo.isOn = true;

                additionalGroupFadeOuts.delete(
                    lightInfo.groupNumber
                );

            }
        );

        updateSelectedLightingGroup();


        syncBrightnessFeedback();

        flashGroupLED();


        console.log(
            "增加亮度：",
            brightnessLevel
        );


        return;

    }


    // ==================================================
    // Dim
    // ==================================================

    if (
        buttonName ===
        "Button_Dim"
    ) {

        getSelectedLightingGroup().forEach(
            (lightInfo) => {

                lightInfo.brightnessLevel =
                    lightInfo.isOn
                        ? Math.max(
                            lightInfo.brightnessLevel - 1,
                            1
                        )
                        : 1;

                lightInfo.isOn = true;

                additionalGroupFadeOuts.delete(
                    lightInfo.groupNumber
                );

            }
        );

        updateSelectedLightingGroup();


        syncBrightnessFeedback();

        flashGroupLED();


        console.log(
            "降低亮度：",
            brightnessLevel
        );


        return;

    }


    // ==================================================
    // Group
    // ==================================================

    if (
        buttonName.startsWith(
            "Button_Group_"
        )
    ) {

        console.log(
            "群組按鈕：",
            buttonName
        );


        const groupNumber =
            parseInt(
                buttonName.replace(
                    "Button_Group_",
                    ""
                )
            );


        selectLightingGroup(
            groupNumber
        );


        // LED_Button_Group

        flashGroupLED();


        return;

    }


    // ==================================================
    // Memory
    // ==================================================

    if (
        buttonName.startsWith(
            "Button_Memory_"
        )
    ) {

        if (buttonName === "Button_Memory_1") {

            applyMemoryOneScene();

        } else if (buttonName === "Button_Memory_2") {

            applyMemoryTwoScene();

        } else if (buttonName === "Button_Memory_3") {

            applyMemoryThreeScene();

        } else {

            console.log(
                `${buttonName} 尚未設定情境`
            );

        }

        flashGroupLED();

        return;

    }

}


// ======================================================
// 滑鼠 / 手機觸控
// ======================================================

renderer.domElement.addEventListener(
    "pointerup",
    handleRemotePointer
);


// ======================================================
// 載入模型
// ======================================================

const initialModelPositions = {
    desktop: {
        original: {
            x: -1.75,
            y: -0.2,
            z: -3.5
        },
        additional: {
            x: 1.55,
            y: 0,
            z: -7
        }
    },
    mobile: {
        original: {
            x: -0,
            y: -0.9,
            z: -1.1
        },
        additional: {
            x: 0,
            y: -0.2,
            z: -10
        }
    }
};


let pendingModelLoads = 0;

let shaderPrewarmQueue =
    Promise.resolve();

function updateLoadingOverlay(isLoading) {

    const loadingOverlay =
        document.getElementById(
            "loading-overlay"
        );

    if (loadingOverlay) {
        loadingOverlay.hidden =
            !isLoading;
    }

}


function prewarmSceneShaders() {

    if (typeof renderer.compileAsync !== "function") {
        return Promise.resolve();
    }

    shaderPrewarmQueue =
        shaderPrewarmQueue
            .catch(() => {})
            .then(
                () => renderer.compileAsync(
                    scene,
                    camera
                )
            );

    return shaderPrewarmQueue.catch(
        (error) => {

            console.warn(
                "場景預熱未完成，將於首次顯示時編譯：",
                error
            );

        }
    );

}


function prewarmLightingScenarios() {

    if (
        typeof renderer.compileAsync !== "function" ||
        additionalModelLights.length === 0
    ) {

        return Promise.resolve();

    }

    const originalLightStates =
        additionalModelLights.map(
            (lightInfo) => ({
                isOn: lightInfo.isOn,
                brightnessLevel:
                    lightInfo.brightnessLevel
            })
        );

    const scenarios = [
        {
            groups: [1, 2, 3, 4],
            brightnessLevel: 8
        },
        {
            groups: [2, 4],
            brightnessLevel: 8
        },
        {
            groups: [1, 3, 4],
            brightnessLevel: 3
        }
    ];

    const warmScenarios =
        async () => {

            try {

                for (const scenario of scenarios) {

                    additionalModelLights.forEach(
                        (lightInfo) => {

                            lightInfo.isOn =
                                scenario.groups.includes(
                                    lightInfo.groupNumber
                                );

                            if (lightInfo.isOn) {

                                lightInfo.brightnessLevel =
                                    scenario.brightnessLevel;

                            }

                        }
                    );

                    updateAdditionalModelLighting();

                    await renderer.compileAsync(
                        scene,
                        camera
                    );

                }

            } finally {

                additionalModelLights.forEach(
                    (lightInfo, index) => {

                        lightInfo.isOn =
                            originalLightStates[index].isOn;

                        lightInfo.brightnessLevel =
                            originalLightStates[index]
                                .brightnessLevel;

                    }
                );

                updateAdditionalModelLighting();

            }

        };

    shaderPrewarmQueue =
        shaderPrewarmQueue
            .catch(() => {})
            .then(warmScenarios);

    return shaderPrewarmQueue.catch(
        (error) => {

            console.warn(
                "情境燈光預熱未完成，首次切換時可能需要編譯：",
                error
            );

        }
    );

}


function loadModel(
    modelPath,
    addToScene = false,
    position = {
        x: 0,
        y: 0,
        z: 0
    },
    rotationY = -20
) {

    pendingModelLoads++;
    updateLoadingOverlay(true);

    const loader =
        new GLTFLoader();


    loader.load(

        modelPath,


        (gltf) => {

            const newModel =
                gltf.scene;


            // --------------------------------------------------
            // 模型位置
            // --------------------------------------------------

            newModel.position.set(
                position.x,
                position.y,
                position.z
            );


            // --------------------------------------------------
            // 保持 GLB 本身原始角度
            // --------------------------------------------------

            newModel.rotation.set(
                addToScene
                    ? 0
                    : mobileCameraTiltCompensation +
                        THREE.MathUtils.degToRad(
                            settings.tiltAngle
                        ),
                addToScene
                    ? THREE.MathUtils.degToRad(rotationY)
                    : 0,
                0
            );


            if (!addToScene) {

                if (currentModel) {

                    scene.remove(
                        currentModel
                    );

                }

                clearRemoteLEDs();
                clearGroupLEDs();

                currentModel =
                    newModel;

            }


            scene.add(
                newModel
            );

            if (addToScene) {

                setupAdditionalModelLights(newModel);

                prewarmLightingScenarios()
                    .then(prewarmSceneShaders)
                    .finally(finishModelLoad);

                return;
            }


            // --------------------------------------------------
            // 建立 Button Hit Area
            // --------------------------------------------------

            setupRemoteButtons(
                currentModel
            );


            // --------------------------------------------------
            // 建立 8 顆亮度 LED
            // --------------------------------------------------

            setupRemoteLEDs(
                currentModel
            );


            // --------------------------------------------------
            // 建立 Group LED
            // --------------------------------------------------

            setupGroupButtonLEDs(
                currentModel
            );

            updateGroupButtonIndicators();


            // --------------------------------------------------
            // 建立 LED_Button_Group
            // --------------------------------------------------

            setupGroupFlashLED(
                currentModel
            );


            // --------------------------------------------------
            // 初始亮度
            // --------------------------------------------------

            syncBrightnessFeedback();

            setRemoteSleeping(false);
            resetRemoteSleepTimer();


            // --------------------------------------------------
            // Debug：列出 GLB 節點
            // --------------------------------------------------

            console.log(
                "========== GLB Nodes =========="
            );


            currentModel.traverse(
                (object) => {

                    if (object.name) {

                        console.log(
                            object.name,
                            object.type
                        );

                    }

                }
            );


            console.log(
                "==============================="
            );


            console.log(
                "遙控器 GLB 載入完成"
            );

            prewarmSceneShaders().finally(
                finishModelLoad
            );

        },


        undefined,


        (error) => {

            console.error(
                "GLB 載入失敗：",
                error
            );

            finishModelLoad();

        }

    );

    function finishModelLoad() {

        pendingModelLoads =
            Math.max(
                0,
                pendingModelLoads - 1
            );

        updateLoadingOverlay(
            pendingModelLoads > 0
        );

    }

}


// ======================================================
// 預設載入
// ======================================================

const activeModelPositions =
    isMobile
        ? initialModelPositions.mobile
        : initialModelPositions.desktop;

loadModel(
    "https://dl.dropboxusercontent.com/scl/fi/ni1wbk8s6u21i6vhhvnzh/.glb?rlkey=d704a60hxrx9e47ulvuehkw8z&dl=1",
    false,
    activeModelPositions.original
);

loadModel(
    "https://dl.dropboxusercontent.com/scl/fi/va4lgm3kaetcm4gjxhgz6/.glb?rlkey=wny1jiqvk1bo76xpt5xwtfg0i&dl=1",
    true,
    activeModelPositions.additional,
    isMobile ? -5 : -20
);


// ======================================================
// 模型切換按鈕
// ======================================================

const modelButtons =
    document.querySelectorAll(
        ".model-btn"
    );


modelButtons.forEach(
    (btn) => {

        btn.addEventListener(
            "click",
            () => {

                modelButtons.forEach(
                    (b) =>
                        b.classList.remove(
                            "active"
                        )
                );


                btn.classList.add(
                    "active"
                );


                const modelPath =
                    btn.getAttribute(
                        "data-model"
                    );


                if (modelPath) {

                    loadModel(
                        modelPath
                    );

                }

            }
        );

    }
);


// ======================================================
// 動畫迴圈
// ======================================================

function animate() {

    requestAnimationFrame(
        animate
    );


    // --------------------------------------------------
    // LED 漸變
    // --------------------------------------------------

    animateLEDs();

    updateAdditionalModelLighting();


    // --------------------------------------------------
    // OrbitControls
    // --------------------------------------------------

    controls.update();


    // --------------------------------------------------
    // Render
    // --------------------------------------------------

    renderer.render(
        scene,
        camera
    );

}


animate();
