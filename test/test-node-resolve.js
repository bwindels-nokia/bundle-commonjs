/*jshint evil: false, bitwise:false, strict: false, undef: true, white: false, node:true, onevar: false */

var testCase = require('nodeunit').testCase;
var nodeResolve = require('../lib/node-resolve');

function mockFs(fs) {
    return {
        isFile: function(fileName, callback) {
            var fsEntry = fs[fileName];
                        console.log('isFile', fileName, !!fsEntry);

            return callback(!!fsEntry);
        },
        readFile: function(fileName, callback) {
            var fsEntry = fs[fileName];
            console.log('readFile', fileName, fsEntry);

            if(!fsEntry) {
                return callback(new Error('file not found: ' + fileName));
            }
            return callback(null, fsEntry);
        }
    };
}

module.exports = testCase({
    'test resolve absolute filename with extension': function(test) {
        var fs = mockFs({
            '/some/path/foo.js': 'var foo;'
        });
        var resolver = nodeResolve.createRequireResolve(fs).atBasePath('/some/path');
        resolver.resolve('/some/path/foo.js', function(err, fileName) {
            test.ifError(err);
            test.strictEqual(fileName, '/some/path/foo.js');
            test.done();
        });
    }
});