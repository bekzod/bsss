 var Bsss 	= require('./bsss'),
	s3Api   = require('./s3');

var App = exports = module.exports = function App (opts){
	this.s3   		 = s3Api(opts);
	this.openUploads = []; 
};

App.prototype.upload = function(path,options){
	if(!path) throw new Error("Path is required");
	var upload = new Bsss(path,this.s3,options);
	return upload;
};

App.prototype.destroy = function(){
	if(Array.isArray(this.openUploads)){
		this.openUploads.forEach(function(upload){
			upload.abort();
		});
	}
};