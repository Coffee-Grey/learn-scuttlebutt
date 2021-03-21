
var util = require('../util')
function main(){
    console.log(`util.createId() result ${util.createId()}`)

    var sources = new Array(5)
    sources[2]=1
    console.log(`util.filter(update, sources) result ${util.filter([0, 2, 3], sources)}` )

}

main()