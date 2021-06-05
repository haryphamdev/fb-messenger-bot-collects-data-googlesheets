require("dotenv").config();
import request from "request";
import homepageService from "../services/homepageService";
const { GoogleSpreadsheet } = require('google-spreadsheet');

const MY_VERIFY_TOKEN = process.env.MY_VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

let getHomepage = (req, res) => {
    return res.render("homepage.ejs");
};

let getWebhook = (req, res) => {

    // Your verify token. Should be a random string.
    let VERIFY_TOKEN = MY_VERIFY_TOKEN;

    // Parse the query params
    let mode = req.query['hub.mode'];
    let token = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];

    // Checks if a token and mode is in the query string of the request
    if (mode && token) {

        // Checks the mode and token sent is correct
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {

            // Responds with the challenge token from the request
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);

        } else {
            // Responds with '403 Forbidden' if verify tokens do not match
            res.sendStatus(403);
        }
    }
};

let postWebhook = (req, res) => {
    // Parse the request body from the POST
    let body = req.body;

    // Check the webhook event is from a Page subscription
    if (body.object === 'page') {

        // Iterate over each entry - there may be multiple if batched
        body.entry.forEach(function (entry) {

            // Gets the body of the webhook event
            let webhook_event = entry.messaging[0];
            console.log(webhook_event);


            // Get the sender PSID
            let sender_psid = webhook_event.sender.id;
            console.log('Sender PSID: ' + sender_psid);

            // Check if the event is a message or postback and
            // pass the event to the appropriate handler function
            if (webhook_event.message) {
                handleMessage(sender_psid, webhook_event.message);
            } else if (webhook_event.postback) {
                handlePostback(sender_psid, webhook_event.postback);
            }

        });

        // Return a '200 OK' response to all events
        res.status(200).send('EVENT_RECEIVED');

    } else {
        // Return a '404 Not Found' if event is not from a page subscription
        res.sendStatus(404);
    }

};

// Handles messages events
let handleMessage = (sender_psid, received_message) => {
    let response;

    // Checks if the message contains text
    if (received_message.text) {
        // Create the payload for a basic text message, which
        // will be added to the body of our request to the Send API
        response = {
            "text": `You sent the message: "${received_message.text}". Now send me an attachment!`
        }
    } else if (received_message.attachments) {
        // Get the URL of the message attachment
        let attachment_url = received_message.attachments[0].payload.url;
        response = {
            "attachment": {
                "type": "template",
                "payload": {
                    "template_type": "generic",
                    "elements": [{
                        "title": "Is this the right picture?",
                        "subtitle": "Tap a button to answer.",
                        "image_url": attachment_url,
                        "buttons": [
                            {
                                "type": "postback",
                                "title": "Yes!",
                                "payload": "yes",
                            },
                            {
                                "type": "postback",
                                "title": "No!",
                                "payload": "no",
                            }
                        ],
                    }]
                }
            }
        }
    }

    // Send the response message
    callSendAPI(sender_psid, response);
};

// Handles messaging_postbacks events
let handlePostback = (sender_psid, received_postback) => {
    let response;

    // Get the payload for the postback
    let payload = received_postback.payload;

    // Set the response based on the postback payload
    if (payload === 'yes') {
        response = { "text": "Thanks!" }
    } else if (payload === 'no') {
        response = { "text": "Oops, try sending another image." }
    } else if (payload === 'GET_STARTED') {
        response = homepageService.handleGetStartedButton();
    } else if (payload === 'RESTART_CONVERSATION') {
        response = homepageService.handleGetStartedButton();
    }
    // Send the message to acknowledge the postback
    callSendAPI(sender_psid, response);
};

// Sends response messages via the Send API
let callSendAPI = (sender_psid, response) => {
    // Construct the message body
    let request_body = {
        "recipient": {
            "id": sender_psid
        },
        "message": response
    };

    // Send the HTTP request to the Messenger Platform
    request({
        "uri": "https://graph.facebook.com/v6.0/me/messages",
        "qs": { "access_token": PAGE_ACCESS_TOKEN },
        "method": "POST",
        "json": request_body
    }, (err, res, body) => {
        if (!err) {
            console.log('message sent!')
        } else {
            console.error("Unable to send message:" + err);
            console.log('check error send messages 1111111111111')
            console.log(res)
            console.log('check error send messages 22222222222')
        }
    });
};

let handleSetupInfor = async (req, res) => {
    //call the facebook api
    // Send the HTTP request to the Messenger Platform
    let request_body = {
        "get_started": {
            "payload": "GET_STARTED"
        },
        "persistent_menu": [
            {
                "locale": "default",
                "composer_input_disabled": false,
                "call_to_actions": [
                    {
                        "type": "web_url",
                        "title": "My youtube channel",
                        "url": "https://www.youtube.com/channel/UCHqJxLo7mKam9GKqqwr2wfA",
                        "webview_height_ratio": "full"
                    },
                    {
                        "type": "web_url",
                        "title": "Source code this chatbot",
                        "url": "https://www.github.com/haryphamdev",
                        "webview_height_ratio": "full"
                    },
                    {
                        "type": "postback",
                        "title": "Restart the converstaion",
                        "payload": "RESTART_CONVERSATION"
                    },
                ]
            }
        ],
        "whitelisted_domains": [
            "https://personal-data-haryphamdev-bot.herokuapp.com", //link to your Heroku app
        ]
    };
    return new Promise((resolve, reject) => {
        try {
            request({
                "uri": "https://graph.facebook.com/v10.0/me/messenger_profile",
                "qs": { "access_token": PAGE_ACCESS_TOKEN },
                "method": "POST",
                "json": request_body
            }, (err, response, body) => {
                console.log('-------------------------------------------------------')
                console.log('Logs setup persistent menu & get started button: ', response)
                console.log('-------------------------------------------------------')
                if (!err) {
                    return res.send('Setup done!')
                } else {
                    return res.send('Something wrongs with setup, please check logs...')
                }
            });
        } catch (e) {
            reject(e);
        }
    })
}

let handleGetSurveyPage = (req, res) => {
    const facebookAppId = process.env.FACEBOOK_APP_ID;
    return res.render('survey.ejs', {
        facebookAppId: facebookAppId
    });
}

let handlePostSurvey = async (req, res) => {
    let psid = req.body.psid;
    let name = req.body.name;
    let country = req.body.country;
    let email = req.body.email;
    let phonenumber = req.body.phonenumber;
    let note = req.body.note;

    await writeDataToGoogleSheet(name, country, email, phonenumber, note);

    //send a text message
    await callSendAPI(psid, { text: `Done!\nYour information 's recorded!` });


    //send a button template message
    let response = homepageService.getButtonMessageTemplate();
    await callSendAPI(psid, response);

    return res.status(200).json({
        message: 'ok'
    })
}

let writeDataToGoogleSheet = async (name, country, email, phonenumber, note) => {
    return new Promise(async (resolve, reject) => {
        try {
            // Initialize the sheet - doc ID is the long id in the sheets URL
            const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID);

            // Initialize Auth - see more available options at https://theoephraim.github.io/node-google-spreadsheet/#/getting-started/authentication
            await doc.useServiceAccountAuth({
                client_email: JSON.parse(`"${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL}"`),
                private_key: JSON.parse(`"${process.env.GOOGLE_PRIVATE_KEY}"`),
            });
            await doc.loadInfo(); // loads document properties and worksheets

            const sheet = doc.sheetsByIndex[0];
            const rows = await sheet.getRows();

            let id = rows.length + 1;

            await sheet.addRow(
                {
                    'No': id,
                    'Name': name,
                    'Country': country,
                    'Email': email,
                    'Phone number': phonenumber,
                    'Message': note
                }
            );

            resolve();
        } catch (e) {
            reject(e);
        }
    })
}

module.exports = {
    getHomepage: getHomepage,
    getWebhook: getWebhook,
    postWebhook: postWebhook,
    handleSetupInfor: handleSetupInfor,
    handleGetSurveyPage: handleGetSurveyPage,
    handlePostSurvey: handlePostSurvey,
    writeDataToGoogleSheet: writeDataToGoogleSheet
};
