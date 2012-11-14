/*jshint evil: false, bitwise:false, strict: false, undef: true, white: false, node:true */

var testCase = require('nodeunit').testCase;
var common = require('../lib/common');

module.exports = testCase({
    'test combinePath': function(test) {
        var relativePath = common.combinePath.bind(common, '/a/b');
        test.strictEqual(relativePath('/c'), '/c', 'absolute path in second argument should be kept');
        test.strictEqual(relativePath('c'), 'c', 'module name in second argument should be kept');
        test.strictEqual(relativePath('./c'), '/a/b/c', 'file in local directory should be appended to base dir');
        test.strictEqual(relativePath('../c'), '/a/c', 'parent directory should remove directory b');
        test.strictEqual(relativePath('./e/../b/../../c'), '/a/c', 'complex parent directories should resolve correctly');
        test.strictEqual(common.combinePath('', './b'), 'b', 'empty base path should yield a path with no slash at the start');
        test.strictEqual(common.combinePath('/', './b'), '/b', '/ base path should be considered the root');
        test.strictEqual(common.combinePath('aa', './b'), 'aa/b', 'non-absolute base path should be honoured');
        
        test.done();
    },
    'test normalize module name': function(test) {
        var normalize = common.normalize.bind(null, '/a/b');
        test.strictEqual(normalize('module'), 'module', 'node_modules names should be kept');
        test.strictEqual(normalize('mod.js.ule.js'), 'mod.js.ule', '.js extensions should be trimmed');
        test.strictEqual(normalize('./module.js'), '/a/b/module', 'relative path should be resolved');
        test.strictEqual(normalize('some/path'), 'some/path', 'paths that rely on NODE_PATH being set should be kept');
        test.strictEqual(common.normalize(null, './b'), 'b', 'relative path with no base path should be resolved');
        test.strictEqual(common.normalize('/', './b'), '/b', 'relative path with root base path should be resolved');
        test.done();
    }
});