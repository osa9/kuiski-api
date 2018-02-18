"use strict";

const aws = require("aws-sdk");
const Client = require("@line/bot-sdk").Client;
const fs = require("fs");
const cloudinary = require("cloudinary");
const shortid = require("shortid");

const lambdaHttp = require("./lib/lambda-http");
const models = require("./models");
const notify = require("./notify");
const db = require("./db");

const getKey = () => {
  return {
    channelAccessToken: process.env.KUISKITAN_ACCESS_TOKEN,
    channelSecret: process.env.KUISKITAN_CHANNEL_SECRET
  };
};

const GROUP_ID_DEV = "Cfafcf796026aa74a0c02637107d20541";

module.exports.text = (event, context, callback) => {
  const parameters = [
    lambdaHttp.defineParam("query", "text", false, "string", "hello")
  ];

  const Api = new lambdaHttp.LambdaApi(event, context, callback);

  Api.setParameters(parameters);
  Api.execute(req => {
    const client = new Client(getKey());
    const message = { type: "text", text: req.params.text };
    client.pushMessage(GROUP_ID_DEV, message);
  });
};

const dialogHandler = (req, client) => {
  const dialogOption = req.params.option;
  const optionMessage = dialogOption.message;
  const enqueteId = `${shortid.generate()}`;

  const actions = dialogOption.options.map(option => {
    return {
      type: "postback",
      data: JSON.stringify({
        enqueteId: enqueteId,
        vote: option.id,
        callback: dialogOption.callback
      }),
      label: option.label,
      displayText: option.label
    };
  });

  const message = {
    type: "template",
    altText: optionMessage,
    template: {
      type: "buttons",
      text: optionMessage,
      actions: actions
    }
  };

  const enquete = new db.Enquete(req.params.DYNAMODB_TABLE, enqueteId);
  return enquete.create(optionMessage, dialogOption.options).then(res => {
    client.pushMessage(GROUP_ID_DEV, message);
    return { enqueteId: enqueteId };
  });
};

module.exports.dialog = (event, context, callback) => {
  const parameters = [
    lambdaHttp.defineParam("body", "option", true, models.DialogOption),
    lambdaHttp.defineParam("env", "DYNAMODB_TABLE", true, "string")
  ];

  const testEvent = {
    body: JSON.stringify({
      enqueteId: "ry5PElQwz",
      callback: "http://exam/kuistan/webhook",
      options: [{ id: "out", label: "アウト" }, { id: "safe", label: "セーフ" }]
    })
  };

  const Api = new lambdaHttp.LambdaApi(event, context, callback);
  Api.setParameters(parameters);
  Api.execute(req => {
    const client = new Client(getKey());
    return dialogHandler(req, client);
  });
};

module.exports.image = (event, context, callback) => {
  console.log(event);

  const Api = new lambdaHttp.LambdaApi(event, context, callback);

  Api.execute(req => {
    return "ok";
  });
};

/**
 * Sample Event
 *     "events": [
        {
            "type": "message",
            "replyToken": "123",
            "source": {
                "groupId": "g123",
                "userId": "u123",
                "type": "group"
            },
            "timestamp": 1518473487536,
            "message": {
                "type": "text",
                "id": "7465459623036",
                "text": "もふ"
            }
        }
    ]
 */

const getUserProfile = (client, event) => {
  const source = event.source;
  switch (source.type) {
    case "group":
      return client.getGroupMemberProfile(source.groupId, source.userId);
    case "room":
      return client.getRoomMemberProfile(source.roomId, source.userId);
    default:
      return client.getProfile(source.userId);
  }
};

const handlePostback = (req, client, event, postback) => {
  return getUserProfile(client, event)
    .then(profile => {
      const data = JSON.parse(postback.data);

      const enquete = new db.Enquete(req.params.DYNAMODB_TABLE, data.enqueteId);
      return enquete.update(profile.userId, profile.displayName, data.vote);
    })
    .then(res => {
      console.log(res);
      client.replyMessage(event.replyToken, {
        type: "text",
        text: `DEBUG: ${JSON.stringify(res.vote)}`
      });

      return res;
    })
    .catch(err => {
      if (err.code == "ConditionalCheckFailedException") {
        throw new lambdaHttp.ConflictError("You have already voted");
      }
      throw err;
    });
};

const uploadMedia = (filename, filetype) => {
  return new Promise((resolve, reject) => {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });

    cloudinary.v2.uploader.upload(filename, { folder: "dev" }, res => {
      console.log(res);

      if (filetype == "image") {
        notify.send("dev", models.NotifyMessage.Image(res.secure_url));
      } else if (filetype == "video") {
        notify.send("dev", models.NotifyMessage.Video(res.secure_url));
      }

      resolve(res);
    });
  });
};

const handleMedia = (client, message) => {
  const ext = message.type === "image" ? "jpg" : "mp4";
  const filename = `/tmp/${message.id}.${ext}`;

  client.getMessageContent(message.id).then(stream => {
    stream.on("end", () => {
      uploadMedia(filename, message.type);
      return "ok";
    });
    stream.pipe(fs.createWriteStream(filename));
  });
};

const handleMessage = (client, event, message) => {
  if (message.type === "text") {
    if (message.text === "/info") {
      client.replyMessage(event.replyToken, {
        type: "text",
        text: JSON.stringify(event.source)
      });

      return "ok";
    }
  } else if (message.type === "image" || message.type == "video") {
    console.log(message);
    return handleMedia(client, message);
  }
};

module.exports.webhook = (event, context, callback) => {
  console.log(event);

  const parameters = [
    lambdaHttp.defineParam("body", "body", true, "json"),
    lambdaHttp.defineParam("env", "DYNAMODB_TABLE", true, "string")
  ];

  const Api = new lambdaHttp.LambdaApi(event, context, callback);
  Api.setParameters(parameters);

  Api.execute(req => {
    const event = req.params.body.events[0];
    const client = new Client(getKey());

    if (event.type === "postback") {
      return handlePostback(req, client, event, event.postback);
    } else if (event.type === "message") {
      return handleMessage(client, event, event.message);
    }

    return "ok";
  });
};
