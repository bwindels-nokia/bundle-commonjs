/*jshint evil: false, bitwise:false, strict: false, undef: true, white: false, plusplus:false, node:true */

var normalize = require('./common').normalize;
var combinePath = require('./common').combinePath;
var isRelative = require('./common').isRelative;

function createModule(requireFn, createFn) {
    var moduleExports;

    return function() {
        if(!moduleExports) {
            var exports = {};
            var moduleObj = {
                loaded: false,
                exports: exports,
                require: requireFn
            };
            createFn(requireFn, moduleObj, exports);
            moduleExports = moduleObj.exports;
            moduleObj.loaded = true;
        }
        return moduleExports;
    };
}

function clientRequire(modulesMap, basePath, moduleName, browserModuleName) {
    if(browserModuleName) {
        moduleName = browserModuleName;
    }
    var normalizedName = normalize(basePath, moduleName);
    if(!modulesMap.hasOwnProperty(normalizedName)) {
        throw new Error('Cannot find module ' + moduleName + ' with base path ' + basePath + ', normalizedName: ' + normalizedName);
    }
    return modulesMap[normalizedName]();
}

function clientPredefinedModule(modulesMap, moduleName, value) {
    modulesMap[moduleName] = function() {
        return value;
    };
}

function clientDefine(modulesMap, basePath, normalizedModuleName, createFn) {
    var requireFn = clientRequire.bind(null, modulesMap, basePath);
    modulesMap[normalizedModuleName] = createModule(requireFn, createFn);
}

/* both fully normalized */
function clientDefineAlias(modulesMap, moduleNameA, moduleNameB) {
    modulesMap[moduleNameA] = modulesMap[moduleNameB];
}

function createModuleDefinitionsSource(modules) {
    return modules.reduce(function(source, module, predefinedModules) {
        return source + '\n' + [
            'define("',
            module.basePath || '', 
            '", "',
            module.normalizedName ,
            '", function(require, module, exports) {\n',
            module.sourceCode,
            '\n});'
        ].join('');
    }, '');
}

function createModuleAliasesSource(aliases) {
    return Object.keys(aliases).reduce(function(source, moduleA) {
        var moduleB = aliases[moduleA];
        return source + '\n' + [
            'defineAlias("',
            moduleA, 
            '", "',
            moduleB ,
            '");'
        ].join('');
    }, '');
}

function createPredefinedModulesSource(predefinedModules) {
    return Object.keys(predefinedModules).reduce(function(source, moduleName) {
        var valueSource = predefinedModules[moduleName];
        return source + '\n' + [
            'predefinedModule("',
            moduleName, 
            '", ',
            valueSource ,
            ');'
        ].join('');
    }, '');
}

//client source code generator
function createClientSource(modules, aliases, predefinedModules, requireFnName) {
    var moduleDefinitionsSource = createModuleDefinitionsSource(modules),
        moduleAliasesSource = createModuleAliasesSource(aliases),
        predefinedModulesSource = createPredefinedModulesSource(predefinedModules);

    requireFnName = requireFnName || 'require';

    return [
        'var ' + requireFnName + ' = (function() {',
            '',
            isRelative.toString(),
            combinePath.toString(),
            normalize.toString(),
            createModule.toString(),
            clientRequire.toString(),
            clientDefine.toString(),
            clientDefineAlias.toString(),
            clientPredefinedModule.toString(),
            'var modulesMap = {};',
            'var define = clientDefine.bind(null, modulesMap);',
            'var defineAlias = clientDefineAlias.bind(null, modulesMap);',
            'var predefinedModule = clientPredefinedModule.bind(null, modulesMap);',
            'var globalRequire = clientRequire.bind(null, modulesMap, null);',
            '//module definitions follow',
            moduleDefinitionsSource,
            '',
            '//module aliases follow',
            moduleAliasesSource,
            '',
            '//predefined modules follow',
            predefinedModulesSource,
            'return globalRequire;',
            '',
        '})();'
    ].join('\n');
}

module.exports = {
    createModule: createModule,
    clientRequire: clientRequire,
    clientDefine: clientDefine,
    createClientSource: createClientSource
};