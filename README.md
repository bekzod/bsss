BSSS
----
Multipart S3 file uploader, simultaneously uploads several parts. Buffers upload chunks until they are fully uploaded. The module might not be scalable but good for reliable upload to S3. 


Usage
----

```javascript

	var fs = require('fs');
	var stream = fs.createReadStream(__dirname+'/../data.mov');

	var bsss = require('bsss')({
			key               : process.env.AWS_KEY,
			secret            : process.env.AWS_SECRET,
			bucket            : process.env.AWS_BUCKET,
			endPoint          : process.env.AWS_ENDPOINT,
		})

	var upload = bsss.upload('/path',stream,{
			integrityCheck    : true,
			retry        	  : 3,
			concurrency  	  : 3,
			bufferSize        : '15mb'
		});
	
	upload.on("finished",function(){
		console.log('finished')
	});

```

