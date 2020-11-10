This is meant to serve as an example of a basic Avaya Cloud application that is able to handle incoming voice calls and provide a unique mobile experience if the caller is calling from a mobile device.

For the voice interactions, it will answer the call and do a mobile look up check.  If the caller is mobile, then they are offered an option to press 1 to
receive a link via SMS and then the call is dropped.  If the caller is not mobile, then a message is played to the caller and the caller is forwarded to the end destination.


You will need to fill in some values for the variables at the top of the screen.  In order to properly map the Avaya Cloud number to the application, you will have to set your Request Url for Voice Requests to whatever the value of INCOMING_VOICE_URL is.  

The link that is sent out as the mobile deflection link could be changed by setting the MOBILE_DEFLECTION_LINK to another value.

Once you have cloned the repository, go inside of the directory and run 'npm install' to install the proper node libraries.  
After that, simply run 'node app-MobileDeflection.js' and it should say that the application is Listening on the configured port.
