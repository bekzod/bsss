var fs = require('fs');
var stream = fs.createReadStream(__dirname+'/../data.mov');



var Bsss = require('./bsss');

var storage = new Bsss({
	path     : "/content/text.txt",
	key      : process.env.AWS_KEY,
	secret   : process.env.AWS_SECRET,
	bucket   : process.env.AWS_BUCKET,
	endPoint : process.env.AWS_ENDPOINT
});

storage.on('ready',function(){
	console.log("ready");

	stream.on('data',function(data){
		size += data.length;	
		stream.pause();
		leftover = storage.write(data);
	})
});

storage.on('drained',function(){
	console.log("drained");
});


var leftover = null
var size = 0



// storage.multipartInitiateUpload("/content/dwad.txt",function(err,uploadId){

// })

// storage.singleUpload("/content/dwdwadawad.txt","dawdwadaw",null,function(err,res){
// 	console.log(err,res);
// })
