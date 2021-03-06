/// <reference path="node.d.ts" />
/// <reference path="node_modules/rx/ts/rx" />
/// <reference path="es6-promise.d.ts" />

//import http = require("http");

var http = require("http");
var Rx = require("rx");

module RestApi {
	
	interface Parameter {
		name: string
		value: string;
	}
	
	export class Url {
		path: string
		method: string
		parameters: Rx.Observable<Parameter>
		
		constructor(request: http.IncomingMessage) {
			let url = request.url,
				path = Url.parse_path(url),
				query_parameters = url.replace(new RegExp("^" + path), "");
			
			this.path = path;
			this.method = request.method;
			this.parameters = this.parse_parameters(query_parameters, request);
		}
		
		static parse_path(url: string) {
			if (url) {
				let match = url.match(/^\/\w+/);
			
				return match ? match[0] : undefined;
			}
		} 
		
		parse_parameters(query_parameter_str: string, body: NodeJS.ReadableStream): Rx.Observable<Parameter> {
			let query_parameters: Rx.Observable<Parameter> = 
					Rx.Observable.fromArray(Url.parse_query_parameters(query_parameter_str));
			
			return query_parameters;//.concat(body_parameters);
		}
		
		parse_body_parameters(observale: Rx.Observable<Buffer>): Rx.Observable<Parameter> {
			let str = "",
				json: Parameter[];
				
			return null;
		}
		
		observable_readable_stream(body: NodeJS.ReadableStream): Rx.Observable<Buffer> {
			return Rx.Observable.create<Buffer>(observer => {
				body.on("data", observer.onNext);
				body.on("error", observer.onError);
				body.on("end", () => observer.onCompleted());
			});
		}
		
		static parse_query_parameters(query_parameter_str: string): Parameter[] {
			let has_value: boolean = null,
				has_params: boolean = false;
			
			if (query_parameter_str) {
				if (query_parameter_str === "" || query_parameter_str === "/") has_value = false;
				else if (query_parameter_str.match(/\/\w+/) !== null) has_value = true;
				else if (query_parameter_str.match(/\/\?/) !== null) has_params = true;
				
				query_parameter_str = query_parameter_str.replace(/\/(\?)?/, "");
				
				if (has_value === true) {
					return [{ 
						name: "_id", 
						value: query_parameter_str
					}];	
				}
				else if (has_params) {
					return query_parameter_str.split("&")
						.map(pair => pair.split("="))
						.map(pair => {
							return {
								name: pair[0],
								value: pair[1]
							}
						});
			}
			
			}
		}
	}
	
	export interface Route<T> {
		name: string;
		object_defenition: any;
		get: (object: T) => Promise<string | void>;
		get_all: (object: T) => Promise<string | void>;
		post: (object: T) => Promise<string | void>;
		put: (object: T) => Promise<string | void>;
		delete: (object: T) => Promise<string | void>;
	}
	
	export interface Options {
		port: number;
		routes: Route<any>[];
	}
	
	export class Server {
		constructor(options: Options) {
			this.create(options)
				.map(server => {
					return {
						promise: this.get_route(server.url, server.routes),
						response: server.response
					};
				})
				.forEach(server => {
					let res = server.response;
					
					server.promise.then(output => {
						if (output) {
							this.respond(output, 200, res);
						} else {
							this.respond('{"error": "no path found"}', 404, res);
						}
					}).catch(error => 
						this.respond(`{"error": ${error}}`, 500, res));
				},
				error => {console.log("[ERROR]", error)});
		}
		
		create(options: Options): Rx.Observable<{ url: Url, routes: Route<any>[], response: http.ServerResponse}> {
			return Rx.Observable.create<{ url: Url, routes: Route<any>[], response: http.ServerResponse}>(observer => {
				let server = http.createServer((request, response) => {
					observer.onNext({
						url: new Url(request),
						routes: options.routes,
						response
					});
				});
				
				server.on("error", observer.onError);
				
				server.listen(options.port);
			});
		}
		
		respond(output: any, status_code: number, response: http.ServerResponse) {
			response.writeHead(status_code, { "Content-Type": "application/json" });
			response.statusCode = status_code;
			response.end(output);
		}
		
		static get_route(url: Url, routes: Route<any>[]): Promise<any> {
			let method = url.method.toLocaleLowerCase();
			
			return new Promise<any>((resolve, reject) => {
				let count = 0;
				
				url.parameters.subscribe(
					() => count++,
					() => this.route_filter(url, method, count, routes, { resolve, reject }),
					() => this.route_filter(url, method, count, routes, { resolve, reject })
				);
			});
		}
		
		static route_filter(url: Url, method: string, count: number, routes: Route<any>[], promise: { resolve: (value?: any) => void, reject: (error?: any) => void }) {
			method = (count === 0 && method === "get") ? "get_all" : method;
			
			routes.filter(route => ("/" + route.name === url.path))
				.map(route => {
					this.execute_method(route[method], route.object_defenition, url.parameters).then(promise.resolve).catch(promise.reject);
				});
		}
		
		static parse_value(value: string, type: string): any {
			type = type.replace(/function /,"").match(/\w+/)[0];
			
			if (type === "Number") {
				return parseInt(value, 10);
			} else if (type === "Object") {
				return JSON.stringify(value);
			} else {
				return value.toString();
			}
		}
		
		static execute_method(method: (object: any) => Promise<string | void>, object_defenifion: any, paramerters: Rx.Observable<Parameter>): Promise<string | void> {
			var object_copy = JSON.parse(JSON.stringify(object_defenifion));
			
			return new Promise<string | void>((resolve, reject) => {
				paramerters.forEach(parameter => {
					for (var prop in object_defenifion) {
						if (prop === parameter.name) {
							object_copy[prop] = this.parse_value(parameter.value, object_copy[prop]);
						} else {
							delete object_copy[prop];
						}
					}
				},
				reject,
				() => method(object_copy).then(resolve).catch(reject));
			});
		}
	}
}