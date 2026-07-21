# Portfolio demo contract

The portfolio treats each demonstration as a replaceable media boundary rather than coupling project runtimes to
the page shell.

## Current kinds

- `iframe`: load a bounded same-origin application only after the visitor asks for it.
- `video`: show recorded output with native play, pause and seek controls.
- `sequence`: show a small set of recorded frames with keyboard-operable play and scrub controls.

Only one live GPU iframe should be mounted at a time. Removing an iframe is the disposal path.

## Future Morphliner player

A future read-only Morphliner embed should be hosted on a dedicated embed origin and mounted in a lazy, sandboxed
iframe. The main editor and account/payment routes should remain unframeable.

Use a versioned `postMessage` envelope:

```text
namespace: morphliner.embed
version: 1
instanceId: unique per iframe
type: ready | configure | play | pause | seek | state | resize | error
payload: validated for the specific message type
```

Both parent and player must validate the exact origin, `event.source`, namespace, version, instance ID, message
type and payload. Use an exact `targetOrigin`, never `*`.

The player should default to manual activation, respect reduced motion, pause offscreen, expose keyboard play,
pause, seek and reset controls, avoid a keyboard trap, and provide a written description outside the canvas.
