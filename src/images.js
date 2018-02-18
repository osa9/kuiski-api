const lambdaHttp = require("./lib/lambda-http");
const cloudinary = require("cloudinary");

module.exports.list = (event, context, callback) => {
  const parameters = [
    lambdaHttp.defineParam("query", "channel", false, "string", "dev"),
    lambdaHttp.defineParam("query", "startAt", false, "integer", 0),
    lambdaHttp.defineParam("env", "CLOUDINARY_CLOUD_NAME", true, "string"),
    lambdaHttp.defineParam("env", "CLOUDINARY_API_KEY", true, "string"),
    lambdaHttp.defineParam("env", "CLOUDINARY_API_SECRET", true, "string")
  ];

  const Api = new lambdaHttp.LambdaApi(event, context, callback);
  Api.setParameters(parameters);
  Api.execute(req => {
    cloudinary.config({
      cloud_name: req.params.CLOUDINARY_CLOUD_NAME,
      api_key: req.params.CLOUDINARY_API_KEY,
      api_secret: req.params.CLOUDINARY_API_SECRET
    });

    return new Promise((resolve, reject) => {
      cloudinary.v2.api.resources(
        {
          type: "upload",
          resource_type: "image",
          prefix: `${req.params.channel}`
        },
        (err, res) => {
          if (err) {
            return reject(err);
          }

          resolve(res);
        }
      );
    });
  });
};
