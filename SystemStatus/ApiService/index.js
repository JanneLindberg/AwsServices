var AWS = require('aws-sdk');
const util = require('util')

AWS.config.update({ region: process.env.AWS_REGION });

const ddb = new AWS.DynamoDB({ apiVersion: '2012-10-08' });

exports.handler = (event, context, callback) => {

  const debug = process.env.debug;

  const done = (err, res) => callback(null, {
    statusCode: err ? '400' : '200',
    body: err ? err.message : JSON.stringify(res),
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    }
  });


  switch (`${event.httpMethod} ${event.resource}`) {

    case 'POST /':
      var body = JSON.parse(event.body);
      if (debug) console.log("body: " + util.inspect(body));

      const searchKey = body.sk === undefined ? '_ev#' + new Date().toISOString() : body.sk;

      const item = {
        'systemId': { S: body.systemId },
        'sk': { S: searchKey },
        'title': { S: body.title },
        'description': { S: body.description },
        'ref': { S: body.ref },
        'sign': { S: body.sign },
        'time': { S: new Date().toISOString() },
      };

      ddb.putItem({
          TableName: process.env.TABLE_NAME,
          Item: item,
          ReturnConsumedCapacity: "TOTAL"
        })
        .promise()
        .then(response =>
          done(null, { body: JSON.stringify({ sk: searchKey }) })
        ).catch(err =>
          done(err, null)
        );
      break;

    default:
      callback(null, { statusCode: '501' });
  }

};
