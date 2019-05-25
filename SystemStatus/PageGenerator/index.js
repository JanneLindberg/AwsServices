'use strict';

var AWS = require('aws-sdk');
const ejs = require('ejs');
const showdown = require('showdown');

AWS.config.apiVersions = {
  s3: '2006-03-01',
};

AWS.config.update({ region: process.env.AWS_REGION });

const s3 = new AWS.S3();

const markdownConverter = new showdown.Converter({
  simpleLineBreaks: 'true',
  openLinksInNewWindow: 'true',
  tables: 'true',
  tasklists: 'true',
  flavor: 'github'
});


exports.handler = async(event, context, callback) => {

  if (process.env.DBG_ENABLED > 0) {
    console.log('Received event:', JSON.stringify(event, null, 2));
  }

  event.Records.forEach((record) => {
    console.log(record.eventID);
    console.log(record.eventName);
    console.log('DynamoDB Record: %', record.dynamodb);

    fetchEntries(record);

    callback(null, `Successfully processed ${event.Records.length} records.`);
  });
};


const fetchEntries = async(record) => {

  const table = record.eventSourceARN.split('/')[1];
  const systemId = record.dynamodb.Keys.systemId.S;

  var docClient = new AWS.DynamoDB.DocumentClient();

  var params = {
    TableName: table,
    KeyConditionExpression: "#systemId = :systemId",
    ExpressionAttributeNames: {
      "#systemId": "systemId"
    },
    ExpressionAttributeValues: {
      ":systemId": systemId
    },
    Limit: process.env.MAX_PAGE_ENTRIES,
    ScanIndexForward: false
  };

  const result = await docClient.query(params).promise();
  const pageName = 'data/' + systemId + '.html';

  generatePage(pageName, result);
};

const generatePage = async(pageName, entry) => {

  Promise.resolve(renderPage(entry))
    .then((page) => {
      storePageInS3(pageName, page);
    });
};


const renderPage = (data) => {

  data.Items.forEach((item) => {
    item.date = item.time !== undefined ? item.time.substring(0, 19).replace('T', ' ') : '';
    item.note = markdownConverter.makeHtml(item.description);
  });

  let page = ejs.renderFile('./templates/template.ejs', {
    title: 'Lates status',
    items: data.Items,
  }, { async: true });

  return page;
}


const storePageInS3 = async(keyName, page) => {

  const params = {
    Bucket: process.env.S3_DATA_STORE,
    Key: keyName,
    Body: page,
    ContentType: 'text/html; charset=UTF-8',
  };

  return await s3.putObject(params)
    .promise()
    .then(response =>
      console.log('PutResp:' + JSON.stringify(response)))
    .catch / (err =>
      console.log('ERR:' + err)
    );
}
