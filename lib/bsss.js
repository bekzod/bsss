var S3 = require('./s3');

var Bsss = module.exports = exports = function Bsss(options){
	this.storage = new S3(options);


}