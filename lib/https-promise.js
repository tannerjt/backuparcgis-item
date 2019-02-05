const https = require('https')
const fs = require('fs')

function httpsPromise(url, path) {
    const outfile = fs.createWriteStream(path)
    return new Promise(function(resolve, reject) {
        var req = https.get(url, function (res) {
            res.pipe(outfile)

            res.on('end', function () {
                resolve()
            })
        })

        req.on('error', function (err) {
            reject(err)
        })

        req.end()
    })
}

module.exports = httpsPromise