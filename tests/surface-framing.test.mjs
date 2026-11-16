import test from 'node:test';
import assert from 'node:assert/strict';
import { frames } from '../assets/portfolio/spatial/surface-data.js';
import { fitSavedSurfaceViewport } from '../assets/portfolio/spatial/surface-viewer.js';

function orbit(yaw,pitch){
  const c=Math.cos(yaw),s=Math.sin(yaw),a=Math.cos(pitch),b=Math.sin(pitch);
  return new Float32Array([c,b*s,-a*s,0,a,b,s,-b*c,a*c]);
}

test('a shared camera fits every saved vertex at wide and phone aspect ratios throughout orbit',()=>{
  for(const [width,height] of [[1152,680],[360,480],[320,600]]){
    for(const yaw of [0,.7,Math.PI/2,Math.PI,4.4])for(const pitch of [-1.4,0,1.4]){
      const rotation=orbit(yaw,pitch),[sx,sy]=fitSavedSurfaceViewport(width,height,rotation);
      assert.ok(Math.abs(sx*width-sy*height)<1e-9,'both axes use equal pixels per source unit');
      let greatestExtent=0;
      for(const {positions} of frames.values())for(let i=0;i<positions.length;i+=3){
        const x=positions[i],y=positions[i+1],z=positions[i+2];
        const px=(rotation[0]*x+rotation[3]*y+rotation[6]*z)*sx;
        const py=(rotation[1]*x+rotation[4]*y+rotation[7]*z)*sy;
        greatestExtent=Math.max(greatestExtent,Math.abs(px),Math.abs(py));
      }
      assert.ok(greatestExtent<=.880001,'every saved frame retains the declared border');
      assert.ok(greatestExtent>=.879999,'the limiting viewport axis is used fully');
    }
  }
});

test('the shared initial framing makes the wide-canvas surface substantially larger',()=>{
  const width=1152,height=680;
  const [sx]=fitSavedSurfaceViewport(width,height,orbit(0,0));
  const previousScale=.84*Math.min(width,height)/width;
  assert.ok(sx/previousScale>1.5,'initial pixel scale increases by more than 50% without per-frame normalization');
  const middle=frames.get(15).positions;
  let min=Infinity,max=-Infinity;
  for(let i=0;i<middle.length;i+=3){min=Math.min(min,middle[i]);max=Math.max(max,middle[i]);}
  assert.ok((max-min)*sx*width/2>600,'the middle saved surface exceeds 600px on the representative wide canvas');
});
