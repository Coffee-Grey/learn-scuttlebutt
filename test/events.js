require('tape')('events', function (t) {
    var ReliableEventEmitter = require('../events')
    var mac = require('macgyver')().autoValidate()

    function allow(update, cb) {
        return cb(null, true)
    }

    var A = new ReliableEventEmitter('a')
    var B = new ReliableEventEmitter('b')

    function log() {
        console.log('LOG', this.id, date)
    }

    function old(data) {
        console.log('OLD', data, this.sources[data[2]])
    }

    var _a = [], _b = []
    A.on('a', log)
    A.on('a', mac(function (data) {
        _a.push(data)
    }).times(1))

    B.on('a', log)
    B.on('a', mac(function (data) {
        _b.push(data)
    }).times(1))

    A.emit('a', 'aardvark')
    A.emit('a', 'antelope')
    A.emit('a', 'anteater')

    B.emit('a', 'armadillo')
    B.emit('a', 'alligator')
    B.emit('a', 'amobea')

    var s
    (s = A.createStream()).pipe(B.createStream()).pipe(s)

    process.nextTick(function () {
        t.deepEqual(_a.sort(), _b.sort())
        console.log(_a.sort())
        t.end()
    })
})