 var Bsss 	= require('./bsss'),
	s3Api   = require('./s3');

exports = module.exports = function(opts){
	var app  = {};
	app.s3   = s3Api(opts);

	app.upload = function(path,stream,options){
		if(!path)   throw new Error("Path is required");
		if(!stream) throw new Error("Stream is required");

		var upload = new Bsss(path,this.s3,options);	

		upload.on('ready',function(){	
			var leftover = null;
			stream.on('data',function(data){
				if(leftover){
					leftover+=data.toString('binary');
				}else {
					leftover = data.toString('binary');
				}
				leftover = upload.write(leftover);
				if(leftover) stream.pause();
			});

			stream.on('end',function(){
				upload.finish();
			});

			upload.on('drained',function(){
				stream.resume();
			});
		});
		return upload;
	};	

	return app;
};