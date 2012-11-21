/*jshint evil: false, bitwise:false, strict: false, undef: true, white: false, node:true, onevar: false */

var testCase = require('nodeunit').testCase;
var createClientSource = require('../lib/client-code').createClientSource;
var vm = require('vm');

module.exports = testCase({
    'test createClientSource': function(test) {
        var modulesFunctions = {
            'a' : function(require, module, exports) {
                module.exports = {
                    hello: function(world) { return require('alias/of/c').hello(world+'!') + require('./b').foo(); }
                };
            },
            'b' : function(require, module, exports) {
                module.exports = {
                    foo: function() {return ', I am B';}
                };
            },
            'c' : function(require, module, exports) {
                module.exports = {
                    hello: function(world) { return 'hello ' + world; }
                };
            }
        };
        
        var modules = [
            { normalizedName: 'c',
              sourceCode: '('+modulesFunctions.c.toString()+')(require, module, exports);' },
            { normalizedName: 'a',
              sourceCode: '('+modulesFunctions.a.toString()+')(require, module, exports);' },
            { normalizedName: 'b',
              sourceCode: '('+modulesFunctions.b.toString()+')(require, module, exports);' }
        ];
        var aliases = {'alias/of/c' : 'c'};
        var predefinedModules = {
            '_' : function() {return 'I am underscore!';}.toString()
        };
        var bundleSourceCode = createClientSource(modules, aliases, predefinedModules, 'myRequireFunction');
        //assign result of hello function to global variable, so we can get it from there
        bundleSourceCode = bundleSourceCode + 'var hello = myRequireFunction("a").hello("world");';
        //try use a predefined module
        bundleSourceCode = bundleSourceCode + 'var underscoreSays = myRequireFunction("_")();';
        //run code in new vm
        
        var vmGlobalObject = {};
        vm.runInNewContext(bundleSourceCode, vmGlobalObject);
        
        test.strictEqual(typeof vmGlobalObject.myRequireFunction, 'function', 'the external (global) name for the require function should be what we passed');
        test.strictEqual(vmGlobalObject.hello, 'hello world!, I am B', 'global variable in vm was not correctly assigned');
        test.strictEqual(vmGlobalObject.underscoreSays, 'I am underscore!', 'global variable from predefined module in vm was not correctly assigned');
        
        test.done();
    }
});