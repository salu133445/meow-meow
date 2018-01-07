var EventEmitter = require('events').EventEmitter;

function setPin (pin) {
  // Check pin looks like a pin object.
  if (!pin instanceof EventEmitter || typeof pin.read != 'function') {
    throw new Error('Object passed as pin doesn\'t appear to be a pin');
  }
  this.pin = pin;
  return this;
}

function checkPin (cb) {
  if (!this.pin) return;
  this.pin.read((function processPinInput (err, value) {
    if (err) return this.emit('error', err);
    this.pinValue = value;
    // Call callback if provided.
    if (typeof cb == 'function') { cb.apply(this, arguments); }

  }).bind(this));

  return this;
}

function listen (options) {
  if (options.pin) this.setPin(options.pin);
  if (!this.pin) throw new Error('Can\'t listen without setting pin');
  if (options.pullDown != null) this.pullDown = options.pullDown;

  var delay = options.delay;
  if (delay == null) {
    // Calculate delay from frequency
    var freq = options.frequency || 100;
    delay = 1000 / freq;
  }


  // First cancel the existing listener if we have one.
  if (this.listenInterval !== null) { this.stopListening() }

  this.listenInterval = setInterval(this.checkPin.bind(this), delay);

  return this;
}

function stopListening () {
  clearInterval(this.listenInterval);
  this.listenInterval = null;
  this.val = null;
  return this;
}

var TesselButton = {
  pin: null,
  pullDown: true,
  set pinValue (val) {
    if (this.val == null) return this.val = val;
    if (this.val == null) return val;
    if (this.val && !val) {
      this.emit(this.pullDown ? 'press' : 'release');
    } else if (!this.val && val) {
      this.emit(this.pullDown ? 'release' : 'press');
    }
    this.val = val;
  },
  get pinValue () { return this.val },
  stopListening: stopListening,
  listen: listen,
  setPin: setPin,
  checkPin: checkPin
}

Object.setPrototypeOf(TesselButton, EventEmitter.prototype);

module.exports = TesselButton;
