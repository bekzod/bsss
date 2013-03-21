var fs = require('fs');
var stream = fs.createReadStream(__dirname+'/../data.mov');

var bsss = require('bsss')({
        key               : process.env.AWS_KEY,
        secret            : process.env.AWS_SECRET,
        bucket            : process.env.AWS_BUCKET,
        endPoint          : process.env.AWS_ENDPOINT,
});

var upload = bsss.upload('/path',stream);

upload.on('finished',function(){
	console.log("finished");
})