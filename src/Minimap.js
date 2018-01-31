const localBlockSize = 10;

class Minimap {

  constructor(maze, canvas) {
    this.maze = maze;
    this.matrix = this.maze.matrix();
    this.canvas = canvas;

    this.container = document.getElementById('minimap');
    this.width = this.container.offsetWidth;
    this.height = this.container.offsetHeight;
    this.aspect = this.width / this.height;

    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.cameraTarget = null;
    this.plane = null;

    this.tracker = null;

    this._drawMaze();
    this._setupScene();
  }

  _drawMaze() {
    const matrix = this.matrix;
    this.canvas.height = matrix.length * localBlockSize;
    this.canvas.width = matrix[0].length * localBlockSize;

    const ctx = this.canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    for (let j = 0; j < matrix.length; j++) {
      for (let i = 0; i < matrix[j].length; i++) {
        if (matrix[j][i] === 0) {
          ctx.fillStyle = "white";
          ctx.fillRect(i * localBlockSize, j * localBlockSize, localBlockSize, localBlockSize);
        }
      }
    }
  }

  _setupScene() {

    const frustumSize = 100;

    this.renderer = new THREE.WebGLRenderer({
      alpha: true
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(this.width, this.height);

    this.container.innerHTML = "";
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    // this.scene.fog = new THREE.Fog(0x000000, 1, 90);
    // this.scene.background = new THREE.Color(0xffffff);

    this.camera = new THREE.OrthographicCamera(frustumSize * this.aspect / - 2, frustumSize * this.aspect / 2, frustumSize / 2, frustumSize / - 2, 1, 1000);
    // this.camera = new THREE.PerspectiveCamera(75, width / height, 1, 1000);
    this.scene.add(this.camera);
    // this.camera.position.set(0, 0, 0);

    // const light = new THREE.PointLight(0xffffff, 1.5, 200, 2);
    // this.camera.add(light);
    // light.position.set(0, 0, 10);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1);
    this.scene.add(ambientLight);

    const texture = new THREE.Texture(this.canvas);
    texture.magFilter = THREE.LinearFilter;
    // textureLoader.flipY = false;
    texture.needsUpdate = true;

    const geometry = new THREE.PlaneGeometry(this.canvas.width, this.canvas.height);
    const material = new THREE.MeshStandardMaterial({ map: texture, side: THREE.FrontSide });
    // const material = new THREE.LineBasicMaterial({
    //   color: 0xffffff,
    //   linewidth: 1,
    //   linecap: 'round', //ignored by WebGLRenderer
    //   linejoin: 'round' //ignored by WebGLRenderer
    // });
    this.plane = new THREE.Mesh(geometry, material);
    this.camera.add(this.plane);
    this.plane.position.set(0, 0, -100);

    const trackerGeometry = new THREE.CircleGeometry(2, 10);
    const trackerMaterial = new THREE.MeshBasicMaterial({
      color: 0xc00000,
      opacity: 0.5
    });
    this.tracker = new THREE.Mesh(trackerGeometry, trackerMaterial);
    // this.tracker.position.set(0, 0, 25);
    // this.tracker.rotation.z = Math.PI;
    this.camera.add(this.tracker);
    this.tracker.position.z = -50;
  }

  update(controls, camera) {
    const rot = camera.getWorldRotation();
    const pos = controls.getObject().position;
    const xCells = this.maze.localWidth();
    const yCells = this.maze.localDepth();
    const worldBlockSize = 100;

    // console.log(
    //   xCells / 2 * -worldBlockSize - xCells / 2 * worldBlockSize,
    //   yCells / 2 * -worldBlockSize - yCells / 2 * worldBlockSize
    // );
    const x = mapRange(
      pos.x,
      xCells / 2 * -worldBlockSize, xCells / 2 * worldBlockSize,
      xCells / 2 * -localBlockSize, xCells / 2 * localBlockSize,
    );

    const y = mapRange(
      pos.z,
      yCells / 2 * -worldBlockSize, yCells / 2 * worldBlockSize,
      yCells / 2 * -localBlockSize, yCells / 2 * localBlockSize,
    );

    this.plane.position.x = -1 * x - localBlockSize / 2;
    this.plane.position.y = y + localBlockSize / 2;

    document.getElementById('stats').innerHTML = document.getElementById('stats').innerHTML.replace(
      '{slot}',
      `<br>local.x=${this.plane.position.x}<br>local.y=${this.plane.position.y}`
    );

    // this.tracker.position.x = pos.x;
    // this.tracker.position.y = pos.z;
    // this.tracker.rotation.x = rot.x;
    // this.tracker.rotation.z = rot.z;
    // this.tracker.setRotationFromEuler(rot);

    this.renderer.render(this.scene, this.camera);
  }

  teleport(i, j) {
    const localWidth = this.maze.localWidth();
    const localDepth = this.maze.localDepth();

    // Find a random location as initial starting point
    i = i || 0;
    j = j || 0;
    while (!mazeMatrix[j][i]) {
      i = Math.round(Math.random() * (localWidth - 1));
      j = Math.round(Math.random() * (localDepth - 1));
    };

    this.camera.position.x = (i * localBlockSize) - localWidth / 2 * localBlockSize;
    this.camera.position.y = (j * localBlockSize) - localDepth / 2 * localBlockSize;
  }

}