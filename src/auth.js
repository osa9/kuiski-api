const lambdaHttp = require("./lib/lambda-http");

module.exports.handler = (event, context, callback) => {
  const parameters = [
    lambdaHttp.defineParam("env", "GOOGLE_MAP_KEY", true, "string"),
    lambdaHttp.defineParam("env", "PUBNUB_PUBLISH_KEY", true, "string"),
    lambdaHttp.defineParam("env", "PUBNUB_SUBSCRIBE_KEY", true, "string"),
    lambdaHttp.defineParam("query", "channel", false, "string", "dev")
  ];

  const Api = new lambdaHttp.LambdaApi(event, context, callback);
  Api.setParameters(parameters);
  Api.execute(req => {
    return {
      googleMapKey: req.params.GOOGLE_MAP_KEY,
      pubnub: {
        publishKey: req.params.PUBNUB_PUBLISH_KEY,
        subscribeKey: req.params.PUBNUB_SUBSCRIBE_KEY
      }
    };
  });
};
