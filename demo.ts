/// <reference path="reactive-rest-api.ts" />

interface item {
	_id: number
	test: string
}

var route: RestApi.Route<item> = {
	name: "test",
	object_defenition: {
		_id: Number,
		test: String
	},
	get: (obj: item) => new Promise<string>(resolve => resolve(JSON.stringify(obj))),
	get_all: (obj) => new Promise<string>(resolve => resolve("get all")),
	post: (obj: item) => new Promise<any>(resolve => resolve()),
	put: (obj: item) => new Promise<any>(resolve => resolve()),
	delete: (obj: item) => new Promise<any>(resolve => resolve())
};

var options: RestApi.Options = {
	port: 9000,
	routes: [ route ]
};

new RestApi.Server(options);