#!/usr/bin/env node

const axios = require('axios')
const httpsPromise = require('./lib/https-promise')
const querystring = require('querystring')
const url = require('url')
const fs = require('fs')
const fsPromises = require('./lib/fs-promise')

class BackupArcGISItem {

    constructor(itemId, dir, username, token) {

        if(!itemId || !dir || !username || !token ) {
            throw new Error('4 Parameters Required (ItemID, Working Directory Path, Username, Token)')
        }

        // MIN SIZE FOR NEW DOWNLOAD
        this._bytes = 100

        // ArcGIS Online account for storing item
        this.username = username
        this.token = token

        // original item in arcgis
        this.itemUrl = `https://www.arcgis.com/home/item?id=${itemId}`
        this.itemId = itemId
        this.itemDetails = undefined

        // tmp item in arcgis for download
        this.exportItemDetails = undefined

        // storage 
        this.workingDir = dir.slice(-1) == '/' ? dir.slice(0,-1) : dir

        
        // versioning
        this.duplicate = false
        
    }

    set bytes(val) {
        
        this._bytes = val

    } 

    // Given an itemId, return item details json
    // returns item details object
    async getItemDetails(itemId) {

        try {
            const response = await axios.get(`https://www.arcgis.com/sharing/rest/content/items/${itemId}?f=json&token=${this.token}/status`)
            if(response.data.error) {
                throw(response.data.error.message)
            }
            return response.data
        } catch (err) {
            process.exitCode = 1
            throw(err)
        }

    }

    // Given a jobId and itemId of new ArcGIS Item, returns new item details
    // returns item details object
    async getJobStatus(jobId, exportItemId) {
 
        const status_url = `https://www.arcgis.com/sharing/rest/content/users/${this.username}/items/${exportItemId}/status`
        const params = {
            token: this.token,
            jobType: 'export',
            f: 'json',
            jobId: jobId
        }

        try {
            const response = await axios({
                method: 'get',
                headers: {
                    'Content-Type': 'form-data'
                },
                url: status_url,
                params: params,
                responseType: 'json'
            })
      
            if(response.data.status !== 'completed') {
                return false
            }
            return response.data
        } catch (err) {
            throw(err)
        }
    }

    async exportItem() {

        return new Promise(async (resolve, reject) => {
            
            const username = this.itemDetails.owner
            const usercontent_url = `https://www.arcgis.com/sharing/rest/content/users/${this.username}/export`
    
            const params = {
                token: this.token,
                f: 'json',
                itemId: this.itemId,
                exportFormat: 'File Geodatabase',
                title: `${Date.now()}_${this.itemId}`
            }
    
            try {
    
                const response = await axios({
                    method: 'post',
                    headers: {
                        'Content-Type': 'form-data',
                    },
                    url: usercontent_url,
                    params: params,
                    responseType: 'json',
                })
        
                if(response.status == 200) {
    
                    var jobStatusResponse = false
                    var checkingId = setInterval( await checkResponse.bind(this), 1000)
    
                    async function checkResponse() {
                        jobStatusResponse = await this.getJobStatus(response.data.jobId, response.data.exportItemId)
            
                        if(jobStatusResponse) {
                            clearInterval(checkingId)
                            resolve(jobStatusResponse)
                        }
                    }
    
                } else {
                    throw('Problem Creating Export')
                }
            } catch (err) {
                process.exitCode = 1
                throw(err)
            }

        })

    }

    async downloadItem() {

        const download_url = `https://www.arcgis.com/sharing/rest/content/items/${this.exportItemDetails.id}/data?token=${this.token}`
        var archive_url = ''
        // get s3 signed URL for download
        try {

            const response = await axios.get(download_url)
            archive_url = `https://${response.request._headers.host}${response.request.path}`

        } catch (err) {

            throw(err)

        }
        
        const path = `${this.workingDir}/archive/tmp/${this.itemId}.zip`
        try {
            await httpsPromise(archive_url, path)

            // Get File Size and get returned size
            const tmpStats = await fsPromises.stat(path)

            return {
                tmpPath: path,
                tmpSize: tmpStats.size
            }
        } catch (err) {
            throw(err)
        }

    }

    async compareLatest(itemId, tmpSize) {

        // get latest file in directory
        const files = await fsPromises.readdir(`${this.workingDir}/archive/${itemId}`)
        files.sort()
        const latest = files[files.length - 1]
        const latestStats = await fsPromises.stat(`${this.workingDir}/archive/${itemId}/${latest}`)
        const latestSize = latestStats.size

        // ASSUMPTION -> NOT HASH COMPARISON... SET THRESHOLD
        if(Math.abs(tmpSize - latestSize) < this._bytes) {
            return true
        }
        return false

    }

    async deleteDownload(itemId) {

        const delete_url = `https://www.arcgis.com/sharing/rest/content/users/${this.username}/items/${this.exportItemDetails.id}/delete`

        const params = {
            token: this.token,
            f: 'json'
        }

        try {

            const response = await axios({
                method: 'post',
                headers: {
                    'Content-Type': 'form-data',
                },
                url: delete_url,
                params: params,
                responseType: 'json',
            })
    
            if(response.status == 200 && response.data.success) {
                return response.data
            } else {
                throw('Problem Deleting Item in ArcGIS Online')
            }
        } catch (err) {
            process.exitCode = 1
            throw(err)
        }
    }

    async run() {
      
        // check for archive and tmp directory
        const archiveExists = await fsPromises.exists(`${this.workingDir}/archive`)
        if(!archiveExists) {
            await fs.mkdir(`${this.workingDir}/archive`, (err) => {
                if(!(err && err.code === 'EEXIST')){
                    handleErr(err)
                } 
            })
        }
   
        const tmpExists = await fsPromises.exists(`${this.workingDir}/archive/tmp`)
        if(!tmpExists) {
            await fs.mkdir(`${this.workingDir}/archive/tmp`, (err) => {
                if(!(err && err.code === 'EEXIST')){
                    handleErr(err)
                } 
            })
        }
    
        this.itemDetails = await this.getItemDetails(this.itemId)
       
        const exportJob = await this.exportItem()
        this.exportItemDetails = await this.getItemDetails(exportJob.itemId)
  
        const {tmpPath, tmpSize} = await this.downloadItem(exportJob.itemId)

        // delete download item from agol
        await this.deleteDownload()

        const pathExists = await fsPromises.exists(`${this.workingDir}/archive/${this.itemId}`)
        const outFileName = `${this.workingDir}/archive/${this.itemId}/${Date.now()}.zip`

        if(pathExists) {
            // path already exists, check file sizes
            const exists = await this.compareLatest(this.itemId, tmpSize)
            if(!exists) {
                await fs.rename(tmpPath, outFileName, handleErr)
            } else {
                // no updates to file, duplicate
                this.duplicate = true
                await fs.unlink(tmpPath, handleErr)
            }
        } else {
            // async version is causing issues
            fs.mkdirSync(`${this.workingDir}/archive/${this.itemId}`, handleErr)
            await fs.rename(tmpPath, outFileName, handleErr)
        }

        return {
            filename: this.duplicate ? false : outFileName,
            itemDetails: this.itemDetails,
            duplicate: this.duplicate
        }

    }
}

function handleErr(err) {

    if(err) throw err

}

if(require.main == module) {

    // if run as node process
    if ( process.argv.length < 6 ) {
        console.log('ArcGIS Item URL, working directory path, username, and token required')
        console.log('example: backuparcgis-item https://www.arcgis.com/home/item.html?id=c31146ae5a7d4299a08dd4407526625d ./ {username} {token}')
        process.exitCode = 1
        return
    }

    const backup = new BackupArcGISItem(process.argv[2], process.argv[3], process.argv[4], process.argv[5])
    backup.run().then((resp) => {
        if(!resp.duplicate) {
            console.log(`${resp.itemDetails.title} completed: ${resp.filename}`)
        } else {
            console.log(`No updates to ${resp.itemDetails.title}.`)
        }
    }).catch((err) => {
        console.log(err)
    })
} else {
    // if run by require()
    module.exports = BackupArcGISItem
}