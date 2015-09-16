/// <reference path="node.d.ts" />
/// <reference path="node_modules/rx/ts/rx" />
/// <reference path="es6-promise.d.ts" />
//import http = require("http");
var http = require("http");
var Rx = require("rx");
var ReactiveRestApi;
(function (ReactiveRestApi) {
    var React = (function () {
        function React() {
        }
        React.nodeReadableStream = function (stream) {
            return Rx.Observable.create(function (observer) {
                stream.on("data", function (chunk) { return observer.onNext(chunk); });
                stream.on("error", function (error) { return observer.onError(error); });
                stream.on("end", function () { return observer.onCompleted(); });
            });
        };
        return React;
    })();
    var Parameter = (function () {
        function Parameter() {
        }
        Parameter.hasParams = function (url) {
            return url.match(/\?/) !== null;
        };
        Parameter.getParams = function (queryParamsString, body) {
            var queryParams = this.parseQueryParams(queryParamsString);
            return this.parseBody(body)
                .concat(Rx.Observable.fromArray(queryParams));
        };
        Parameter.parseQueryParams = function (queryParamsString) {
            var pairs = queryParamsString.replace(/^(\?)?/, "").split("&");
            return pairs
                .map(function (pair) { return pair.split("="); })
                .map(function (pair) {
                return {
                    name: pair[0],
                    value: pair[1]
                };
            });
        };
        Parameter.object2parameters = function (obj) {
            return Rx.Observable.create(function (observer) {
                for (var prop in obj) {
                    observer.onNext({
                        name: prop,
                        value: obj[prop]
                    });
                }
                observer.onCompleted();
            });
        };
        Parameter.parseBody = function (body) {
            var _this = this;
            var paramerters = [], str, json;
            return Rx.Observable.create(function (observer) {
                var str = "";
                React.nodeReadableStream(body)
                    .forEach(function (chunk) {
                    str += chunk;
                }, observer.onError, function () {
                    if (str) {
                        var obj = JSON.parse(str);
                        _this.object2parameters(obj).subscribe(observer.onNext, observer.onError, observer.onCompleted);
                    }
                    else {
                        observer.onCompleted();
                    }
                });
            });
        };
        return Parameter;
    })();
    var Url = (function () {
        function Url(request) {
            var url = request.url, hasParams = Parameter.hasParams(url), queryParams;
            console.log(url, hasParams);
            this.path = hasParams ? this.getPath(url) : url;
            queryParams = url.replace(new RegExp("^" + this.path), "");
            if (hasParams)
                this.parameters = Parameter.getParams(queryParams, request);
        }
        Url.prototype.getPath = function (url) {
            return url.match(/^.+?\?/)[0].replace(/\?$/, "");
        };
        return Url;
    })();
    var Server = (function () {
        function Server() {
        }
        Server.create = function (routes, defaultRoute, port) {
            var _this = this;
            Rx.Observable.create(function (observer) {
                var server = http.createServer(function (request, response) {
                    observer.onNext({
                        request: request,
                        routes: routes,
                        response: response
                    });
                });
                server.on("error", observer.onError);
                server.listen(port);
            })
                .map(function (server) {
                var request = server.request, method = request.method, url = new Url(request);
                return {
                    parameters: url.parameters,
                    route: _this.routeFilter(url.path, method, server.routes),
                    response: server.response
                };
            })
                .filter(function (server) { return _this.defaultResponse(server, defaultRoute); })
                .forEach(function (server) {
                var route = server.route, output = _this.getOutput(server.parameters, route.response);
                _this.respond(route, server.response, output);
            });
        };
        Server.respond = function (route, response, output) {
            response.writeHead(route.statusCode, { "Content-Type": route.contentType });
            response.statusCode = route.statusCode;
            output.then(function (out) {
                response.end(out);
            })
                .catch(function (error) {
                response.statusCode = 500;
                response.end(error);
            });
        };
        Server.getOutput = function (parameters, func) {
            var parameterNames = this.getArgumentNames(func);
            console.log(parameterNames);
            var parameterArray = [];
            return new Promise(function (resolve, reject) {
                parameters.forEach(function (param) { return parameterArray.push(param); }, function (error) {
                    throw error;
                }, function () {
                    var values = parameterNames.map(function (name) {
                        var parameter = parameterArray.filter(function (param) { return param.name === name; })[0];
                        if (parameter) {
                            return parameter.value;
                        }
                    });
                    func.apply(null, values).then(resolve).catch(reject);
                });
            });
        };
        Server.getArgumentNames = function (func) {
            var str = func.toString().replace(/^function\s/, "");
            var match = str.match(/\(.*?\)/);
            if (match) {
                str = match[0].replace(/[()\s]/g, "");
                return str.split(",");
            }
        };
        Server.defaultResponse = function (server, defaultRoute) {
            var isError = server.route === undefined;
            if (isError) {
                var route = server.route, output = this.getOutput(server.parameters, route.response);
                server.route = {
                    path: null,
                    method: null,
                    response: defaultRoute.response,
                    statusCode: defaultRoute.statusCode,
                    contentType: defaultRoute.contentType
                };
                this.respond(route, server.response, output);
            }
            return !isError;
        };
        Server.routeFilter = function (path, method, routes) {
            return routes.filter(function (route) { return route.path === path && route.method === method; })[0];
        };
        return Server;
    })();
    ReactiveRestApi.Server = Server;
})(ReactiveRestApi || (ReactiveRestApi = {}));
