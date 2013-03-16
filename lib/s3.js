var	util     = require ('util'),
	request  = require ('request'),
	xml2json = require ("node-xml2json")

var S3 = module.exports = exports = function S3 (options){	
	this.debug = options.debug ||function(){};

	if (!options.key)throw new Error('There is no key');
	if (!options.secret)throw new Error('There is no secret');
	if (!options.bucket)throw new Error('There is no bucket');

	this.aws={
		key      : options.key,
		secret   : options.secret,
		bucket   : options.bucket
		endPoint : options.endPoint || 'aws.amazonaws.com' 
	};
}


S3.prototype.singleUpload = function (name,buffer,bufferHash,callback) {
	var path = encodeURI( '/' + objectName );
	this.awsRequest('PUT',path,buffer,bufferHash,function(err,res,json){
		if (err) callback(err)
		if (res.statusCode!=200) callback(new Error("ERROR"));
		var etag = res.headers["etag"];
		if (etag && etag.length > 0) callback(null,eTag);
	})
}

S3.prototype.awsRequest = function (method,path,body,bodyHash,callback) {	
	var self = this;
	callback = callback || function(){}

	var headers = {};
	headers['date'] = new Date().toUTCString();
	if (hashBody) headers['content-md5']    = bodyHash;
	if (bodyData) headers['content-length'] = body.length; 

	var connectionOptions = {
		uri: {
			pathname : path
			hostname : this.aws.endPoint
			protocol : 'https'
		},
		body  	 : body,
		aws      : this.aws,
		path     : connectionPath,
		method   : method,
		headers  : headers
		encoding : 'utf8'
	}

	return request(connectionOptions,function(err,res,body){
		if (err) return callback(err);
		var JSONValue = null;
		try { 
			JSONValue = xml2json.parser(body);
		} catch(error) { return callback(error);}
		callback(null,res,JSONValue);
	});
}


/**
* Format AWS Complete Upload Body (Should be used for all MultipartCompleteUpload request)
*
* Amazon Docs: http://docs.amazonwebservices.com/AmazonS3/latest/API/mpUploadComplete.html
*
* @param array partsRef - Should be all part reference in array, with part number and etag as `[{PartNumber:1,ETag:009},{PartNumber:2,ETag:007}]` - REQUIRED
**/
S3.prototype.formatCompleteBodyXML = function (partsRef) {
	var xmlBodyString = "";
	for (var i = 0; i < partsRef.length; i++) {
		xmlBodyString += "<Part><PartNumber>" + partsRef[i]["PartNumber"] + "</PartNumber><ETag>" + partsRef[i]["ETag"] + "</ETag></Part>";
	}
	//Check if have body, closes XML string with 'CompleteMultipartUpload' key as below
	if (partsRef.length > 0 && xmlBodyString && xmlBodyString.length > 0) { 
		xmlBodyString = "<CompleteMultipartUpload>" + xmlBodyString + "</CompleteMultipartUpload>"; 
		return xmlBodyString;
	}
	return null;
}