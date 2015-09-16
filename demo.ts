/// <reference path="reactive-rest-api.ts" />

function testResponse(name: string = "world"): Promise<string> {
	return new Promise<string>(resolve => {
		resolve(`hello ${name}`);
	});
}

var testRoute: ReactiveRestApi.Route = {
	path: "/test",
	method: "GET",
	response: testResponse,
	statusCode: 200,
	contentType: "text/text"
};

var errorRoute: ReactiveRestApi.DefaultRoute = {
	response: "error",
	statusCode: 404,
	contentType: "text/text"
}

ReactiveRestApi.Server.create([testRoute], errorRoute, 9000);