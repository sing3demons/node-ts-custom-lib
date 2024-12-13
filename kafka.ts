import { Consumer, ConsumerSubscribeTopics, EachBatchPayload, Kafka, EachMessagePayload, Producer, Message, TopicMessages, ProducerBatch, logLevel, RecordMetadata } from 'kafkajs'
import { randomUUID } from 'node:crypto'

const kafka = new Kafka({
    clientId: 'my-app',
    brokers: ['localhost:29092'],
    logLevel: logLevel.ERROR
})

const TOPIC_NAME = ['example-topic', 'test-topic', 'producer-topic','create-cms-product-offering', 'mfaf.createCMSProductOffering']


class KafkaConsumer {
    private readonly kafkaConsumer: Consumer

    public constructor() {
        this.kafkaConsumer = this.createKafkaConsumer()
    }

    public async startConsumer(): Promise<void> {
        const topic: ConsumerSubscribeTopics = {
            topics: TOPIC_NAME,
            fromBeginning: false
        }

        try {
            console.log('Connecting to Kafka...')
            await this.kafkaConsumer.connect()
            console.log('Connected to Kafka')
            await this.kafkaConsumer.subscribe(topic)
            console.log('Subscribed to topics')

            await this.kafkaConsumer.run({
                eachMessage: async (messagePayload: EachMessagePayload) => {
                    const { topic, partition, message } = messagePayload
                    const prefix = `${topic}[${partition} | ${message.offset}] / ${message.timestamp}`
                    console.log(`- ${prefix} ${message.key}#${message.value}`)
                }
            })
        } catch (error) {
            console.log('Error: ', error)
        }
    }

    public async startBatchConsumer(): Promise<void> {
        const topic: ConsumerSubscribeTopics = {
            topics: TOPIC_NAME,
            fromBeginning: false
        }

        try {
            await this.kafkaConsumer.connect()
            await this.kafkaConsumer.subscribe(topic)
            await this.kafkaConsumer.run({
                eachBatch: async (eachBatchPayload: EachBatchPayload) => {
                    const { batch } = eachBatchPayload
                    for (const message of batch.messages) {
                        const prefix = `${batch.topic}[${batch.partition} | ${message.offset}] / ${message.timestamp}`
                        console.log(`- ${prefix} ${message.key}#${message.value}`)
                    }
                }
            })
        } catch (error) {
            console.log('Error: ', error)
        }
    }

    public async shutdown(): Promise<void> {
        await this.kafkaConsumer.disconnect()
    }

    private createKafkaConsumer(): Consumer {
        const consumer = kafka.consumer({ groupId: 'consumer-group' })
        return consumer
    }
}

interface RequestData<T> {
    header: {
        version: string;
        timestamp: string;
        orgService: string;
        from: string;
        channel: string;
        broker: string;
        useCase: string;
        useCaseStep: string;
        useCaseAge: number;
        session: string;
        transaction: string;
        communication: string;
        groupTags: string[];
        identity: Record<string, unknown>;
        tmfSpec: string;
        baseApiVersion: string;
        schemaVersion: string;
    };
    body: T
}

interface CustomMessageFormat { a: string }

class KafkaProducer {
    private readonly producer: Producer

    constructor() {
        this.producer = this.createProducer()
    }

    public async start(): Promise<void> {
        try {
            await this.producer.connect()
        } catch (error) {
            console.log('Error connecting the producer: ', error)
            throw new Error('Error connecting the producer: ' + error)
        }
    }

    public async shutdown(): Promise<void> {
        await this.producer.disconnect()
    }

    public async send(topic:string,message: any): Promise<RecordMetadata[]> {
        try {

            const payload :RequestData<any> = {
                header: {
                    version: "2.0",
                    timestamp: new Date().toISOString(),
                    orgService: "rest_proxy",
                    from: "rest_proxy",
                    channel: "CMS-myAIS",
                    broker: "",
                    useCase: "CMS-myAIS",
                    useCaseStep: "0",
                    useCaseAge: 0,
                    session: randomUUID(),
                    transaction: randomUUID(),
                    communication: "unicast",
                    groupTags: [],
                    identity: {},
                    tmfSpec: "TMF620",
                    baseApiVersion: "4.0.0",
                    schemaVersion: "1.0.0"
                },
                body: message
            }

            const kafkaMessage: Message = {
                value: JSON.stringify(payload)
            }

            const topicMessage: TopicMessages = {
                topic,
                messages: [kafkaMessage]
            }

            const record = await this.producer.send(topicMessage)
            // console.log('Record: ', record)
            return record
        } catch (error) {
            console.log('Error sending message: ', error)
            throw new Error('Error sending message: ' + error)

        }
    }

    public async sendBatch(messages: Array<CustomMessageFormat>): Promise<void> {
        const kafkaMessages: Array<Message> = messages.map((message) => {
            return {
                value: JSON.stringify(message)
            }
        })

        const topicMessages: TopicMessages = {
            topic: 'producer-topic',
            messages: kafkaMessages
        }

        const batch: ProducerBatch = {
            topicMessages: [topicMessages]
        }

        await this.producer.sendBatch(batch)
    }

    private createProducer(): Producer {
        return kafka.producer()
    }
}

export { KafkaConsumer, KafkaProducer, CustomMessageFormat }