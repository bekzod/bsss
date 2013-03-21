 var Bsss 	= require('./bsss'),
	s3Api   = require('./s3');

exports = module.exports = function(opts){
	var app  = {};
	app.s3   = s3Api(opts);

	app.upload = function(path,options){
		if(!path) throw new Error("Path is required");
		var upload = new Bsss(path,this.s3,options);	
		return upload;
	};	

	return app;
};