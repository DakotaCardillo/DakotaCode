import * as THREE from './three.js';
import WebGL from './three/addons/capabilities/WebGL.js';
//import './style.css'

import Stats from './stats.js'

import { GUI } from './three/addons/libs/lil-gui.module.min.js'
import { OrbitControls } from './three/addons/controls/OrbitControls.js'
import { Sky } from './three/addons/objects/Sky.js'
import { GLTFLoader } from './three/addons/loaders/GLTFLoader.js';
import { degToRad } from './three/src/math/MathUtils.js';

let camera, scene, renderer;

let sky, sun, player;

let velocity = new THREE.Vector3(0, 0, 0);
let acceleration = new THREE.Vector3(0, 0, 0);

const maxSpeed = 0.1;
const damping = 0.9;

const keyState = {};

const stats = new Stats();

const loader = new GLTFLoader();

const clock = new THREE.Clock();

init();
render();

function init()
{
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 10, 35);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x002222);

    const helper = new THREE.GridHelper(100, 10, 0xffffff, 0xffffff);
    //scene.add(helper);

    renderer = new THREE.WebGLRenderer({
        canvas: document.querySelector("#bg"),
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.5;
    document.body.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.addEventListener('change', render);

    controls.enableZoom = true;
    controls.enablePan = true;

    //initSky();
    initPlayer();
    initLights();
    initWorld();

    window.addEventListener( 'resize', onWindowResize );
    document.addEventListener('keydown', onDocumentKeyDown);
    document.addEventListener('keyup', onDocumentKeyUp);

    

    // Performance Stats
    //stats.showPanel(0);
    //document.body.appendChild(stats.dom);
}

function initSky()
{
    sky = new Sky();
    sky.scale.setScalar (450000);
    scene.add(sky);

    sun = new THREE.Vector3();

    const effectController = {
        turbidity: 10,
        rayleigh: 3,
        mieCoefficient: 0.005,
        mieDirectionalG: 0.7,
        elevation: 2,
        azimuth: 180,
        exposure: renderer.toneMappingExposure
    };

    function guiChanged()
    {
        const uniforms = sky.material.uniforms;
        uniforms['turbidity'].value = effectController.turbidity;
        uniforms['rayleigh'].value = effectController.rayleigh;
        uniforms['mieCoefficient'].value = effectController.mieCoefficient;
        uniforms['mieDirectionalG'].value = effectController.mieDirectionalG;

        const phi = THREE.MathUtils.degToRad(90 - effectController.elevation);
        const theta = THREE.MathUtils.degToRad(effectController.azimuth);

        sun.setFromSphericalCoords(1, phi, theta);

        uniforms['sunPosition'].value.copy(sun);

        renderer.toneMappingExposure = effectController.exposure;
        renderer.render(scene, camera);
    }
    
    const gui = new GUI();

    gui.add( effectController, 'turbidity', 0.0, 20.0, 0.1 ).onChange( guiChanged );
    gui.add( effectController, 'rayleigh', 0.0, 4, 0.001 ).onChange( guiChanged );
    gui.add( effectController, 'mieCoefficient', 0.0, 0.1, 0.001 ).onChange( guiChanged );
    gui.add( effectController, 'mieDirectionalG', 0.0, 1, 0.001 ).onChange( guiChanged );
    gui.add( effectController, 'elevation', 0, 90, 0.1 ).onChange( guiChanged );
    gui.add( effectController, 'azimuth', - 180, 180, 0.1 ).onChange( guiChanged );
    gui.add( effectController, 'exposure', 0, 1, 0.0001 ).onChange( guiChanged );

    guiChanged();
}

function initPlayer()
{
    // Load mesh
    loader.load('/assets/fox_dragon.glb', function(gltf) {
        player = gltf.scene;
        player.material = new THREE.MeshStandardMaterial({ color: 0x888200 });
        player.position.set(0, 0, 0);
        player.rotation.y= degToRad(180);
        player.scale.set(1,1,1);
        scene.add(player);
    }, undefined, function(error) {
        console.error(error);
    });


    //create a blue LineBasicMaterial
    const material = new THREE.LineBasicMaterial( { color: 0x0000ff } );
    const points = [];
    points.push( new THREE.Vector3( 0, 0, 0 ) );
    points.push( new THREE.Vector3( 0, 1, 0 ) );
    points.push( new THREE.Vector3( 0, 0, 0 ) );
    const geometry  = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line( geometry, material );

    scene.add( line );
}

function initLights()
{
    // Fog for depth
    //scene.fog = new THREE.FogExp2(0x000000, 0.02); // Adjust color and density

    const ambientLight = new THREE.AmbientLight(0xffffff); // Soft white light
    ambientLight.intensity = 1.0;
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0xffffff, 100, 1000, 1);
    pointLight.position.set(0, 9, 0);
    scene.add(pointLight);

    const lightHelper = new THREE.PointLightHelper(pointLight);
    scene.add(lightHelper);
}

function initWorld()
{
    const boxGeometry = new THREE.BoxGeometry(50, 1, 50, 1, 1, 1);
    const boxMaterial = new THREE.MeshStandardMaterial({ color: 0x008800 });
    const floor = new THREE.Mesh(boxGeometry, boxMaterial);
    floor.position.set(0, -0.5, 0);
    scene.add(floor);
}

function updatePlayer(delta)
{
    const deltaAcceleration = 0.75;

    acceleration.set(0, 0, 0);

    if (keyState['w']) acceleration.z -= deltaAcceleration * delta;
    if (keyState['s']) acceleration.z += deltaAcceleration * delta;
    if (keyState['a']) acceleration.x -= deltaAcceleration * delta;
    if (keyState['d']) acceleration.x += deltaAcceleration * delta;

    velocity.add(acceleration);
    velocity.clampScalar(-maxSpeed, maxSpeed);
    velocity.multiplyScalar(damping);

    if (player)
    {
        player.position.add(velocity);
        camera.position.add(velocity);
        
        if (velocity.lengthSq() > 0.0000001) { // Avoid rotation when movement is very small
            player.lookAt(player.position.clone().add(velocity));
        }
    }
    // if (dx !== 0 || dz !== 0)
    // {
    //     const dir = new THREE.Vector3(dx, 0, dz).normalize();

    //     sphere.position.x += dir.x * speed;
    //     sphere.position.z += dir.z * speed;
    // }
}

function update(delta)
{
    updatePlayer(delta);
}

function render()
{
    requestAnimationFrame(render);

    const delta = clock.getDelta();

    update(delta);
    renderer.render( scene, camera );
}

function onWindowResize()
{
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );

    render();
}

function onDocumentKeyDown()
{
    keyState[event.key.toLowerCase()] = true;
}

function onDocumentKeyUp()
{
    keyState[event.key.toLowerCase()] = false;
}

// // const geometry = new THREE.BoxGeometry(1, 1, 1);
// // const material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
// // const cube = new THREE.Mesh(geometry, material);

// // scene.add(cube);e



// camera.position.z = 30;

// //document.body.style.background = "linear-gradient(to bottom, #1e5799 0%,#2989d8 50%,#207cca 51%,#7db9e8 100%)";

// // Fog for depth
// //scene.fog = new THREE.FogExp2(0x000000, 0.3); // Adjust color and density

// const ambientLight = new THREE.AmbientLight(0xffffff); // Soft white light
// scene.add(ambientLight);
// const pointLight = new THREE.PointLight(0xffffff);
// pointLight.position.set(5, 5, 5);
// scene.add(pointLight);

// const lightHelper = new THREE.PointLightHelper(pointLight);
// scene.add(lightHelper);

// // Add a glowing sphere
// const geometry = new THREE.TorusGeometry(10, 3, 16, 100);
// const material = new THREE.MeshStandardMaterial({ color: 0xff6347 });
// const sphere = new THREE.Mesh(geometry, material);
// scene.add(sphere);

// function animate()
// {
//     sphere.rotation.x += 0.01;
//     sphere.rotation.y += 0.005;
//     sphere.rotation.z += 0.01;

//     requestAnimationFrame(animate);
//     renderer.render(scene, camera);
// }

// if ( WebGL.isWebGLAvailable() ) {

// 	// Initiate function or other initializations here
// 	animate();

// } else {

// 	const warning = WebGL.getWebGLErrorMessage();
// 	document.getElementById( 'container' ).appendChild( warning );

// }