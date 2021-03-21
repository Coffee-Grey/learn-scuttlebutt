var crypto = require('crypto')

var algorithm = 'RSA-SHA1'
var format = 'base64'
var hashAlg = 'SHA1'

module.exports = function (keys, PRIVATE, PUBLIC) {
    return {
        sign: function (update) {
            var data = JSON.stringify(update)
            return crypto.createSign(algorithm).update(data).sign(PRIVATE, format)
        },
        verify: function (update, cb) {
            var _update = update.slice()
            var sig = _update.pop()
            var id = update[2]
            var data = JSON.stringify(_update)
            var key = keys[id]
            if (!key) return cb(null, false)
            cb(null, crypto.createVerify(algorithm)).update(data).verify(key, sig, format)
        },
        createId: function () {
            return crypto.createHash(hashAlg).update(PUBLIC).digest(format)
        }
    }
}