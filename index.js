const AWS = require("aws-sdk");
// HELLO!
const dynamo = new AWS.DynamoDB.DocumentClient();
function toTitleCase(str) {
  return str.replace(/\w\S*/g, function (txt) {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

exports.handler = async (event, context) => {
  let body;
  let statusCode = 200;
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  try {
    switch (event.routeKey) {
      case "DELETE /organizations/{id}":
        await dynamo
          .delete({
            TableName: "btlaw-poc-organizations",
            Key: {
              id: event.pathParameters.id,
            },
          })
          .promise();
        body = `Deleted item ${event.pathParameters.id}`;
        break;
      case "GET /organizations/{id}":
        body = await dynamo
          .get({
            TableName: "btlaw-poc-organizations",
            Key: {
              id: event.pathParameters.id,
            },
          })
          .promise();
        break;
      case "GET /tags":
        const orgs = await dynamo
          .scan({ TableName: "btlaw-poc-organizations" })
          .promise();
        const tags = new Set();

        for (let org of orgs.Items) {
          for (let tag of org.tags) {
            if (tag.length > 0) {
              tags.add(toTitleCase(tag));
            }
          }
        }
        body = [...tags];
        break;
      case "GET /organizations":
        body = await dynamo
          .scan({ TableName: "btlaw-poc-organizations" })
          .promise();
        body = body.Items.map((org) => {
          return {
            ...org,
            tags: org.tags.map((t) => toTitleCase(t)),
          };
        });
        break;
      case "POST /organizations":
        let requestJSON = JSON.parse(event.body);
        console.log(requestJSON);

        if (!requestJSON.id) {
          throw new Error(`No id found: "${JSON.stringify(requestJSON)}"`);
        }

        const existingByName = await dynamo.get({
          TableName: "btlaw-poc-organizations",
          IndexName: "name_index",
          KeyConditionExpression: "name = :name",
          ExpressionAttributeValues: { ":name": { S: requestJSON.name } },
        }).Item;

        console.log({ existingByName });

        if (!!existingByName) {
          throw new Error(
            `Organization already exists with name, ${JSON.stringify(
              existingByName
            )}`
          );
        }

        const existingById = await dynamo.get({
          TableName: "btlaw-poc-organizations",
          Key: {
            id: requestJSON.id,
          },
        }).Item;

        console.log({ existingById });

        if (!!existingById) {
          throw new Error(
            `Organization already exists with id, ${JSON.stringify(
              existingById
            )}`
          );
        }

        await dynamo
          .put({
            TableName: "btlaw-poc-organizations",
            Item: {
              id: requestJSON.id,
              name: requestJSON.name,
              description: requestJSON.description,
              btContactName: requestJSON.btContactName,
              volunteerContactName: requestJSON.volunteerContactName,
              volunteerContactEmail: requestJSON.volunteerContactEmail,
              volunteerContactPhone: requestJSON.volunteerContactPhone,
              orgUrl: requestJSON.orgUrl,
              volunteerUrl: requestJSON.volunteerUrl,
              tags: requestJSON.tags,
              trainingInformation: requestJSON.trainingInformation,
              areasServed: requestJSON.areasServed,
            },
          })
          .promise();
        body = `Put organizations ${requestJSON.id}`;
        break;
      default:
        throw new Error(`Unsupported route: "${event.routeKey}"`);
    }
  } catch (err) {
    statusCode = 400;
    body = err.message;
  } finally {
    body = JSON.stringify(body);
  }

  return {
    statusCode,
    body,
    headers,
  };
};
