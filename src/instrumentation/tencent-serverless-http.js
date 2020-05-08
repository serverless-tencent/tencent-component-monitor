const utils = require('../utils')
const report = require('../report')

module.exports = function initialize(agent, httpProxy) {
  utils.wrapMethod(httpProxy, 'proxy', function wrapRoute(fn) {
    return function() {
      const { transaction } = agent
      transaction.init()
      const proxy = fn.apply(this, arguments)
      return new Promise(function(resolve) {
        agent.once('responseFinish', function(ctx, data) {
          if (ctx) {
            report.reportHttp(ctx, data).then(
              function() {
                resolve(proxy)
              },
              function() {
                resolve(proxy)
              }
            )
          } else {
            resolve(proxy)
          }
        })
      })
    }
  })
}
