var Bsss 	= require('./bsss'),
	s3Api   = require('./s3');

exports = module.exports = function(opts){
	var app  = {};
	app.s3   = s3Api(opts);
	
	app.opts = {};
	app.opts.retry          = opts.retry;
	app.opts.concurrency    = opts.concurrency;
	app.opts.integrityCheck = opts.integrityCheck;
	
	app.upload = function(path){
		return new Bsss(path,this.s3,this.opts);
	};	
	return app;
};