
var NLB = new Buffer('\n');
var NLB_LEN = NLB.length;

module.exports = parseStream;

function parseStream(stream, cb) {
  var removeParser;
  var promise = new Promise(function(resolve, reject) {
    var b = new Buffer(0);
    var bi = 0;
    var bl = 0;
    var i = 0;
    var lines = [];

    stream.on('data', onData);
    stream.once('end', onEnd);

    function onData(d) {
      b = Buffer.concat([b, d]);
      parseBuffer();
    }

    function onEnd() {
      cleanup();
      resolve();
    }

    function cleanup() {
      stream.removeListener('data', onData);
      parseBuffer(true);
      // Trigger GC for everything.
      b = null;
      bi = null;
      bl = null;
      i = null;
      lines = null;
      // And I mean really everything
      removeParser = null;
      promise.removeParser = null; // Yes, everything. And break bad code too.
      promise = null;
    }

    function parseBuffer(flush) {
      bl = b.length;
      i = bi;
      while(i < bl) {
        if(b.slice(i, i+NLB_LEN).compare(NLB) === 0) {
          lines.push(b.slice(0, i+NLB_LEN));
          b = b.slice(i+NLB_LEN);
          bl = b.length;
          i = bi = 0;
        }
        ++i;
      }
      bi = i;
      if(flush) {
        lines.push(b.slice(0));
        b = new Buffer(0);
        bi = 0;
        bl = 0;
        i = 0;
      }
      emitLines(lines);
    }

    function emitLines(lines) {
      var strb = [];
      var data;
      while(lines.length) {
        data = lines.shift();
        try {
          data = JSON.parse(data.toString());
        } catch(err) {
          strb.push(data);
          continue;
        }
        if(strb.length) {
          cb(Buffer.concat(strb));
          strb.splice(0, strb.length);
        }
        cb(data);
      }
      if(strb.length) {
        cb(Buffer.concat(strb));
      }
      strb = null;
      data = null;
    }

    function unbind() {
      stream.removeListener('end', onEnd);
      cleanup();
      resolve(true);
    }

    removeParser = unbind;
  });

  promise.removeParser = function() {
    removeParser();
  };

  return promise;
}
