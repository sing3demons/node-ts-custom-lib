import { Kafka, KafkaMessage, Consumer, Producer } from 'kafkajs';

type ServerKafkaOptions = {
  client?: {
    clientId?: string;
    brokers?: string[];
  };
  consumer?: {
    groupId?: string;
    [key: string]: unknown;
  };
  producer?: Record<string, unknown>;
  parser?: unknown;
  subscribe?: Record<string, unknown>;
  run?: Record<string, unknown>;
  send?: Record<string, unknown>;
  postfixId?: string;
};

type KafkaContext = {
  topic: string;
  partition: number;
  headers: KafkaMessage['headers'];
  value: string | null;
};

type MessageHandler = (data: unknown, context: KafkaContext) => Promise<unknown>;

type ParsedMessage = {
  topic: string;
  partition: number;
  headers: KafkaMessage['headers'];
  value: string | null;
};

export class ServerKafka {
  private logger: any;
  private client: Kafka | null = null;
  private consumer: Consumer | null = null;
  private producer: Producer | null = null;
  private parser: any | null = null;
  private brokers: string[];
  private clientId: string;
  private groupId: string;
  private options: ServerKafkaOptions;
  private messageHandlers: Map<string, MessageHandler> = new Map();

  constructor(options: ServerKafkaOptions) {
    this.options = options;
    this.logger = console;
    const clientOptions = options.client || {};
    const consumerOptions = options.consumer || {};
    const postfixId = options.postfixId ?? '-server';

    this.brokers = clientOptions.brokers || ['localhost:9092'];
    this.clientId = (clientOptions.clientId || 'kafka-client') + postfixId;
    this.groupId = (consumerOptions.groupId || 'kafka-group') + postfixId;

    this.parser = options.parser || null;
  }

  async listen(callback: (err?: Error) => void): Promise<void> {
    try {
      this.client = this.createClient();
      await this.start(callback);
    } catch (err) {
      callback(err as Error);
    }
  }

  async close(): Promise<void> {
    if (this.consumer) await this.consumer.disconnect();
    if (this.producer) await this.producer.disconnect();
    this.consumer = null;
    this.producer = null;
    this.client = null;
  }

  private async start(callback: () => void): Promise<void> {
    const consumerOptions = { ...this.options.consumer, groupId: this.groupId };
    this.consumer = this.client!.consumer(consumerOptions);
    this.producer = this.client!.producer(this.options.producer);

    await this.consumer.connect();
    await this.producer.connect();
    await this.bindEvents(this.consumer);

    callback();
  }

  private createClient(): Kafka {
    return new Kafka({
      clientId: this.clientId,
      brokers: this.brokers,
      ...this.options.client,
    });
  }

  private async bindEvents(consumer: Consumer): Promise<void> {
    const registeredPatterns = [...this.messageHandlers.keys()];
    const consumerSubscribeOptions = this.options.subscribe || {};

    if (registeredPatterns.length > 0) {
      await consumer.subscribe({
        ...consumerSubscribeOptions,
        topics: registeredPatterns,
      });
    }

    const consumerRunOptions = {
      ...this.options.run,
      eachMessage: this.getMessageHandler(),
    };

    await consumer.run(consumerRunOptions);
  }

  private getMessageHandler() {
    return async (payload: {
      topic: string;
      partition: number;
      message: KafkaMessage;
      heartbeat: () => Promise<void>;
    }): Promise<void> => {
      await this.handleMessage(payload);
    };
  }

  private async handleMessage(payload: {
    topic: string;
    partition: number;
    message: KafkaMessage;
    heartbeat: () => Promise<void>;
  }): Promise<void> {
    const { topic, message } = payload;


    const rawMessage: ParsedMessage = this.parser
      ? this.parser.parse({
      ...message,
      topic,
      partition: payload.partition,
      })
      : { topic, partition: payload.partition, headers: message.headers, value: message.value?.toString() };

    this.logger.debug('Parsed message:', rawMessage);

    if (!rawMessage?.topic) {
      this.logger.error(`No pattern found in message for topic: ${topic}`, rawMessage);
      return;
    }


    const kafkaContext: KafkaContext = {
      ...rawMessage,
      partition: payload.partition,
      topic,
      // consumer: this.consumer,
      // producer: this.producer,
    };

    const handler = this.getHandlerByPattern(rawMessage.topic);

    if (!handler) {
      this.logger.error(`No handler registered for pattern: ${rawMessage.topic}`);
      return;
    }

    const response = await handler(rawMessage.value, kafkaContext);
    console.log('response', response);
    // await this.sendMessage({ response }, rawMessage.headers['reply-topic']?.toString(), rawMessage.headers['reply-partition']?.toString(), rawMessage.headers['correlation-id']?.toString());
  }


  parse(message: KafkaMessage): { pattern: string; data: unknown } | {} {
    try {
      const value = message.value?.toString();
      return value ? JSON.parse(value) : {};
    } catch (err) {
      console.error('Failed to parse message', err);
      return {};
    }
  }

  private async sendMessage(
    message: any,
    replyTopic: string,
    replyPartition: string | undefined,
    correlationId: string
  ): Promise<void> {
    const outgoingMessage = { ...message.response };
    if (replyPartition) outgoingMessage.partition = parseFloat(replyPartition);
    outgoingMessage.headers = { 'correlation-id': Buffer.from(correlationId) };
    await this.producer!.send({
      topic: replyTopic,
      messages: [outgoingMessage],
    });
  }

  private getHandlerByPattern(pattern: string): MessageHandler | undefined {
    return this.messageHandlers.get(pattern);
  }

  public addHandler(pattern: string, handler: MessageHandler): void {
    this.messageHandlers.set(pattern, handler);
  }
}
