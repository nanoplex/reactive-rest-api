/// <reference path="node.d.ts" />
/// <reference path="node_modules/rx/ts/rx" />
/// <reference path="es6-promise.d.ts" />

//import http = require("http");

var http = require("http");
var Rx = require("rx");

module ReactiveRestApi {
	class React {
		static nodeReadableStream(stream: NodeJS.ReadableStream): Rx.Observable<Buffer> {
			return Rx.Observable.create<Buffer>(observer => {
				stream.on("data", chunk => observer.onNext(chunk));
				stream.on("error", error => observer.onError(error));
				stream.on("end", () => observer.onCompleted());
			});
		}
	}
	
	export interface Route {
		path: string;
		method: string;
		response: Function;
		statusCode: number;
		contentType: string;
	}
	
	export interface DefaultRoute {
		response;
		statusCode: number;
		contentType: string;
	}
	
	
	class Parameter {
		name: string;
		value: any;
		
		static hasParams(url: string): boolean {
			return url.match(/\?/) !== null;
		}
		
		static getParams(queryParamsString: string, body: NodeJS.ReadableStream): Rx.Observable<Parameter> {
			var queryParams = this.parseQueryParams(queryParamsString);
			
			return this.parseBody(body)
				.concat(Rx.Observable.fromArray(queryParams))
		}
		
		private static parseQueryParams(queryParamsString: string): Parameter[] {
			var pairs = queryParamsString.replace(/^(\?)?/, "").split("&");
			
			return pairs
				.map(pair => pair.split("="))
				.map(pair => {
					return {
						name: pair[0],
						value: pair[1]
					}
				})
		}
		
		private static object2parameters(obj: any): Rx.Observable<Parameter> {
			return Rx.Observable.create<Parameter>(observer => {
				for (var prop in obj) {
					observer.onNext({
						name: prop,
						value: obj[prop]
					});
				}
				
				observer.onCompleted();
			})
		}
		
		private static parseBody(body: NodeJS.ReadableStream): Rx.Observable<Parameter> {
			var paramerters: Parameter[] = [],
				str: string,
				json;
				
			return Rx.Observable.create<Parameter>(observer => {
				var str: string = "";
				
				React.nodeReadableStream(body)
					.forEach(
						chunk => {
							str += chunk;
						}, 
						observer.onError,
						() => {
							
							if (str) {
								var obj = JSON.parse(str);
								
								this.object2parameters(obj).subscribe(
									observer.onNext,
									observer.onError,
									observer.onCompleted
								);
							}
							else {
								observer.onCompleted();
							}
						});
			});
		}
	}
	
	class Url {
		path: string;
		parameters: Rx.Observable<Parameter>;
		
		constructor(request: http.IncomingMessage) {
			var url = request.url,
				hasParams = Parameter.hasParams(url),
				queryParams: string;
			
			console.log(url, hasParams);
			
			this.path = hasParams ? this.getPath(url) : url;
			
			queryParams = url.replace(new RegExp("^" + this.path), "");
			
			if (hasParams)
				this.parameters = Parameter.getParams(queryParams, request);
		}
		
		private getPath(url: string): string {
			return url.match(/^.+?\?/)[0].replace(/\?$/, "");
		}
	}
	
	export class Server {
		static create(routes: Route[], defaultRoute: DefaultRoute, port: number) {
			Rx.Observable.create<{request: http.IncomingMessage, routes: Route[], response: http.ServerResponse}>(observer => {
				var server = http.createServer((request, response) => {
					observer.onNext({
						request,
						routes,
						response
					});
				});
				
				server.on("error", observer.onError);
				
				server.listen(port);
			})
			.map(server => {
				var request = server.request,
					method = request.method,
					url = new Url(request);
					
				return {
					parameters: url.parameters,
					route: this.routeFilter(url.path, method, server.routes),
					response: server.response
				}
			})
			.filter(server => this.defaultResponse(server, defaultRoute))
			.forEach(server => {
				var route = server.route,
					output = this.getOutput(server.parameters, route.response);
				
				this.respond(route, server.response, output);
			});
		}
		
		private static respond(route: Route, response: http.ServerResponse, output: Promise<string>) {
			response.writeHead(route.statusCode, {"Content-Type": route.contentType});
			response.statusCode = route.statusCode;
			
			output.then(out => {
				response.end(out);
			})
			.catch(error => {
				response.statusCode = 500;
				response.end(error);
			});
		}
		
		private static getOutput(parameters: Rx.Observable<Parameter>, func: Function): Promise<string> {
			var parameterNames = this.getArgumentNames(func);
			console.log(parameterNames);
			var parameterArray: Parameter[] = [];
			
			return new Promise((resolve, reject) => {
				parameters.forEach(
					param => parameterArray.push(param),
					error => {
						throw error
					},
					() => {
						var values = parameterNames.map(name => {
							var parameter = parameterArray.filter(param => param.name === name)[0];
							
							if (parameter) {
								return parameter.value;
							}
						});
						
						func.apply(null, values).then(resolve).catch(reject);
					});
			});
		}
		
		private static getArgumentNames(func: Function): string[] {
			var str = func.toString().replace(/^function\s/, "");
			var match = str.match(/\(.*?\)/);
			if (match) {
				str = match[0].replace(/[()\s]/g, "");
				
				return str.split(",");
			}
		}
		
		private static defaultResponse(server: { route: Route, parameters: Rx.Observable<Parameter>, response: http.ServerResponse }, defaultRoute: DefaultRoute): boolean {
			var isError = server.route === undefined
			
			if (isError) {
				var route = server.route,
					output = this.getOutput(server.parameters, route.response);
				
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
		}
		
		private static routeFilter(path, method, routes: Route[]): Route {
			return routes.filter(route => route.path === path && route.method === method)[0];
		}
	}	
}