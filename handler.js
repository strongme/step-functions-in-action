'use strict';
const AWS = require('aws-sdk')
const axios = require('axios');
const region = 'us-east-1';
const stepfunctions = new AWS.StepFunctions({region});
const secretsmanager = new AWS.SecretsManager({region});

module.exports.generateAnnotation = async (event, context, callback) => {
  callback(null, event)
};

module.exports.startAnnotation = async (event) => {
    const stateMachineArn = process.env.state_machine_arn;
    const params = {
        stateMachineArn,
        input: event.body
    }
    try {
        const response = await stepfunctions.startExecution(params).promise()
        return {
            statusCode: 200,
            body: JSON.stringify(response,
                null,
                2
            ),
        };
    } catch (e) {
        return {
            statusCode: 200,
            body: JSON.stringify(e,
                null,
                2
            ),
        };
    }
};

module.exports.submitToReview = async (event, context, callback) => {
    const {token, input} = event
    console.log(`token: ${token}`)
    console.log(`request external api with token: ${token} and annotation: ${JSON.stringify(input)}`)
    const p = {SecretId: 'step-functions-review-service-info'}
    try {
        const resp = await secretsmanager.getSecretValue(p).promise();
        const reviewServiceInfo = JSON.parse(resp.SecretString)
        const data = {...input, taskToken: token, formId: 'random form id', formVariantId: 'random form variant id', userId: 'random user id'}
        axios.post(reviewServiceInfo.url, data, {
            headers: {
                Authorization: reviewServiceInfo.token
            }
        }).then(res=> {
            console.log(res)
        }).catch(error=> {
            console.error(error)
        })
        callback(null, data)
    } catch (e) {
        callback(e, null)
    }
}

module.exports.endAnnotation = (event, context, callback) => {
    console.log('end of annotation')
    const {annotation, token} = event
    console.log(`review task token: ${token}`)
    console.log(`reviewed annotation: ${annotation}`)
    callback(null, {annotation})
}

module.exports.confirmAnnotation = async (event) => {
    const {token, annotation} = JSON.parse(event.body)
    if (token) {
        const params = {
            output: JSON.stringify({annotation, token}),
            taskToken: token
        }
        try {
            await stepfunctions.sendTaskSuccess(params).promise()
            return {
                statusCode: 200,
                body: JSON.stringify({
                        message: 'callback success'
                    },
                    null,
                    2
                ),
            };
        } catch (e) {
            return {
                statusCode: 200,
                body: JSON.stringify(e,
                    null,
                    2
                ),
            };
        }

    }
    return {
        statusCode: 200,
        body: JSON.stringify({
                message: 'missing token'
            },
            null,
            2
        ),
    };

}