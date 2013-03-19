var	request  = require ('request'),
	xmlParser = require ("xml2json");


module.exports = exports = function (options){
	var S3 = self = {};

	self.debug = options.debug ||function(){};

	if (!options.key)throw new Error('There is no key');
	if (!options.secret)throw new Error('There is no secret');
	if (!options.bucket)throw new Error('There is no bucket');
	options.endPoint = (options.endPoint || 's3.amazonaws.com');

	var credantials = {
		key      : options.key,
		secret   : options.secret,
		bucket   : options.bucket
	};

	self.awsPath ="https://"+options.bucket+'.'+options.endPoint;

	request = request.defaults({
		aws : credantials,
		jar : false
	});

	S3.singleUpload = function (path,buffer,bufferHash,callback) {
		self.awsRequest('PUT',path,buffer,bufferHash,function(err,res,json){
			if (err)return callback(err);
			if (res.statusCode!=200)return callback(new Error("Error"));

			var etag = res.headers["etag"];
			if (etag && etag.length > 0) callback(null,etag);
			else callback(new Error("ERROR"));
		});
	};

	S3.multipartInitiateUpload = function(path,callback) {
		path+='?uploads';
		self.awsRequest('POST',path,null,null,function(err,res,json){
			if (err) return callback(err);
			if (!json) return callback(new Error("Error"));
			if (res.statusCode!=200) return callback(json);

			var uploadID = json["InitiateMultipartUploadResult"]["UploadId"];
			if (uploadID && uploadID.length > 0){
				callback(null,uploadID);
			} else {
				callback(new Error("Error"));
			}
		});
	};

	S3.awsRequest = function (method,path,body,bodyHash,callback) {	
		callback = callback || function(){};

		var headers = {};
		headers['date'] = new Date().toUTCString();
		if (body) headers['content-length']  = body.length;
		if (bodyHash) headers['content-md5'] = bodyHash;

		var connectionOptions = {
			uri 	 : (self.awsPath+path),
			body  	 : body,
			method   : method,
			headers  : headers,
			encoding : 'utf8'
		};

		return request(connectionOptions,function(err,res,body){
			if (err) return callback(err);
			var JSONValue = null;	
			if(body){
				try { 
					JSONValue = xmlParser.toJson(body,{object:true});
				} catch(error) { 
					return callback(error);
				};			
			};
			callback(null,res,JSONValue);
		});
	};

	S3.multipartUploadChunk = function (path,partNumber,uploadID,buffer,bufferHash,callback) {
		path += '?partNumber=' + partNumber + '&uploadId=' + uploadID;

		self.awsRequest('PUT',path,buffer,bufferHash,function(err,res,json){
			if (err)return callback(err);
			if (res.statusCode!=200)return callback(new Error("Error Chunk"),json);

			var etag = res.headers["etag"];
			if (etag && etag.length > 0) callback(null,etag);
			else callback(new Error("ERROR"));
		});
	}

	S3.multipartAbortUpload = function (path,uploadID,callback) {
		path+='?uploadId=' + uploadID;

		this.awsRequest('DELETE',path,body,bodyHash,function(err,res,json){
			if (err)return callback(err);
			if (res.statusCode!=204)return callback(new Error("Error"));
			callback(null,json);
		});
	}


	S3.multipartCompleteUpload = function (path,uploadID,partsRef,callback) {
		path+='?uploadId=' + uploadID;
		var body = self.formatCompleteBodyXML(partsRef);
		self.awsRequest('POST',path,body,null,function(err,res,json){
			if (err)return callback(err);
			if (res.statusCode!=200)return callback(new Error("Error Couldn't Complete MultiPart Upload"));
			callback(null,json);
		});
	};

	/**
	* Format AWS Complete Upload Body (Should be used for all MultipartCompleteUpload request)
	*
	* Amazon Docs: http://docs.amazonwebservices.com/AmazonS3/latest/API/mpUploadComplete.html
	*
	* @param array partsRef - Should be all part reference in array, with part number and etag as `[{PartNumber:1,ETag:009},{PartNumber:2,ETag:007}]` - REQUIRED
	**/
	S3.formatCompleteBodyXML = function (partsRef) {
		if(!partsRef || !partsRef.length) return null;
		var xml = "<CompleteMultipartUpload>";
		for (var i = 0; i < partsRef.length; i++) {
			xml += "<Part><PartNumber>" + partsRef[i].partId + "</PartNumber><ETag>" + partsRef[i].etag + "</ETag></Part>";
		}
		xml+="</CompleteMultipartUpload>"; 
		return xml;
	};
	
	return S3;
}