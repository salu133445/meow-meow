var fs = require('fs');
var express = require('express');
var app = express();
var os = require('os');
var path = require('path');
var http = require('http').Server(app);

var tessel = require('tessel');
var av = require('tessel-av');
var io = require('socket.io')(http);

var servolib = require('servo-pca9685');
var Button = require('t2-button');

var servo = servolib.use(tessel.port.A);
var buttonPin  = tessel.port.B.pin[0];
var camera = new av.Camera();
var mp3_meow = path.join(__dirname, 'meow.mp3');
var mp3_eat = path.join(__dirname, 'eat.mp3');

var port = 8888;

var errButton = 0;

var lastPressed = 0.0;
var feedSys = 1;
var camSys = 3;
var position = 0.5;
var speed = 0.53;

app.use(express.static(path.join(__dirname, '/public')));

app.get('/stream', function(req, res) {
    res.redirect(camera.url);
    console.log("Camera is on.");
});

io.on('connection', function(socket) {  
  if(!errButton) {
    var pushButton = Object.create(Button);
    pushButton.listen({ frequency: 100, pin: buttonPin }).on('press', function () {
      var nowTime = new Date();
      if ( nowTime.getTime() - lastPressed > 2000 ) {   
		  var date = new Date();
         console.log("A paw has been detected.");
         io.emit('meow calling', {year:date.getFullYear(), month:date.getMonth()+1, date:date.getDate(),
														hour:date.getHours(), minute:date.getMinutes() } );         
         lastPressed = date.getTime();
      };
    });    
  };
 
  socket.on('call meow', function(data) {
    var sound = new av.Player(mp3_meow);
    sound.play();
    console.log("A meow has been sent.");
  });
  
  socket.on('camera left', function(data) {
    servo.configure(camSys, 0.05, 0.12, function () {
      if (position > 0.0) {
        position -= 0.1;
      }
      console.log('Position:', position);
      //  Set servo #2 to position pos.
      servo.move(camSys, position);
    });
  });
  
  socket.on('camera right', function(data) {
    servo.configure(camSys, 0.05, 0.12, function () {
      if (position < 1.0) {
        position += 0.1;
      }
      console.log('Position:', position);
      //  Set servo #2 to position pos.
      servo.move(camSys, position);
    });
  });
  
  socket.on('feed', function(data) {
    var sound = new av.Player(mp3_eat);
    sound.play();
    servo.configure(feedSys, 0.05, 0.12, function () {
      console.log('Speed:', speed);
      //  Set servo #1 to position pos.
      servo.move(feedSys, speed);
    });
    setTimeout(function() {
      servo.configure(feedSys, 0.05, 0.12, function () {
          console.log('Speed:',0.48);
          servo.move(feedSys, 0.48);
          var d = new Date();
          lastFed = d.getTime();
      });
    }, 15000);
  });
});

http.listen(port, function() {
  console.log(`http://${os.hostname()}.local:${port}`);
});