var bytes  = require('bytes')
	async  = require('async'),
	crypto = require('crypto'),
	S3     = require('./s3'),
	inherits =  require('util').inherits,
	EventEmitter = require('events').EventEmitter;


var Bsss = module.exports = exports = function Bsss(options){
	var self = this;
	if(!options.path)throw new Error('There is no Path');

	self.storage = S3(options);

	self.path             = options.path;
	self.retry 	     	  = options.retry || 2;
	self.concurrency 	  = options.concurrency || 3;
	self.integrityCheck   = options.integrityCheck || false;
	self.bufferSize  	  = bytes(options.bufferSize || '15mb');
	self.uploadId	  	  = null;
	self.partsUploaded    = 1;
	self.buffer 		  = new Buffer(self.bufferSize);
	self.finishedUploads  = [];
	self._isWriteFinished = false; 
	
	self.uploadsQue = async.queue(function(opts,callback){
			self.storage.multipartUploadChunk(
				self.path,
				opts.partId,
				self.uploadId,
				opts.buffer,
				opts.hash,
				function(err,res){
					if(err) callback(err,opts);
					opts.etag = res;
					callback(null,opts);
			});
		},self.concurrency);
 
	self.once("newListener",function (event,listFunction) {
		if (event == "ready") self._getReady();
	});
};

inherits(Bsss, EventEmitter);


Bsss.prototype._getReady = function(){
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
	// self.uploadsQue
};


Bsss.prototype._uploadBuffer= function(){
	var self = this;

	var opts = {};
	opts.buffer  = self.buffer;
	opts.hash    = self.integrityCheck ? self.getHash(self.buffer) : null;
	opts.partId  = self.partsUploaded++;
	opts.retries = 0;
	
	self.uploadsQue.push(opts,self.chunkFinished);
	
	self.buffer = null;
	self.buffer = new Buffer(self.bufferSize);
	if(self.uploadsQue.length() < self.concurrency) self.emit('drained');
};

Bsss.prototype.chunkFinished = function(err,opts){
	var self = this;
	if(err){
		if(opts.retries > self.retry){
			self.emit('error');
			self.abort();
		}else{
			opts.retries++;
			self.uploadsQue.push(opts,self.chunkFinished);
		}
	}else{
		self.finishedUploads.push({
			etag: opts.etag,
			partId: opts.partId
		});

		if(_isWriteFinished){
			self._finish();
		}else{			
			if(self.uploadsQue.length() < self.concurrency )self.emit('drained');
		}
	}
}


Bsss.prototype.getHash=function(chunk){
	return crypto.createHash('sh1').update(chunk).digest('base64');
};

Bsss.prototype.write = function(chunk){
	var self = this;

	if(self.uploadsQue.length() < self.concurrency) {
		if((chunk.length + self.buffer.length) < self.bufferSize){
			self.buffer.write(chunk);
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

Bsss.prototype._finish = function(){
	var self = this;		
	self.storage.multipartCompleteUpload(self.path,self.uploadId,self.finishedUploads,function(err,res){
		console.log(err,res);
		self.emit('finished');
	});
}

Bsss.prototype.finish = function(){
	var self = this;
	if(self._isWriteFinished)return;

	if(self.buffer.length()) self._uploadBuffer();
	else self._finish();
};


