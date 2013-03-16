var bytes = require('bytes'),
	async = require('async'),
	S3    = require('./s3'),
	inherits =  require('util').inherits,
	EventEmitter = require('events').EventEmitter;


var Bsss = module.exports = exports = function Bsss(options){
	var self = this;
	self.storage = S3(options);
	
	options.bufferSize = options.bufferSize || '15mb'

	options.retry 			  = options.retry || 2;
	options.uploadConcurrency = options.uploadConcurrency || 3;
	
	self.retry      = (options.bufferSize);
	self.bufferSize = bytes(options.bufferSize);
	self.buffer     = new Buffer(self.bufferSize);
	
	self.uploads    = aysnc.queue(_uploader,options.uploadConcurrency);
	self.uploads.drain = function(){
		self.emit('drained')
	}
};

inherits(Bsss, EventEmitter);


Bsss.prototype._uploader = function(opts,callback){

};

Bsss.prototype.write = function(chunk){
	if(uploads.length > options.uploadConcurrency) return false;
	if((chunk.length + buffer.length)>this.bufferSize){

	}
};

