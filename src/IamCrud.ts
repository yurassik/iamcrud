import * as Redis from 'redis';

import { AsyncRedisClient, promisifyClient } from './AsyncRedis';
import { Repository } from './Repository';
import { Schema } from './Schema';

interface Model {
  [key: string]: any;
}

export class IamCrud {
  client: AsyncRedisClient;

  constructor(client: Redis.RedisClient) {
    this.client = promisifyClient(client);
  }

  public createRepository<T extends Model>(alias: string, schema: Schema<T>): Repository<T> {
    return new Repository(alias, schema, this.client);
  }
}
