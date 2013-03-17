var bytes  = require('bytes'),
	async  = require('async'),
	crypto = require('crypto'),
	S3     = require('./s3'),
	inherits =  require('util').inherits,
	EventEmitter = require('events').EventEmitter;


var Bsss = module.exports = exports = function Bsss(options){
	var self = this;
	self.storage = S3(options);
	
	self.retry 	     	= options.retry || 2;
	self.concurrency 	= options.concurrency || 3;
	self.integrityCheck = options.integrityCheck || false;
	self.bufferSize  	= bytes(options.bufferSize || '15mb');
	self.uploadID    	= null;
	self.partsUploaded  = 0;
	self.path           = options.path;
	
	self.buffer = new Buffer(self.bufferSize);
	
	self.uploads = async.queue(self._uploader,self.concurrency);
	self.uploads.drain = function(){
		self.emit('drained');
	};
};


inherits(Bsss, EventEmitter);

Bsss.prototype.getReady = function(){
	S3.multipartInitiateUpload(self.path,function(err,uploadId){
		if(err || !uploadId){
			self.emit('error');
			self.abort();
		}
		self.uploadId = uploadId;
		self.emit('ready');
	});
}

Bsss.prototype.abort = function(){

}


Bsss.prototype._uploader = function(opts,callback){
	var self = this;
	if(opts.retries++ > self.retry){
		self.abort();
		callback();
		return
	}

	S3.multipartUploadChunk(self.path,opts.partId,self.uploadId,opts.buffer,opts.hash,function(err,res){
		if(err)callback()
	})
};


Bsss.prototype._uploadBuffer= function(){
	var self = this;

	var opts = {};
	opts.buffer  = self.buffer;
	opts.hash    = self.integrityCheck ? self.getHash(self.buffer) : null;
	opts.partId  = self.partsUploaded++;
	opts.retries = 0;
	
	self.uploads.push(opts);
	
	self.buffer = null;
	self.buffer = new Buffer(self.bufferSize);
}

Bsss.prototype.getHash=function(chunk){
	return crypto.createHash('sh1').update(chunk).digest('base64')
}

Bsss.prototype.write = function(chunk){
	if(uploads.length < this.concurrency) {
		if((chunk.length + buffer.length) < this.bufferSize){
			this.buffer.write(chunk);
			return null;
		} else if (chunk.length){
			var buflen = this.buffer.length;
			var amountToBeFull = this.bufferSize - buflen;
			this.buffer.write(chunk,buflen,amountToBeFull);
			this._uploadBuffer();
			return chunk.slice(amountToBeFull,chunk.length);
		};
	}
	return chunk
};

Bsss.prototype.finish = function(){

};


