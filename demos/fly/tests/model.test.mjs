import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectPair, countThrough } from '../model.js';
const trials = [{gain:1,seed:0,condition:'intact',spikes:[0.1,0.2,0.9],count:3},{gain:1,seed:0,condition:'silenced',spikes:[0.2],count:1},{gain:0.8,seed:0,condition:'intact',spikes:[],count:0},{gain:0.8,seed:0,condition:'silenced',spikes:[],count:0}];
test('gain and seed selection retains the matched condition pair',()=>{const p=selectPair(trials,'1','0');assert.equal(p.intact.count,3);assert.equal(p.cut.count,1);assert.equal(selectPair(trials,0.8,0).cut.count,0);assert.throws(()=>selectPair(trials,1,4));});
test('replay includes a spike exactly at the cursor and none from the future',()=>{assert.equal(countThrough([0.1,0.2,0.9],0),0);assert.equal(countThrough([0.1,0.2,0.9],0.2),2);assert.equal(countThrough([0.1,0.2,0.9],1),3);});
test('the default pair uses the verified 67/50 MN9 counts and replay resets both at zero',()=>{const raw=readFileSync(new URL('../archive.js',import.meta.url),'utf8');const data=JSON.parse(raw.slice(raw.indexOf('=')+1).trim().replace(/;$/,''));const pair=selectPair(data.trials,1,0);assert.equal(countThrough(pair.intact.spikes,0),0);assert.equal(countThrough(pair.cut.spikes,0),0);assert.equal(countThrough(pair.intact.spikes,1),67);assert.equal(countThrough(pair.cut.spikes,1),50);assert.equal(countThrough(pair.intact.spikes,0.0378),1);assert.equal(countThrough(pair.cut.spikes,0.0378),1);});
