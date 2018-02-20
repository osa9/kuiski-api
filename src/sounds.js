const lambdaHttp = require("./lib/lambda-http");
const cloudinary = require("cloudinary");
const googletts = require("google-tts-api");
const fs = require("fs");
var aws = require("aws-sdk");
var s3 = new aws.S3();

const get = (hash, key, defaultValue = undefined) => {
  if (hash[key] === null || hash[key] === undefined) {
    return defaultValue;
  }

  return hash[key];
};

const s3Exists = (bucket, name) => {
  const params = {
    Bucket: bucket,
    Prefix: `voices/`
  };

  return s3
    .listObjects(params)
    .promise()
    .then(data => {
      const finds = data.Contents.find(content => {
        const key = content.Key;
        return key === `voices/${name}.mp3`;
      });

      return finds > 0;
    })
    .catch(err => false);
};

const s3Upload = (bucket, name, data) => {
  const params = {
    Bucket: bucket,
    Key: `voices/${name}.mp3`,
    Body: data
  };

  return s3
    .upload(params)
    .promise()
    .then(data => {
      return `https://s3.amazonaws.com/kuis.ski/voices/${encodeURI(name)}.mp3`;
    })
    .catch(err => {
      console.log(err);
      return err;
    });
};

const getGoogleTts = (text, language) => {
  return googletts(text, language, 1, 1000, "us")
    .then(url => fetch(url))
    .then(res => {
      return new Promise((resolve, error) => {
        const f = fs.createWriteStream("/tmp/tmp.mp3");
        const stream = res.body.pipe(f);

        stream.on("finish", () => {
          const data = fs.readFileSync("/tmp/tmp.mp3");
          s3Upload("kuis.ski", text, data)
            .then(res => {
              resolve(res);
            })
            .catch(err => {
              error(err);
            });
        });
      });
    });
};

module.exports.getSpeechUrl = (event, context, callback) => {
  console.log(event);

  const parameters = [
    lambdaHttp.defineParam("query", "text", true, "string"),
    lambdaHttp.defineParam("query", "language", false, "string", "ja")
  ];

  const Api = new lambdaHttp.LambdaApi(event, context, callback);
  Api.setParameters(parameters);
  Api.execute(req => {
    const text = req.params.text;
    const language = req.params.language;

    return s3Exists("kuis.ski", text).then(res => {
      if (res)
        return `https://s3.amazonaws.com/kuis.ski/voices/${encodeURI(
          name
        )}.mp3`;
      else return getGoogleTts(text, language);
    });
  });
};
