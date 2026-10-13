# PID Playground

An interactive simulator for tuning a PID controller. Drag Kp, Ki and Kd and the response re-runs instantly.

- Three systems: DC motor speed, drone altitude, cruise control
- Live charts of the output and the controller's effort
- Metrics: overshoot, rise time, settling time, steady-state error, and worst dip after a disturbance
- Toggles for a disturbance at 6 s, sensor noise and anti-windup
- Presets such as "P only" and "Too much I" that show common failure modes

## How it works

`sim.js` is a fixed-step (5 ms) simulation of each plant with a PID loop around it. Error is divided by each system's range so gains mean similar things everywhere. Derivative is taken on the (low-pass filtered) measurement, and anti-windup uses conditional integration. `app.js` draws the charts on canvas and handles the controls. No libraries.

## Run it

Open `index.html`, or run `python3 -m http.server 8000` from the repo root and visit http://localhost:8000/pid/.

## Ideas to extend

- Auto-tuning (Ziegler-Nichols) button
- Inverted pendulum plant
- Click-and-drag your own target on the chart
- Export the gains as Arduino code
