/// <reference path="reactive-rest-api.ts" />

function testResponse(name: string = "world"): Promise<string> {
	return new Promise<string>(resolve => {
		resolve(`hello ${name}`);
	});
}


var options: ReactiveRestApi.ServerOptions = {
	"routePrefix": "/api",
	"port": 9000,
	"routes": [
		{
			"name": "test",
			"object_defenition": {
				"test": "",
				"test1": ""
			},
			"get": {
				"path": "/{test}",
				"promise": new Promise<string>(resolve => resolve("get"))
			},
			"get_all": {
				"promise": new Promise<string>(resolve => resolve("get all"))
			},
			"post": {
				"path": "/{test, test1}",
				"promise": new Promise<string>(resolve => resolve("post"))
			},
			"put": {
				"path": "/{test, test1}",
				"promise": new Promise<string>(resolve => resolve("put"))
			},
			"delete": {
				"path": "/{test}",
				"promise": new Promise<string>(resolve => resolve("delete"))
			}
		}
	]
};

ReactiveRestApi.Server.create(options);