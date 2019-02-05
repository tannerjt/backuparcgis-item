const BackupArcGISService = require('../index.js')
const axios = require('axios')
require('dotenv').config()

if(require.main == module) {
    axios({
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        url: 'https://www.arcgis.com/sharing/rest/generateToken',
        params: {
            'username': `${process.env.ARCGIS_USERNAME}`,
            'password': `${process.env.ARCGIS_PASSWORD}`,
            'referer': 'localhost',
            'f': 'json'
        },
        responseType: 'json',
    }).then(function (response) {
        if(!response.data.token) {
            console.log('No Token Returned.  Check Credentials')
        } else {
            const outDir = './secure'
            const Backup1 = new BackupArcGISService('682fac79087c4e159962444de9b823c5', outDir, process.env.ARCGIS_USERNAME, response.data.token)
            Backup1.run().then((resp) => {
                if(!resp.duplicate) {
                    console.log(`${resp.itemDetails.title} completed: ${resp.filename}`)
                } else {
                    console.log(`No updates to ${resp.itemDetails.title}.`)
                }
            }).catch((err) => {
                console.log(err)
            })

            const Backup2 = new BackupArcGISService('c31146ae5a7d4299a08dd4407526625d', outDir, process.env.ARCGIS_USERNAME, response.data.token)
            Backup2.run().then((resp) => {
                if(!resp.duplicate) {
                    console.log(`${resp.itemDetails.title} completed: ${resp.filename}`)
                } else {
                    console.log(`No updates to ${resp.itemDetails.title}.`)
                }
            })
        }
    })
    
}