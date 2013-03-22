var bytes        = require('bytes'),
    crypto       = require('crypto'),
    Queue        = require('queue'),
    inherits     = require('util').inherits,
    EventEmitter = require('events').EventEmitter;


var Bsss = module.exports = exports = function Bsss(path,s3,options){
    var self = this;

    if(!s3)   throw new Error('Missing S3');
    if(!path) throw new Error('Missing path');

    options || (options = {});

    self.path             = path;
    self.s3               = s3;
    
    self.retry            = options.retry || 1;
    self.concurrency      = options.concurrency || 3;
    self.integrityCheck   = options.integrityCheck || false;
    self.bufferSize       = bytes(options.bufferSize || '15mb');

    self.uploadId         = null;
    self.partsUploaded    = 0;
    self.dataInBuffer     = 0;
    self.buffer           = new Buffer(self.bufferSize,'binary');
    self.finishedUploads  = [];
    self._isWriteFinished = false; 
    self.requests         = {};

    self.uploadsQue = new Queue(self.concurrency);

    self.once("newListener",function (event,listFunction) {
        if (event == "ready") self._getReady();
    });
};

inherits(Bsss, EventEmitter);

Bsss.prototype._getReady = function(){
    var self = this;
    self.s3.multipartInitiateUpload(self.path,function(err,uploadId){
        if(err || !uploadId){
            self.emit('error');
            self.abort();
        }
        self.uploadId = uploadId;
        self.emit('ready');
    });
};


Bsss.prototype.abort = function(){
    var self = this;

    if(self._isAborted) return ;
    self._isAborted = true;
    self._isWriteFinished = true;

    for(var prop in obj){if(obj.hasOwnProperty('abort'))obj.abort();}

    self.requests = null;
    self.buffer   = null;
    self.emit('aborted');
};


Bsss.prototype._pushToQue = function(opts){
    var self = this;
    self.uploadsQue.push(
        function(cb){
            self.requests[self.partsUploaded]=self.s3.multipartUploadChunk(
                    self.path,
                    opts.partId,
                    self.uploadId,
                    opts.buffer,
                    opts.hash,
                    function(err,res){
                        cb();
                        opts.etag = res;
                        self.chunkFinished(err,opts,self);
                    }
            );
        }
    );
}

Bsss.prototype._uploadBuffer = function(){
    var self = this;

    var opts = {};
    opts.buffer  = self.buffer.slice(0,self.dataInBuffer);
    opts.hash    = self.integrityCheck ? self.getHash(opts.buffer) : null;
    opts.partId  = 1+self.partsUploaded++;
    opts.retries = 0;

    self._pushToQue(opts);

    self.buffer       = null;
    self.buffer       = new Buffer(self.bufferSize,'binary');
    self.dataInBuffer = 0;

    console.log("uploading",opts.partId,self.uploadsQue.active.length);
};



Bsss.prototype.chunkFinished = function(err,opts,self){
    console.log("chunk finish");
    self.requests[opts.partId] = null;

    if(err){
        if (opts.retries < self.retry){
            opts.retries++;
            self._pushToQue(opts);
        } else {
            self.abort();
            self.emit('error');
        }
    } else {
        self.finishedUploads.push({
            etag: opts.etag,
            partId: opts.partId
        });
        if(self._isWriteFinished && self.hasUploadsFinished())self._finish();
        else if(self.uploadsQue.active.length < self.concurrency)self.emit('drain');
    };  
};

Bsss.prototype.hasUploadsFinished= function(){
    var self = this;
    return self.finishedUploads.length == self.partsUploaded;
};

Bsss.prototype._write = function(chunk){
    var self = this;
    if(!chunk) return;
    var amountToBeFull = self.bufferSize - self.dataInBuffer;
    if (chunk.length < amountToBeFull){
        self.buffer.write(chunk,self.dataInBuffer,chunk.length,'binary');
        self.dataInBuffer +=chunk.length;
    } else {
        if(amountToBeFull){
            self.buffer.write(chunk,self.dataInBuffer,amountToBeFull,'binary');
            self.dataInBuffer +=amountToBeFull;
        }
        self._uploadBuffer();
        self._write(chunk.slice(amountToBeFull));
    };        
};

Bsss.prototype.hasBufferFull = function(){
    return  this.dataInBuffer == this.bufferSize;
}


Bsss.prototype.write = function(chunk){
    var self = this;
    self._write(chunk);
    return self.uploadsQue.active.length < self.concurrency;
};

Bsss.prototype.getHash = function(chunk){
    return crypto.createHash('md5').update(chunk).digest('base64');
};


Bsss.prototype._finishMultiUpload = function(){
    var self = this;
    self.s3.multipartCompleteUpload(
        self.path,
        self.uploadId,
        self.finishedUploads,
        function(err,res){
            if(err) return self.emit('error');
            self.emit('end');
        }
    );
}

Bsss.prototype._singleUploadBuffer = function(){
    var self = this;
    self.s3.singleUpload(
        self.path,
        self.buffer.slice(0,self.dataInBuffer),
        self.integrityCheck ? self.getHash(self.buffer) : null,
        function(err,res){
            if(err)return self.emit('error');
            self.emit('end');
        }
    );
};

Bsss.prototype._finish = function(){
    var self = this;
    if(self.partsUploaded > 0){
        if(self.dataInBuffer > 0){
            self._uploadBuffer();
        }else if(self.finishedUploads.length == self.partsUploaded){
            self._finishMultiUpload();
        }
    }else{
        if(self.dataInBuffer)self._singleUploadBuffer();
        else self.emit('end');
    }
}

Bsss.prototype.finish = function(){
    var self = this;
    if(self._isWriteFinished || self._isAborted)return;
    self._isWriteFinished = true;
    if(self.hasUploadsFinished)self._finish();
};


