/**
* @external {KoaContext} https://github.com/koajs/koa/blob/master/docs/api/context.md
*/
/**
* @external {KoaNext} https://github.com/koajs/koa/blob/master/docs/api/index.md#cascading
*/
/**
 * @external {JSURL} https://github.com/Sage/jsurl
 */
/**
  * @external {KoaRouter} https://github.com/alexmingoia/koa-router
  */
/**
 * @external {Verb} http://www.restapitutorial.com/lessons/httpmethods.html
 */
import 'colors';
import * as passport from 'koa-passport';
import { line1, line2 } from './support/consoleLines';
import './support/globals';
import include from './support/include';
import views from './views';
import * as KStatic from 'koa-static';
import * as bodyParser from 'koa-bodyparser';
import * as session from 'koa-session';
import * as helmet from 'koa-helmet';
import * as Koa from 'koa';
import * as path from 'path';
import * as fs from 'fs';
// TODO: This setup is for legacy compability
let App = new Koa();

/* istanbul ignore next */
if (process.env.NODE_ENV === 'development') {
	const logger = require('koa-logger');
	App.use(logger());
}

let koaton = include(path.join(__dirname, 'middleware'));
const view = views(configuration.views);
const ServeStatic = KStatic(configuration.static.directory || /* istanbul ignore next */ ProyPath('public'), configuration.static.configuration);
const {i18nHelper, i18nMiddleware} = koaton.localization(App);
const oAuth2Server = koaton.oauth2server.oauth2server();
const BodyParser = bodyParser(configuration.server.bodyParser);
const Helmet = helmet(configuration.server.helmet);

koaton.orm.initializeORM(false);
App.use(koaton.orm.ormMiddleware);
koaton.oauth2server.setAuthModel();
koaton.oauth2server = oAuth2Server;

koaton.auth.loadSecurityContext();
koaton.router.initialize();

App.keys = configuration.security.keys;
delete koaton.auth.initialize;
delete koaton.router.initialize;
delete koaton.orm.initialize;
delete koaton.server_models;

Object.defineProperty(App, 'helmet', {
	configurable: false,
	enumerable: true,
	get () {
		return Helmet;
	}
});
Object.defineProperty(App, 'session', {
	configurable: false,
	enumerable: true,
	get () {
		return session;
	}
});
Object.defineProperty(App, 'bodyparser', {
	configurable: false,
	enumerable: true,
	get () {
		return BodyParser;
	}
});

Object.defineProperty(App, 'views', {
	enumerable: true,
	get () {
		return view;
	}
});
Object.defineProperty(App, 'oAuth2Server', {
	enumerable: true,
	get () {
		return oAuth2Server;
	}
});
Object.defineProperty(App, 'subdomainrouter', {
	enumerable: true,
	get () {
		return koaton.subdomainrouter;
	}
});

Object.defineProperty(App, 'cached', {
	enumerable: true,
	get () {
		return koaton.cached;
	}
});

Object.defineProperty(App, 'passport', {
	enumerable: true,
	get () {
		return passport;
	}
});
Object.defineProperty(App, 'jsurl', {
	enumerable: true,
	get () {
		return koaton.jsurl;
	}
});
Object.defineProperty(App, 'static', {
	enumerable: true,
	get () {
		return ServeStatic;
	}
});
Object.defineProperty(App, 'localization', {
	enumerable: true,
	get () {
		return i18nMiddleware;
	}
});
Object.defineProperty(App, 'i18nHelper', {
	enumerable: true,
	get () {
		return i18nHelper;
	}
});
/* istanbul ignore next */
App.stack = function (...args) {
	for (const middleware in args) {
		App.use(middleware);
	}
};
App.start = function (port) {
	for (const route of koaton.router.options()) {
		App.use(route);
	}
	let callback = () => {
		/* istanbul ignore else  */
		if (process.env.NODE_ENV === 'development') {
			line1(true);
			console.log();
			line2();
			console.log(`   Server running in ${process.cwd()}\n` +
				`   To see your App, visit http://${configuration.server.host}:${port}\n` +
				'   To shut down Koaton, press <CTRL> + C at any time.');
			line2();
			console.log();
			line1(true);
			console.log(`  Enviroment:\t\t${process.env.NODE_ENV.green}`);
			console.log(`  Port:\t\t\t${port.toString().green}`);
			line1();
		} else if (!(process.env.welcome === 'false')) {
			console.log('+Running on port ' + port);
		}
	};
	const https = configuration.server.https;
	if (https && https.key && https.cert) {
		return require('https').createServer({
			key: fs.readFileSync(https.key),
			cert: fs.readFileSync(https.cert)
		}, App.callback()).listen(port, callback);
	} else {
		return App.listen(port, callback);
	}
};
module.exports = App;
