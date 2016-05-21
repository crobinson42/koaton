'use strict';
/*eslint global-require:0*/
const fs = require('fs');
const path = require('path');
fs.readdirSync(__dirname)
	.filter(item => !(/(^|\/)\.[^\/\.]/g).test(item))
	.filter(item => item !== "index.js")
	.forEach((file) => {
		module.exports[file.replace(/\.js/, "")] = {
			load(){
				return require(path.join(__dirname, "\\", file));
			}
		};
		//module.exports[file.replace(/\.js/, "")] = require(path.join(__dirname, "\\", file));
	});
