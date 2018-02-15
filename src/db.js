const aws = require("aws-sdk");
//aws.config.update({ region: "us-east-1" });

class DB {
  constructor(tableName) {
    this.tableName = tableName;
    this.dynamo = new aws.DynamoDB.DocumentClient();
  }
}

exports.UserDB = class extends DB {
  constructor(tableName, eventId) {
    super(tableName);
    this.eventId = eventId;
    this.groupName = `${eventId}-users`;
  }

  add(user) {
    const item = {
      group: this.groupName,
      key: user.id,
      user: user.toJSON()
    };

    const params = {
      TableName: this.tableName,
      Item: item
    };

    return this.dynamo.put(params).promise();
  }

  list(limit = 20) {
    const params = {
      TableName: this.tableName,
      KeyConditionExpression: "#group = :groupName",
      ExpressionAttributeNames: {
        "#group": "group"
      },
      ExpressionAttributeValues: {
        ":groupName": this.groupName
      },
      Limit: limit
    };

    return this.dynamo.query(params).promise();
  }

  updateDebt(userId, currentDebt, newDebt) {
    const params = {
      TableName: this.tableName,
      Key: {
        group: this.groupName,
        key: userId
      },
      UpdateExpression: "set #user.debt = :newDebt",
      ConditionExpression: "#user.debt = :currentDebt",
      ExpressionAttributeNames: {
        "#user": "user"
      },
      ExpressionAttributeValues: {
        ":currentDebt": currentDebt,
        ":newDebt": newDebt
      }
    };

    return this.dynamo.update(params).promise();
  }
};

exports.Enquete = class extends DB {
  constructor(tableName, enqueteId) {
    super(tableName);
    this.enqueteId = enqueteId;
    this.groupName = `${enqueteId}-enquete`;
  }

  create(enqueteName, votes) {
    const v = {};
    Object.keys(votes).forEach(key => {
      v[votes[key].id] = [];
    });
    console.log(v);

    const params = {
      TableName: this.tableName,
      Item: {
        group: this.groupName,
        key: this.enqueteId,
        name: enqueteName,
        answered_users: [],
        vote: v
      }
    };

    return this.dynamo.put(params).promise();
  }

  get() {
    const params = {
      TableName: this.tableName,
      Key: {
        group: this.groupName,
        key: this.enqueteId
      }
    };

    return this.dynamo.get(params).promise();
  }

  update(userId, userName, vote) {
    return this.get()
      .then(item => {
        if (item.Item.answered_users.includes(userId)) {
          console.log("You have already voted");
          return item.Item;
        }

        console.log(userId);
        console.log(item.Item.answered_users);

        const params = {
          TableName: this.tableName,
          Key: {
            group: this.groupName,
            key: this.enqueteId
          },
          UpdateExpression:
            "set #v.#vote = list_append(if_not_exists(#v.#vote, :emptyList), :userName), #ans = list_append(if_not_exists(#ans, :emptyList), :userId)",
          ExpressionAttributeNames: {
            "#v": "vote",
            "#vote": vote,
            "#ans": "answered_users"
          },
          ExpressionAttributeValues: {
            ":userName": [userName],
            ":userId": [userId],
            ":emptyList": []
          },
          ReturnValues: "ALL_NEW"
        };

        return this.dynamo
          .update(params)
          .promise()
          .then(item => item.Attributes);
      })
      .catch(e => {
        console.log(e);
      });
  }
};
