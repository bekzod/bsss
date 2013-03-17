var Bsss = require('./bsss');

var storage = new Bsss({
	key      : process.env.AWS_KEY,
	secret   : process.env.AWS_SECRET,
	bucket   : process.env.AWS_BUCKET,
	endPoint : process.env.AWS_ENDPOINT
});



storage

// storage.multipartInitiateUpload("/content/dwad.txt",function(err,uploadId){

// })

// storage.singleUpload("/content/dwdwadawad.txt","dawdwadaw",null,function(err,res){
// 	console.log(err,res);
// })
