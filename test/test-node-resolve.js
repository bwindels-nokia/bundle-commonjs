/*jshint evil: false, bitwise:false, strict: false, undef: true, white: false, node:true, onevar: false */

var testCase = require('nodeunit').testCase;
var nodeResolve = require('../lib/node-resolve');

function mockFs(fs) {
    return {
        isFile: function(fileName, callback) {
            var fsEntry = fs[fileName];
            return callback(!!fsEntry);
        },
        readFile: function(fileName, callback) {
            var fsEntry = fs[fileName];
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
    },
    'test resolve absolute filename without extension': function(test) {
        var fs = mockFs({
            '/some/path/foo.js': 'var foo;'
        });
        var resolver = nodeResolve.createRequireResolve(fs).atBasePath('/some/path');
        resolver.resolve('/some/path/foo', function(err, fileName) {
            test.ifError(err);
            test.strictEqual(fileName, '/some/path/foo.js');
            test.done();
        });
    },
    'test resolve relative filename without extension': function(test) {
        var fs = mockFs({
            '/some/path/foo.js': 'var foo;'
        });
        var resolver = nodeResolve.createRequireResolve(fs).atBasePath('/some/path');
        resolver.resolve('../path/foo', function(err, fileName) {
            test.ifError(err);
            test.strictEqual(fileName, '/some/path/foo.js');
            test.done();
        });
    },
    'test resolve absolute directory name': function(test) {
        var fs = mockFs({
            '/some/path/index.js': 'var foo;'
        });
        var resolver = nodeResolve.createRequireResolve(fs).atBasePath('/');
        resolver.resolve('/some/path', function(err, fileName) {
            test.ifError(err);
            test.strictEqual(fileName, '/some/path/index.js');
            test.done();
        });
    },
    'test resolve relative directory name': function(test) {
        var fs = mockFs({
            '/some/path/index.js': 'var foo;'
        });
        var resolver = nodeResolve.createRequireResolve(fs).atBasePath('/some');
        resolver.resolve('./path', function(err, fileName) {
            test.ifError(err);
            test.strictEqual(fileName, '/some/path/index.js');
            test.done();
        });
    },
    'test node_modules with package.json': function(test) {
        var fs = mockFs({
            '/some/path/node_modules/somename/package.json': JSON.stringify({main:'./lib/foo'}),
            '/some/path/node_modules/somename/lib/foo.js': 'var foo;'
        });
        var resolver = nodeResolve.createRequireResolve(fs).atBasePath('/some/path/high/up/far/away/from/node_modules/dir');
        resolver.resolve('somename', function(err, fileName) {
            test.ifError(err);
            test.strictEqual(fileName, '/some/path/node_modules/somename/lib/foo.js');
            test.done();
        });
    },
});