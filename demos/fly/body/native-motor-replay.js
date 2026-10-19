(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NativeMotorReplay = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const LABELS = ['MN6_l', 'MN6_r', 'MN9_l', 'MN9_r'];
  const AXES = ['midline', 'left', 'right'];
  const ANGLES = ['head', 'rostrum', 'haustellum', 'labrum_left', 'labrum_right'];

  function finiteNumber(value, name) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new TypeError(`${name} must be finite`);
    }
    return value;
  }

  function positivePolicy(policy, key) {
    const value = finiteNumber(policy[key], `policy.${key}`);
    if (value <= 0) throw new RangeError(`policy.${key} must be positive`);
    return value;
  }

  function clamp01(value) { return Math.max(0, Math.min(1, value)); }
  function zeroExtension() { return { midline: 0, left: 0, right: 0 }; }
  function zeroActivity() { return { mn9: 0, mn6_left: 0, mn6_right: 0 }; }
  function scaledAngle(extension, amplitude) {
    // Keep exact rest represented as +0, including negative angle amplitudes.
    return extension === 0 ? 0 : extension * amplitude;
  }

  function build(trial, policy, options) {
    options = options === undefined ? {} : options;
    if (!policy || typeof policy !== 'object') throw new TypeError('policy is required');
    if (!options || typeof options !== 'object') throw new TypeError('options must be an object');
    for (const option of ['blockMN9', 'blockMN6']) {
      if (options[option] !== undefined && typeof options[option] !== 'boolean') {
        throw new TypeError(`${option} must be boolean`);
      }
    }
    const dt = positivePolicy(policy, 'dt_seconds');
    const neuralDuration = positivePolicy(policy, 'neural_duration_seconds');
    const duration = positivePolicy(policy, 'replay_duration_seconds');
    const tau = positivePolicy(policy, 'activation_tau_seconds');
    const rate = positivePolicy(policy, 'reference_rate_hz');
    const omega = positivePolicy(policy, 'natural_frequency_per_second');
    const damping = finiteNumber(policy.damping_ratio, 'policy.damping_ratio');
    if (damping < 0) throw new RangeError('policy.damping_ratio cannot be negative');
    if (duration < neuralDuration) throw new RangeError('policy replay duration must cover neural duration');
    const steps = Math.round(duration / dt);
    if (!Number.isSafeInteger(steps) || steps < 1 || steps > 1000000 ||
        Math.abs(steps * dt - duration) > 1e-12) {
      throw new RangeError('policy duration must contain an integral, bounded number of steps');
    }
    const amplitudes = policy.angle_amplitudes_radian;
    if (!amplitudes || typeof amplitudes !== 'object') throw new TypeError('policy angle amplitudes are required');
    const amplitude = {};
    for (const angle of ANGLES) amplitude[angle] = finiteNumber(amplitudes[angle], `policy angle ${angle}`);
    if (!trial || !trial.channels || typeof trial.channels !== 'object') {
      throw new TypeError('trial.channels are required');
    }

    // Copy and validate every channel even when its actuator input is blocked.
    // Source traces retain their original timing/order and are never modified.
    const spikes = {};
    const cursors = {};
    const activation = {};
    for (const label of LABELS) {
      const channel = trial.channels[label];
      if (!channel || !Array.isArray(channel.spikes)) throw new TypeError(`channel ${label}.spikes must be an array`);
      spikes[label] = channel.spikes.slice();
      let previous = -Infinity;
      for (const value of spikes[label]) {
        finiteNumber(value, `${label} spike time`);
        if (value < 0 || value >= neuralDuration) throw new RangeError(`${label} spike time outside neural domain`);
        if (value < previous) throw new RangeError(`${label} spike times are out of order`);
        previous = value;
      }
      cursors[label] = 0;
      activation[label] = 0;
    }

    const extension = zeroExtension();
    const velocity = zeroExtension();
    const decay = Math.exp(-dt / tau);
    const impulseScale = 1 / (rate * tau);
    function blocked(label) {
      return label.startsWith('MN9') ? options.blockMN9 : options.blockMN6;
    }
    function currentActivity() {
      return {
        mn9: (activation.MN9_l + activation.MN9_r) / 2,
        mn6_left: activation.MN6_l,
        mn6_right: activation.MN6_r
      };
    }
    function addBoundaryImpulses(t) {
      for (const label of LABELS) {
        const events = spikes[label];
        while (cursors[label] < events.length && events[cursors[label]] <= t) {
          const spike = events[cursors[label]++];
          if (!blocked(label)) activation[label] += Math.exp(-(t - spike) / tau) * impulseScale;
        }
      }
    }
    function frame(t) {
      return {
        t,
        angles: {
          head: scaledAngle(extension.midline, amplitude.head),
          rostrum: scaledAngle(extension.midline, amplitude.rostrum),
          haustellum: scaledAngle(extension.midline, amplitude.haustellum),
          labrum_left: scaledAngle(extension.left, amplitude.labrum_left),
          labrum_right: scaledAngle(extension.right, amplitude.labrum_right)
        },
        activity: currentActivity(),
        extension: { ...extension }
      };
    }
    const frames = [];
    addBoundaryImpulses(0);
    frames.push(frame(0));
    for (let step = 1; step <= steps; step++) {
      const previous = currentActivity();
      const targets = {
        midline: clamp01(previous.mn9),
        left: clamp01(previous.mn6_left),
        right: clamp01(previous.mn6_right)
      };
      for (const axis of AXES) {
        const acceleration = omega * omega * (targets[axis] - extension[axis]) -
          2 * damping * omega * velocity[axis];
        velocity[axis] += acceleration * dt;
        extension[axis] = clamp01(extension[axis] + velocity[axis] * dt);
        // A saturated position cannot keep accumulating outward velocity.
        if ((extension[axis] === 0 && velocity[axis] < 0) ||
            (extension[axis] === 1 && velocity[axis] > 0)) velocity[axis] = 0;
      }
      for (const label of LABELS) activation[label] *= decay;
      const t = step * dt;
      addBoundaryImpulses(t);
      frames.push(frame(t));
    }

    const rest = { t: 0, angles: Object.fromEntries(ANGLES.map(name => [name, 0])),
      activity: zeroActivity(), extension: zeroExtension() };
    function copyFrame(f, t) {
      return { t, angles: { ...f.angles }, activity: { ...f.activity }, extension: { ...f.extension } };
    }
    function sample(t) {
      finiteNumber(t, 'sample time');
      if (t <= 0) return copyFrame(rest, 0);
      // Interpolation only touches boundaries at or before the query time:
      // evaluating t-dt ensures its ceiling boundary cannot lie in the future.
      const position = Math.min(steps, Math.max(0, t / dt - 1));
      const lower = Math.floor(position);
      const upper = Math.min(steps, lower + 1);
      const fraction = position - lower;
      const a = frames[lower], b = frames[upper];
      const result = { t: Math.min(t, duration), angles: {}, activity: {}, extension: {} };
      for (const group of ['angles', 'activity', 'extension']) {
        for (const key of Object.keys(a[group])) {
          result[group][key] = a[group][key] + fraction * (b[group][key] - a[group][key]);
        }
      }
      return result;
    }
    return { frames, dtSeconds: dt, durationSeconds: duration, sample };
  }

  return { build };
});
