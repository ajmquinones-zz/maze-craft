
const N = 1 << 0;
const S = 1 << 1;
const W = 1 << 2;
const E = 1 << 3;

class Maze {

  constructor(width, depth) {
    this.width = width || 8;
    this.depth = depth || 8;
    this.data = [];
    this.frontier = new MinHeap((a, b) => a.weight - b.weight);

    this._matrix = null;

    this._init();
    this._generate();
  }

  compass() {
    const x = (this.start % this.width) * 2 + 1;
    const z = (this.start / this.width | 0) * 2 + 1;
    return { x, z };
  }

  globalCompass() {
    const localWidth = maze.localWidth();
    const localDepth = maze.localDepth();
    const { x, z } = maze.compass();
    return {
      x: x * 100 - localWidth / 2 * 100,
      z: z * 100 - localDepth / 2 * 100
    };
  }

  debug() {
    let data = [];
    for (let z = 0; z < this.depth; z++) {
      data[z] = [];
      for (let x = 0; x < this.width; x++) {
        data[z][x] = this.data[z * this.width + x] | 0;
      }
    }

    return data;
  }

  localWidth() {
    const mat = this.matrix();
    return mat[0].length;
  }

  localDepth() {
    const mat = this.matrix();
    return mat.length;
  }

  matrix() {

    if (this._matrix !== null) {
      return this._matrix;
    }


    let data = [];
    for (let z = 0; z < this.depth * 2 + 1; z++) {
      data[z] = [];
      for (let x = 0; x < this.width * 2 + 1; x++) {
        data[z][x] = 0;
      }
    }

    const that = this;
    this.data.forEach((dirs, i) => {

      const x = (i % that.width) * 2 + 1;
      const y = (i / that.width | 0) * 2 + 1;

      data[y][x] = dirs;
      if (dirs & N) data[y - 1][x] |= N;
      if (dirs & S) data[y + 1][x] |= S;
      if (dirs & W) data[y][x - 1] |= W;
      if (dirs & E) data[y][x + 1] |= E;
    });

    this._matrix = data;
    return this._matrix;
  }

  _init() {

    this.start = (this.depth - 1) * this.width;
    this.data[this.start] = 0;

    this.frontier.push({ index: this.start, direction: N, weight: Math.random() });
    this.frontier.push({ index: this.start, direction: E, weight: Math.random() });
  }

  _generate() {

    let done = false;
    while (!(done = this._exploreFrontier()));
  }

  _exploreFrontier() {

    let edge = this.frontier.pop();
    if (edge == null) return true;

    let i0 = edge.index;
    let d0 = edge.direction;
    let i1 = i0 + (d0 === N ? -this.width : d0 === S ? this.width : d0 === W ? -1 : +1);
    let x0 = i0 % this.width;
    let y0 = i0 / this.width | 0;
    let x1;
    let y1;
    let d1;
    let open = this.data[i1] == null;

    switch (d0) {
      case N:
        x1 = x0;
        y1 = y0 - 1;
        d1 = S;
        break;
      case S:
        x1 = x0;
        y1 = y0 + 1;
        d1 = N;
        break;
      case W:
        x1 = x0 - 1;
        y1 = y0;
        d1 = E;
        break;
      case E:
      default:
        x1 = x0 + 1;
        y1 = y0;
        d1 = W;
        break;
    }

    if (open) {
      this.data[i0] |= d0;
      this.data[i1] |= d1;

      if (y1 > 0 && this.data[i1 - this.width] == null)
        this.frontier.push({ index: i1, direction: N, weight: Math.random() });
      if (y1 < this.depth - 1 && this.data[i1 + this.width] == null)
        this.frontier.push({ index: i1, direction: S, weight: Math.random() });
      if (x1 > 0 && this.data[i1 - 1] == null)
        this.frontier.push({ index: i1, direction: W, weight: Math.random() });
      if (x1 < this.width - 1 && this.data[i1 + 1] == null)
        this.frontier.push({ index: i1, direction: E, weight: Math.random() });
    }
  }
}