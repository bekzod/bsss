var bytes        = require('bytes'),
    async        = require('async'),
    crypto       = require('crypto'),
    S3           = require('./s3'),
    inherits     = require('util').inherits,
    EventEmitter = require('events').EventEmitter;


var Bsss = module.exports = exports = function Bsss(options){
    var self = this;
    if(!options.path)throw new Error('There is no Path');

    self.s3 = S3(options);

    self.path             = options.path;
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

    self.uploadsQue = async.queue(function(opts,callback){
            self.s3.multipartUploadChunk(
                self.path,
                opts.partId,
                self.uploadId,
                opts.buffer,
                opts.hash,
                function(err,res){
                    opts.etag = res;
                    callback(err,opts);
            });

            // if(!self.retry){
            //     delete opts.buffer;
            //     delete opts.hash;
            // };

        },self.concurrency);

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
    // self.uploadsQue
};


Bsss.prototype._uploadBuffer= function(){
    var self = this;

    var opts = {};
    opts.buffer  = self.buffer.slice(0,self.dataInBuffer);
    opts.hash    = self.integrityCheck ? self.getHash(opts.buffer) : null;
    opts.partId  = 1+self.partsUploaded++;
    opts.retries = 0;
   
    self.uploadsQue.push(opts,function(err,res){
        self.chunkFinished(err,res,self);
    });

    self.buffer       = null;
    self.buffer       = new Buffer(self.bufferSize,'binary');
    self.dataInBuffer = 0;

    console.log("uploading",opts.partId,self.uploadsQue.length());
};

Bsss.prototype._singleUploadBuffer = function(){
    var self = this;
    self.s3.singleUpload(
        self.path,
        self.buffer.slice(0,self.dataInBuffer),
        self.integrityCheck ? self.getHash(self.buffer) : null,
        function(err,res){
            if(err)return self.emit('error');
            self.emit('finished');
        });
};

Bsss.prototype.chunkFinished = function(err,opts,self){
    console.log("chunk finish");
    if(err){
        if (opts.retries < self.retry){
            opts.retries++;
            self.uploadsQue.push(opts,function(err,res){
                self.chunkFinished(err,res,self);
            });
        } else {
            self.abort();
            self.emit('error');
        }
    } else {
        self.finishedUploads.push({
            etag: opts.etag,
            partId: opts.partId
        });

        if (self._isWriteFinished && self.finishedUploads.length == self.partsUploaded){
            self._finishMultiUpload();
        } else {          
            if(!self.uploadsQue.length())self.emit('drained');
        };
    };  
};

Bsss.prototype._write = function(chunk){
    var self = this;
    if(!chunk) return null;
    var amountToBeFull = self.bufferSize - self.dataInBuffer;
    if (amountToBeFull == 0) return chunk;

    if (chunk.length <= amountToBeFull){
        self.buffer.write(chunk,self.dataInBuffer,chunk.length,'binary');
        self.dataInBuffer +=chunk.length;
        return null;
    } else {
        self.buffer.write(chunk,self.dataInBuffer,amountToBeFull,'binary');
        self.dataInBuffer +=amountToBeFull;
        return chunk.slice(amountToBeFull);
    };        
};

Bsss.prototype.hasBufferFull = function(){
    return  this.dataInBuffer == this.bufferSize;
}

Bsss.prototype.write = function(chunk){
    var self = this;
    if(chunk && !self.uploadsQue.length()){
        if(self.hasBufferFull())self._uploadBuffer();
        return self.write(self._write(chunk));
    }
    return chunk;
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
        self.emit('finished');
     }
    );
}

Bsss.prototype.finish = function(){
    var self = this;

    if(self._isWriteFinished)return;
    self._isWriteFinished = true;
    
    if(self.partsUploaded > 0){
        if(self.dataInBuffer > 0){
            self._uploadBuffer();
        }else if(self.finishedUploads.length == self.partsUploaded){
            self._finishMultiUpload();
        }
    }else{
        if(self.dataInBuffer)self._singleUploadBuffer();
        else self.emit('finish');
    }

};


