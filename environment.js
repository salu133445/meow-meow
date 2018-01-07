var tessel = require('tessel');
var climatelib = require('climate-si7020');
var relaylib = require('relay-mono');
var firebase = require('firebase');

var climate = climatelib.use(tessel.port.A);
var relay = relaylib.use(tessel.port.B);

var firebaseConfig = {
  apiKey: "AIzaSyBzJHHk_k4P21JJV5d2xUO6POt7j26UVcE",
  authDomain: "meow-a16ea.firebaseapp.com",
  databaseURL: "https://meow-a16ea.firebaseio.com",
};

var lightChannel = 1;
var fanChannel = 2;
var night = false;
var lastSwitch = [0, 0];
var hot = false;

firebase.initializeApp(firebaseConfig);

climate.on('ready', function () {
	console.log('Connected to climate module');
  firebase.database().ref('/serverStatus').update({errClimate: false});
  setInterval(function () {
		climate.readTemperature('c', function (err, temp) {
			climate.readHumidity(function (err, humid) {
        firebase.database().ref('/climate').update({
          temperature: temp,
          humidity: humid
        });
        if (!hot && temp > 28) {
          firebase.database().ref('/climate').update({hot: true});
          hot = true;
        } else if ( hot && temp < 25 ) {
          firebase.database().ref('/climate').update({hot: false});
          hot = false;
        };      
			});
		});
	}, 1000);
});

climate.on('error', function(err) {
  console.log('error connecting module', err);
  firebase.database().ref('/serverStatus').update({errClimate: true});
});

function switchRelay(mode, channel) {
  relay.getState(channel, function(err, state) {
    if(mode != state){
      relay.toggle(channel, function(err) {
        if(err) {
          if(channel == lightChannel) {
            console.log('Error controlling the light', err);
          } else if(channel == fanChannel) {
            console.log('Error controlling the fan', err);
          }
        } else {
          var date = new Date();
          lastSwitch[channel-1] = date.getTime();
        }
      });
      if(channel == lightChannel) {
        relay.getState(channel, function(err2, state2) {
          firebase.database().ref('/relay/status').update({lightIsOn: state2});
        });
      } else if(channel == fanChannel) {
        relay.getState(channel, function(err2, state2) {
          firebase.database().ref('/relay/status').update({fanIsOn: state2});
        });
      }
    }
  });
}

setInterval(function() {
  var date = new Date();
  var hour = date.getHours() - 16;
  if (hour < 0) {
    hour = 24 - hour;
  }
  if(!night && (hour > 18 || hour < 6) ) {
    console.log(hour);
    switchRelay(true, lightChannel)
    night = true;
    firebase.database().ref('/serverStatus').update({night: true});
  } else if (night && hour > 6 && hour < 18) {
    console.log(date.getHours());
    switchRelay(false, lightChannel)
    night = false;
    firebase.database().ref('/serverStatus').update({night: false});
  }
}, 10000);

firebase.database().ref('/relay/command').on('value', function(snapshot) {
  relay.getState(lightChannel, function(err, state) {
    if(snapshot.val().switchLight != state) {
      switchRelay(snapshot.val().switchLight, lightChannel)
    }
  });
  relay.getState(fanChannel, function(err, state) {
    if(snapshot.val().switchFan != state) {
      switchRelay(snapshot.val().switchFan, fanChannel)
    }
  });
});