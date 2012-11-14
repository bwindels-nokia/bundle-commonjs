/*jshint evil: false, bitwise:false, strict: false, undef: true, white: false, plusplus:false, node:true */

var fs = require('fs');
var _ = require('underscore');
var async = require('async');
var ModuleBuilder = require('./module-builder').ModuleBuilder;
var createClientSource = require('./client-code').createClientSource;
var EventEmitter = require('events').EventEmitter;

function BundleBuilder() {
    this.rootModules = [];
    this.predefinedModules = {};
}

BundleBuilder.prototype = Object.create(EventEmitter.prototype);

BundleBuilder.prototype.addModule = function(moduleName, replacements) {
    this.rootModules.push({name: moduleName, replacements: replacements});
    return this;
};

BundleBuilder.prototype.addPredefinedModules = function(modules) {
    _.extend(this.predefinedModules, modules);
    return this;
};

BundleBuilder.prototype._addModules = function(callback) {
    async.forEachSeries(this.rootModules, function(m, next) {
        this.moduleBuilder.addModule(m.name, m.replacements, next);
    }.bind(this), callback);
};

BundleBuilder.prototype.sourceCode = function(callback) {
    this.moduleBuilder = new ModuleBuilder();
    this.moduleBuilder.ignore(Object.keys(this.predefinedModules));
    this._addModules(function(err) {
        if(err) {
            return callback(err);
        }
        var modules = this.moduleBuilder.modules();
        modules.forEach(function(m) {
            this.emit('module', m.normalizedName, m.fileName);
        }, this);
        var source = createClientSource(modules, this.moduleBuilder.aliases(), this.predefinedModules);
        this.moduleBuilder = null;
        callback(null, source);
    }.bind(this));
};

BundleBuilder.prototype.writeToFile = function(filename, encoding, callback) {
    if(!callback) {
        callback = encoding;
        encoding = 'utf8';
    }
    
    this.sourceCode(function(err, sourceCode) {
        if(err) {
            return callback(err);
        }
        fs.writeFile(filename, sourceCode, encoding, callback);
    });
};

module.exports = {
    BundleBuilder: BundleBuilder
};