/*
 *
 * Folders.io provider: in-memory file system.
 *
 */

var fs = require('fs');
var path = require('path');

var MemoryFio = function(fio, prefix) {
  this.fio = fio;
  this.prefix = prefix || "/http_window.io_0:memory/";
};
module.exports = MemoryFio;

MemoryFio.prototype.normalizePath = function(o) {
  var prefix = this.prefix;
  var op = o.path;
  if(o.path != null && o.path.indexOf('@') > -1) {
    var preuri = o.path.substr(o.path.indexOf('@')+1).substr(prefix.length);
    o.path = preuri;
  }
  console.log({prefix: prefix, op: op, path: o.path, pre: preuri});
  var uri = path.resolve(path.normalize(o.path || "."));
  return uri;
};

MemoryFio.prototype.cat = function(data, cb) {

  var o = data.data;
  o.path = o.fileId;

  // FIXME: This method is repeated often and is fragile.
  var uri = this.normalizePath(o);

  cat(uri, function(result, err) {
    var headers = {
      "Content-Length": result.size,
      "Content-Type": "application/octet-stream",
      "X-File-Type": "application/octet-stream",
      "X-File-Size": result.size,
      "X-File-Name": result.name
    };
    cb({streamId: o.streamId, data: result.stream, headers: headers, shareId: data.shareId });
  });
};

MemoryFio.prototype.write = function(data, cb) {
	var stream = data.data;
	//var headers = data.headers;
	var streamId = data.streamId;
	var shareId = data.shareId;
	var uri = data.uri;

	var headers = {
		"Content-Type" : "application/json"
	};

	write(uri, stream, function(result, err) {
		cb({
			streamId : streamId,
			data : result,
			headers : headers,
			shareId : shareId
		});
	});
};

MemoryFio.prototype.ls = function(uri, cb) {
  var self = this;

  uri = path.resolve(path.normalize(uri || "."));

// FIXME: Not implemented yet.

  fs.stat(uri, function(err, stats) {
    if(err) {
      cb(null, err);
      return;
    }
    if(!stats.isDirectory()) {
      var results = self.asFolders(uri, [stats]);
      cb(results);
      return;
    }
    fs.readdir(uri, function(err, files) {
      var results = self.asFolders(uri, files);
      cb(results);
    });
  });
};

MemoryFio.prototype.meta = function(uri, files, cb) {
  if(files === null) { cb(null, "files not found"); return; }
  var latch = files.length;
  // TODO: Limit the number of active stat calls.
  for(var i = 0; i < files.length; i++) {
    (function(i) {
    fs.stat(path.resolve(uri, files[i].name), function(err, stats) {
      latch--;
      files[i].modificationTime = +stats.mtime;
      if(stats.isDirectory()) {
        files[i].extension = '+folder';
        files[i].type = "";
      } else {
        files[i].size = stats.size;
      }
      if(latch == 0) {
        cb(files);
      }
      // else console.log("progress " + latch);
    })})(i);
  }
};

// Convert from a node.js readdir result to a folders.io record.
MemoryFio.prototype.asFolders = function(dir, files) {
  var out = [];
  for(var i = 0; i < files.length; i ++) {
    var file = files[i];
    var o = { name: file };
    o.fullPath = path.relative('.', path.resolve(dir, o.name));
    o.uri = "#" + this.prefix + o.fullPath;
    o.size = 0;
    o.extension = "txt";
    o.type = "text/plain";
    o.modificationTime = +new Date();
    out.push(o);
  }
  return out;
};

var cat = function(uri, cb) {
    if(!(uri in fileSystem)) {
      cb(null, {error: "not found"});
      return;
    }
    // cb(null, "refused to cat directory");
    var size = fileSystem[uri].size;
    var name = path.basename(uri);
    // FIXME: Adapt BufferStream to handle arrays of buffer.
    cb({stream: new BufferStream(fileSystem[uri].data), size: size, name: name});
};

var fileSystem = {};

var write = function(uri, data, cb) {
	// NOTES: uri could be setup to be a destination pipe, such as piped writable in Java
	var len = 0; var chunks = [];
	data.on('data', function(chunk) {
		console.log('got %d bytes of data',
		len += chunk.length;
		chunks.push(data);
	});
	data.on('end', function() {
		fileSystem[uri] = { size: len, data: chunks };
		cb(null, "write uri success");
	});
};
