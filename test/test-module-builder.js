/*jshint evil: false, bitwise:false, strict: false, undef: true, white: false, node:true */

var testCase = require('nodeunit').testCase;
var ProcessModuleSet = require('../lib/module-builder').ProcessModuleSet;
var ModuleBuilder = require('../lib/module-builder').ModuleBuilder;
var normalize = require('../lib/common').normalize;
var requireStatementsFinder = require('../lib/module-builder').requireStatementsFinder;
var partsInCommon = require('../lib/module-builder').partsInCommon;

module.exports = testCase({
    'test ProcessModuleSet.item': function(test) {
        var item = ProcessModuleSet.item('/a/b', './hello');
        test.strictEqual(item.normalizedName, '/a/b/hello');
        test.strictEqual(item.localName, './hello');
        test.done();
    },
    'test ProcessModuleSet': function(test) {
        var set = new ProcessModuleSet();
        var item = ProcessModuleSet.item('/a/b', './hello');
        var item2 = ProcessModuleSet.item('/a/b', './hello');
        set.push(item);
        set.push(item2);
        test.ok(!set.empty(), 'set should not be empty');
        var poppedItem = set.pop();
        test.ok(set.empty(), 'set should be empty, since items that are pushed and have the same normalizedName should be ignored/overwrite the previous item'); 
        test.deepEqual(poppedItem, item, 'popped item should be the same as the one pushed');
        test.done();
    },
    'test ModuleBuilder': function(test) {
        var modules = {};
        function mod(name, base, children) {
            var n = base + '/' + name;
            modules[n] = {base: base, children: children, name: name, normalizedName: n};
        }

        
        mod('a', '/some/path/1', ['../3/b', '../2/c']);
        modules.a = modules['/some/path/1/a'];
        mod('c', '/some/path/2', ['../2/../3/b']);
        mod('b', '/some/path/3', ['../1/a.js', 'a', './d','_']);
        mod('d', '/some/path/3', []);
        
        mod('x', '/other/path/1', ['./y']);
        modules.x = modules['/other/path/1/x'];
        mod('y', '/other/path/1', []);
        
        modules._ = {base: '', children: [], name:'_', normalizedName: '_'};
        
        var resolver = function(normalizedName) {
            var m = modules[normalizedName];
            
            return {
                read: function(callback) {
                    return callback(m.children);
                },
                fileName: function() {
                    return  m.normalizedName;
                },
                canRead: function() {
                    return typeof m !== 'undefined';
                }
            };
        };
        var childModuleFinder = function(moduleContent) {
            return moduleContent;
        };
        
        var builder = new ModuleBuilder(resolver, childModuleFinder);
        builder.ignore(['_']);
        builder.addModule('a', null, function(err) {
            test.ifError(err);
            builder.addModule('x', null, function(err) {
                test.ifError(err);
                //the problem here is that a module goes by multiple names. We want to be able to resolve a normalized name together with a basePath to a filename (to handle the case of relative require paths, that depend on the directory of the module where the require statement occurs).
                //If we resolve node_modules module names to their filename for the moduleMap, we lose this property. There is no way to go from require('module') to define('/base/path', 'module', function(...) {}) if we store this under the key /base/path/module
                //the best solution would be to alias the short and long name to the same entry
                //so to be able to do that we need to be able to detect that two modules are the same file and have a defineAlias function
                
                var expectedModules = [
                    '/other/path/1/y',
                    '/some/path/2/c',
                    '/some/path/3/b',
                    '/some/path/3/d',
                    'a',
                    'x'
                ];
                var returnedModules = builder.modules().map(function(m) {return m.normalizedName;}).sort();
                
                var expectedAliases = { '/some/path/1/a': 'a' };
                
                test.deepEqual(returnedModules, expectedModules, 'the returned modules should be as expected');
                test.deepEqual(expectedAliases, builder.aliases(), 'the returned aliases should be as expected');
                
                test.done();
            });
        });
    },
    
    'test ModuleBuilder basePath resolution': function(test) {
        test.expect(7);
        var modules = {
            '/base/main' : {basePath: '/base', deps: ['./util/point']},
            '/base/util/point' : {basePath: '/base/util', deps: ['../../modules/date']},
            '/modules/date' : {basePath: '/modules', deps: []}
        };
        
        var resolver = function(normalizedName) {
            var m = modules[normalizedName];
            if(!m) {
                throw new Error('could not find module ' + normalizedName);
            }
            
            return {
                read: function(callback) {
                    return callback(m.deps);
                },
                fileName: function() {
                    return  normalizedName;
                },
                canRead: function() {
                    return typeof m !== 'undefined';
                }
            };
        };
        var childModuleFinder = function(deps) {
            return deps;
        };
        
        var builder = new ModuleBuilder(resolver, childModuleFinder);
        builder.addModule('/base/main', null, function() {
            var resolvedModules = builder.modules();
            test.strictEqual(resolvedModules.length, 3, '3 modules should have been resolved for /base/main');
            resolvedModules.forEach(function(m) {
                var moduleDef = modules[m.normalizedName];
                test.strictEqual(typeof m, 'object', 'resolved modules should be an object');
                test.strictEqual(m.basePath, moduleDef.basePath, 'basePath is wrong for module ' + m.normalizedName);
            });
            test.done();
        });
    },
    "test finding require statements": function(test) {
        var source = "require('module1');\n" + 'require("module2.js")';
        var modules = requireStatementsFinder()(source);
        test.deepEqual(['module1', 'module2.js'], modules, 'requireStatementsFinder did not parse correctly');
        var alternativeModule = requireStatementsFinder()("require('foo' , 'bar')");
        test.deepEqual(['bar'], alternativeModule, 'requireStatementsFinder did not parse require(nodeModule, browserModule) correctly');
        test.done();
    },
    "test partsInCommon": function(test) {
        test.strictEqual(partsInCommon("/no","/way"), 0, 'no common start');
        test.strictEqual(partsInCommon("","/way"), 0, 'one empty string');
        test.strictEqual(partsInCommon("/way", ""), 0, 'one empty string (2)');
        test.strictEqual(partsInCommon("", ""), 0, 'two empty strings');
        test.strictEqual(partsInCommon("/wally", "/wobbly"), 0, 'no parts in common');
        test.strictEqual(partsInCommon("/home/wally", "/home/dude"), 1, 'first part in common');
        test.strictEqual(partsInCommon("/home/wally/docs", "/home/wally/pics"), 2, 'two parts in common');
        test.strictEqual(partsInCommon("/home/wally/dev", "/home/wally/dev"), 3, 'three parts in common');
        
        test.done();
    }
});