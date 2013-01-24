/*jshint evil: false, bitwise:false, strict: false, undef: true, white: false, plusplus:false, node:true */
var fs = require('fs');
var isRelative = require('./common').isRelative;
var nodeResolve = require('./node-resolve');

function moduleNeedsBasePath(requiredNames) {
    //we need the base path if the a required path is either a relative path
    //or a module name of a non-internal module
    return requiredNames.some(function(n) {
        return isRelative(n) || (n.charAt(0) !== '/' && !nodeResolve.isCoreModuleName(n));
    });
}

//abstract away access to filesystem, useful for unit testing
function createFsResolver(encoding) {
    return function(normalizedName) {
        try {
            var fileName = require.resolve(normalizedName);
        }
        //swallow error since canRead will be called to check
        catch(e) {console.log(e);}
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
                return typeof fileName === 'string' && fileName.charAt(0) === '/';
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

module.exports = {
    createFsResolver: createFsResolver,
    createReplacementsResolver: createReplacementsResolver,
    moduleNeedsBasePath: moduleNeedsBasePath
};