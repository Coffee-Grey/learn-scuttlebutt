require('tape')('dispose', function (t) {

    var EE = require('../events')
    var es = require('event-stream')
    var mac = require('macgyver')().autoValidate()

    var emitter = new EE()
    var ended = false

    var fs = require('fs')

    var s = emitter.createReadStream({tail: true})
    s.on('readable', function () {
        console.log('READABLE')
    })

    s.pipe(es.writeArray(function (err, ary) {
        console.log(ary)
        ended = true
    }))

    emitter.emit('message', 'hello')
    emitter.emit('message', 'hello')

    emitter.on('dispose', function () {
        console.log('DISPOSE')
    })

    process.nextTick(function () {
        console.log('dispose')
        emitter.dispose()
        t.ok(ended, 'dispose must trigger end on all stareams')
        t.end()
    })
})