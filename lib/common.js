/*jshint evil: false, bitwise:false, strict: false, undef: true, white: false, plusplus:false, node:true */

//reimplemented this since it needs to work in the browser as well
function combinePath(base, relative) {
    if(isRelative(relative)) {
        var relativeParts = relative.split('/');
        var pathStack = base.split('/').filter(function(part) {return !!part;});
        relativeParts.forEach(function(part) {
            if(part === '..') {
                pathStack.pop();
            } else if( part !== '.') {
                pathStack.push(part);
            }
        });
        //only prepend starting slash if base had one
        var firstBaseCharIsSlash = base.substr(0,1) === '/';
        return  (firstBaseCharIsSlash ? '/' : '') + pathStack.join('/');
    }
    return relative;
}


function normalize(basePath, moduleName) {
    moduleName = combinePath(basePath || '', moduleName);

    if(moduleName.lastIndexOf('.js') === Math.max(1, moduleName.length - 3)) {
        moduleName = moduleName.substr(0, moduleName.length - 3);
    }
    return moduleName;
}

function isRelative(moduleName) {
    //start with a dot
    return moduleName.indexOf('.') === 0;
}

module.exports = {
    combinePath: combinePath,
    normalize: normalize,
    isRelative: isRelative
};