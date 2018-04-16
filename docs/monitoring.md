# Environment Monitoring System

<img src="figs/system_diagram_monitoring.png" alt="system_diagram_monitoring" style="max-height:200px; display:block; margin:auto">
<p class="caption" align="center">System diagram</p>

## Climate module

- monitor the temperature and humidity
- update climate/temperature and climate/humidity in a *Firebase* real-time
  database
- update climate/hot to true when the temperature rises over 28&deg;C and update
  climate/hot to false when the temperature drops below 25&deg;C

## Relay module

- control the fan and the light bulb
- automatically turn on the fan when temperature rises
- automatically turn on the light at nighttime (18:00~06:00) and turn it off
  at daytime (06:00~18:00)
- enable clients to send request to control the fan and the light bulb

<img src="figs/system_monitoring.png" alt="system_monitoring" style="max-height:300px; display:block; margin:auto">
<p class="caption" align="center">Environment monitoring system</p>
