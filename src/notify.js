'use strict';

const fetch = require('node-fetch');

const lambdaHttp = require('./lib/lambda-http');
const models = require('./models');

const uuid = 'kuiski-api-notify';



module.exports.send = (channel, notifyMessage) => {
    const pub_key = encodeURI(process.env.PUBNUB_PUBLISH_KEY);
    const sub_key = encodeURI(process.env.PUBNUB_SUBSCRIBE_KEY);
    const echannel = encodeURI(channel);
    const payload = encodeURI(notifyMessage);

    const url = `https://ps.pndsn.com/publish/${pub_key}/${sub_key}/0/${channel}/0/${payload}?uuid=${uuid}`;

    return fetch(url).then((res) => res.json());
}

module.exports.handler = (event, context, callback) => {
    const parameters = [
        lambdaHttp.defineParam('env', 'PUBNUB_PUBLISH_KEY', true, 'string'),
        lambdaHttp.defineParam('env', 'PUBNUB_SUBSCRIBE_KEY', true, 'string'),
        lambdaHttp.defineParam('query', 'channel', false, 'string', 'dev'),
        lambdaHttp.defineParam('query', 'type', true, 'string'),
        lambdaHttp.defineParam('query', 'message', true, 'string'),
    ]

    const Api = new lambdaHttp.LambdaApi(event, context, callback);
    Api.setParameters(parameters);
    Api.execute((req) => {
        const message = models.NotifyMessage.Text(req.params.type, req.params.message);
        return send(channel, message).then(() => 'ok');
    });
  }