"""Export a deterministic, read-only subset of the pinned Shiu v630 graph.

Run with Python plus numpy/pyarrow: --source PATH --protocol PROTOCOL.json.
The local graph viewer's extraction module is reused via --viewer PATH; no simulator
is imported. It verifies source hashes and reads the parquet without altering it.
Output positions intentionally omitted: any display layout is not anatomy.
"""
import argparse, hashlib, importlib.util, json
from datetime import datetime, timezone
from pathlib import Path
import numpy as np
import pyarrow.parquet as pq

def digest(p):
    with p.open('rb') as f: return hashlib.file_digest(f,'sha256').hexdigest()

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--viewer',type=Path,required=True)
    ap.add_argument('--source',type=Path,required=True)
    ap.add_argument('--protocol',type=Path,required=True)
    ap.add_argument('--output',type=Path,default=Path(__file__).parent.parent/'demos'/'fly')
    ap.add_argument('--verification',type=Path,required=True,help='Local receipt path outside published demo directory')
    args=ap.parse_args()
    spec=importlib.util.spec_from_file_location('source_graph',args.viewer/'graph_data.py')
    mod=importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    mod.ROOT=args.protocol.parent; mod.UP=args.source
    graph=mod.Graph()
    roundup=mod.ROUNDUP; mn9=mod.MN9
    path=graph.shortest(graph.sensory,roundup)+graph.shortest([roundup],mn9)
    selected={graph.lookup[roundup],graph.lookup[mn9]}
    for r in path: selected.update([int(graph.pre[r]),int(graph.post[r])])
    candidates=set()
    for ident in (roundup,mn9):
        for direction in ('in','out'):
            candidates.update(int(r) for r in graph.rows(graph.lookup[ident],direction))
    for r in sorted(candidates,key=lambda r:(-abs(int(graph.weight[r])),r)):
        endpoints={int(graph.pre[r]),int(graph.post[r])}
        if len(selected|endpoints)<=55: selected.update(endpoints)
    induced=set(path)
    for i in selected:
        for r in graph.rows(i):
            if int(graph.post[r]) in selected: induced.add(int(r))
    rows=sorted(induced,key=lambda r:(r not in path,-abs(int(graph.weight[r])),r))[:230]
    edges=[{k:v for k,v in graph.edge(r).items() if k in ('row','source','target','signedCount','synapses','modelSign')} for r in rows]
    nodes=[{k:v for k,v in graph.node(i).items() if k!='index'} for i in sorted(selected)]
    direct=[e for e in edges if e['source']==roundup and e['target']==mn9]
    assert len(direct)==1 and direct[0]['signedCount']==424
    # Independent bounded scan checks every exported row against raw parquet.
    wanted={e['row']:e for e in edges}; checked=0; offset=0
    for batch in pq.ParquetFile(args.source/'2023_03_23_connectivity_630_final.parquet').iter_batches(batch_size=131072,columns=mod.COLS):
        found=[r for r in wanted if offset<=r<offset+batch.num_rows]
        for r in found:
            values=[col[r-offset].as_py() for col in batch.columns]; e=wanted[r]
            assert (graph.ids[values[0]],graph.ids[values[1]],values[2],values[3],values[4])==(e['source'],e['target'],e['signedCount'],e['synapses'],e['modelSign'])
            assert e['synapses']*e['modelSign']==e['signedCount']; checked+=1
        offset+=batch.num_rows
    assert checked==len(edges) and all(r in wanted for r in path)
    protocol=json.loads(args.protocol.read_text())
    hashes={n:digest(args.source/n) for n in ('2023_03_23_completeness_630_final.csv','2023_03_23_connectivity_630_final.parquet','sez_neurons.pickle','LICENSE')}
    output={'format':'fly-v630-neighborhood-1','source':{'url':protocol['source']['model_repo'],'commit':protocol['source']['model_commit'],'sha256':hashes,'release':'FlyWire v630','paper':'https://doi.org/10.1038/s41586-024-07763-9','license':'MIT repository; upstream FlyWire data attribution retained separately'},'selection':{'description':'Reserve one shortest directed sugar-GRN-to-Roundup-to-MN9 route by edge count. Add endpoints of Roundup/MN9 incident rows in descending absolute signed-count order (tie: parquet row) until 55 nodes. Retain induced edges, path first then descending absolute signed count (tie: row), capped at 230.','totalNodes':len(graph.ids),'totalEdges':len(graph.pre),'shownNodes':len(nodes),'shownEdges':len(edges),'eligibleInducedEdges':len(induced),'hiddenInducedEdges':len(induced)-len(edges),'pathMeaning':'One topological shortest example; not a measured, unique or causal signal route.','layout':'No anatomical coordinates. No intermediate-neuron activity or timing supplied.','annotations':'Partial source labels; unannotated neurons are explicitly named.'},'nodes':nodes,'edges':edges,'pathRows':path,'roundup':roundup,'mn9':mn9}
    output['source'].update({
        'license':'Model code: MIT. FlyWire-derived data: CC BY-NC 4.0.',
        'dataLicense':'CC-BY-NC-4.0',
        'dataLicenseURL':'https://creativecommons.org/licenses/by-nc/4.0/',
        'licenseBasis':'https://edit.flywire.ai/principles.html',
        'citationGuidelines':'https://docs.google.com/spreadsheets/d/1eOPxOYoalArVDIhzVis3CsKjETzkdFkRtXSHHY3XdSU/edit',
        'attribution':'Model: Philip Shiu, Nico Spiller and colleagues. Connectome: FlyWire Consortium, Dorkenwald et al.; annotations: Schlegel et al.; original synapses: Buhmann et al. and Heinrich et al.; neurotransmitter predictions: Eckstein, Bates et al.',
        'citations':['https://doi.org/10.1038/s41586-024-07763-9','https://doi.org/10.1038/s41586-024-07558-y','https://doi.org/10.1038/s41586-024-07686-5','https://doi.org/10.1038/s41592-021-01183-7','https://doi.org/10.1007/978-3-030-00934-2_36','https://doi.org/10.1016/j.cell.2024.03.016'],
        'modifications':'Deterministic bounded subset; model sign/counts and source IDs unchanged; positions and timed activity absent.'})
    args.output.mkdir(parents=True,exist_ok=True)
    target=args.output/'network-data.json'; target.write_text(json.dumps(output,separators=(',',':'))+'\n',encoding='utf-8')
    receipt={'passed':True,'utc':datetime.now(timezone.utc).isoformat(),'sourceSha256':hashes,'exportSha256':digest(target),'exportBytes':target.stat().st_size,'checkedRows':checked,'sourceRows':offset,'nodes':len(nodes),'edges':len(edges),'directRoundupMN9':direct[0],'pathRows':path,'checks':['Graph startup verifies pinned source hashes','Every exported row independently compared with raw parquet in bounded batches','Exact string neuron-ID/index mapping','Signed count equals synapses times model sign','All reserved path rows exported','Direct Roundup to MN9 signed count +424'],'neuralSimulationRun':False,'anatomicalCoordinates':False}
    args.verification.parent.mkdir(parents=True,exist_ok=True)
    args.verification.write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(receipt,indent=2))

if __name__=='__main__': main()
