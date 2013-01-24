/*jshint evil: false, bitwise:false, strict: false, undef: true, white: false, plusplus:false, node:true */

var path = require('path');
var fs = require('fs');
var async = require('async');
var _ = require('underscore');
var normalize = require('./common').normalize;
var assert = require('assert');
var isRelative = require('./common').isRelative;

/*function obfuscatePath(path) {
    var crypto = require('crypto');
    
    return '/' + path.split('/').filter(function(part) {
        return part.length !== 0;
    }).map(function(part) {
        var shasum = crypto.createHash('sha1');
        shasum.update(part);
        return shasum.digest('hex');
    }).join('/');
}

function normalizeAndObfuscateModuleName(basePath, moduleName) {
    var normalizedName = normalize(basePath, moduleName);
    if(normalizedName.indexOf('/') === 0) {
        normalizedName = obfuscatePath(path.dirname(normalizedName) + '/' + path.dirname(normalizedName));
    }
}*/

//abstract away access to filesystem, useful for unit testing
function createFsResolver(encoding) {
    return function(normalizedName) {
        try {
            var fileName = require.resolve(normalizedName);
        }
        //swallow error since canRead will be called to check
        catch(e) {}
        return {
            read: function(callback) {
                fs.readFile(fileName, encoding, function(err, source) {
                    callback(source);
                });
            },
            fileName: function() {
                return fileName;
            },
            canRead: function() {
                return typeof fileName === 'string';
            }
        };
    };
}

function createReplacementsResolver(replacements) {
    return function(normalizedName) {

        var fileName, hasReplacement = false;
        
        if(replacements && replacements.hasOwnProperty(normalizedName)) {
            hasReplacement = true;
            fileName = normalizedName;
        }

        return {
            read: function(callback) {
                var replacement = replacements[normalizedName];
                var sourceCode;
                if(typeof replacement === 'function') {
                    sourceCode = replacement();
                }
                else if(typeof replacement === 'string') {
                    sourceCode = replacement;
                }
                callback(sourceCode);
            },
            fileName: function() {
                return fileName;
            },
            canRead: function() {
                return hasReplacement;
            }
        };
    };
}


//abstract away the need for the source code to be actual javascript, useful for unit testing
function requireStatementsFinder() {
    
    var matchRequire = /require\((['\"][^\"']+['\"]\s*\,?\s*){1,2}\)/g;
    
    return function(source) {
        //Find require statements
        var requireStatements = source.match(matchRequire);
        if (requireStatements) {
            //map regex matches to moduleNames
            return requireStatements.map(function(requireStatement) {
                var args = requireStatement.substring(8, requireStatement.length - 1);
                args = args.split(',').map(function(arg) {
                    arg = arg.trim();
                    return arg.substring(1, arg.length - 1);
                });
                if(args.length === 2) {
                    return args[1];
                } else {
                    return args[0];
                }
            });
        }
        return [];
    };
}
/** a set (list that cannot contain duplicates) that contains the modules to still process. Used as a stack. */
function ProcessModuleSet(ignoreModuleNames) {
    this.ignoreModuleNames = ignoreModuleNames;
    this.modulesLeftToCheckOut = {};
}

ProcessModuleSet.prototype = {};
ProcessModuleSet.prototype.push = function(item) {
    //don't push items that should be ignored
    if(this.ignoreModuleNames && this.ignoreModuleNames.indexOf(item.normalizedName) !== -1) {
        return;
    }
    this.modulesLeftToCheckOut[item.normalizedName] = item;
};

ProcessModuleSet.item = function(basePath, moduleName) {
    var normalizedName = normalize(basePath, moduleName);
    return {
        localName: moduleName,
        normalizedName: normalizedName
    };
};

ProcessModuleSet.prototype.pop = function(basePath, moduleName) {
    var key = Object.keys(this.modulesLeftToCheckOut)[0];
    var item = this.modulesLeftToCheckOut[key];
    delete this.modulesLeftToCheckOut[key];
    return item;
};

ProcessModuleSet.prototype.empty = function() {
    return Object.keys(this.modulesLeftToCheckOut).length === 0;
};

/** class to trace all dependencies of a module.
    the output of this class is used to generate the bundle code */
function ModuleBuilder(resolver, findModuleNames) {
    this.modulesMap = {};
    this.filesMap = {}; //used to detect aliases
    this.aliasesMap = {};
    this.findModuleNames = findModuleNames || requireStatementsFinder();
    this.resolver = resolver || createFsResolver('utf8');
}

ModuleBuilder.prototype = {};

ModuleBuilder.prototype.resolveModuleName = function(normalizedName) {
    var desc;
    if(this.replacementsResolver) {
        desc = this.replacementsResolver(normalizedName);
        if(desc.canRead()) {
            return desc;
        }
    }
    desc = this.resolver(normalizedName);
    if(desc.canRead()) {
        return desc;
    }
    throw new Error('could not find resolver to load ' + normalizedName);
}

ModuleBuilder.prototype._processModule = function(item, callback) {
    //resolve relative paths to be independent of the current require context
    var moduleDescriptor;
    try {
        moduleDescriptor = this.resolveModuleName(item.normalizedName);    
    } catch(err) {
        err.message = err.message + ': context: ' + JSON.stringify(item);
        return callback(err);
    }
    var fileName = moduleDescriptor.fileName();
    var basePath = path.dirname(fileName);
    
    //is this an alias of another module name?
    if(this.filesMap.hasOwnProperty(fileName)) {
        this.aliasesMap[item.normalizedName] = this.filesMap[fileName];
        return callback(null, []);  //no child modules since this is just an alias
    } else {
        this.filesMap[fileName] = item.normalizedName;
    }
    //read the file to store the source and child for more child modules ...
    moduleDescriptor.read(function(sourceCode) {
        //if the source code could not be read, we probably tried to read an internal node module. just skip.
        if(!sourceCode) {
            return callback(null, []);
        }
        //add to map with processed modules
        item.sourceCode = sourceCode;
        item.fileName = fileName;
        this.modulesMap[item.normalizedName] = item;
        //look for require statements in the module source code
        var requiredModuleNames = this.findModuleNames(sourceCode);
        //only include the basepath if a require inside needs it to resolve the normalized module name
        var hasRelativeRequirePaths = requiredModuleNames.some(isRelative);
        if(hasRelativeRequirePaths) {
            item.basePath = basePath;
        }
        //convert the module names to work items
        var childItems = requiredModuleNames.map(ProcessModuleSet.item.bind(null, basePath));
        return callback(null, childItems);
    }.bind(this));
};


ModuleBuilder.prototype.addModule = function(moduleName, replacements, callback) {
    if(replacements) {
        this.replacementsResolver = createReplacementsResolver(replacements);
    }
    var workSet = new ProcessModuleSet(this.ignoreModuleNames);
    workSet.push(ProcessModuleSet.item(null, moduleName));
    
    async.whilst(
        function () { return !workSet.empty(); },
        function (callback) {
            var workItem = workSet.pop();
            //skip modules that have already been processed
            if(this.modulesMap.hasOwnProperty(workItem.normalizedName)) {
                return callback();
            }
            this._processModule(workItem, function(err, childItems) {
                if(err) {
                    return callback(err);
                }
                //push newly found items in processed module
                childItems.forEach(workSet.push.bind(workSet));
                return callback();
            });
        }.bind(this),
        function(err) {
            delete this.replacements;
            return callback(err);
        }
    );
};

function partsInCommon(a, b) {
    function split(s) {
        //split by / and remove empty entries 
        return s.split('/').filter(function(ss) {return !!ss;});
    }
    
    var aParts = split(a),
        bParts = split(b);
    
    var i, c, smallestLength = Math.min(aParts.length, bParts.length);
    for(i = 0; i < smallestLength ; ++i) {
        if(aParts[i] !== bParts[i]) {
            return i;
        }
    }
    return smallestLength;
}

ModuleBuilder.prototype.removeCommonRoots = function() {
    
};

ModuleBuilder.prototype.ignore = function(moduleNames) {
    this.ignoreModuleNames = moduleNames;
};

ModuleBuilder.prototype.modules = function() {
    return _.values(this.modulesMap);
};

ModuleBuilder.prototype.aliases = function() {
    return this.aliasesMap;
};

module.exports = {
    ProcessModuleSet: ProcessModuleSet,
    ModuleBuilder: ModuleBuilder,
    requireStatementsFinder: requireStatementsFinder,
    fsResolver: createFsResolver,
    partsInCommon: partsInCommon
};