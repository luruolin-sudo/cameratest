import * as THREE from "./libs/three.module.js";
import { GLTFLoader } from "./libs/GLTFLoader.js";
import { OrbitControls } from "./libs/OrbitControls.js";
import { EXRLoader } from "./libs/EXRLoader.js";


// ======================================================
// 基本設定
// ======================================================

const settings = {
    rotateSpeed: 0,
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


// 保持正面
camera.position.set(
    0,
    0,
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
// UI：旋轉速度
// ======================================================

const rotateSpeedUI =
    document.getElementById(
        "rotateSpeed"
    );

if (rotateSpeedUI) {

    rotateSpeedUI.addEventListener(
        "input",
        (e) => {

            settings.rotateSpeed =
                parseFloat(
                    e.target.value
                );

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
                envMap;

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


// ======================================================
// LED 資料
// ======================================================

const ledData = [];


// ======================================================
// Group 按鈕 LED
// ======================================================

const groupButtonLEDs = [];


// LED_Button_Group
// Group 1 ~ 4 任一按下時短暫亮起

let groupButtonFlashLED = null;

let groupButtonFlashTimer = null;


// ======================================================
// Button Hit Area
// ======================================================

const buttonHitAreas = [];


// ======================================================
// 尺寸參數
// ======================================================

let buttonHitRadius = 0.04;
let ledRadius = 0.012;


// ======================================================
// 建立 Button 點擊區域
// ======================================================

function setupRemoteButtons(model) {

    // 清除舊 Hit Area
    buttonHitAreas.forEach(
        (hitArea) => {

            scene.remove(
                hitArea
            );

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


            hitArea.position.copy(
                worldPosition
            );


            hitArea.userData.buttonName =
                name;

            hitArea.userData.originalButton =
                button;


            scene.add(
                hitArea
            );


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
            buttonHitRadius * 0.55,
            16,
            16
        );


    const material =
        new THREE.MeshBasicMaterial({

            color: 0xffffff,

            transparent: true,

            opacity: 0.75,

            depthWrite: false

        });


    const flash =
        new THREE.Mesh(
            geometry,
            material
        );


    flash.position.copy(
        worldPosition
    );


    scene.add(
        flash
    );


    const startTime =
        performance.now();

    const duration = 250;


    function animateFlash(now) {

        const elapsed =
            now - startTime;

        const progress =
            elapsed / duration;


        if (progress >= 1) {

            scene.remove(
                flash
            );

            geometry.dispose();

            material.dispose();

            return;

        }


        flash.scale.setScalar(
            1 + progress * 0.6
        );


        material.opacity =
            0.75 *
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

                scene.remove(
                    ledInfo.ledMesh
                );

                if (ledInfo.ledMesh.geometry) {
                    ledInfo.ledMesh.geometry.dispose();
                }

                if (ledInfo.ledMesh.material) {
                    ledInfo.ledMesh.material.dispose();
                }

            }


            if (ledInfo.pointLight) {

                scene.remove(
                    ledInfo.pointLight
                );

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

                scene.remove(
                    ledInfo.ledMesh
                );

                if (ledInfo.ledMesh.geometry) {
                    ledInfo.ledMesh.geometry.dispose();
                }

                if (ledInfo.ledMesh.material) {
                    ledInfo.ledMesh.material.dispose();
                }

            }


            if (ledInfo.pointLight) {

                scene.remove(
                    ledInfo.pointLight
                );

            }

        }
    );

    groupButtonLEDs.length = 0;


    // 清除 LED_Button_Group

    if (groupButtonFlashLED) {

        if (
            groupButtonFlashLED.ledMesh
        ) {

            scene.remove(
                groupButtonFlashLED.ledMesh
            );

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

            scene.remove(
                groupButtonFlashLED.pointLight
            );

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
                        false,

                    depthTest:
                        false

            });


        const ledMesh =
            new THREE.Mesh(
                ledGeometry,
                ledMaterial
            );


        ledMesh.position.copy(
            worldPosition
        );

        ledMesh.renderOrder = 10;


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


        pointLight.position.copy(
            worldPosition
        );


        scene.add(
            ledMesh
        );

        scene.add(
            pointLight
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
        const offsetZ = -0.02;


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


        ledMesh.position.copy(
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


        pointLight.position.copy(
            worldPosition
        );


        scene.add(
            ledMesh
        );

        scene.add(
            pointLight
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


    ledMesh.position.copy(
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


    pointLight.position.copy(
        worldPosition
    );


    scene.add(
        ledMesh
    );

    scene.add(
        pointLight
    );


    groupButtonFlashLED = {

        ledMesh:
            ledMesh,

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

                ledInfo.ledMesh
                    .material
                    .emissiveIntensity =
                        ledInfo.currentIntensity;

            }


            // 套用 PointLight

            if (ledInfo.pointLight) {

                ledInfo.pointLight
                    .intensity =
                        ledInfo.currentLightIntensity;

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

                ledInfo.ledMesh
                    .material
                    .emissiveIntensity =
                        ledInfo.currentIntensity;

            }


            if (ledInfo.pointLight) {

                ledInfo.pointLight
                    .intensity =
                        ledInfo.currentLightIntensity;

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
            buttonHitAreas,
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


    // ==================================================
    // Power
    // ==================================================

    if (
        buttonName ===
        "Button_Power"
    ) {

        if (
            brightnessLevel > 0
        ) {

            brightnessLevel = 0;

        } else {

            brightnessLevel = 4;

        }


        updateLEDs();


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

        brightnessLevel =
            Math.min(
                brightnessLevel + 1,
                8
            );


        updateLEDs();


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

        brightnessLevel =
            Math.max(
                brightnessLevel - 1,
                0
            );


        updateLEDs();


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


        const ledInfo =
            groupButtonLEDs.find(
                (led) =>
                    led.index ===
                    groupNumber
            );


        if (ledInfo) {

            ledInfo.isOn =
                !ledInfo.isOn;

            const intensity =
                ledInfo.isOn
                    ? 20.0
                    : 0;

            const lightIntensity =
                ledInfo.isOn
                    ? 0.45
                    : 0;

            ledInfo.targetIntensity =
                intensity;

            ledInfo.targetLightIntensity =
                lightIntensity;

            ledInfo.currentIntensity =
                intensity;

            ledInfo.currentLightIntensity =
                lightIntensity;


            ledInfo.ledMesh
                .material
                .emissiveIntensity =
                    intensity;


            ledInfo.pointLight
                .intensity =
                    lightIntensity;


        }


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

        console.log(
            "記憶按鈕：",
            buttonName
        );


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

function loadModel(modelPath) {

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
                0,
                0,
                0
            );


            // --------------------------------------------------
            // 保持 GLB 本身原始角度
            // --------------------------------------------------

            newModel.rotation.set(
                0,
                0,
                0
            );


            // --------------------------------------------------
            // 清除舊模型
            // --------------------------------------------------

            if (currentModel) {

                scene.remove(
                    currentModel
                );

            }


            // --------------------------------------------------
            // 清除舊的控制元件
            // --------------------------------------------------

            clearRemoteLEDs();

            clearGroupLEDs();


            // --------------------------------------------------
            // 設定新模型
            // --------------------------------------------------

            currentModel =
                newModel;


            scene.add(
                currentModel
            );


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


            // --------------------------------------------------
            // 建立 LED_Button_Group
            // --------------------------------------------------

            setupGroupFlashLED(
                currentModel
            );


            // --------------------------------------------------
            // 初始亮度
            // --------------------------------------------------

            brightnessLevel = 0;

            updateLEDs();


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

        },


        undefined,


        (error) => {

            console.error(
                "GLB 載入失敗：",
                error
            );

        }

    );

}


// ======================================================
// 預設載入
// ======================================================

loadModel(
    "https://dl.dropboxusercontent.com/scl/fi/ni1wbk8s6u21i6vhhvnzh/.glb?rlkey=d704a60hxrx9e47ulvuehkw8z&dl=1"
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
    // 模型自動旋轉
    // --------------------------------------------------

    if (
        currentModel &&
        settings.rotateSpeed !== 0
    ) {

        currentModel.rotation.y +=
            settings.rotateSpeed;

    }


    // --------------------------------------------------
    // LED 漸變
    // --------------------------------------------------

    animateLEDs();


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
