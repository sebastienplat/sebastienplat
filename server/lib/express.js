'use strict';

// Module dependencies.
var config = require('../../config/config'),
  express = require('express'),
  morgan = require('morgan'),
  logger = require('./logger'),
  bodyParser = require('body-parser'),
  session = require('express-session'),
  MongoStore = require('connect-mongo')(session),
  favicon = require('serve-favicon'),
  compression = require('compression'),
  methodOverride = require('method-override'),
  cookieParser = require('cookie-parser'),
  helmet = require('helmet'),
  flash = require('connect-flash'),
  consolidate = require('consolidate'),
  path = require('path'),
	webpack = require('webpack'),
	webpackDevMiddleware = require('webpack-dev-middleware'),
	webpackHotMiddleware = require('webpack-hot-middleware');

// Initialize local variables
module.exports.initLocalVariables = function (app) {
  // Setting application local variables
  app.locals.title = config.app.title;
  app.locals.description = config.app.description;
  if (config.secure && config.secure.ssl === true) {
    app.locals.secure = config.secure.ssl;
  }
  app.locals.keywords = config.app.keywords;
  app.locals.googleAnalyticsTrackingID = config.app.googleAnalyticsTrackingID;
  app.locals.facebookAppId = config.facebook.clientID;
  app.locals.jsFiles = config.files.client.js;
  app.locals.cssFiles = config.files.client.css;
  app.locals.livereload = config.livereload;
  app.locals.logo = config.logo;
  app.locals.favicon = config.favicon;
	
  // Passing the request url to environment locals
  app.use(function (req, res, next) {
    res.locals.host = req.protocol + '://' + req.hostname;
    res.locals.url = req.protocol + '://' + req.headers.host + req.originalUrl;
    next();
  });
};

// Initialize application middleware
module.exports.initMiddleware = function (app) {
  // Showing stack errors
  app.set('showStackError', true);

  // Enable jsonp
  app.enable('jsonp callback');

  // Should be placed before express.static
	 app.use(compression());
	/*
  app.use(compression({
		filter: function (req, res) {
      return (/json|text|javascript|css|font|svg/).test(res.getHeader('Content-Type'));
    },
		level: 9
  }));
	*/
  
	// Initialize favicon middleware
  app.use(favicon(app.locals.favicon));

  // Enable logger (morgan)
  app.use(morgan(logger.getFormat(), logger.getOptions()));

  // Environment dependent middleware
  if (process.env.NODE_ENV === 'development') {
    // Disable views cache
    app.set('view cache', false);
  } else if (process.env.NODE_ENV === 'production') {
    app.locals.cache = 'memory';
  }

  // Request body parsing middleware should be above methodOverride
  app.use(bodyParser.urlencoded({
		limit: '50mb',
    extended: true
  }));
  app.use(bodyParser.json({limit: '50mb'}));
  app.use(methodOverride());

  // Add the cookie parser and flash middleware
  app.use(cookieParser());
  app.use(flash());
};

// Configure view engine
module.exports.initViewEngine = function (app) {
  // Set swig as the template engine
  app.engine('server.view.html', consolidate[config.templateEngine]);

  // Set views path and view engine (server.view.html as extension)
  app.set('view engine', 'server.view.html');
  app.set('views', './');
};

// Configure Express session (MongoDB session storage)
module.exports.initSession = function (app, db) {
  app.use(session({
    saveUninitialized: true,
    resave: true,
    secret: config.sessionSecret,
    cookie: {
      maxAge: config.sessionCookie.maxAge,
      httpOnly: config.sessionCookie.httpOnly,
      secure: config.sessionCookie.secure && config.secure.ssl
    },
    key: config.sessionKey,
    store: new MongoStore({
      mongooseConnection: db.connection,
      collection: config.sessionCollection
    })
  }));
};

// Invoke modules server configuration
module.exports.initModulesConfiguration = function (app, db) {
  config.files.server.configs.forEach(function (configPath) {
    require(path.resolve(configPath))(app, db);
  });
};

// Configure Helmet headers configuration (secure Express headers)
module.exports.initHelmetHeaders = function (app) {
  var SIX_MONTHS = 15778476000;
  app.use(helmet.xframe());
  app.use(helmet.xssFilter());
  app.use(helmet.nosniff());
  app.use(helmet.ienoopen());
  app.use(helmet.hsts({
    maxAge: SIX_MONTHS,
    includeSubdomains: true,
    force: true
  }));
  app.disable('x-powered-by');
};

// Configure the modules static routes (globbing)
module.exports.initModulesClientRoutes = function (app) {
  app.use('/', express.static(path.resolve('./public'))); // Setting the app router and static folder
  config.folders.client.forEach(function (staticPath) {
    app.use(staticPath, express.static(path.resolve('./' + staticPath)));
  });
};

// Configure the modules ACL policies (globbing)
module.exports.initModulesServerPolicies = function (app) {
  config.files.server.policies.forEach(function (policyPath) {
    require(path.resolve(policyPath)).invokeRolesPolicies();
  });
};

// Configure the modules server routes
module.exports.initModulesServerRoutes = function (app) {
  // Globbing routing files
  config.files.server.routes.forEach(function (routePath) {
    require(path.resolve(routePath))(app);
  });
};

// Configure error handling
module.exports.initErrorRoutes = function (app) {
  app.use(function (err, req, res, next) {
    if (!err) return next();				// If the error object doesn't exists
    console.error(err.stack); 			// Log it
    res.redirect('/server-error');	// Redirect to error page
  });
};

// Configure Socket.io
module.exports.configureSocketIO = function (app, db) {
  var server = require('./socket.io')(app, db); // Load the Socket.io configuration
  return server; // Return server object
};

// Configure webpack hot reload middleware
module.exports.initWebpackMiddleware = function (app) {
	var WebpackConfig = require('../../webpack.config'),
			WebpackCompiler = webpack(WebpackConfig);
	
	app.use(webpackDevMiddleware(WebpackCompiler, {
		publicPath: WebpackConfig.output.publicPath,
		stats: {colors: true}
	}));
	
	app.use(webpackHotMiddleware(WebpackCompiler, {  
    log: console.log, 
		path: '/__webpack_hmr', 
		heartbeat: 10 * 1000
	}));

};

// Initialize the Express application
module.exports.init = function (db) {
  
  var app = express();										// Initialize express app  
	if (process.env.NODE_ENV === 'development') {
		this.initWebpackMiddleware(app);				// Initialize webpack hot reload middleware
	}
	
  this.initLocalVariables(app);						// Initialize local variables 
  this.initMiddleware(app);								// Initialize Express middleware
  this.initViewEngine(app);								// Initialize Express view engine
  this.initHelmetHeaders(app);						// Initialize Helmet security headers
  this.initModulesClientRoutes(app);			// Initialize modules static client routes, before session!
  this.initSession(app, db);							// Initialize Express session
  this.initModulesConfiguration(app);			// Initialize Modules configuration
  this.initModulesServerPolicies(app);		// Initialize modules server authorization policies
  this.initModulesServerRoutes(app);			// Initialize modules server routes
  this.initErrorRoutes(app);							// Initialize error routes

	app = this.configureSocketIO(app, db);	// Configure Socket.io
  return app;
	
};
