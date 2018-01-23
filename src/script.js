if (!Detector.webgl) {
  Detector.addGetWebGLMessage();
  document.getElementById('container').innerHTML = "";
}

let inventory = document.getElementById('inventory');
let stats = document.getElementById('stats');
let blocker = document.getElementById('blocker');
let instructions = document.getElementById('instructions');
let havePointerLock = 'pointerLockElement' in document || 'mozPointerLockElement' in document || 'webkitPointerLockElement' in document;
if (havePointerLock) {
  let element = document.body;
  let pointerlockchange = function (event) {
    if (document.pointerLockElement === element || document.mozPointerLockElement === element || document.webkitPointerLockElement === element) {
      controlsEnabled = true;
      controls.enabled = true;
      blocker.style.display = 'none';
    } else {
      controls.enabled = false;
      blocker.style.display = 'block';
      instructions.style.display = '';
    }
  };
  let pointerlockerror = function (event) {
    console.error(event.error);
    instructions.style.display = '';
  };
  // Hook pointer lock state change events
  document.addEventListener('pointerlockchange', pointerlockchange, false);
  document.addEventListener('mozpointerlockchange', pointerlockchange, false);
  document.addEventListener('webkitpointerlockchange', pointerlockchange, false);
  document.addEventListener('pointerlockerror', pointerlockerror, false);
  document.addEventListener('mozpointerlockerror', pointerlockerror, false);
  document.addEventListener('webkitpointerlockerror', pointerlockerror, false);
  instructions.addEventListener('click', function (event) {
    instructions.style.display = 'none';

    // Ask the browser to lock the pointer
    element.requestPointerLock = element.requestPointerLock || element.mozRequestPointerLock || element.webkitRequestPointerLock;
    element.requestPointerLock();
  }, false);
} else {
  instructions.innerHTML = 'Your browser doesn\'t seem to support Pointer Lock API';
}

let controlsEnabled = false;
let fogExp2 = true;
let container;
let camera;
let controls;
let scene;
let renderer;
let maze;
let mazeMatrix;
let objects = [];
let textureLoader = new THREE.TextureLoader();
let textures = [
  'textures/environment/256x256/0000.png',
  'textures/environment/256x256/0100.png',
  'textures/environment/256x256/0160.png',
  'textures/environment/256x256/0200.png',
  'textures/environment/256x256/0250.png',
  'textures/environment/256x256/0270.png',
  'textures/environment/256x256/0300.png',
  'textures/environment/256x256/0400.png',
  'textures/environment/256x256/0500.png',
  'textures/environment/256x256/0600.png',
].map(asset => {
  let texture = new THREE.TextureLoader().load(asset);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.LinearMipMapLinearFilter;
  texture._url = asset;
  return texture;
});

let audioListener;
let ambientSound;
let audioLoader = new THREE.AudioLoader();

let clock = new THREE.Clock();
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;

let canJump = false;
let prevTime = performance.now();
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let raycaster;
let lamp;
let minHeight = 0;
let theta = 0;

let superJump = 1000;
let superFlash = 1000;
let battery = 0;
let superSpeed = 1000;
let gas = 0;
let superBlink = 1000;

const WORLD_WIDTH = 200;
const WORLD_DEPTH = 200;
const WORLD_HALF_WIDTH = WORLD_WIDTH / 2;
const WORLD_HALF_DEPTH = WORLD_DEPTH / 2;

function init() {
  container = document.getElementById('container');

  // Generate maze
  maze = new Maze((WORLD_WIDTH / 2 | 0) - 1, (WORLD_DEPTH / 2 | 0) - 1)
  mazeMatrix = maze.matrix();

  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 1000);
  camera.zoom = 2;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x02050e);
  scene.fog = new THREE.FogExp2(0x02050e, 0.00395);

  audioListener = new THREE.AudioListener();
  camera.add(audioListener);

  ambientSound = new THREE.Audio(audioListener);
  scene.add(ambientSound);

  audioLoader.load(
    'audio/darkshadow.mp3',
    // onLoad callback
    audioBuffer => {
      ambientSound.setBuffer(audioBuffer);
      ambientSound.setLoop(true);
      ambientSound.play();
    },

    // onProgress callback
    xhr => {
      console.log((xhr.loaded / xhr.total * 100) + '% loaded');
    },

    // onError callback
    err => {
      console.log('An error happened');
    }
  )

  controls = new THREE.PointerLockControls(camera);
  scene.add(controls.getObject());

  let onKeyDown = event => {
    switch (event.keyCode) {
      case 38: // up
      case 87: // w
        moveForward = true;
        break;
      case 37: // left
      case 65: // a
        moveLeft = true; break;
      case 40: // down
      case 83: // s
        moveBackward = true;
        break;
      case 39: // right
      case 68: // d
        moveRight = true;
        break;
      case 32: // space
        if (canJump === true) {
          velocity.y += 350;
          canJump = false;
        }
        break;
      case 49: case 84:
        if (superBlink >= 1000) {
          teleport();
          superBlink = 0;
        }
        break;
      case 50: case 71:
        if (canJump === true && superJump >= 1000) {
          velocity.y += 1000;
          superJump = 0;
          canJump = false;
        }
        break;
      case 51: case 70:
        if (superFlash >= 1000) {
          superFlash = 0;
          battery = 250;
        }
        break;
      case 52: case 82:
        if (superSpeed >= 1000) {
          superSpeed = 0;
          gas = 250;
        }
        break;
    }
  };
  let onKeyUp = event => {
    switch (event.keyCode) {
      case 38: // up
      case 87: // w
        moveForward = false;
        break;
      case 37: // left
      case 65: // a
        moveLeft = false;
        break;
      case 40: // down
      case 83: // s
        moveBackward = false;
        break;
      case 39: // right
      case 68: // d
        moveRight = false;
        break;
    }
  };

  document.addEventListener('keydown', onKeyDown, false);
  document.addEventListener('keyup', onKeyUp, false);
  raycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, - 1, 0), 0, 10);

  // let floorGeometry = new THREE.PlaneGeometry(2000, 2000, 100, 100);
  // floorGeometry.rotateX(- Math.PI / 2);
  // for (let i = 0, l = floorGeometry.vertices.length; i < l; i++) {
  //   let vertex = floorGeometry.vertices[i];
  //   vertex.x += Math.random() * 20 - 10;
  //   vertex.y += Math.random() * 2;
  //   vertex.z += Math.random() * 20 - 10;
  // }
  // for (let i = 0, l = floorGeometry.faces.length; i < l; i++) {
  //   let face = floorGeometry.faces[i];
  //   face.vertexColors[0] = new THREE.Color().setHSL(Math.random() * 0.3 + 0.5, 0.75, Math.random() * 0.25 + 0.75);
  //   face.vertexColors[1] = new THREE.Color().setHSL(Math.random() * 0.3 + 0.5, 0.75, Math.random() * 0.25 + 0.75);
  //   face.vertexColors[2] = new THREE.Color().setHSL(Math.random() * 0.3 + 0.5, 0.75, Math.random() * 0.25 + 0.75);
  // }

  // let floorMaterial = new THREE.MeshBasicMaterial({ vertexColors: THREE.VertexColors });
  // let floor = new THREE.Mesh(floorGeometry, floorMaterial);
  // scene.add(floor);

  const light = new THREE.Color(0xffffff);
  const shadow = new THREE.Color(0x303030);
  const matrix = new THREE.Matrix4();

  let pxGeometry = new THREE.PlaneGeometry(100, 100);
  pxGeometry.faces[0].vertexColors = [light, shadow, light];
  pxGeometry.faces[1].vertexColors = [shadow, shadow, light];
  // pxGeometry.faceVertexUvs[0][0][0].y = 1;
  // pxGeometry.faceVertexUvs[0][0][2].y = 1;
  // pxGeometry.faceVertexUvs[0][1][2].y = 1;
  pxGeometry.rotateY(Math.PI / 2);
  pxGeometry.translate(50, 0, 0);

  let nxGeometry = new THREE.PlaneGeometry(100, 100);
  nxGeometry.faces[0].vertexColors = [light, shadow, light];
  nxGeometry.faces[1].vertexColors = [shadow, shadow, light];
  // nxGeometry.faceVertexUvs[0][0][0].y = 1;
  // nxGeometry.faceVertexUvs[0][0][2].y = 1;
  // nxGeometry.faceVertexUvs[0][1][2].y = 1;
  nxGeometry.rotateY(- Math.PI / 2);
  nxGeometry.translate(- 50, 0, 0);

  let pyGeometry = new THREE.PlaneGeometry(100, 100);
  pyGeometry.faces[0].vertexColors = [light, light, light];
  pyGeometry.faces[1].vertexColors = [light, light, light];
  pyGeometry.rotateX(- Math.PI / 2);
  pyGeometry.translate(0, 50, 0);

  let py2Geometry = new THREE.PlaneGeometry(100, 100);
  py2Geometry.faces[0].vertexColors = [light, light, light];
  py2Geometry.faces[1].vertexColors = [light, light, light];
  py2Geometry.rotateX(- Math.PI / 2);
  py2Geometry.rotateY(Math.PI / 2);
  py2Geometry.translate(0, 50, 0);

  let pzGeometry = new THREE.PlaneGeometry(100, 100);
  pzGeometry.faces[0].vertexColors = [light, shadow, light];
  pzGeometry.faces[1].vertexColors = [shadow, shadow, light];
  pzGeometry.translate(0, 0, 50);

  let nzGeometry = new THREE.PlaneGeometry(100, 100);
  nzGeometry.faces[0].vertexColors = [light, shadow, light];
  nzGeometry.faces[1].vertexColors = [shadow, shadow, light];
  nzGeometry.rotateY(Math.PI);
  nzGeometry.translate(0, 0, - 50);

  let geometries = textures.map(() => {
    return new THREE.Geometry();
  });

  let dummy = new THREE.Mesh();
  let cubeGeometry = new THREE.CubeGeometry(100, 100, 100);

  for (let z = 0; z < WORLD_WIDTH; z++) {
    for (let x = 0; x < WORLD_DEPTH; x++) {

      h = getY(x, z);

      matrix.makeTranslation(
        x * 100 - WORLD_HALF_WIDTH * 100,
        h * 100,
        z * 100 - WORLD_HALF_DEPTH * 100
      );

      let finish = maze.compass();
      let dz = Math.abs(z - finish.z);
      let dx = Math.abs(x - finish.x);
      let dist = Math.sqrt(dz * dz + dx * dx);
      let geomIndex = Math.round(mapRange(dist, 0, 280, 1, geometries.length - 1));

      if (dist <= 1) {
        geomIndex = 0;
      }

      if (geomIndex > geometries.length - 1) {
        geomIndex = geometries.length - 1;
      }

      let px = getY(x + 1, z);
      let nx = getY(x - 1, z);
      let pz = getY(x, z + 1);
      let nz = getY(x, z - 1);
      let pxpz = getY(x + 1, z + 1);
      let nxpz = getY(x - 1, z + 1);
      let pxnz = getY(x + 1, z - 1);
      let nxnz = getY(x - 1, z - 1);

      let a = nx > h || nz > h || nxnz > h ? 0 : 1;
      let b = nx > h || pz > h || nxpz > h ? 0 : 1;
      let c = px > h || pz > h || pxpz > h ? 0 : 1;
      let d = px > h || nz > h || pxnz > h ? 0 : 1;
      let colors;

      if (a + c > b + d) {
        colors = py2Geometry.faces[0].vertexColors;
        colors[0] = b === 0 ? shadow : light;
        colors[1] = c === 0 ? shadow : light;
        colors[2] = a === 0 ? shadow : light;
        colors = py2Geometry.faces[1].vertexColors;
        colors[0] = c === 0 ? shadow : light;
        colors[1] = d === 0 ? shadow : light;
        colors[2] = a === 0 ? shadow : light;
        geometries[geomIndex].merge(py2Geometry, matrix);
      } else {
        colors = pyGeometry.faces[0].vertexColors;
        colors[0] = a === 0 ? shadow : light;
        colors[1] = b === 0 ? shadow : light;
        colors[2] = d === 0 ? shadow : light;
        colors = pyGeometry.faces[1].vertexColors;
        colors[0] = b === 0 ? shadow : light;
        colors[1] = c === 0 ? shadow : light;
        colors[2] = d === 0 ? shadow : light;
        geometries[geomIndex].merge(pyGeometry, matrix);
      }
      if ((px != h && px != h + 1) || x == 0) {
        colors = pxGeometry.faces[0].vertexColors;
        colors[0] = pxpz > px && x > 0 ? shadow : light;
        colors[2] = pxnz > px && x > 0 ? shadow : light;
        colors = pxGeometry.faces[1].vertexColors;
        colors[2] = pxnz > px && x > 0 ? shadow : light;
        geometries[geomIndex].merge(pxGeometry, matrix);
      }
      if ((nx != h && nx != h + 1) || x == WORLD_WIDTH - 1) {
        colors = nxGeometry.faces[0].vertexColors;
        colors[0] = nxnz > nx && x < WORLD_WIDTH - 1 ? shadow : light;
        colors[2] = nxpz > nx && x < WORLD_WIDTH - 1 ? shadow : light;
        colors = nxGeometry.faces[1].vertexColors;
        colors[2] = nxpz > nx && x < WORLD_WIDTH - 1 ? shadow : light;
        geometries[geomIndex].merge(nxGeometry, matrix);
      }
      if ((pz != h && pz != h + 1) || z == WORLD_DEPTH - 1) {
        colors = pzGeometry.faces[0].vertexColors;
        colors[0] = nxpz > pz && z < WORLD_DEPTH - 1 ? shadow : light;
        colors[2] = pxpz > pz && z < WORLD_DEPTH - 1 ? shadow : light;
        colors = pzGeometry.faces[1].vertexColors;
        colors[2] = pxpz > pz && z < WORLD_DEPTH - 1 ? shadow : light;
        geometries[geomIndex].merge(pzGeometry, matrix);
      }
      if ((nz != h && nz != h + 1) || z == 0) {
        colors = nzGeometry.faces[0].vertexColors;
        colors[0] = pxnz > nz && z > 0 ? shadow : light;
        colors[2] = nxnz > nz && z > 0 ? shadow : light;
        colors = nzGeometry.faces[1].vertexColors;
        colors[2] = nxnz > nz && z > 0 ? shadow : light;
        geometries[geomIndex].merge(nzGeometry, matrix);
      }
    }
  }

  geometries.forEach((geometry, index) => {
    let mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ map: textures[index], vertexColors: THREE.VertexColors }));
    scene.add(mesh);
  });

  let ambientLight = new THREE.AmbientLight(0x666666);
  scene.add(ambientLight);


  // let finishLight = new THREE.PointLight(0xffffff, 10, 10, 2);
  // const { x, z } = maze.compass();
  // finishLight.position.set(
  //   x * 100 - WORLD_HALF_WIDTH * 100,
  //   0,
  //   z * 100 - WORLD_HALF_DEPTH * 100,
  // )
  // scene.add(finishLight);

  lamp = new THREE.PointLight(0xffffff, 2);
  scene.add(lamp);

  renderer = new THREE.WebGLRenderer();
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);

  teleport();

  container.innerHTML = "";
  container.appendChild(renderer.domElement);
}

function getY(x, z) {
  if (typeof mazeMatrix[z] === 'undefined') return 0;
  if (typeof mazeMatrix[z][x] === 'undefined') return 0;
  return mazeMatrix[z][x] === 0 ? 0 : -1;
}

function animate() {
  requestAnimationFrame(animate);
  render();
}

function updateControls() {

  if (controlsEnabled === true) {
    raycaster.ray.origin.copy(controls.getObject().position);
    raycaster.ray.origin.y -= 10;
    // let intersections = raycaster.intersectObjects(objects);
    let onObject = false;
    let time = performance.now();
    let delta = (time - prevTime) / 1000;

    velocity.x -= velocity.x * 10.0 * delta;
    velocity.z -= velocity.z * 10.0 * delta;
    velocity.y -= 9.8 * 100.0 * delta; // 100.0 = mass
    direction.z = Number(moveForward) - Number(moveBackward);
    direction.x = Number(moveLeft) - Number(moveRight);
    direction.normalize(); // this ensures consistent movements in all directions

    if (moveForward || moveBackward) velocity.z -= direction.z * 1200.0 * delta;
    if (moveLeft || moveRight) velocity.x -= direction.x * 1200.0 * delta;
    if (onObject === true) {
      velocity.y = Math.max(0, velocity.y);
      canJump = true;
    }

    let oldX = controls.getObject().position.x;
    let oldY = controls.getObject().position.y;
    let oldZ = controls.getObject().position.z;
    let dx = Math.round((oldX + WORLD_HALF_WIDTH * 100) / 100);
    let dz = Math.round((oldZ + WORLD_HALF_DEPTH * 100) / 100);
    let dirs = mazeMatrix[dz][dx];
    stats.innerHTML =
      `x: ${oldX} <br>y:${oldY}<br>z:${oldZ}<br><br>` +
      `dx: ${dx} <br>dz:${dz}<br>`;

    let boost = 1;
    if (gas > 0) {
      gas -= 0.5;
      boost = 2.5;
    }
    controls.getObject().translateX(velocity.x * delta * boost);
    controls.getObject().translateZ(velocity.z * delta * boost);
    controls.getObject().translateY(velocity.y * delta);

    let collisionN = false;
    let collisionS = false;
    let collisionW = false;
    let collisionE = false;

    if (!(dirs & N)) {
      collisionN = controls.getObject().position.z <= (dz * 100 - (WORLD_HALF_DEPTH * 100) - 40);
    }

    if (!(dirs & S)) {
      collisionS = controls.getObject().position.z >= (dz * 100 - (WORLD_HALF_DEPTH * 100) + 40);
    }

    if (!(dirs & E)) {
      collisionE = controls.getObject().position.x >= (dx * 100 - (WORLD_HALF_WIDTH * 100) + 40);
    }

    if (!(dirs & W)) {
      collisionW = controls.getObject().position.x <= (dx * 100 - (WORLD_HALF_WIDTH * 100) - 40);
    }

    if (collisionN || collisionS) {
      controls.getObject().position.z = oldZ;
    }

    if (collisionE || collisionW) {
      controls.getObject().position.x = oldX;
    }

    if (controls.getObject().position.y < minHeight) {
      velocity.y = 0;
      controls.getObject().position.y = minHeight;
      canJump = true;
    }

    lamp.position.set(
      controls.getObject().position.x,
      controls.getObject().position.y,
      controls.getObject().position.z
    );

    prevTime = time;
  }
}

function isOpen(x, z) {
  let dx = ((x + WORLD_HALF_WIDTH * 100 + 50) / 100) | 0;
  let dz = ((z + WORLD_HALF_DEPTH * 100 + 50) / 100) | 0;
  let val = mazeMatrix[dz][dx];
  return val !== 0;
}

function render() {
  theta += 0.05;
  updateControls();

  if (superSpeed < 1000) {
    superSpeed += 1;
  }

  if (superFlash < 1000) {
    superFlash += 1;
  }

  if (superBlink < 1000) {
    superBlink += 1;
  }


  if (superJump < 1000) {
    superJump += 1;
  }


  let inventoryText = `<strong style="font-size:125%">ABILITIES</strong><hr>` +
    `(T) Blink: <b>${Math.round(superBlink / 10)}%</b> <br>` +
    `(G) Leap: <b>${Math.round(superJump / 10)}%</b> <br>` +
    `(F) Flash: <b>${Math.round(superFlash / 10)}%</b> <br>` +
    `(R) Burst: <b>${Math.round(superSpeed / 10)}%</b> <br>` + '<br><br>';

  if (gas > 0) {
    inventoryText += `GAS: <b>${Math.round(gas / 2.5)}%</b><br>`;
  }

  if (battery > 0) {
    lamp.intensity = 6;
    lamp.decay = 0;

    inventoryText += `BATTERY: <b>${Math.round(battery / 2.5)}%</b><br>`;
    battery -= 0.5;
  } else {
    lamp.intensity = 0.25 + ((Math.sin(theta) + 1) / 2) * 3;
    lamp.decay = 2;
  }

  inventory.innerHTML = inventoryText;
  renderer.render(scene, camera);
}

function teleport(i, j) {
  // Find a random location as initial starting point
  i = i || 0;
  j = j || 0;
  while (!mazeMatrix[j][i]) {
    i = Math.round(Math.random() * (WORLD_WIDTH - 1));
    j = Math.round(Math.random() * (WORLD_DEPTH - 1));
  };

  controls.getObject().position.x = (i * 100) - WORLD_HALF_WIDTH * 100;
  controls.getObject().position.z = (j * 100) - WORLD_HALF_DEPTH * 100;
}

function home() {
  const { x, z } = maze.compass();
  controls.getObject().position.set(
    x * 100 - WORLD_HALF_WIDTH * 100,
    10,
    z * 100 - WORLD_HALF_DEPTH * 100,
  )
}

init();
animate();
