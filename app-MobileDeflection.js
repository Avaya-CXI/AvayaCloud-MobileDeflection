const express = require('express');
const https = require('https');
const cpaas = require('@avaya/cpaas'); //Avaya cloud
let enums = cpaas.enums;
let ix = cpaas.inboundXml;
const bodyParser = require('body-parser');
const cookieParse = require('cookie-parser');
const fs = require('fs');
const axios = require('axios');

const CPAAS_SID = ""; //Your Avaya Cloud SID
const CPAAS_TOKEN = ""; //Your Avaya Cloud Auth Token
const CPAAS_SEND_NUMBER = ""; //The number that you own that you want Avaya Cloud to send the SMS from
const FORWARD_TO_NUMBER = ""; //The number you would like to use as the end destination

const PROTOCOL = "https"; //The protocol of the application that is being hosted
const HOST = ""; //Host of the application
const URL_PORT = 5004; //The Port that the application is being served from
const BASE_URL = PROTOCOL + "://" + HOST + ":" + URL_PORT;
const INCOMING_VOICE_PATH = "/IncomingVoice/"
const INCOMING_VOICE_URL = BASE_URL + INCOMING_VOICE_PATH; //The URL that should handle the incoming voice call
const POTENTIAL_MOBILE_DEFLECTION_PATH = "/PotentialMobile/"
const POTENTIAL_MOBILE_DEFLECTION_URL = BASE_URL + POTENTIAL_MOBILE_DEFLECTION_PATH; //The URL where the call will go to once a mobile caller is detected

const MOBILE_DEFLECTION_LINK = "https://avaya.com"; //The link you want sent for mobile deflection
const CHAIN_FILE =  ""; //Path to Chain File for HTTPS Cert
const KEY_FILE = ""; //Path to Key File for HTTPS Cert

let key = fs.readFileSync(KEY_FILE).toString();
let cert = fs.readFileSync(CHAIN_FILE).toString();

let httpsOptions = {
        key: key,
        cert: cert
};


//Tells the application to use express and the bodyParser as middleware to easily parse JSON
let app = express();
app.use(bodyParser.urlencoded({
    extended : true
}));
app.use(bodyParser.json()); //Tries to parse incoming HTTP request bodies as JSON


let httpsServer = https.createServer(httpsOptions, app); //Creates the HTTPS Server
httpsServer.listen(URL_PORT, function(){ //Tells the HTTPS Server to listen on a specific port
    console.log("Listening: " , URL_PORT.toString());
});

//This is where the endpoints are set up to handle the incoming request
app.post(INCOMING_VOICE_PATH , incomingVoice);
app.post(POTENTIAL_MOBILE_DEFLECTION_PATH , potentialMobile);



async function incomingVoice(req , res)
{

  let callingNumber = req.body.From;

  //Carrier Lookup to find out if the caller is mobile or not
  let connector = new cpaas.CarrierServicesConnector({
      accountSid: CPAAS_SID,
      authToken: CPAAS_TOKEN
  });

  let carrierLookup = await connector.carrierLookup({
      phoneNumber: callingNumber
  }).then(function (data) {

      return data;
  });



  //Check if mobile
  let mobile = carrierLookup.carrier_lookups[0].mobile;
  let xml = null;
  if(mobile) { //Mobile Treatment
      xml = generateXMLdtmf(POTENTIAL_MOBILE_DEFLECTION_URL , 10 , 1 , "We have detected that you are calling from a mobile device.  If you would like to try our mobile experience, please press 1, otherwise, press anything else." , null);
  } else { //Not Mobile
      xml = generateForwardToAgentResponse();
  }

  let xmlResponse = await buildCPaaSResponse(xml);

  res.type('application/xml');
  res.send(xmlResponse);

}

async function potentialMobile(req , res)
{
    let digits = req.body.Digits;
    let caller = req.body.From;

    let xml = null;
    if(digits == "1") { //Send mobile link
        sendMobileDeflectionLink(caller);
        xml = generateMobileDeflectionResponse();
    } else {
        xml = generateForwardToAgentResponse();
    }

    let xmlResponse = await buildCPaaSResponse(xml);

    res.type('application/xml');
    res.send(xmlResponse);
}



function sendMobileDeflectionLink(personToSendTo)
{
    var connector = new cpaas.SmsConnector({
        accountSid: CPAAS_SID,
        authToken: CPAAS_TOKEN
    });

    connector.sendSmsMessage({
        to : personToSendTo ,
        from : CPAAS_SEND_NUMBER ,
        body : MOBILE_DEFLECTION_LINK
    }).then(function(data){
        console.log("Post SMS Send: " , data);
    });
}


async function buildCPaaSResponse(xmlDefinition)
{
      var result = await ix.build(xmlDefinition).then(function(xml){
          return xml;
      }).catch(function(err){
          console.log('The generated XML is not valid!', err);
      });

      return result;
}

function generateForwardToAgentResponse()
{
      let xml = [];
      let say = ix.say({
          language: enums.Language.EN,
          text: 'You will now be forwarded to our help line.' ,
          voice : enums.Voice.FEMALE
      });

      let number = ix.number({number : FORWARD_TO_NUMBER});
      let forward = ix.dial({
          content : number
      });

      xml.push(say);
      xml.push(forward);

      xml = ix.response({content: xml});

      return xml;
}

function generateMobileDeflectionResponse()
{
      let xml = [];
      let say = ix.say({
          language: enums.Language.EN,
          text: 'You will be receiving a link shortly!' ,
          voice : enums.Voice.FEMALE
      });

      let hangup = ix.hangup();

      xml.push(say);
      xml.push(hangup);

      xml = ix.response({content: xml});

      return xml;
}

function generateXMLdtmf(callback_url , timeout , numDigits , prompt , hangup)
{

      var xml_content = [];
      if(hangup == null) {
          var gather = ix.gather({
              action : callback_url ,
              method : "POST" ,
              input : "dtmf" ,
              timeout : timeout ,
              numDigits : numDigits ,
              content : [
                ix.say({
                    language: enums.Language.EN,
                    text: prompt ,
                    voice : enums.Voice.FEMALE
                })
              ]
          });

          xml_content.push(gather);
      }
      else
      {
            var say = ix.say({
                language: enums.Language.EN,
                text: prompt ,
                voice : enums.Voice.FEMALE
            });

            hangup = ix.hangup();

            xml_content.push(say);
            xml_content.push(hangup);
      }




      var xmlDefinition = ix.response({content: xml_content});

      return xmlDefinition;
}
