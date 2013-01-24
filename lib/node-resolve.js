/*jshint evil: false, bitwise:false, strict: false, undef: true, white: false, plusplus:false, node:true */
//var fs = require('fs');
var async = require('async');
var path = require('path');
var _ = require('underscore');
var isRelative = require('./common').isRelative;

function isCoreModuleName(moduleName) {
    try {
        return moduleName.charAt(0) !== '/' && require.resolve(moduleName) === moduleName;
    } catch(e) {
        return false;
    }
}

function notFound(moduleName, callback) {
    return callback(new Error("Cannot resolve module '"+moduleName+"'"));
}

//file system operations necessary for createRequireResolve,
//extracted from main algorithm for easy unit testing
function createFsWrapper() {
    var fs = require('fs');
    return {
        isFile: fs.exists,
        readFile: function(file, callback) {
            return fs.readFile(file, 'utf8', callback);
        }
    };
}

function createRequireResolve(fsWrapper) {
    fsWrapper = fsWrapper || createFsWrapper();

    //extensions to try out in resolve
    var extensions = ['', '.js'];
    function resolveFile(file, callback) {
        async.detectSeries(extensions, function(ext, done) {
            return fsWrapper.isFile(file + ext, done);
        }, function(ext) {
            if(typeof ext === 'string') {
                return callback(null, file + ext);
            } else {
                return notFound(file, callback);
            }
        });
    }

    function resolveDirectoryWithPackageManifest(directory, callback) {
        var packageManifest = path.join(directory, 'package.json');
        fsWrapper.readFile(packageManifest, function(err, json) {
            if(!err) {
                try {
                    var main = JSON.parse(json).main;
                    return resolveFile(path.join(directory, main), callback);
                } catch(err) {
                    return callback(err);
                }
            } else {
                return notFound(packageManifest, callback);
            }
        });
    }

    function resolveDirectory(directory, callback) {
        resolveDirectoryWithPackageManifest(directory, function(err, fileName) {
            if(err) {
                return resolveFile(path.join(directory, 'index'), callback);
            } else {
                return callback(err, fileName);
            }
        });
    }

    function resolveFileOrDirectory(path, callback) {
        resolveFile(path, function(err, fileName) {
            if(err) {
                return resolveDirectory(path, function(err, fileName) {
                    if(err) {
                        return notFound(path, callback);
                    }
                    return callback(null, fileName);
                });
            }
            return callback(err, fileName);
        });
    }

    function resolveNodeModulesHierarchy(moduleName, basePath, callback) {
        var parts = basePath.split('/'),
        //array with level indices to try, reversed so we try the longest paths first
            levels = _.range(1, parts.length + 1).reverse(), resolvedFileName;

        function modulePathForLevel(level) {
            var base = '/' + parts.slice(0, level).join('/');
            return path.join(base, 'node_modules', moduleName);
        }

        async.detectSeries(levels, function(level, done) {
            var path = modulePathForLevel(level);
            resolveFileOrDirectory(path, function(err, fileName) {
                resolvedFileName = fileName;
                return done(!err);
            });
        }, function(level) {
            if(typeof level === 'undefined') {
                return notFound(moduleName, callback);
            } else {
                return callback(null, resolvedFileName);
            }
        });
    }

    return {
        atBasePath: function(basePath) {
            return {
                resolve: function resolve(moduleName, callback) {
                    var absoluteModulePath;
                    if(isCoreModuleName(moduleName)) {
                        return callback(new Error(moduleName + ' is a core module, core modules are not supported.'));
                    }
                    if(isRelative(moduleName)) {
                        absoluteModulePath = path.join(basePath, moduleName);
                    }
                    if(moduleName.charAt(0) === '/') {
                        absoluteModulePath = moduleName;
                    }
                    if(absoluteModulePath) {
                        return resolveFileOrDirectory(absoluteModulePath, callback);
                    }
                    //must be a node_modules module
                    else {
                        return resolveNodeModulesHierarchy(moduleName, basePath, callback);
                    }
                }
            };
        }
    };
}

module.exports = {
    createRequireResolve: createRequireResolve,
    isCoreModuleName: isCoreModuleName
};