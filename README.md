# IamCRUD
## A simple CRUD operations for Redis

### How to use
```
import redis from 'redis';
import { IamCrud, Schema, DataType } from 'iamcrud';

const client = redis.createClient();
const iamcrud = new IamCrud(client);

interface User {
  firstname: string;
  lastname: string;
  age: number;
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
];

const user = iamcrud.createRepository('user', userSchema);
```

### How to query

#### Inserting
```
user
  .insert({ fistname: 'Elon', lastname: 'Musk', age: 49 })
  .then((elonMusk) => console.log(elonMusk))
```
```
--> { fistname: 'Elon', lastname: 'Musk', age: 49 }
```

#### Searching
```
user
  .find({ firstname: 'Elon' })
  .then((users) => console.log(users))
```
```
--> [{ fistname: 'Elon', lastname: 'Musk', age: 49 }]
```
Searching with conditions:
```
userRepo
  .find({ age: { $lg: 66 }})
  .then((users) => console.log(users))
```
```
--> [
      { fistname: 'Elon', lastname: 'Musk', age: 49 },
      { fistname: 'Bill', lastname: 'Gates', age: 65 }
    ]
```
```
userRepo
  .find({ fistname: { $gt: 'Bill' }})
  .then((users) => console.log(users))
```
```
--> [
      { fistname: 'Billie', lastname: 'Eilish', age: 49 },
      { fistname: 'Bill', lastname: 'Gates', age: 65 }
    ]
```