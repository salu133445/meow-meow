## t2-button

### Quick start

#### Hardware

Connect your button between the `3v3` and the `GND` inputs on one of the GPIO pins on your tessel.

#### Code

The following code will light the t2's green LED while the button is pressed.

```javascript
var tessel     = require('tessel');
var Button     = require('t2-button');
var buttonPin  = tessel.port.A.pin[0];
var greenLight = tessel.led[2];

var pushButton = Object.create(Button);

pushButton
.listen({ frequency: 100, pin: buttonPin })
.on('press', function () {
  green.on();
})
.on('release', function () {
  green.off();
})
.on('error', function (err) {
  console.log("Uh oh: ", err);
});
```

### More information

#### Configuration

`Button.listen` should be called with an `options` object, which may have the following keys.

| Key | Description | Default / requried? |
|-----|-------------|---------------------|
| pin | The tessel GPIO pin that the button is connected to. | *No default* - requried unless you have separately called `Button.setPin` |
| delay | The delay between polling the state of the button in milliseconds | *No default* - see frequency property below.
| frequency | The frequency at which the button should be polled in Hz. **Note:** this will be ignored if you have also specified a delay | *Default: 100*
| pullDown | Boolean indicating whether the pin is high or low when pressed. If true, the button is expected to be low when pressed. | *Default: true* |

#### `Button` properties

| Property | Type | Description |
|----------|------|-------------|
| setPin  | function | Sets the GPIO pin to listen on. |
| listen | function | Starts an interval to regularly poll the input and trigger the `press` and `release` events. |
| checkPin | function | This is the function called by the `listen` interval. If the pin value has changed since this was last called, the `press` or `release` event will be emitted. |
| stopListening | function | Cancels the checkPin interval. |
| val | number | The current value of the pin (1 or 0). |

All methods are chainable.
`Button`'s prototype is an `EventEmitter`.

#### What's with `Object.create(Button)`?

This library was made using the ["behaviour delegation"](https://github.com/getify/You-Dont-Know-JS/blob/master/this%20&%20object%20prototypes/ch6.md#delegation-theory) design pattern discussed by [Kyle Simpson](https://github.com/getify/You-Dont-Know-JS/blob/master/this%20&%20object%20prototypes/ch6.md#delegation-theory) in his excellent book series [You Don't know JS](https://github.com/getify/You-Dont-Know-JS/blob/master/this%20&%20object%20prototypes/ch6.md).
