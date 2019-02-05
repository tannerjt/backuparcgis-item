## backuparcgis-item
backuparcgis-item is a nodejs library used to backup items from ArcGIS Online (hosted feature services) items to a file geodatabase.

## About

Hosted Feature Services in ArcGIS Online are a great way to host and serve geospatial data into your online maps.  The infrastructure of ArcGIS Online has proven to be performant and highly available.  There is, however, always a chance your mission critical services will run into issues.  ArcGIS Online outages, accidental deletion, or service corruption can all happen.  It's best to be prepared and at least have a backup of your data on hand.

This library, *backuparcgis-item*, is a performant asynchronous streaming nodejs library that can be imported as a nodejs module or run directly from command line.

## Features

### Asynchronous 

backuparcgis-item is asynchronous and returns a promise when complete.

### Versioned

backuparcgis-item only stores a backup of the data if changes has been made.  It uses the file size of file geodatabase archives to dtermine if the source data has been altered.  The minimum threshold (in bytes) can be changed if neeeded.

### Streaming

backuparcgis-item streams feature service content directly to a file and does not store it in memory.  This allows the script to run faster and avoid memory issues with larger datasets.

## Use require()

```bash
$ npm install backuparcgis-item
```

```javascript
const BackupArcGISService = require('backuparcgis-item')

// new BackupArcGIS(itemId, archiveDirectory, username, ?token)
const Backup = new BackupArcGISService('682fac79087c4e159962444de9b823c5', outDir, username, token)

Backup.run().then((resp) => {
    if(!resp.duplicate) {
        console.log(`${resp.serviceDetails.title} completed: ${resp.filename}`)
    } else {
        console.log(`No updates to ${resp.serviceDetails.title}.`)
    }
})
```

## Run from command line

```bash
$ npm install backuparcgis-item --global
```

**Format:**

*backuparcgis-item serviceUrl archiveDirectory*

```bash
#!/bin/bash

backuparcgis-item 682fac79087c4e159962444de9b823c5 ./terminal john.appleseed jkfdla9udfajklsafjda9eu232-fds_fjdsla..
```

## Response

The library will respond with a promise with the following object:

```json
{
    "duplicate": "boolean",
    "itemDetails": "object",
    "filename": "string"
}
```

## File Storage Format

A new archive directory will be created in your specified output directory.  Within the archive directory, a new folder will be created for each feature service, which is named the same as the item id in ArcGIS Online.  Data will be versioned by timestamp, only storing new datasets that are different from the previous export (sha256 hash comparisons).

```
archive  
└───arcgis_item_id
    │--timestamp.zip
    │--timestamp.zip
```

## Change Minimum Size Change Threshold

This library compares file sizes (in bytes) to determine if updates have been made to the hosted feature service.  Under normal circumstances, I would use a cryptographic hash comparison, like `md5` or `sha256`.  However, file geodatabases containing the same content but created at different times will produce different unique hashes.  The default minimum byte threshold for determining if an item has been altered is `100 bytes`.  This can be changed by using the setter `bytes`.

Example:

```javascript
const BackupArcGISService = require('backuparcgis-item')

// new BackupArcGIS(serviceURL, archiveDirectory, username, ?token)
const Backup = new BackupArcGISService('682fac79087c4e159962444de9b823c5', outDir, username, token)

Backup.bytes = 250
```

Changing this value will ensure new versions are only created if the absolute value of the difference between the datasets is > 250 bytes.