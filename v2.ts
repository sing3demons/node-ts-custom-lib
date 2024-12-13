import type { TSchema, Static, TObject } from "@sinclair/typebox";
import { Type as t } from "@sinclair/typebox";
import express, { Response, Request, NextFunction } from "express";

type ExtractParams<Path extends string> = Path extends `${string}:${infer ParamName}/${infer Rest}`
    ? ParamName | ExtractParams<Rest>
    : Path extends `${string}:${infer ParamName}`
    ? ParamName
    : never;

type HttpRequestMethod =
    | "ALL"
    | "GET"
    | "HEAD"
    | "POST"
    | "PUT"
    | "DELETE"
    | "PATCH"
    | "CONNECT";

type HandlerContext =
    | any[]
    | Blob
    | string
    | number
    | Record<any, any>;

type Handler<
    Route extends string,
    Schema extends {
        body?: TObject;
        query?: TObject;
        headers?: TObject;
    }
> = (
    context: {
        body: Schema["body"] extends TObject
        ? Static<Schema["body"]>
        : Record<string, any>;
        params: Record<ExtractParams<Route>, string>;
        query: Schema["query"] extends TObject
        ? Static<Schema["query"]>
        : Record<string, string>;
        headers: Record<string, string>;
        cookies: Record<string, string | undefined>;
        set: {
            headers: Record<string, string>;
            status: number;
        };
        detailLog: DetailLogger
    }
) => Promise<HandlerContext> | HandlerContext;




class CustomRoute {
    private readonly _RoutesMetadata: Array<{
        method: HttpRequestMethod;
        path: string;
        handler: Function;
        schema?: {
            body?: Record<string, TSchema>;
            query?: Record<string, TSchema>;
            headers?: Record<string, TSchema>;
        };
    }> = [];


    private route<
        Method extends HttpRequestMethod,
        PathName extends `/${string}` | "*",
        Schema extends {
            body?: TObject;
            query?: TObject;
            headers?: TObject;
        }
    >(
        method: Method,
        route: PathName,
        handler: Handler<PathName, Schema>,
        schema?: Schema
    ): this {

        this._RoutesMetadata.push({
            method,
            path: route,
            handler,
            schema,
        });
        return this;
    }

    private funcGetParams(url: string, route: string): Record<string, string> {
        const routeParts = route.split("/").filter(Boolean);
        const urlParts = url.split("/").filter(Boolean);

        const params: Record<string, string> = {};

        routeParts.forEach((part, index) => {
            if (part.startsWith(":")) {
                params[part.substring(1)] = urlParts[index] || "";
            }
        });

        return params;
    }

    private initializeRouterHandler(): void {

        for (const route of this._RoutesMetadata) {
            console.log(route.method, route.path, route.handler);








            // (this.app as any)[method.toLowerCase()](route.path, );



        }
    }


    private isRouteMatch(route: any, method: string, url: string): boolean {
        return (
            (route.method === method || route.method === "ALL") &&
            (route.path === "*" || route.path === url || route.path.includes(":"))
        );
    }

    // private parseRequestBody(req: any, route: any): any {
    //     if (route.schema?.body) {
    //         const rawBody = req.body || "{}";
    //         const parsedBody = JSON.parse(rawBody);
    //         if (route.schema.body) {
    //             const compiledSchema = TypeCompiler.Compile(t.Object(route.schema.body));
    //             if (!compiledSchema.Check(parsedBody)) {
    //                 throw new Error("Invalid body format");
    //             }
    //         }
    //         return parsedBody;
    //     }
    //     return {};
    // }

    // private parseRequestQuery(url: string, route: any): any {
    //     if (route.schema?.query) {
    //         const query = new URLSearchParams(url.split("?")[1]);
    //         const queryObject: Record<string, string> = {};
    //         for (const [key, value] of query) {
    //             queryObject[key] = value;
    //         }
    //         const compiledSchema = TypeCompiler.Compile(t.Object(route.schema.query));
    //         if (!compiledSchema.Check(queryObject)) {
    //             throw new Error("Invalid query format");
    //         }
    //         return queryObject;
    //     }
    //     return {};
    // }

    private createContext(req: Request, parsedBody: any, params: any, parsedQuery: any): any {
        return {
            body: parsedBody,
            params,
            query: parsedQuery,
            headers: req.headers,
            set: {
                headers: {},
                status: 200,
            },
            detailLog: new DetailLogger(),
        };
    }

    private sendResponse(res: Response, context: any, result: any): void {
        if (context.set.status) {
            res.status(context.set.status);
        }
        res.json(result);
    }

    private sendErrorResponse(res: Response, error: any): void {
        res.status(400);
        res.json(JSON.stringify({ error: error.message }));
    }

    private sendNotFoundResponse(res: any): void {
        res.writeHead(404);
        res.end("Not Found");
    }


    public get<PathName extends `/${string}` | "*",
        Schema extends {
            body?: TObject;
            query?: TObject;
            headers?: TObject;
        }>(
            path: PathName,
            handler: Handler<PathName, Schema>,
            schema?: Schema) {
        return this.route("GET", path, handler, schema);
    }

    public post<PathName extends `/${string}` | "*",
        Schema extends {
            body?: TObject;
            query?: TObject;
            headers?: TObject;
        }>(
            path: PathName,
            handler: Handler<PathName, Schema>,
            schema?: Schema) {
        return this.route("POST", path, handler, schema);
    }

    public put<PathName extends `/${string}` | "*",
        Schema extends {
            body?: TObject;
            query?: TObject;
            headers?: TObject;
        }>(
            path: PathName,
            handler: Handler<PathName, Schema>,
            schema?: Schema) {
        return this.route("PUT", path, handler, schema);
    }

    public delete<PathName extends `/${string}` | "*",
        Schema extends {
            body?: TObject;
            query?: TObject;
            headers?: TObject;
        }>(
            path: PathName,
            handler: Handler<PathName, Schema>,
            schema?: Schema) {
        return this.route("PUT", path, handler, schema);
    }

    public patch<PathName extends `/${string}` | "*",
        Schema extends {
            body?: TObject;
            query?: TObject;
            headers?: TObject;
        }>(
            path: PathName,
            handler: Handler<PathName, Schema>,
            schema?: Schema) {
        return this.route("PUT", path, handler, schema);
    }

   private readonly app = express();

    public listen<ListenPORT extends number>(port: ListenPORT) {
        this._RoutesMetadata.forEach((route) => {
            const method = route.method.toLowerCase();
            const path = route.path;
            const handler = route.handler;
            const schema = route.schema;

            (this.app as any)[method.toLocaleLowerCase()](path, async (req: Request, res: Response) => {
                try {
                    const params = this.funcGetParams(req.url, path);
                    const parsedBody = req.body;
                    const parsedQuery = req.query;

                    const context = this.createContext(req, parsedBody, params, parsedQuery);
                    const result = await handler(context);

                    return this.sendResponse(res, context, result);
                } catch (error) {
                    this.sendErrorResponse(res, error);
                }
            });
        });


        this.app.listen(port, () => {
            console.log(`Server running at http://localhost:${port}`);
        });


    }
}

class DetailLogger {
    public static log(message: string) {
        console.log(message);
    }

    public Log(message: string) {
        console.log(message);
    }
}

export { CustomRoute, t, HttpRequestMethod, Handler };
