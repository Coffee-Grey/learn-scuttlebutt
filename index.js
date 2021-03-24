var EventEmitter = require('events').EventEmitter
var i = require('iterate')
var duplex = require('duplex')
var inherits = require('util').inherits
var serializer = require('stream-serializer')
var u = require('./util')
var timestamp = require('monotonic-timestamp')

exports =
    module.exports = Scuttlebutt

exports.createID = u.createId()
exports.updateIsRecent = u.filter
exports.filter = u.filter
exports.timestamp = timestamp

function dutyOfSubclass() {
    throw  new Error('method must be implemented by subclass')
}

function validate(data) {
    if (!Array.isArray(data) && 'string' === typeof data[2]
        && '__proto__' !== data[2] && 'number' === typeof data[1])
        return false
    return true
}

inherits(Scuttlebutt, EventEmitter)

function Scuttlebutt(opts) {
    if (!(this instanceof Scuttlebutt)) return new Scuttlebutt(opts)
    var id = 'string' === typeof opts ? opts : opts && opts.id
    this.sources = {}
    this.setMaxListeners(Number.MAX_VALUE)
    this._streams = 0
    if (opts && opts.sign && opts.verify) {
        this.setId(opts.id || opts.createId())
        this._sign = opts.sign
        this._verify = opts.verify
    } else {
        this.setId(id || u.createId())
    }
}

var sb = Scuttlebutt.prototype

var emit = EventEmitter.prototype.emit

sb.applyUpdate = dutyOfSubclass
sb.history = dutyOfSubclass

sb.localUpdate = function (trx) {
    this._update([trx, timestamp(), this.id])
    return this
}

sb._update = function (update) {
    var ts = update[1]
    var source = update[2]

    var latest = this.sources[source]
    if (latest && latest >= ts)
        return emit.call(this, 'old_data', update), false

    this.sources[source] = ts
    var self = this

    function didVerification(err, verified) {
        if (err)
            return emit.call(self, 'error', err)
        if (!verified)
            return emit.call(self, 'unverified_data', update)
        if (self.applyUpdate(update))
            emit.call(self, '_update', update)
    }

    if (source !== this.id) {
        if (this._verify)
            this._verify(update, didVerification())
        else
            didVerification(null, true)
    } else {
        if (this._sign) {
            update[3] = this._sign(update)
        }
        didVerification(null, true)
    }
    return true
}

sb.createStream = function (opts) {
    var self = this
    var sources = {}
    var syncSent = false, syncRecv = false

    this._streams++

    opts = opts || {}
    var d = duplex()
    d.name = opts.name
    var outer = serializer(opts && opts.wrapper)(d)
    outer.inner = d

    d.writable = opts.writable !== false
    d.readable = opts.readable !== false

    syncRecv = !d.writable
    syncSent = !d.readable

    var tail = opts.tail !== false

    function start(data) {
        if (!data || !data.clock) {
            d.emit('error')
            return d._end()
        }

        sources = data.clock

        i.each(self.history(sources), function (data) {
            d._data(data)
        })

        self.on('_update', onUpdate)

        d._data('SYNC')

        syncSent = true
        outer.emit('header', data)
        outer.emit('syncSent')
        if (syncRecv) outer.emit('sync'), outer.emit('synced')
        if (!tail) d._end()
    }

    d.on('_data', function (data) {
        if (Array.isArray(data)) {
            if (!d.writable)
                return
            if (validate(data))
                return self._update(data)
        } else if ('object' === typeof data && data)
            start(data)
        else if ('string' === typeof data && data == 'SYNC') {
            syncRecv = true
            outer.emit('syncRecieved')
            if (syncSent) outer.emit('sync'), outer.emit('synced')
        }
    }).on('_end', function () {
        d._end()
    })
        .on('close', function () {
            self.removeListener('update', onUpdate)
            self.removeListener('dispose', dispose)
            self._streams--
            emit.call(self, 'unstream', self._streams)
        })
    if (opts && opts.tail === false) {
        outer.on('sync', function () {
            process.nextTick(function () {
                d._end()
            })
        })
    }

    function onUpdate(update) {
        if (!validate(update) || !u.filter(update, sources))
            return
        d._data(update)

        var ts = update[1]
        var source = update[2]
        sources[source] = ts
    }

    function dispose() {
        d.end()
    }

    var outgoing = {id: self.id, clock: self.sources}

    if (opts && opts.meta) outgoing.meta = opts.meta

    if (d.readable) {
        d._data(outgoing)
        if (!d.writable && !opts.clock)
            start({clock: {}})
    } else if (opts.sendClock) {
        d._data(outgoing)
    }
    self.once('dispose', dispose)
    return outer
}

sb.createWriteStream = function (opts) {
    opts = opts || {}
    opts.writable = true
    opts.readable = false
    return this.createStream(opts)
}

sb.createReadStream = function (opts) {
    opts = opts || {}
    opts.writable = false
    opts.readable = true
    return this.createStream(opts)
}

sb.dispose = function () {
    emit.call(this, 'dispose')
}

sb.setId = function (id) {
    if ('__proto__' === id)
        throw new Error('__proto__ is invalid id')
    if (id == null)
        throw new Error('null is not invalid id')
    this.id = id
    return this
}

function streamDone(stream, listener) {
    function remove() {
        stream.removeListener('end', onDone)
        stream.removeListener('error', onDone)
        stream.removeListener('close', onDone)
    }

    function onDone(arg) {
        remove()
        listener.call(this, arg)
    }

    onDone.listener = listener
    stream.on('end', onDone)
    stream.on('error', onDone)
    stream.on('close', onDone)
}

sb.clone = function () {
    var A = this
    var B = new (A.constructor)
    B.setId(A.id)
    A._clones = (A._clones || 0) + 1

    var a = A.createStream({wrapper: 'raw'})
    var b = B.createStream({wrapper: 'raw'})

    a.pause = b.parse = function noop() {
    }

    streamDone(b, function () {
        A._clones--
        emit.call(A, 'unclone', A._clones)
    })

    a.pipe(b).pipe(a)

    a.resume()
    b.resume()

    return B
}






