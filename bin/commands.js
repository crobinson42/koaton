"use strict";

const colors = require('colors');
const prompt = require('co-prompt');
const path = require('path');
const fs = require('fs');
const utils = require('./utils').utils;
const shell = require('./utils').shell;
const exec = require('./utils').exec;
const print = require('./console');
const version = require(path.join(__dirname , "/../package.json")).version;
const secret = require('./secret');
const ADP = require('./adapters');
const Handlebars = require('handlebars');
const inflector = require('i')();
const access = function (path) {
	try {
		fs.accessSync(path);
		return true;
	} catch (e) {
		return false;
	}
};
const deleteFolderRecursive = function (path) {
	var files = [];
	if (fs.existsSync(path)) {
		files = fs.readdirSync(path);
		files.forEach(function (file) {
			var curPath = path.join(path,"/",file);
			if (fs.lstatSync(curPath).isDirectory()) { // recurse
				deleteFolderRecursive(curPath);
			} else { // delete file
				fs.unlinkSync(curPath);
			}
		});
		fs.rmdirSync(path);
	}
};
const adapters = ADP.adapters;
const chokidar = require('chokidar');

const camintejs = ["Number", "Integer", "Float", "Double", "Real", "Boolean", "Date", "String", "Text", "Json", "BLOB"];
const emberdatas = ["number", "number", "number", "number", "number", "boolean", "date", "string", "string", undefined, "string"];



var application = "";
/**
 * Create application at the given directory `path`.
 *
 * @param {String} path
 */
function* setupApplication(proyect_path, db, eg, options) {
	yield utils.mkdir(proyect_path);
	yield utils.mkdir(`${proyect_path}/ember`);
	yield utils.compile('app.js');
	yield utils.mkdir(`${proyect_path}/config`);
	yield utils.compile('config/models.js');
	yield utils.compile('config/views.js');
	yield utils.compile('config/inflections.js');
	yield utils.compile('config/ember.js');
	yield utils.compile('config/server.js', {
		key: `"${(yield secret(48)).toString('hex')}"`
	});
	yield utils.compile('config/connections.js');
	yield utils.compile('config/bundles.js');
	yield utils.compile('config/routes.js');
	yield utils.mkdir(`${proyect_path}/assets/img`);
	yield utils.copy("/public/img/koaton.png", 'assets/img/logo.png');
	yield utils.copy("/public/img/koaton2.png", 'assets/img/logo2.png');
	yield utils.mkdir(`${proyect_path}/assets/js`);
	yield utils.mkdir(`${proyect_path}/assets/css`);
	yield utils.copy("../bin/koaton-char.png", "assets/img/favicon.ico");
	yield utils.mkdir(`${proyect_path}/node_modules`);
	try {
		fs.symlinkSync(path.join(__dirname , "/../"), path.join(proyect_path , "/node_modules/koaton"));
	} catch (e) {
		console.log(e.toString());
	}
	yield utils.mkdir(`${proyect_path}/controllers`);
	yield utils.mkdir(`${proyect_path}/models`);
	yield utils.mkdir(`${proyect_path}/public`);
	yield utils.mkdir(`${proyect_path}/public/img`);
	yield utils.mkdir(`${proyect_path}/views/layouts`);
	yield utils.copy("/views/layouts/main.handlebars");
	yield utils.compile('/views/index.html', {
		application: application
	});
	yield utils.compile('bower.json', {
		application: application
	});

	var pk = require('../templates/package');
	pk.name = application;
	if (!options.skipNpm) {
		yield utils.write(path.join(application, "package.json"), JSON.stringify(pk, null, '\t'), null);
		console.log(print.line1);
		yield shell("Installing npm dependencies", ["npm", "install", "--loglevel", "info"], application);
		yield shell("Installing adapter " + db[2].green, db, application);
		yield shell("Installing engine " + eg[2].green, eg, application);
	} else {
		pk.dependencies[eg[2]] = "latest";
		pk.dependencies[db[2]] = "latest";
		yield utils.write(path.join(application, "package.json"), JSON.stringify(pk, null, '\t'), null);
	}
	if (!options.skipBower) {
		yield shell("Installing bower dependencies", ["bower", "install"], application);
	}
	process.on('exit', function () {
		console.log(print.line1);
		console.log("   To run your app first: ");
		console.log('     $' + ' cd %s '.bgWhite.black, application);
		console.log('   and then: ');
		console.log('     $' + ' koaton serve '.bgWhite.black);
		console.log(print.line3("or"));
		console.log('     $' + 'cd %s && koaton serve '.bgWhite.black, application);
		console.log();
		console.log();
	});
}

function engine(selection) {
	switch (selection) {
	case "atpl":
	case "doT":
	case "dust":
	case "dustjs-linkedin":
	case "eco":
	case "ect":
	case "ejs":
	case "haml":
	case "haml-coffee":
	case "hamlet":
	case "handlebars":
	case "hogan":
	case "htmling":
	case "jade":
	case "jazz":
	case "jqtpl":
	case "JUST":
	case "liquor":
	case "lodash":
	case "mote":
	case "mustache":
	case "nunjucks":
	case "QEJS":
	case "ractive":
	case "react":
	case "slm":
	case "swig":
	case "templayed":
	case "twig":
	case "liquid":
	case "toffee":
	case "underscore":
	case "vash":
	case "walrus":
	case "whiskers":
		selection = selection.toLocaleLowerCase();
		break;
	case undefined:
		selection = "handlebars";
		break;
	default:
		console.log("unknow template engine".red.bold);
		process.exit(1);
		break;
	}
	return ["npm", "install", selection, "--save", "--loglevel", "info"];
}

function proxydb(driver) {
	switch (driver) {
	case "mariadb":
		driver = "mysql";
		break;
	case "mongo":
		driver = "mongoose";
		break;
	case "postgres":
		driver = "pg";
		break;
	case "mongoose":
	case "mysql":
	case "redis":
	case "sqlite3":
	case "couchdb":
	case "neo4j":
	case "riak":
	case "firebird":
	case "tingodb":
	case "rethinkdb":
		break;
	case undefined:
		driver = "mongoose";
		break;
	default:
		driver = null;
		break;
	}
	return driver;
}

function database(selection) {
	selection = proxydb(selection);
	if (selection === null) {
		console.log("Unknown driver.".red);
		process.exit(1);
	}
	return ["npm", "install", selection, "--save", "--loglevel", "info"];
}

function diff(start, end) {
	console.log((end[0] - start[0]) * 1000000 + (end[1] - start[1]) / 1000, 'us');
}

module.exports = [
	(commands) => {
		let help = "";
		delete commands[0];
		help += `  version: ${version}\n`;
		help += "  Command list:\n";
		commands.forEach(function (definition) {
			var args = definition.args.length > 0 ? `<${definition.args.join("> <")}>` : "";
			var opts = definition.options.length > 0 ? "[options]" : "";
			help += `    koaton ${definition.cmd} ${args.yellow} ${opts.cyan}\n`;
			help += `      ${definition.description.replace('\n',"\n   ")}\n`;
			definition.options.forEach(function (option) {
				var opt = option[1].split(' ');
				opt[0] = option[0] === opt[0] ? "" : opt[0];
				opt[1] = opt[1] || "";
				while (opt[0].length < 13) {opt[0] = opt[0] + " "};
				help += `      ${option[0].cyan} ${opt[0].gray} ${opt[1].cyan} ${option[2]}\n`;
			});
			help +="\n\n" ;
		});
		return help;
	},
	/*{
		cmd: "barebone",
		description: "Runs your awsome Koaton applicaction",
		args: ["command", "args"],
		options: [
			["-p", "--production", "Runs with NODE_ENV = production"]
		],
		action: function (command, args, options) {}
	},*/
	{
		cmd: "new",
		description: `Creates a new koaton aplication.`,
		args: ["app_name"],
		options: [
			[
				"-d", "--db <driver>",
				"[ ".yellow +
				adapters.map(function (tx) {
					return tx.cyan;
				}).join(" | ".yellow)
				+ " ]".yellow
			],
			[
				"-e", "--view-engine <engine>",
				"[ ".yellow +
				["handlebars", "ejs"].map(function (tx) {
					return tx.cyan;
				}).join(" | ".yellow)
				+ " ]".yellow
			 //"[ atpl|doT|dust|dustjs-linkedin|eco|ect|ejs|haml|haml-coffee|hamlet|handlebars|hogan|htmling|jade|jazz\n\t\t\t\t jqtpl|JUST|liquor|lodash|mote|mustache|nunjucks|QEJS|ractive|react|slm|swig|templayed|twig|liquid|toffee\n\t\t\t\t underscore|vash|walrus|whiskers ]"
			],
			["-f", "--force", "Overrides the existing directory."],
			["-n", "--skip-npm", "Omits npm install"],
			["-b", "--skip-bower", "Omits bower install"]
		],
		action: function* (app_name, options) {
			application = app_name;
			const proypath = path.resolve(app_name);
			utils.proyect_path = proypath;
			if (!application) {
				console.log(`${colors.yellow('The command requires a name to run.\n\tkoaton -h\nto see help.')}`);
				process.die(1);
			}
			const db = database(options.db);
			const eg = engine(options.viewEngine);
			var empty = utils.isEmpty(proypath);
			var ok = true;
			if (!(empty || options.force)) {
				ok = yield prompt.confirm(`destination ${colors.yellow(utils.proyect_path)} is not empty, continue? [y/n]: `);
			}
			if (ok) {
				process.stdin.destroy();
				utils.to_env = path.join(utils.to_env, application);
				return yield setupApplication(proypath, db, eg, options);
			} else {
				utils.abort('aborting');
				return 1;
			}
		}
			},
	{
		cmd: "ember",
		alias: "ex",
		description: "If no app_name epecified it lists all the installed ember apps.",
		args: ["app_name"],
		options: [
			["-n", "--new", "Creates a new ember app with the especified named."],
			["-f", "--force", "Overrides the current app."],
			["-u", "--use <ember_addon>", "Install the especified addon in the especified app."],
			["-m", "--mount <path>", "(Default: /) Sets the mounting path in the koaton app. Can be used with -n or alone."],
			["-b", "--build <env>", "[ development | production] Builds the especified ember app in the Koaton app."]
		],
		action: function* (app_name, options) {
			var override = false;
			const pt = `${process.cwd()}/ember/${app_name}`;
			if (app_name === undefined) {
				fs.readdirSync('./ember').forEach((dir) => {
					const f = require(`${process.cwd()}/ember/${dir}/bower.json`);
					console.log(`${dir}@${f.dependencies.ember}`);
				});
				return 0;
			} else if (options.use) {
				let res = yield shell(`Installing ${options.use.green} addon on ${app_name.cyan}`, ["ember", "i", options.use], pt);
				console.log(!res ? "Success".green : "Failed".red);
				return res;
			} else if (options.new) {
				const canAccess = access(pt);
				override = !canAccess;
				if (canAccess && app_name && !options.force) {
					override = yield prompt.confirm(`destination ${pt} is not empty, continue? [y/n]: `);
					if (override) {
						deleteFolderRecursive(pt);
					}
				}
				if (override || options.force) {
					yield shell(`Installing ${app_name.green}`, ["ember", "new", app_name, "-dir", pt, "-v"], process.cwd());
					options.mount = options.mount === undefined ? "/" : path.join("/", options.mount);
				}else{
					return 0;
				}
			} else if (options.build) {
				const embercfg = require(`${process.cwd()}/config/ember`)[app_name];
				const publicdir = path.join(process.cwd(), "public", app_name, "/");
				const mount_views = path.join(process.cwd(), "views", "ember_apps", embercfg.mount, "/");
				const mount_public = path.join(process.cwd(), "public", embercfg.mount, "/");
				if (yield shell(`Building ... ${app_name.yellow}->${embercfg.mount.green}`, ["ember", "build", "--environment", options.build, "-o", path.join("../../public/", embercfg.mount)],
						process.cwd() + "/ember/" + app_name
					)) {
					console.log(logstring.red);
					return 1;
				}
				yield utils.mkdir(mount_views);
				console.log(`${publicdir}index.html`, `${mount_views}index.html`);
				fs.renameSync(`${mount_public}index.html`, `${mount_views}index.html`);
				fs.renameSync(`${mount_public}crossdomain.xml`, `${mount_views}crossdomain.xml`);
				fs.renameSync(`${mount_public}robots.txt`, `${mount_views}robots.txt`);
				fs.unlinkSync(`${mount_public}testem.js`);
				fs.unlinkSync(`${mount_public}tests/index.html`);
				fs.rmdirSync(`${mount_public}tests/`);
			}
			if (!options.build) {
				const connections = require(`${process.cwd()}/config/connections`);
				const connection = require(`${process.cwd()}/config/models`).connection;
				const def = connections[connection];
				options.mount = path.join('/', options.mount);
				options.mount = options.mount.replace(/\\/igm,"/");
				console.log(`mounting ${app_name.green} on path ${options.mount.cyan}`);
				yield utils.mkdir(path.join(process.cwd(), "ember", app_name, "app", "adapters"));
				yield utils.compile('ember_apps/adapter.js',
					path.join("ember", app_name, "app", "adapters", "application.js"), {
						localhost: def.host,
						port: def.port
					});
				var emberjs = require(`${process.cwd()}/config/ember.js`);

				emberjs[app_name] = {
					mount: options.mount
				};
				yield utils.write(`${process.cwd()}/config/ember.js`, `"use strict";
module.exports=${ JSON.stringify(emberjs,null,'\t')};`, true);
				let embercfg = yield utils.read(`${pt}/config/environment.js`, {
					encoding: 'utf-8'
				});
				embercfg = embercfg.replace(/baseURL: ?'.*',/, `baseURL: '${options.mount}',`);
				yield utils.write(`${pt}/config/environment.js`, embercfg, true);
			}
			return 0;
		}
			},
	{
		cmd: "adapter",
		description: "Install the especified driver adapter.",
		args: ["driver"],
		options: [
			["-l", "--list", "Show the adapters installed in the current application. " + "koaton adapter -l".bgWhite.black],
			["-u", "--uninstall", "Removes the driver"],
			["-g", "--generate", "Creates an adapter template for the especified driver"],
			["--host", "--host <hostname>", "Default is localhost. Use this with -g"],
			["--port", "--port <port>", "Default driver port. Use this with -g"],
			["--user", "--user <username>", "User to connect to database default is ''. Use this with -g"],
			["--db", "--db <databse>", "Database name for the connection default is ''. Use this with -g"],
			["--password", "--password <databse>", "Password to login in your database default is ''. Use this with -g"]
		],
		action: function* (driver, options) {
			const dependencies = require(path.resolve() + "/package.json").dependencies;
			let drivers = {};
			adapters.map((adapter) => {
				drivers[adapter] = dependencies[proxydb(adapter)] ? dependencies[proxydb(adapter)] : false;
			});
			let installed = {};
			let available = {};
			Object.keys(drivers).forEach((driver) => {
				if (drivers[driver]) {
					installed[driver] = drivers[driver];
				} else {
					available[driver] = drivers[driver];
				}
			});
			if (installed.mysql) {
				delete available.mariadb;
			}
			if (installed.pg) {
				installed.postgres = installed.pg;
				delete installed.pg;
				delete available.postgres;
			}
			if (adapters.indexOf(driver) === -1) {
				console.log("The driver you especied is not available please check: ".yellow);
				console.log();
				options.list = true;
			}
			if (options.uninstall) {
				yield shell(`Uninstalling ${proxydb(driver).green}`, ["npm", "uninstall", proxydb(driver)], process.cwd());
			} else if (options.list) {
				console.log("Installed drivers: ");
				Object.keys(installed).forEach((driver) => {
					console.log(`\t${driver}@${installed[driver].cyan}`);
				});
				console.log();
				console.log("Available drivers: ");
				Object.keys(available).forEach((driver) => {
					console.log(`\t${driver}`);
				});
			} else {
				if (!options.generate) {
					if (available[driver] === undefined) {
						console.log("The driver you especified is already installed".yellow);
						console.log("Other drivers: ");
						Object.keys(available).forEach((driver) => {
							console.log(`\t${driver}`);
						});
						return 1;
					}
					yield shell(`Installing ${proxydb(driver).green}`, database(driver), process.cwd());
					delete require.cache[path.resolve() + "/package.json"];
					console.log(`${driver}@${require(path.resolve() + "/package.json").dependencies[proxydb(driver)]} installed`);
					options.generate = true;
				}
				if (options.generate) {
					var adapterCFG = JSON.parse(Handlebars.compile(ADP.template)({
						adapter: driver,
						driver: proxydb(driver),
						user: options.user || '',
						password: options.password || '',
						host: options.host || 'localhost',
						port: options.port || ADP.connections[proxydb(driver)],
						application: options.db || path.basename(process.cwd())
					}), "\t");

					if (drivers === "sqlite3") {
						delete adapterCFG.port;
						delete adapterCFG.host;
						delete adapterCFG.pool;
						delete adapterCFG.ssl;
					}
					try {
						var connections = require(process.cwd() + "/config/connections");
						/*if (connections[driver] === undefined) {
							connections[driver] = adapterCFG;
						} else {
							console.log(`An adapter named ${driver.green} already exits in ./config/${"connections.js".green}\nPlease update it manually.`);
							return 1;
						}*/
						connections[driver] = adapterCFG;
						const output = '"use strict";\nmodule.exports=' + JSON.stringify(connections, null, '\t') + ";";
						yield utils.write(process.cwd() + "/config/connections.js", output, true);
						return 0;
					} catch (e) {
						console.log("Configuration file located at ./config/connections.js not found.");
						return 1;
					}

				}
			}
			return 0;
		}
	},
	{
		cmd: "model",
		description: `Creates a new model. fields must be sourrounded by \"\".
	${"Fields syntax".yellow}:
		${"field_name"}:${"type".cyan}	${"[ ".yellow+camintejs.map((c)=>{return c.toLowerCase().cyan}).join( " | ".yellow )+" ]".yellow}
	${"example:".yellow}
		koaton model User "active:integer name email password note:text created:date"
`,
		args: ["name", "fields"],
		options: [
			["-e", "--ember <app>", "Generates the model also for the app especified."],
			["-f", "--force", "Deletes the model is exits."],
			["-r", "--rest", "Makes the model REST enabled."]
		],
		action: function* (name, fields, options) {
			const inflections = require(process.cwd() + '/config/inflections');
			inflections.irregular.forEach((inflect) => {
				inflector.inflections.irregular(inflect[0], inflect[1]);
			});
			if (name === undefined) {
				console.log("you must especifie a ".red + "name".yellow);
				process.exit(1);
			}
			name = inflector.singularize(name.toLowerCase());
			var definition = {
				model: {},
				extra: {}
			};
			const _camintejs = camintejs.map((c) => {
				return c.toLowerCase();
			});
			if (fields !== undefined) {
				fields = fields.split(' ').map((field) => {
					return field.split(':');
				});
				fields.forEach((field) => {
					field[1] = field[1] || "String";
					definition.model[field[0]] = `{ type:schema.${camintejs[_camintejs.indexOf(field[1].toLowerCase())]} }`;
				});
			}
			definition = JSON.stringify(definition, null, '\t').replace(/"{/igm, "{").replace(/}"/igm, "}");
			definition = `"use strict";
module.exports = function(schema) {
    return ${definition};
};`;
			var ok = true;
			console.log(`${process.cwd()}/models/${name.toLowerCase()}.js`);
			console.log();
			if (access(`${process.cwd()}/models/${name.toLowerCase()}.js`) && !options.force) {
				ok = yield prompt.confirm(`The model ${name.green} already exits,do you want to override it? [y/n]: `);
			}
			if (!ok) {
				return 0;
			}
			yield utils.write(process.cwd() + "/models/" + name.toLowerCase() + ".js", definition);
			if (options.rest && ok) {
				var restcontroller = `"use strict";\nmodule.exports = {\n\tREST:true\n};`;
				yield utils.write(process.cwd() + "/controllers/" + name.toLowerCase() + ".js", restcontroller);
			}
			if (options.ember) {
				var embermodel = "import Model from 'ember-data/model';\n";
				embermodel += "import attr from 'ember-data/attr';\n";
				embermodel += "export default Model.extend({\n";
				fields.forEach((field) => {
					embermodel += `\t${field[0]}:attr('${emberdatas[_camintejs.indexOf(field[1].toLowerCase())]}'),\n`
				});
				embermodel += "});";
				yield utils.write(process.cwd() + "/ember/" + options.ember + "/app/models/" + name + ".js", embermodel);
				if (options.rest) {
					var embercontroller = `
						import CTABLE from 'ember-cli-crudtable/mixins/crud-controller';
import Ember from 'ember';
export default Ember.Controller.extend(CTABLE('${name}'),{
	actions:{
	},
	fieldDefinition:{
		${fields.map((f)=>{return f[0];}).join(':{},\n\t\t')}:{}
	}
});`
					yield utils.write(process.cwd() + "/ember/" + options.ember + "/app/controllers/" + name + ".js", embercontroller);
					yield utils.write(
						process.cwd() + "/ember/" + options.ember + "/app/templates/" + name + ".hbs",
						`{{crud-table\n\tfields=this.fieldDefinition\n}}`
					);
				}
				console.log(`Please add this.route('${name}') to your ember app router.js`);
			}
			return 1;
		}
			},
	{
		cmd: "build",
		description: "Make bundles of your .js .scss .css files and output to public folder.\n   Default value is ./config/bundles.js",
		args: ["config_file"],
		options: [
				["-p", "--prod", "builds for production"]
			],
		action: function* (config_file, options) {
			config_file = config_file || process.cwd() + '/config/bundles.js';
			var gulp = require('gulp');
			var concat = require('gulp-concat');
			var sourcemaps = require('gulp-sourcemaps');
			var uglify = require('gulp-uglify');
			var hash = require('gulp-hash-filename');
			var patterns = require(config_file);
			if (Object.keys(patterns).length === 0) {
				console.log("Nothing to compile on: " + config_file);
			}
			Object.keys(patterns).forEach(function (key) {
				var info = patterns[key].map(function (file) {
					return path.basename(file).yellow;
				}).join(",".yellow.dim);
				info = "Compiling: ".green + info + " => public/js/" + key.green.bold;
				console.log(info);
				if (!options.prod) {
					gulp.src(patterns[key])
						.pipe(sourcemaps.init())
						.pipe(uglify())
						.pipe(concat(key))
						.pipe(sourcemaps.write())
						.pipe(hash())
						.pipe(gulp.dest('./public/js'));

				} else {
					console.log(options.prod);
				}
			});
		}
			},
	{
		cmd: "serve",
		description: "Runs your awsome Koaton applicaction using nodemon",
		args: [],
		options: [
			["-p", "--production", "Runs with NODE_ENV = production"],
			["-b", "--build", "Builds the ember apss."],
			["--port", "--port <port>", "Run on the especified port (port 80 requires sudo)."]
		],
		action: function* (options) {
			const env = {
				welcome: false,
				NODE_ENV: !options.production ? 'development' : 'production',
				port: options.port || 62626
			};
			if (options.forever) {
				env.NODE_ENV = 'production';
			}
			utils.welcome(env);
			const nodemon = require('gulp-nodemon');
			const livereload = require('gulp-livereload');
			const notifier = require('node-notifier');
			if (options.production) {
				livereload.listen({
					port: 62627,
					quiet: true
				});
			}
			const embercfg = require(`${process.cwd()}/config/ember`);

			let build = [];
			let watching = [];
			const building = [];
			const watch_error=function(e){
				console.log(`Watcher error: ${e}`);
			}
			for (var ember_app in embercfg) {
				const updateApp = function () {
					notifier.notify({
						title: 'Koaton',
						message: 'Rebuilding app: ' + ember_app,
						icon: path.join(__dirname, 'koaton.png'),
						sound: 'Hero',
						wait: false
					});
					shell("Building " + ember_app.green, ["koaton", "ember", ember_app, "-b", env.NODE_ENV], process.cwd());
					livereload.reload();
				}
				if (build.indexOf(ember_app) === -1) {
					if (options.build) {
						building.push(shell("Building " + ember_app.green, ["koaton", "ember", ember_app, "-b", env.NODE_ENV], process.cwd()).then(() => {
							return `${ember_app.yellow} → ${embercfg[ember_app].mount.cyan}`;
						}));
					}
					if ((yield building[building.length - 1]) === 0) {
						var watcher = chokidar.watch(`ember/${ember_app}/**/*.js`, {
							ignored: [
									"**/node_modules/**",
									"**/bower_components/**",
									"**/tmp/**",
									"**/vendor/**",
									/[\/\\]\./
								],
							persistent: true,
							alwaysStat: false,
							awaitWriteFinish: {
								stabilityThreshold: 1000,
								pollInterval: 100
							}
						});
						watcher
						.on('change', updateApp)
						.on('unlink', updateApp)
						.on('ready', () => watcher.on('add', updateApp))
						.on('unlinkDir', updateApp)
						.on('error', watch_error);
						watching.push(watcher);
					}
				}
			}
			nodemon({
				ext: '*',
				quiet: true,
				delay: 500,
				ignore: [
						"**/node_modules/**", "**/bower_components/**", "**/ember/**", "**/public/**", "**/views/**"
					],
				verbose: false,
				script: 'app.js',
				env: env,
				stdout: true
			}).once('start', function () {
				utils.info(env, building);
				notifier.notify({
					title: 'Koaton',
					message: `Server runnung on localhost: ${env.port}`,
					open: `http://localhost: ${env.port}`,
					icon: path.join(__dirname, 'koaton.png'),
					sound: 'Hero',
					wait: false
				});
			}).on('restart', function () {
				setTimeout(function () {
					livereload.reload();
				}, 1000);
				notifier.notify({
					title: 'Koaton',
					message: 'restarting server...',
					icon: path.join(__dirname, 'koaton.png'),
					sound: 'Hero'
				});
			});
		}
			},
	{
		cmd: "forever",
		description: "Runs your awsome Koaton on production mode with forever.",
		args: [],
		options: [
			["-l", "--list", "Lists all Koaton running applicactions."],
			["-o", "--logs <app>", "Shows the logs for the selected app."],
			["-s", "--stop", "Stops all the forever running servers."],
			["--port", "--port <port>", "(Default: 62626) Run on the especified port (port 80 requires sudo)."]
		],
		action: function* (options) {
			const env = {
				welcome: false,
				NODE_ENV: 'production',
				port: options.port || 62626
			};
			const app = path.basename(process.cwd());
			const cmd = `NODE_ENV=${env.NODE_ENV} port=${env.port} forever start --colors --uid "koaton_${app}" -a app.js`;
			if (options.logs) {
				exec(`forever list`).then((data) => {
					data = data.stdout.replace("info:    Forever processes running", "").replace(/ /igm, "-").replace(/data:/igm, "").replace(/-([a-z]|\/|[0-9])/igm, " $1").split('\n');
					data = data.slice(2).map((d) => {
						return d.trim().split(' ')
					});
					for (let i in data) {
						if (data[i].indexOf(options.logs) > -1) {
							return data[i][6];
						}
					}
					return null;
				}).done(id => {
					if (id !== null) {
						exec(`cat ${id}`).then(data => {
							console.log(data.stdout);
						}).finally(() => {
							process.exit(0);
						});
					}
				});
			} else if (options.stop) {
				exec(`forever stop koaton_${path.basename(process.cwd())}`).then(() => {}).finally(() => {
					process.exit(0);
				});
			} else if (options.list) {
				exec(`forever list`).then((data) => {
					data = data.stdout.replace("info:    Forever processes running", "").replace(/ /igm, "-").replace(/data:/igm, "").replace(/-([a-z]|\/|[0-9])/igm, " $1").split('\n');
					var headers = data[1].trim().split(' ').slice(1);
					data = data.slice(2).map((d) => {
						return d.trim().split(' ')
					}).map((d) => {
						return d.slice(1);
					});
					headers[0] = headers[0].green;
					headers[1] = headers[1].gray.dim;
					headers[2] = headers[2].gray.dim;
					headers[3] = headers[3].gray.dim;
					headers[4] = headers[4].cyan;
					headers[5] = headers[5].gray.dim;
					headers[6] = headers[6].magenta;
					headers[7] = headers[7].yellow;
					data.pop();
					data.forEach((line) => {
						line[0] = line[0].green;
						line[1] = line[1].gray.dim;
						line[2] = line[2].gray.dim;
						line[3] = line[3].gray.dim;
						line[4] = line[4].cyan;
						line[5] = line[5].magenta;
						line[6] = line[6].yellow;
					});
					console.log(headers.join(' ').replace(/-/igm, " "));
					console.log(data.map((d) => {
						if (d[0].indexOf("koaton") > -1) {
							return d.join(' ').replace(/-/igm, " ");
						} else {
							return null;
						}

					}).join('\n'));
				}).finally(() => {
					process.exit(0);
				});
			} else {
				exec(`forever stop koaton_${app}`).catch(() => {}).finally(() => {
					exec(cmd, {
						cwd: process.cwd()
					}).then(() => {
						console.log(`${app} is running ... `);
					}).finally(() => {
						process.exit(0);
					});
				});
			}
		}
			}


			];
