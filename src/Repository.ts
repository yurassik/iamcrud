import intersection from 'lodash.intersection';
import pick from 'lodash.pick';

import { AsyncRedisClient } from './AsyncRedis';
import { Schema, DataType } from './Schema';
import { getUnixTime, unixTimeToDate } from './utils';

type FinalData = string | number | Date;
type ComparisonOperator = '$gt' | '$gte' | '$lt' | '$lte' | '$eq' | '$ne';
type OperatorOptions = { [P in ComparisonOperator]?: FinalData };
type SearchOptions<T> = { [P in keyof T]?: FinalData | OperatorOptions } & { id?: number | OperatorOptions };
type SetOperator = '$set' | '$unset';
type SetOptions<T> = { [P in SetOperator]?: Partial<T> };
type UpdateOptions<T> = T | SetOptions<T>;
type UpdateSettings = { multi?: boolean };

export type Normalized = {
  id: string;
  [key: string]: string;
};

export class Repository<T extends { [key: string]: any }> {
  constructor(alias: string, schema: Schema<T>, client: AsyncRedisClient) {
    this.client = client;
    this.schema = schema;
    this.alias = alias;
    this.initRepository();
  }

  private client: AsyncRedisClient;
  private schema: Schema<T>;
  private alias: string;
  private comparisonOps: ComparisonOperator[] = ['$gt', '$gte', '$lt', '$lte', '$eq', '$ne'];
  private setOps: SetOperator[] = ['$set', '$unset'];
  private INCR_SUFFIX = '__idincr';

  private async initRepository() {
    if (!(await this.client.exists(`${this.alias}${this.INCR_SUFFIX}`))) {
      this.client.set(`${this.alias}${this.INCR_SUFFIX}`, '1');
    }
  }

  private getHashName(id: string | number) {
    return `${this.alias}:${id}`;
  }

  private normalizeValue(type: DataType, value: any): string {
    switch (type) {
      case DataType.DATE:
        return String(getUnixTime(<Date>value));

      case DataType.NUMBER:
        return String(value);

      case DataType.STRING:
        return value;

      default:
        return value.toString();
    }
  }

  private normalize(model: Partial<T>) {
    return this.schema.reduce((acc, { key, type }) => {
      if (model[key]) {
        try {
          acc[<string>key] = this.normalizeValue(type, model[key]);
        } catch (error) {
          console.log(error);
        }
      }
      return acc;
    }, <Normalized>{});
  }

  private denormalizeValue(type: DataType, value: string): FinalData {
    switch (type) {
      case DataType.DATE:
        return unixTimeToDate(Number(value));

      case DataType.NUMBER:
        return Number(value);

      case DataType.STRING:
      default:
        return value;
    }
  }

  private denormalize(data: Normalized): T {
    const model = this.schema.reduce<any>((acc, { key, type }) => {
      if (data.hasOwnProperty(key)) {
        try {
          acc[key] = this.denormalizeValue(type, data[<string>key]);
        } catch (error) {
          console.log(error);
        }
      }
      return acc;
    }, {});

    model['id'] = Number(data.id);
    return <T>model;
  }

  private getComparisonRange(value: FinalData, operator: ComparisonOperator) {
    switch (operator) {
      case '$eq':
        return [`[${value}:`, `[${value}:\xff`];

      case '$gt':
        return [`[${value}:\xff`, '+'];

      case '$gte':
        return [`[${value}:`, '+'];

      case '$lt':
        return [`-`, `[${value}:`];

      case '$lte':
        return [`-`, `[${value}\xff`];

      case '$ne':
        break;

      default:
        // no default
        break;
    }
  }

  private modelToArray(model: Partial<Normalized>): string[] {
    return Object.entries(model).reduce((acc, [key, value]) => {
      return [...acc, key, value];
    }, []);
  }

  async insert(model: T) {
    const nextId = await this.client.get(`${this.alias}${this.INCR_SUFFIX}`);

    const normalizedModel = { ...this.normalize(model), id: nextId };

    const pool = this.client.multi();
    pool.hset(this.getHashName(nextId), this.modelToArray(normalizedModel));
    
    // Add to indexes
    Object.entries(normalizedModel).forEach(([key, value]) => {
      pool.zadd(`${this.alias}.${key}.index`, 0, `${value}:${nextId}`);
    });

    pool.incr(`${this.alias}${this.INCR_SUFFIX}`);
    await pool.exec();

    return <T>{ id: nextId, ...model };
  }

  private async findIds(options: SearchOptions<T>): Promise<string[]> {
    const pool = this.client.multi();
    Object.entries<FinalData | OperatorOptions>(options).forEach(([key, value]) => {
      // if comparison operators
      if (intersection(Object.keys(value), this.comparisonOps).length) {
        Object.entries<FinalData>(value as OperatorOptions).forEach(([op, val]) => {
          const [min, max] = this.getComparisonRange(val, op as ComparisonOperator);
          pool.zrangebylex(`${this.alias}.${key}.index`, min, max);
        });
      } else if (typeof value === 'string' || typeof value === 'number') {
        pool.zrangebylex(`${this.alias}.${key}.index`, `[${value}:`, `[${value}:\xff`);
      } else if (value instanceof Date) {
        pool.zrangebylex(`${this.alias}.${key}.index`, `[${value}:`, `[${value}:`);
      }
    });
    const foundInIndexes: string[][] = await pool.exec();
    const foundInIndexesIds: string[][] = foundInIndexes.map((foundArr) => foundArr.map((found) => {
      const [, id] = /.+:(\d+)/.exec(found);
      return id;
    }))
  
    return intersection(...foundInIndexesIds);
  }

  async find(options: SearchOptions<T>): Promise<T[]> {
    const ids = await this.findIds(options);
    if (ids.length) {
      const pool = this.client.multi();
      ids.forEach((id) => {
        pool.hgetall(this.getHashName(id));
      });
      const data = await pool.exec();

      return data.map((item) => this.denormalize(item));
    }

    return [];
  }

  async update(searchOptions: SearchOptions<T>, updateOptions: UpdateOptions<T>, updateSettings: UpdateSettings = {}) {
    const { multi } = updateSettings;
    const ids = await this.findIds(searchOptions);
    if (ids.length) {
      const pool = this.client.multi();
      const isPatch = intersection(Object.keys(updateOptions), this.setOps).length;
      for (const id of (multi ? ids : [ids[0]])) {        
        if (isPatch) {
          if (updateOptions.$set) {
            const fullModelToUpdate = await this.client.hgetall(this.getHashName(id));
            const modelToUpdate = pick(fullModelToUpdate, Object.keys(updateOptions.$set));

            // Delete in indexes
            Object.entries(modelToUpdate).forEach(([key, oldValue]) => {
              pool.zrem(`${this.alias}.${key}.index`, `${oldValue}:${id}`);
            });

            const normalizedModel = { ...this.normalize(updateOptions.$set) };

            // Update in indexes
            Object.entries(normalizedModel).forEach(([key, newValue]) => {
              pool.zadd(`${this.alias}.${key}.index`, 0, `${newValue}:${id}`);
            });

            // Set new fields / update exists
            pool.hset(this.getHashName(id), this.modelToArray(normalizedModel));
          }
          if (updateOptions.$unset) {
            const fullModelToUpdate = await this.client.hgetall(this.getHashName(id));
            const modelToUpdate = pick(fullModelToUpdate, Object.keys(updateOptions.$unset));

            // Delete fields
            pool.hdel(this.getHashName(id), Object.keys(updateOptions.$unset));

            // Delete in indexes
            Object.entries(modelToUpdate).forEach(([key, oldValue]) => {
              pool.zrem(`${this.alias}.${key}.index`, `${oldValue}:${id}`);
            });
          }
        } else {
          const modelToRemove = await this.client.hgetall(this.getHashName(id));

          // Delete old model
          pool.del(this.getHashName(id));

          // Delete in indexes
          Object.entries(modelToRemove).forEach(([key, oldValue]) => {
            pool.zrem(`${this.alias}.${key}.index`, `${oldValue}:${id}`);
          });

          const normalizedModel = { ...this.normalize(<T>updateOptions), id };

          // Add to indexes
          Object.entries(normalizedModel).forEach(([key, newValue]) => {
            pool.zadd(`${this.alias}.${key}.index`, 0, `${newValue}:${id}`);
          });

          pool.hset(this.getHashName(id), this.modelToArray(normalizedModel));
        }
      };
      await pool.exec();
    }
  }

  async findOne(options: Partial<T>) {}

  async findById(id: number) {}
}
