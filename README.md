# IamCRUD
## A simple CRUD operations for Redis

### How to use
```
import * as redis from 'redis';
import { IamCrud, Schema, DataType } from 'iamcrud';

const client = redis.createClient();
const iamcrud = new IamCrud(client);

interface User {
  firstname: string;
  lastname: string;
  age: number;
  occupation: string;
}

const userSchema: Schema<User> = [
  {
    key: 'firstname',
    type: DataType.STRING,
  },
  {
    key: 'lastname',
    type: DataType.STRING,
  },
  {
    key: 'age',
    type: DataType.NUMBER,
  },
  {
    key: 'occupation',
    type: DataType.String,
  }
];

const user = iamcrud.createRepository('user', userSchema);
```

### How to query

#### Inserting
```
user
  .insert({ fistname: 'Elon', lastname: 'Musk', age: 49 })
  .then((elonMusk) => console.log(elonMusk));
```
```
--> { fistname: 'Elon', lastname: 'Musk', age: 49, occupation: 'engineer' }
```

#### Searching
```
user
  .find({ firstname: 'Elon' })
  .then((users) => console.log(users));
```
```
--> [{ fistname: 'Elon', lastname: 'Musk', age: 49, occupation: 'engineer' }]
```
##### Searching with conditions.
The following operators are currently supported: **\$lt**, **\$lte**, **\$eq**, **\$gt**, **\$gte**
what accordingly mean: **lower than**, **lower than or equal**, **equal**, **greater than**, **greater than or equal**.
```
user
  .find({ age: { $lg: 66 }})
  .then((users) => console.log(users));
```
```
--> [
      { fistname: 'Elon', lastname: 'Musk', age: 49, occupation: 'engineer' },
      { fistname: 'Bill', lastname: 'Gates', age: 65, occupation: 'software developer' }
    ]
```
```
user
  .find({ fistname: { $gt: 'Bill' }})
  .then((users) => console.log(users));
```
```
--> [
      { fistname: 'Billie', lastname: 'Eilish', age: 49, occupation: 'musician' },
      { fistname: 'Bill', lastname: 'Gates', age: 65, occupation: 'software developer' }
    ]
```
#### Updating
```
user
  .update({ firstname: 'Bill', lastname: 'Gates' }, { $set: { occupation: 'investor' } });
```
will update `occupation` property
```
user
  .update({ firstname: 'Bill', lastname: 'Gates' }, { firstname: 'Bill', lastname: 'Murray', age: 70, occupation: 'actor' });
```
will replace document comletely
#### Deleting
```
user
  .remove({ firstname: 'Elon', lastname: 'Musk' });
```
