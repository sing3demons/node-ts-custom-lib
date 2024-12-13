// import { KafkaConsumer, KafkaProducer } from "./kafka"
// import BaseRoute, { Type } from "./lib";
import { CustomRoute,t } from "./lib/v2";

const app = new CustomRoute();

app.get(
    "/",
    async ({ query, detailLog }) => {
        const { name } = query; // `name` is now type-safe as `string`
        detailLog.Log("Hello, " + name);
        return { message: `Hello, ${name}` };
    },
    {
        query: t.Object({
            name: t.String(),
        }),
    }
);

app.listen(3000);




// export const ExampleRequestSchema = Type.Object({
//     name: Type.String(),
//     email: Type.String({ format: 'email' }),
//     age: Type.Number({ minimum: 0 }),
// });

// // type ExampleRequest = Static<typeof ExampleRequestSchema>

// // console.log(ExampleRequestSchema);
// const producer = new KafkaProducer()
// const router = new BaseRoute('express')
// router.get('/', async ({ params, res, body, req }) => {
//     // return { id: params.id };
//     const data = {
       
//     }

//     await producer.start()
//     const record = await producer.send('',data)

//     res.json({
//         session: req.session,
//         invoke: req.invoke,
//         record
//     })
// }, {
// })
//     .startHttp(3001, () => console.log('X Server is running on port 3000'))
// const producer = new KafkaProducer()

// app.get("/", async (req:Request, res:Response) => {
//     await producer.start()
//     const record = await producer.send({ a: 'test'})
//     res.json(record)
// });

// new KafkaConsumer().startConsumer()
// app.listen(3000, () =>  console.log(`Server is running on port 3000.`));

// console.log(app)

