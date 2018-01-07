/*
- Initialization
- IRQ
- SPI TRANSMISSIONS
- Updating Firmware
- CRC Checks
*/
var util = require('util');
var events = require('events');
var isp = require('./attiny-isp');
var Queue = require('sync-queue');

var STOP_CONF = 0x16;
var PACKET_CONF = 0x55;
var ACK_CONF = 0x33;

var ACK_CMD = 0x00;
var FIRMWARE_CMD = 0x01;
var CRC_CMD = 0x07;
var MODULE_ID_CMD = 0x08;

/*
The ADC will need 50 ADC clock cycles
(25 for each Sound and Light sources)
for readings with a 125kHz clock.
We should avoid requesting data faster
than that rate. We can double to ensure
we never exceed its sampling period.
*/
var GESTATION_PERIOD = 1; // 1 ms to gather new sensor readings


function Attiny(hardware) {
  this.hardware = hardware;
  this.chipSelect = hardware.digital[0];
  this.reset = hardware.digital[1];
  this.irq = hardware.digital[2].rawWrite(false);
  this.defaultSPISettings = {clockSpeed : 1000, chipSelect:this.chipSelect, chipSelectDelayUs:30};
  this.spi = hardware.SPI(this.defaultSPISettings);
  this.transmitting = false;
  this.listening = false;
  this.chipSelect.output(true);
  this.reset.output(true);
  this.messageQueue = new Queue();
}

util.inherits(Attiny, events.EventEmitter);

// In charge of initializing the modules
Attiny.prototype.initialize = function(rebootTime, firmwareOptions, callback) {

  var self = this;

  firmwareOptions = firmwareOptions || {};

  function commsError(err, callback) {
    if (err) {
      if (callback) {
        callback(new Error("Unable to communicate with module. Are you sure it's plugged in?"));
      }
      return true;
    }
    return false;
  }

  // Reset the chip
  self._reset(rebootTime, function() {

    // Make sure we can communicate with the module
    self._establishCommunication(function (err, readFirmwareVersion, readModuleID) {
      // If there was an error
      if (err) {
        console.warn("Could not retrieve firmware version and module ID. Attempting update.");
        // Attempt to update the firmware
        self.updateFirmware(firmwareOptions, function afterUpdate(err) {
          if (commsError(err, callback)) return;
          // Then try to read the firmware and module id again
          self._establishCommunication(function (err, readFirmwareVersion, readModuleID) {
            // If there was a problem
            if (commsError(err, callback)) return;
            else {
              // Continue with the initialization process
              self._checkModuleInformation(firmwareOptions, readFirmwareVersion, readModuleID, callback);
            }
          });
        });
      }
      else {
        // Continue with the initialziation process
        self._checkModuleInformation(firmwareOptions, readFirmwareVersion, readModuleID, callback);
      }
    });
  });
};

Attiny.prototype._checkModuleInformation = function(firmwareOptions, readFirmwareVersion, readModuleID, callback) {
  var self = this;

  // If the module ID and firmware matches, we are done initializing
  if (firmwareOptions.moduleID == readModuleID && firmwareOptions.firmwareVersion == readFirmwareVersion) {
    // Call the callback with no error
    if (callback) {
      callback();
    }
  }

  // We are probably going to need to update
  else {
    // This module hasn't been updated with an EEPROM writing and may not return a moduleID (MISO is held high)
    if ((readFirmwareVersion === 0xff && readModuleID === 0xff) || readModuleID === 0 || readModuleID === 0xff) {
      // Update the firmware
      console.warn("Old module firmware detected. Updating...");
      self.updateFirmware(firmwareOptions, callback);
    }

    // If the EEPROM has been written to but the firmware version is wrong
    // But the module ID is wring, this is bad
    else if (readModuleID != firmwareOptions.moduleID) {

      // Abort so we don't flash the wrong firmware
      if (callback) {
        callback(new Error("Wrong module plugged into port. Expected moduleID of " + firmwareOptions.moduleID + " but received " + readModuleID + " .Aborting Initialization."));
      }
      return;
    }
    // If the module ID is right but the firmware version is wrong
    // Just update the firmware
    else if (readFirmwareVersion != firmwareOptions.firmwareVersion) {
      console.warn("Module firmware version incompatible. Updating to correct version...");
      // Just update the firmware
      self.updateFirmware(firmwareOptions, callback);
    }
  }
}

Attiny.prototype._reset = function(rebootTime, callback) {
  this.reset.low();
  this.reset.high(function() {
    // Time needed for attiny to reboot
    setTimeout(callback, rebootTime)
  });

}

Attiny.prototype._establishCommunication = function (callback) {
  var self = this;
  // Grab the firmware version
  self.getFirmwareVersion(function (err, version) {
    // If it didn't work
    if (err) {
      // And a callback was provided
      if (callback) {
        // Call the callback with the error
        callback(err);

        return;
      }
    }
    // If we were successful
    else {
      // Grab the module id
      self.getModuleID(function(err, moduleID) {
        // If a callback was provided
        if (callback) {
          // Call it
          callback(err, version, moduleID);
        }
      })
    }
  });
};

Attiny.prototype.getFirmwareVersion = function (callback) {
  this.getModuleInformation(FIRMWARE_CMD, callback);
};

Attiny.prototype.getModuleID = function (callback) {
  this.getModuleInformation(MODULE_ID_CMD, callback);
};

Attiny.prototype.getModuleInformation = function(cmd, callback) {
  var self = this;
  self.transceive(new Buffer([cmd, 0x00, 0x00]), function spiComplete (err, response) {
    if (err) {
      return callback(err, null);
    } else if (self._validateResponse(response, [PACKET_CONF, cmd]) && response.length === 3)  {
      callback && callback(null, response[2]);
    } else {
      callback && callback(new Error("Error retrieving Module Information."));
    }
  });
}

Attiny.prototype.updateFirmware = function(firmwareOptions, callback) {
  var self = this;
  // Update the firmware
  isp.updateFirmware(this.hardware, firmwareOptions, function crcMatch(err) {

    if (err) {
      if (callback) {
        callback(new Error("Unable to update firmware: " + err.message));
      }
      return;
    }
    // Reset the chip so it reboots
    self._reset(function() {
      // Reset our SPI instance to the correct settings (1kHz)
      self.spi = self.hardware.SPI(self.defaultSPISettings);
      // Check the CRC was set correctly
      self.CRCCheck(firmwareOptions.crc, callback)
    });
  });
}

Attiny.prototype._validateResponse = function (values, expected, callback) {
  var res = true;
  for (var index = 0; index < expected.length; index++) {
    if (expected[index] == false) {
      continue;
    }
    if (expected[index] != values[index]) {
      res = false;
      break;
    }
  }

  callback && callback(res);
  return res;
};

// Handles what logic when the IRQ pin is active
Attiny.prototype.setIRQCallback = function(callback) {
  var self = this;

  self.irq.once('high', callback)
}

// Handle SPI comms
Attiny.prototype.transceive = function(dataBuffer, callback) {
  var self = this;
  // Put this new transfer into the queue
  this.messageQueue.place(function() {
    // Activate the transfer when it's first in the queue
    self.spi.transfer(dataBuffer, function(err, data) {
      // Return data or err as necessary
      if (callback) {
        callback(err, data);
      }
      // Allow any subsequent messages to be transferred.
      setTimeout(self.messageQueue.next.bind(self), GESTATION_PERIOD);
    });
  });
}

// Responsible for performing a CRC check
Attiny.prototype.CRCCheck = function(expectedCRC, callback) {
  var self = this;

  // If the CRC is undefined, then the user doesn't know what it will be after update
  if (expectedCRC == undefined) {
    if (callback) {
      callback();
    }
  }

  self.getCRC(function (err, receivedCRC) {
    if (callback) {
      if (err) {
        callback(err);
        return;
      }
      else {
        if (receivedCRC != expectedCRC) {
          callback(new Error("CRCs do not match."));
        }
        else {
          callback();
        }
      }
    }
  })
};

Attiny.prototype.getCRC = function(callback) {
  var self = this;

  self.transceive(new Buffer([CRC_CMD, 0x00, 0x00, 0x00]), function gotCRC(err, res){
    if (callback) {
      if (err) {
        callback(err);

        return;
      }
      else if (self._validateResponse(res, [PACKET_CONF, CRC_CMD, false, false]) && res.length === 4) {
        if (callback) {
          callback(null, (res[2] << 8 | res[3]));
        }
      }
      else {
        if (callback) {
          callback(new Error("Invalid response from CRC check."));
        }
      }
    }
  });

}

module.exports = Attiny;
