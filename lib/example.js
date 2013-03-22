var fs = require('fs');
var stream = fs.createReadStream(__dirname+'/../data.mov');

var bsss = require('bsss')({
        key               : process.env.AWS_KEY,
        secret            : process.env.AWS_SECRET,
        bucket            : process.env.AWS_BUCKET,
        endPoint          : process.env.AWS_ENDPOINT
});

var upload = bsss.upload('/path',stream,{
	concurrency:2
});

var time = Date.now();

upload.on('ready',function(){	
	stream.on('data',function(data){
		if(!upload.write(data.toString('binary')))stream.pause();
	});

	stream.on('end',function(){
		upload.finish();
	});
});

upload.on('drain',function(){
	stream.resume();
});

upload.on('end',function(){
	console.log("finished",(Date.now()-time)/1000/60/60);
});