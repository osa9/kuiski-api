"use strict";

const aws = require("aws-sdk");

const lambdaHttp = require("./lib/lambda-http");
const models = require("./models");
const notify = require("./notify");

const PARAMETERS = [
  lambdaHttp.defineParam("path", "eventId", true, "string", "default")
];

const test = {
  pathParameters: {
    eventId: "dev"
  },
  body: JSON.stringify({
    id: "osa9",
    name: "nain",
    icon: "icon",
    debt: 1234
  })
};

class UserDB {
  constructor(tableName, eventId) {
    this.dynamo = new aws.DynamoDB.DocumentClient();
    this.tableName = tableName;
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
}

module.exports.addUser = (event, context, callback) => {
  const parameters = [
    lambdaHttp.defineParam("path", "eventId", true, "string"),
    lambdaHttp.defineParam("body", "user", true, models.User),
    lambdaHttp.defineParam("env", "DYNAMODB_TABLE", true, "string")
  ];

  const Api = new lambdaHttp.LambdaApi(event, context, callback);

  Api.setParameters(parameters);
  Api.execute(req => {
    const userDb = new UserDB(req.params.DYNAMODB_TABLE, req.params.eventId);
    const user = req.params.user;

    return userDb.add(user).then(() => {
      return "ok";
    });
  });
};

module.exports.listUsers = (event, context, callback) => {
  const parameters = [
    lambdaHttp.defineParam("path", "eventId", true, "string", "default"),
    lambdaHttp.defineParam("env", "DYNAMODB_TABLE", true, "string")
  ];

  const Api = new lambdaHttp.LambdaApi(event, context, callback);
  Api.setParameters(parameters);

  Api.execute(req => {
    const userDb = new UserDB(req.params.DYNAMODB_TABLE, req.params.eventId);
    return userDb.list().then(res => {
      return res.Items.map(res => models.User.fromObject(res.user));
    });
  });
};

module.exports.updateDebt = (event, context, callback) => {
  const parameters = [
    lambdaHttp.defineParam("path", "eventId", true, "string", "default"),
    lambdaHttp.defineParam("path", "userId", true, "string", "default"),
    lambdaHttp.defineParam("query", "currentDebt", false, "integer"),
    lambdaHttp.defineParam("query", "newDebt", true, "integer"),
    lambdaHttp.defineParam("query", "notify", false, "string", "true"),
    lambdaHttp.defineParam("env", "DYNAMODB_TABLE", true, "string")
  ];

  const Api = new lambdaHttp.LambdaApi(event, context, callback);
  Api.setParameters(parameters);

  Api.execute(req => {
    const eventId = req.params.eventId;
    const userId = req.params.userId;
    const currentDebt = req.params.currentDebt;
    const newDebt = req.params.newDebt;
    const sendNotify = req.params.notify;

    const userDb = new UserDB(req.params.DYNAMODB_TABLE, eventId);

    return userDb
      .updateDebt(userId, currentDebt, newDebt)
      .then(res => {
        if (sendNotify === "true") {
          return notify.send(
            eventId,
            models.NotifyMessage.Debt(userId, currentDebt, newDebt)
          );
        } else return;
      })
      .then(() => {
        return "ok";
      })
      .catch(err => {
        if (err.code == "ConditionalCheckFailedException") {
          throw new lambdaHttp.ConflictError("Someone has already update debt");
        }
      });
  });
};
