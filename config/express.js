'use strict';

/**
 * Module dependencies.
 */
var fs = require('fs'),
	http = require('http'),
	https = require('https'),
	express = require('express'),
	morgan = require('morgan'),
	bodyParser = require('body-parser'),
	session = require('express-session'),
	expressSessionPassportCleanup = require('express-session-passport-cleanup'),
	compress = require('compression'),
	methodOverride = require('method-override'),
	cookieParser = require('cookie-parser'),
	helmet = require('helmet'),
	passport = require('passport'),
	mongoStore = require('connect-mongo/es5')({
		session: session
	}),
	flash = require('connect-flash'),
	config = require('./config'),
	consolidate = require('consolidate'),
	path = require('path'),
	rollbar = require('rollbar');

module.exports = function(db) {
	// Initialize express app
	var app = express();

	// Globbing model files
	config.getGlobbedFiles('./app/models/**/*.js').forEach(function(modelPath) {
		require(path.resolve(modelPath));
	});

	// Setting application local variables
	app.locals.title = config.app.title;
	app.locals.description = config.app.description;
	app.locals.keywords = config.app.keywords;
	app.locals.jsFiles = config.getJavaScriptAssets();
	app.locals.cssFiles = config.getCSSAssets();

	// Passing the request url to environment locals
	app.use(function(req, res, next) {
		res.locals.url = req.protocol + '://' + req.headers.host + req.url;
		next();
	});

	// Should be placed before express.static
	app.use(compress({
		filter: function(req, res) {
			return (/json|text|javascript|css/).test(res.getHeader('Content-Type'));
		},
		level: 9
	}));

	// Showing stack errors
	app.set('showStackError', true);

	// Set swig as the template engine
	app.engine('server.view.html', consolidate[config.templateEngine]);

	// Set views path and view engine
	app.set('view engine', 'server.view.html');
	app.set('views', './app/views');

	// Environment dependent middleware
	if (process.env.NODE_ENV === 'development') {
		// Enable logger (morgan)
		// app.use(morgan('dev'));

		// Disable views cache
		app.set('view cache', false);
	} else if (process.env.NODE_ENV === 'production') {
		app.locals.cache = 'memory';
	}

	// Use the rollbar error handler to send exceptions to your rollbar account
	app.use(rollbar.errorHandler(config.rollbar.servertoken, { environment: process.env.NODE_ENV }));

	// Use for rollbar client-side errors
	app.locals.env = process.env.NODE_ENV;
	app.locals.rollbar = config.rollbar.clienttoken;

	app.locals.heap = config.heap.token;

	// handles uncaught exceptions and unhandled promises
	// I dont think this makes sense here... RTFM
	// rollbar.handleUncaughtExceptionsAndRejections(process.env.ROLLBAR_ACCESS_TOKEN);


	// Request body parsing middleware should be above methodOverride
	app.use(bodyParser.urlencoded({
		extended: true
	}));
	app.use(bodyParser.json());
	app.use(methodOverride());

	// CookieParser should be above session
	app.use(cookieParser());

	// Setting the app router and static folder
	// Keep this above sessions and passport
	// https://github.com/jaredhanson/passport/issues/14
	app.use(express.static(path.resolve('./public')));

	// Express MongoDB session storage
	// [TODO] this is still causing issues (see https://github.com/meanjs/mean/issues/224)
	// this is inconsistent, be wary of it...

	var cookieSettings = {};
	cookieSettings.maxAge = 14 * 24 * 60 * 60 * 1000;
	if(process.env.NODE_ENV !== 'development') {
		cookieSettings.domain = 'justfix.nyc';
	}

	app.use(session({
		saveUninitialized: false,
		resave: true,
		secret: config.sessionSecret,
		cookie: cookieSettings,
		store: new mongoStore({
			mongooseConnection: db.connection,
			collection: config.sessionCollection
		})
	}));

	// this is pretty rediculous
	// https://github.com/wesleytodd/express-session-passport-cleanup
	app.use(expressSessionPassportCleanup);

	// use passport session
	app.use(passport.initialize());
	app.use(passport.session());

	// connect flash for flash messages
	app.use(flash());

	// Use helmet to secure Express headers
	app.use(helmet.xframe());
	app.use(helmet.xssFilter());
	app.use(helmet.nosniff());
	app.use(helmet.ienoopen());
	app.disable('x-powered-by');


	// use this for ssl renewal
	app.use('/.well-known/acme-challenge/' + process.env.CERTBOT_URL, function(req, res) {
	  res.send(process.env.CERTBOT_KEY);
	});

	// Force HTTPS
	// disable this for ssl renewal (verifies via http)
	if (process.env.NODE_ENV === 'production') {
		app.use('*',function(req,res,next) {
		  if(req.headers['x-forwarded-proto'] !== 'https') {

				res.redirect('https://' + req.hostname + req.url);
			}
		  else {
				next(); /* Continue to other routes if we're not redirecting */
			}
		});
	}

	// Globbing routing files
	config.getGlobbedFiles('./app/routes/**/*.js').forEach(function(routePath) {
		require(path.resolve(routePath))(app);
	});

	// Assume 'not found' in the error msgs is a 404. this is somewhat silly, but valid, you can do whatever you like, set properties, use instanceof etc.
	app.use(function(err, req, res, next) {
		// If the error object doesn't exists
		if (!err) return next();

		// Log it
		console.error(err.stack);

		// Rollbar time!
		rollbar.handleErrorWithPayloadData(err, {}, req);


		// Error page


		// using the message part for the moment
		// res.status(500).render('500', {
		// 	error: err.stack
		// });

		res.status(500).send({
			errors: [{
				message: err.stack
			}]
		});

		/*

			Should this render a page or just return the error?
			When are times that it should do one or the other, and
			how do we distinguish that?

			Questions for new versions that break less.

		 */
	});

	// Assume 404 since no middleware responded
	app.use(function(req, res) {
		res.status(404).render('404', {
			url: req.originalUrl,
			error: 'Not Found'
		});
	});

	if (process.env.NODE_ENV === 'secure') {
		// Log SSL usage
		console.log('Securely using https protocol');

		// Load SSL key and certificate
		var privateKey = fs.readFileSync('./config/sslcerts/key.pem', 'utf8');
		var certificate = fs.readFileSync('./config/sslcerts/cert.pem', 'utf8');

		// Create HTTPS Server
		var httpsServer = https.createServer({
			key: privateKey,
			cert: certificate
		}, app);

		// Return HTTPS server instance
		return httpsServer;
	}

	// Return Express server instance
	return app;
};
