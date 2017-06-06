var path = require("path");
var urlJoin = require("url-join");
var cloneDeep = require("lodash.clonedeep");
var get = require("lodash.get");
var merge = require("lodash.merge");
var proxy = require("http-proxy").createProxyServer({});

// Default proxy fallback
var fallback = function fallback(target) {
	return function(err, req, res) {
		return res.status(500).json({
			err: "Error while proxing to " + target,
		});
	};
};

// Generate final config based on received config
var generateConfig = function generateConfig(config, onlyUsePrefix) {
	var prefix = config.prefix || "/proxy";

	prefix = path.resolve("/", prefix);

	var routes = [{
		target: "",
		route: prefix,
	}];

	if (!onlyUsePrefix) {
		routes.push({
			target: "files/",
			route: [
				"/files",
				"/file",
				prefix + "/files",
				prefix + "/file",
				"/api/1.0.0/files",
				"/api/1.0.0/file",
			],
		});
	}

	return {
		target: urlJoin(config.target, "/"),
		changeOrigin: true,
		headers: merge({}, {
			host: urlJoin(config.host, "/"),
			apikey: config.apikey,
			tenant: config.tenant,
		}, config.headers),
		routes: routes,
	};
};

// Convert function params to generalized config
var convertParams = function convertParams(app, target, apikey, tenant, host) {
	return {
		target: target,
		host: host,
		apikey: apikey,
		tenant: tenant,
	};
};

// Proxy functionality
var proxyMiddleware = function(config, route) {
	config.target += get(route, "target", "");
	delete config.routes;

	return function(req, res) {
		return proxy.web(req, res, config, fallback);
	};
};

// WCM proxy handler
var main = function main(app, params) {
	// Get function arguments
	var args = [].slice.call(arguments);
	// Convert params to params object if there are more then 2
	var c = args.length > 2 ? convertParams.apply(args[0], args) : params;
	// Generate final config
	var config = generateConfig(c);

	// Setup proxy for every default WCM route.
	for (var i = 0; i < config.routes.length; i++) {
		app.use(config.routes[i].route, proxyMiddleware(cloneDeep(config), config.routes[i]));
	}
};

main.addProxyRoute = function(app, routes, proxyConfig) {
	app.use(routes, proxyMiddleware(generateConfig(proxyConfig, true)));
};

module.exports = main;
