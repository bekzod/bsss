 var Bsss 	= require('./bsss'),
	s3Api   = require('./s3');

exports = module.exports = function(opts){
	var app  = {};
	app.s3   = s3Api(opts);

	app.upload = function(path,stream,options){
		if(!path)   throw new Error("Path is required");
		if(!stream) throw new Error("Stream is required");
		return new Bsss(path,this.s3,options);	
	};	

	return app;
};