var bytes  = require('bytes'),
	async  = require('async'),
	crypto = require('crypto'),
	S3     = require('./s3'),
	inherits =  require('util').inherits,
	EventEmitter = require('events').EventEmitter;


var Bsss = module.exports = exports = function Bsss(options){
	var self = this;
	if(!options.path)throw new Error('There is no Path');
	
	self.storage = S3(options);

	self.path           = options.path;
	self.retry 	     	= options.retry || 2;
	self.concurrency 	= options.concurrency || 3;
	self.integrityCheck = options.integrityCheck || false;
	self.bufferSize  	= bytes(options.bufferSize || '15mb');
	self.uploadId	  	= null;
	self.partsUploaded  = 0;
	
	self.buffer = new Buffer(self.bufferSize);
	
	self.uploadsQue = async.queue(function(opts,callback){
		if(opts.retries++ > self.retry){
			self.abort();
			callback();
			return;
		}
		self.storage.multipartUploadChunk(self.path,opts.partId,self.uploadId,opts.buffer,opts.hash,callback);
	},self.concurrency);

	self.uploadsQue.drain = function(){
		self.emit('drained');
	};

	self.addListener("newListener",function (event,listFunction) {
		if (event == "ready") {
			self.getReady();
		}
	});
};

inherits(Bsss, EventEmitter);


Bsss.prototype.getReady = function(){
	var self = this;
	self.storage.multipartInitiateUpload(self.path,function(err,uploadId){
		if(err || !uploadId){
			self.emit('error');
			self.abort();
		}
		self.uploadId = uploadId;
		self.emit('ready');
	});
};

Bsss.prototype.abort = function(){

};


Bsss.prototype._uploadBuffer= function(){
	var self = this;

	var opts = {};
	opts.buffer  = self.buffer;
	opts.hash    = self.integrityCheck ? self.getHash(self.buffer) : null;
	opts.partId  = self.partsUploaded++;
	opts.retries = 0;
	
	self.uploadsQue.push(opts,self.chunkUploadDone);
	
	self.buffer = null;
	self.buffer = new Buffer(self.bufferSize);
};

Bsss.prototype.chunkUploadDone= function(err,res){
	console.log(err,res);
}


Bsss.prototype.getHash=function(chunk){
	return crypto.createHash('sh1').update(chunk).digest('base64');
};

Bsss.prototype.write = function(chunk){
	var self = this;

	if(self.uploadsQue.length() < self.concurrency) {
		if((chunk.length + self.buffer.length) < self.bufferSize){
			this.buffer.write(chunk,'binary');
			return null;
		} else if (chunk.length){
			var buflen = self.buffer.length;
			var amountToBeFull = self.bufferSize - buflen;
			self.buffer.write(chunk.toString('utf8',0,amountToBeFull));
			async.nextTick(function(){self._uploadBuffer()});
			return chunk.slice(amountToBeFull,chunk.length);
		};
	};
	return chunk
};

Bsss.prototype.finish = function(){

};


