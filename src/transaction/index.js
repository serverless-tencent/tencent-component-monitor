class Transaction {
  get start() {
    return this._start
  }
  set Path(path) {
    this._path = path
  }
  get path() {
    return this._path
  }
  init() {
    this._start = Date.now()
  }
  end() {
    this._start = null
    this._path = null
  }
}
module.exports = Transaction
