/// <reference path="reactive-rest-api.ts" />

interface Test {
	name: string;
	func: () => Promise<any>;
}

class Tests {
	constructor(public tests: Test[]) {}
	
	run() {
		function testFailed(name, error) {
			console.log(`${name} failed: ${error}`);
		}
		
		this.tests.forEach(test => {
			test.func().catch(error => testFailed(test.name, error));
		});
	}
}


var url_parse_path_test: Test = {
		name: "url parse path",
		func: () => {
			var path = RestApi.Url.parse_path("/test"),
				path1 = RestApi.Url.parse_path("/test/test"),
				path3 = RestApi.Url.parse_path(null);
			
			return new Promise((resolve, reject) => {
				if (path !== "/test") reject();
				if (path1 !== "/test") reject();
				if (path3 !== undefined) reject();
				
				resolve();
			});
		}
	},
	url_parse_query_parameters: Test = {
		name: "url parse query parameters",
		func: () => {
			var idParam = RestApi.Url.parse_query_parameters("/value")[0],
				namedParam = RestApi.Url.parse_query_parameters("/?param=value")[0],
				multipleParams = RestApi.Url.parse_query_parameters("/?param1=value&param2=value"),
				nullParam = RestApi.Url.parse_query_parameters(null);
			
			return new Promise((resolve, reject) => {
				if (idParam.name !== "_id" && idParam.value === "value") 
					reject("id param failed");
					
				if (namedParam.name !== "param" && namedParam.value !== "value") 
					reject("named param failed");
					
				if (multipleParams[0].name !== "param1" && multipleParams[0].value !== "value" && 
					multipleParams[1].name !== "param2" && multipleParams[1].value !== "value") 
					reject("multiple params failed");
					
				if (nullParam !== undefined)
					reject("null test failed");
				
				resolve();
			});
		}	
	},
	server_get_route: Test = {
		name: "server get route",
		func: () => {
			var request = {
					url: "/test/1",
					method: "GET"
				},
				url = new RestApi.Url(request),
				testRoute: RestApi.Route<{ _id: number, test: string }> = {
					name: "test",
					object_defenition: {
						_id: Number,
						test: String
					},
					get: (obj) => new Promise(resolve => resolve(obj._id))
				},
				promise = RestApi.Server.get_route(url, [testRoute]);
				
			return new Promise((resolve, reject) => {
				promise.then(output => {
					if (output !== 1) reject();
					else resolve();
				});
			})
			
		}	
	},
	tests = [
		url_parse_path_test,
		url_parse_query_parameters,
		server_get_route
	];
	
new Tests(tests).run();