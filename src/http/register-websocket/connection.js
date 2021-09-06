let invoke = require('../invoke-ws')
let pool = require('./pool')
let noop = err => err ? console.log(err) : ''

module.exports = function connection ({ cwd, inventory, update, domainName }, connectionId, ws) {
  let { get } = inventory
  // Save this for send to use
  pool.register(connectionId, ws)

  const respondToError = (err, resp) => {
    if (err || resp && resp.statusCode >= 400) {
      ws.send(JSON.stringify({ 'message': 'Internal server error', connectionId, 'requestId': 'xxxxxx=' }), noop)
    }
  }

  ws.on('message', function message (data, isBinary) {
    let msg = isBinary ? data : data.toString()
    let lambda
    try {
      let payload = JSON.parse(msg)
      lambda = payload.action && get.ws(payload.action)
    }
    catch (e) {
      // fallback to default
    }
    if (lambda) {
      update.status(`ws/${lambda.name}: ${connectionId}`)
      invoke({
        cwd,
        lambda,
        body: msg,
        inventory,
        update,
        connectionId,
        domainName,
      }, respondToError)
    }
    else {
      let lambda = get.ws('default')
      update.status('ws/default: ' + connectionId)
      invoke({
        cwd,
        lambda,
        body: msg,
        inventory,
        update,
        connectionId,
        domainName,
      }, respondToError)
    }
  })

  ws.on('close', function close () {
    let lambda = get.ws('disconnect')
    update.status(`ws/disconnect: ${connectionId}`)
    invoke({
      cwd,
      lambda,
      req: { headers: { host: domainName } },
      inventory,
      update,
      connectionId,
      domainName
    }, err => {
      pool.delete(connectionId)
      noop(err)
    })
  })
}
