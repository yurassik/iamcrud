import { promisify } from 'util';
import * as Redis from 'redis';

type MultiOrResult<M extends 'multiMode' | 'commonMode', R> = M extends 'multiMode' ? Multi : Promise<R>;

interface OverloadedSetCommandAsync<T, U, M extends 'multiMode' | 'commonMode'> {
  (key: string, arg1: T, arg2: T, arg3: T, arg4: T, arg5: T, arg6: T): MultiOrResult<M, U>;
  (key: string, arg1: T, arg2: T, arg3: T, arg4: T, arg5: T): MultiOrResult<M, U>;
  (key: string, arg1: T, arg2: T, arg3: T, arg4: T): MultiOrResult<M, U>;
  (key: string, arg1: T, arg2: T, arg3: T): MultiOrResult<M, U>;
  (key: string, arg1: T, arg2: T): MultiOrResult<M, U>;
  (key: string, arg1: T | { [key: string]: T } | T[]): MultiOrResult<M, U>;
  (key: string, ...args: T[]): MultiOrResult<M, U>;
  (args: [string, ...T[]]): MultiOrResult<M, U>;
}

interface OverloadedCommandAsync<T, U, M extends 'multiMode' | 'commonMode'> {
  (arg1: T, arg2: T, arg3: T, arg4: T, arg5: T, arg6: T): MultiOrResult<M, U>;
  (arg1: T, arg2: T, arg3: T, arg4: T, arg5: T): MultiOrResult<M, U>;
  (arg1: T, arg2: T, arg3: T, arg4: T): MultiOrResult<M, U>;
  (arg1: T, arg2: T, arg3: T): MultiOrResult<M, U>;
  (arg1: T, arg2: T | T[]): MultiOrResult<M, U>;
  (arg1: T | T[]): MultiOrResult<M, U>;
  (...args: T[]): MultiOrResult<M, U>;
}

export interface OverloadedKeyCommandAsync<T, U, M extends 'multiMode' | 'commonMode'> {
  (key: string, arg1: T, arg2: T, arg3: T, arg4: T, arg5: T, arg6: T): MultiOrResult<M, U>;
  (key: string, arg1: T, arg2: T, arg3: T, arg4: T, arg5: T): MultiOrResult<M, U>;
  (key: string, arg1: T, arg2: T, arg3: T, arg4: T): MultiOrResult<M, U>;
  (key: string, arg1: T, arg2: T, arg3: T): MultiOrResult<M, U>;
  (key: string, arg1: T, arg2: T): MultiOrResult<M, U>;
  (key: string, arg1: T | T[]): MultiOrResult<M, U>;
  (key: string, ...args: T[]): MultiOrResult<M, U>;
  (...args: Array<string | T>): MultiOrResult<M, U>;
}

interface CommandsAsync<M extends 'multiMode' | 'commonMode'> {
  set(key: string, value: string): MultiOrResult<M, 'OK'>;
  set(key: string, value: string, flag: string): MultiOrResult<M, 'OK'>;
  set(key: string, value: string, mode: string, duration: number): MultiOrResult<M, 'OK' | undefined>;
  set(key: string, value: string, mode: string, duration: number, flag: string): MultiOrResult<M, 'OK' | undefined>;
  set(key: string, value: string, flag: string, mode: string, duration: number): MultiOrResult<M, 'OK' | undefined>;

  get(key: string): MultiOrResult<M, string | null>;

  del: OverloadedCommandAsync<string, number, M>;

  hset: OverloadedSetCommandAsync<string, number, M>;

  hdel: OverloadedKeyCommandAsync<string, number, M>;

  hget(key: string, field: string): MultiOrResult<M, string>;

  hgetall(key: string): MultiOrResult<M, { [key: string]: string }>;

  hmget: OverloadedKeyCommandAsync<string, string[], M>;

  zadd: OverloadedSetCommandAsync<string | number, number, M>;

  zrem: OverloadedKeyCommandAsync<string, number, M>;

  incr(key: string): MultiOrResult<M, boolean>;

  zrangebyscore(key: string, min: number | string, max: number | string): MultiOrResult<M, string[]>;
  zrangebyscore(
    key: string,
    min: number | string,
    max: number | string,
    withscores: string,
  ): MultiOrResult<M, string[]>;
  zrangebyscore(
    key: string,
    min: number | string,
    max: number | string,
    limit: string,
    offset: number,
    count: number,
  ): MultiOrResult<M, string[]>;
  zrangebyscore(
    key: string,
    min: number | string,
    max: number | string,
    withscores: string,
    limit: string,
    offset: number,
    count: number,
  ): MultiOrResult<M, string[]>;
  zrangebylex(key: string, min: string, max: string): MultiOrResult<M, string[]>;
  zrangebylex(
    key: string,
    min: string,
    max: string,
    limit: string,
    offset: number,
    count: number,
  ): MultiOrResult<M, string[]>;

  exists: OverloadedCommandAsync<string, number, M>;

  multi(args?: Array<Array<string | number>>): Multi;
}

interface Multi extends CommandsAsync<'multiMode'> {
  exec(): Promise<any[]>;

  exec_atomic(): Promise<any[]>;
}

export interface AsyncRedisClient extends CommandsAsync<'commonMode'> {}

export function promisifyClient(client: Redis.RedisClient): AsyncRedisClient {
  return {
    set: promisify(client.set).bind(client),
    get: promisify(client.get).bind(client),
    del: promisify(client.del).bind(client),
    hset: promisify(client.hset).bind(client),
    hget: promisify(client.hget).bind(client),
    hgetall: promisify(client.hgetall).bind(client),
    hmget: promisify(client.hmget).bind(client),
    hdel: promisify(client.hdel).bind(client),
    exists: promisify(client.exists).bind(client),
    zadd: promisify(client.zadd).bind(client),
    zrem: promisify(client.zrem).bind(client),
    zrangebyscore: promisify(client.zrangebyscore).bind(client),
    zrangebylex: promisify(client.zrangebylex).bind(client),
    incr: promisify(client.incr).bind(client),
    multi: (...args) => {
      const commands = client.multi(...args);
      const methods = [
        'set',
        'get',
        'del',
        'hset',
        'hget',
        'hdel',
        'hgetall',
        'hmget',
        'exists',
        'zadd',
        'zrem',
        'zrangebyscore',
        'zrangebylex',
        'incr',
        'multi',
        'exec',
      ];

      return methods.reduce((acc, method) => {
        acc[method] = promisify(commands[method]).bind(commands);
        return acc;
      }, <Multi>{});
    }
  }
}
