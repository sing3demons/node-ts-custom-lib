import { Type, Static, TSchema } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler';
 import http from 'http';
import express,{ Request, Response, RequestHandler, Express } from "express";
import Fastify, {FastifyRequest, FastifyReply, FastifyInstance} from 'fastify';
import { v7 as uuid, v4 as uuidv4 } from 'uuid';

type RequestContext = {
    session: string;
    invoke: string;
}

declare global {
    namespace Express {
        interface Request extends RequestContext { }
    }
}
declare module 'fastify' {
    interface FastifyRequest extends RequestContext { }
    interface FastifyReply { json: (body: unknown) => void }
}

enum Framework {
    EXPRESS = 'express',
    FASTIFY = 'fastify',
}

type MaybePromise<T = unknown> = T | Promise<T>;
// Utility Types
type ExtractParams<T extends string> = T extends `${infer _Start}:${infer Param}/${infer Rest}`
    ? [Param, ...ExtractParams<Rest>]
    : T extends `${infer _Start}:${infer Param}`
    ? [Param]
    : [];

type ExtractParamsFromPath<T extends string[]> = { [K in T[number]]: string };
type RouteHandler<P = any, B = any, Q = any> = (ctx: ICtx<P, B, Q>) => MaybePromise;
type THandler<T extends string, B extends TSchema, Q extends TSchema> = RouteHandler<
    ExtractParamsFromPath<ExtractParams<T>>,
    Static<B>,
    Static<Q>
>;

type HttpRequestType = Request | FastifyRequest

type HttpResponseType = Response | FastifyReply;

type ICtx<P = any, B = any, Q = any> = {
    params: P;
    body: B;
    query: Q;
    req: HttpRequestType;
    res: HttpResponseType;
};

enum HttpMethod {
    GET = 'get',
    POST = 'post',
    PUT = 'put',
    PATCH = 'patch',
    DELETE = 'delete',
}

type RouteSchema<P, B, Q> = {
    params?: P
    body?: B
    query?: Q
}

type TSchemas = {
    params?: TSchema;
    body?: TSchema;
    query?: TSchema;
};

type Route<T extends string = string> = {
    path: T;
    method: HttpMethod;
    handler: RequestHandler | ((req: FastifyRequest, reply: FastifyReply) => void | Promise<void>);
    schemas?: TSchemas;
};

const framework = {
    express: Framework.EXPRESS,
    fastify: Framework.FASTIFY,
} as const;

type TFramework = keyof typeof framework;
type RequestHandlerType = RequestHandler | ((req: FastifyRequest, reply: FastifyReply) => Promise<void>);

class BaseRoute {
    protected routes: Route[] = [];
    private readonly instances: Express | FastifyInstance;

    constructor(private readonly framework: TFramework, cb?: () => Promise<void> | void) {
        if (framework === 'express') {
            console.log('Express')
            this.instances = express();

            this.framework = Framework.EXPRESS;
            this.instances.use(express.json());
            this.instances.use(express.urlencoded({ extended: true }));
            this.instances.use((req, _, next) => {
                if (!req.headers['x-session']) {
                    req.headers['x-session'] = uuid()
                    req.session = req.headers['x-session']
                }


                if (req.headers['x-tid']) {
                    req.invoke = req.headers['x-tid'] as string
                } else {
                    req.invoke = uuidv4()
                }

                next()
            });
            cb && cb()
        } else {
            this.instances = Fastify();
            console.log('Fastify')
            this.framework = Framework.FASTIFY;
            this.instances.addHook('onRequest', (req, _, done) => {
                if (!req.headers['x-session']) {
                    const sessionId = uuid();
                    req.headers['x-session'] = sessionId;
                    req.session = sessionId;
                } else {
                    req.session = req.headers['x-session'] as string;
                }

                if (req.headers['x-tid']) {
                    req.invoke = req.headers['x-tid'] as string;
                } else {
                    const invokeId = uuidv4();
                    req.headers['x-tid'] = invokeId;
                    req.invoke = invokeId;
                }

                done();
            });
            cb && cb()
        }
    }

    private validateRequest(data: unknown, schema?: TSchema) {
        if (!schema) return;
        const result = TypeCompiler.Compile(schema);
        if (!result.Check(data)) {
            const error = result.Errors(data).First();
            if (error) throw error;
        }
    }

    private handleError(error: unknown, res: HttpResponseType) {
        const response = {
            success: false,
            message: error instanceof Error ? error.message : 'Validation failed',
            stack: error instanceof Error ? error.stack : undefined,
        };

        res.status(400).send(response);
    }

    private createHandler(
        handler: RouteHandler<any, any, any>,
        schemas?: TSchemas
    ): RequestHandlerType {
        if (!this.instances) {
            throw new Error('No instance found');
        }

        if (this.framework === Framework.EXPRESS) {
            return async (req: Request, res: Response) => {
                try {
                    this.validateRequest(req.params, schemas?.params);
                    this.validateRequest(req.body, schemas?.body);
                    this.validateRequest(req.query, schemas?.query);

                    const ctx = { params: req.params, body: req.body, query: req.query, req, res };
                    const result = await handler(ctx as any);
                    if (result) res.send(result);
                } catch (error) {
                    this.handleError(error, res);
                }
            };
        } else {
            return async (req: FastifyRequest, reply: FastifyReply) => {
                try {
                    this.validateRequest(req.params, schemas?.params);
                    this.validateRequest(req.body, schemas?.body);
                    this.validateRequest(req.query, schemas?.query);


                    reply.json = (body): void => { reply.send(body); };
                    const ctx = { params: req.params, body: req.body, query: req.query, req, res: reply };
                    const result = await handler(ctx as any);
                    if (result) reply.send(result);
                } catch (error) {
                    this.handleError(error, reply);
                }
            };
        }
    }

    protected addRoute<T extends string, B extends TSchema, Q extends TSchema>(
        method: HttpMethod,
        path: T,
        handler: THandler<T, B, Q>,
        schemas?: RouteSchema<T, B, Q>
    ) {
        const sc = schemas as TSchemas;
        this.routes.push({ path, method, handler: this.createHandler(handler, sc), schemas: sc });
        return this;
    }

    public get<T extends string, B extends TSchema, Q extends TSchema>(
        path: T,
        handler: THandler<T, B, Q>,
        schemas?: RouteSchema<T, B, Q>
    ) {
        this.addRoute(HttpMethod.GET, path, handler, schemas);
        return this
    }

    private readonly generateSwaggerPaths = (data: Route[]): Record<string, any> => {
        const paths: Record<string, any> = {};
        data.forEach((route) => {
            const { path, method, schemas } = route;

            paths[path] = {
                [method]: {
                    summary: `Endpoint for ${path}`,
                    parameters: [
                        {
                            in: "path",
                            name: "id",
                            required: true,
                            schema: { type: "string" },
                            description: "The user ID",
                        },
                    ],
                    requestBody: schemas?.body
                        ? {
                            required: true,
                            content: {
                                "application/json": {
                                    schema: schemas.body,
                                },
                            },
                        }
                        : undefined,
                    responses: {
                        200: {
                            description: "Success",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            message: { type: "string" },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            };
        });

        return paths;
    };


    public startHttp(port: number, callback?: () => void) {
        if (!this.instances) {
            throw new Error('No instance found');
        }

        console.log('Routes: ', JSON.stringify(this.generateSwaggerPaths(this.routes), null, 2))

        this.routes.forEach((route) => {
            if (this.instances) {
                if (this.framework === Framework.EXPRESS) {
                    (this.instances as Express)[route.method](route.path, route.handler as RequestHandler);
                } else {
                    (this.instances as FastifyInstance).route({
                        method: route.method.toUpperCase() as any,
                        url: route.path,
                        handler: route.handler as any,
                    });
                }
            }
        })

        if (this.framework === Framework.EXPRESS) {
            const server = http.createServer(this.instances as Express);
            server.listen(port, callback);
            server.on('error', (error) => {
                console.error('Error starting server: ', error);
            });
        } else {

            const server = this.instances as unknown as FastifyInstance
            server.listen({ port }, callback || (() => console.log(`Server is running on port ${port}`)));
        }
    }

    // public startHttps(port: number, callback?: () => void) {
    //     if (!this.instances) {
    //         throw new Error('No instance found');
    //     }
    //     if (this.framework === Framework.EXPRESS) {
    //         const server = https.createServer(this.instances as Express);
    //         server.listen(port, callback);
    //         server.on('error', (error) => {
    //             console.error('Error starting server: ', error);
    //         });
    //     } else {
    //         const server = this.instances as FastifyInstance
    //         server.ready((err) => {
    //             if (err) {
    //                 console.error('Error starting server: ', err);
    //                 process.exit(1);
    //             }
    //         }).listen({ port }, () => callback);
    //     }
    // }
}

export {
    Type
}

export default BaseRoute;