const { EventEmitter } = require('events')

const Transaction = require('./transaction')

class Agent extends EventEmitter {
  constructor() {
    super()
    this._transaction = new Transaction()
  }
  get transaction() {
    return this._transaction
  }
}

module.exports = Agent
