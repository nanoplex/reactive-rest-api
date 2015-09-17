/// <reference path="node.d.ts" />
/// <reference path="node_modules/rx/ts/rx" />
/// <reference path="es6-promise.d.ts" />
//import http = require("http");
var http = require("http");
var Rx = require("rx");
var RestApi;
(function (RestApi) {
    var Url = (function () {
        function Url(request) {
            var url = request.url, path = this.parse_path(url), query_parameters = url.replace(new RegExp("^" + path), "");
            this.path = path;
            this.method = request.method;
            this.parameters = this.parse_parameters(query_parameters, request);
        }
        Url.prototype.parse_path = function (url) {
            var match = url.match(/^\/\w+/);
            return match ? match[0] : url;
        };
        Url.prototype.parse_parameters = function (query_parameter_str, body) {
            var query_parameters = Rx.Observable.fromArray(this.parse_query_parameters(query_parameter_str)), body_parameters = this.parse_body_parameters(this.observable_readable_stream(body));
            return query_parameters; //.concat(body_parameters);
        };
        Url.prototype.parse_body_parameters = function (observale) {
            var str = "", json;
            return null;
        };
        Url.prototype.observable_readable_stream = function (body) {
            return Rx.Observable.create(function (observer) {
                body.on("data", observer.onNext);
                body.on("error", observer.onError);
                body.on("end", function () { return observer.onCompleted(); });
            });
        };
        Url.prototype.parse_query_parameters = function (query_parameter_str) {
            var has_value = null, has_params = false;
            if (query_parameter_str === "" || query_parameter_str === "/")
                has_value = false;
            else if (query_parameter_str.match(/\/\w+/) !== null)
                has_value = true;
            else if (query_parameter_str.match(/\/\?/) !== null)
                has_params = true;
            query_parameter_str = query_parameter_str.replace(/\/(\?)?/, "");
            if (has_value === true) {
                return [{
                        name: "_id",
                        value: query_parameter_str
                    }];
            }
            else if (has_value === false)
                return undefined;
            else if (has_params) {
                return query_parameter_str.split("&")
                    .map(function (pair) { return pair.split("="); })
                    .map(function (pair) {
                    return {
                        name: pair[0],
                        value: pair[1]
                    };
                });
            }
        };
        return Url;
    })();
    var Server = (function () {
        function Server(options) {
            var _this = this;
            this.create(options)
                .map(function (server) {
                return {
                    promise: _this.get_route(server.url, server.routes),
                    response: server.response
                };
            })
                .forEach(function (server) {
                var res = server.response;
                server.promise.then(function (output) {
                    if (output) {
                        _this.respond(output, 200, res);
                    }
                    else {
                        _this.respond('{"error": "no path found"}', 404, res);
                    }
                }).catch(function (error) {
                    return _this.respond("{\"error\": " + error + "}", 500, res);
                });
            }, function (error) { console.log("[ERROR]", error); });
        }
        Server.prototype.create = function (options) {
            return Rx.Observable.create(function (observer) {
                var server = http.createServer(function (request, response) {
                    observer.onNext({
                        url: new Url(request),
                        routes: options.routes,
                        response: response
                    });
                });
                server.on("error", observer.onError);
                server.listen(options.port);
            });
        };
        Server.prototype.respond = function (output, status_code, response) {
            response.writeHead(status_code, { "Content-Type": "application/json" });
            response.statusCode = status_code;
            response.end(output);
        };
        Server.prototype.get_route = function (url, routes) {
            var _this = this;
            var method = url.method.toLocaleLowerCase();
            return new Promise(function (resolve, reject) {
                var count = 0, self = _this;
                function routeFilter() {
                    method = (count === 0 && method === "get") ? "get_all" : method;
                    routes.filter(function (route) { return ("/" + route.name === url.path); })
                        .map(function (route) {
                        self.execute_method(route[method], route.object_defenition, url.parameters).then(resolve).catch(reject);
                    });
                }
                url.parameters.subscribe(function () { return count++; }, routeFilter, routeFilter);
            });
        };
        Server.prototype.execute_method = function (method, object_defenifion, paramerters) {
            var object_copy = JSON.parse(JSON.stringify(object_defenifion));
            return new Promise(function (resolve, reject) {
                paramerters.forEach(function (parameter) {
                    for (var prop in object_defenifion) {
                        if (prop === parameter.name) {
                            object_copy[prop] = parameter.value;
                        }
                        else {
                            delete object_copy[prop];
                        }
                    }
                }, reject, function () { return method(object_copy).then(resolve).catch(reject); });
            });
        };
        return Server;
    })();
    RestApi.Server = Server;
})(RestApi || (RestApi = {}));
/// <reference path="reactive-rest-api.ts" />
var route = {
    name: "test",
    object_defenition: {
        _id: Number,
        test: String
    },
    get: function (obj) { return new Promise(function (resolve) { return resolve(JSON.stringify(obj)); }); },
    get_all: function (obj) { return new Promise(function (resolve) { return resolve("get all"); }); },
    post: function (obj) { return new Promise(function (resolve) { return resolve(); }); },
    put: function (obj) { return new Promise(function (resolve) { return resolve(); }); },
    delete: function (obj) { return new Promise(function (resolve) { return resolve(); }); }
};
var options = {
    port: 9000,
    routes: [route]
};
new RestApi.Server(options);
//# sourceMappingURL=demo.js.map