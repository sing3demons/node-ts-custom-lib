import axios, { isCancel, AxiosError } from 'axios';

type HttpServiceResponse = {
    Response: string;
    ResponseCode: number;
}

type HttpServiceRequest = {
    Headers: Record<string, string>;
    Url: string;
    Method: "GET" | "POST" | "PUT" | "DELETE";
    Body: string;
    QueryParams: Record<string, string>;
    Params: Record<string, string>;
}

type HS = HttpServiceRequest | HttpServiceRequest[];
type HSCon<T> = T extends HttpServiceRequest ? HttpServiceResponse : HttpServiceResponse[];

async function httpService<T extends HS>(request: T): Promise<HSCon<T>> {

    const data  = await {
        Response: "Response",
        ResponseCode: 200
    }

    // const startTime = Date.now();
    const createResponse = (): HttpServiceResponse => {
        return {
            Response: "Response",
            ResponseCode: 200,
            // time:`Task duration: ${Date.now() - startTime} milliseconds`
        }
    }

    if (Array.isArray(request)) {

        return request.map(createResponse) as HSCon<T>
    } else {
        return createResponse() as HSCon<T>
    }

}

const options: HttpServiceRequest = {
    Headers: {
        "Content-Type": "application/json"
    },
    Url: "https://jsonplaceholder.typicode.com/todos/1",
    Method: "GET",
    Body: "",
    QueryParams: {},
    Params: {}
}

const response = httpService(options)

