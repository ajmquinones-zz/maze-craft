class MinHeap {

  constructor(compare) {
    this.compare = compare;
    this.data = [];
    this.size = 0;
  }

  empty() {
    return !this.size;
  }

  push(value) {
    this._up(this.data[this.size] = value, this.size++);
    return this.size;
  }

  pop() {
    if (this.size <= 0) return;
    let removed = this.data[0];
    if (--this.size > 0) {
      let value = this.data[this.size];
      this._down(this.data[0] = value, 0);
    }
    return removed;
  }

  _up(value, i) {
    while (i > 0) {
      let j = ((i + 1) >> 1) - 1;
      let parent = this.data[j];
      if (this.compare(value, parent) >= 0) break;
      this.data[i] = parent;
      this.data[i = j] = value;
    }
  }

  _down(value, i) {
    while (true) {
      let r = (i + 1) << 1;
      let l = r - 1;
      let j = i;
      let child = this.data[j];
      if (l < this.size && this.compare(this.data[l], child) < 0) child = this.data[j = l];
      if (r < this.size && this.compare(this.data[r], child) < 0) child = this.data[j = r];
      if (j === i) break;
      this.data[i] = child;
      this.data[i = j] = value;
    }
  }
}
