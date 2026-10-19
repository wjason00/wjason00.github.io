import importlib.util
import struct
import unittest
from pathlib import Path

SCRIPT = Path(__file__).parents[1] / 'export-fly-morphology.py'
spec = importlib.util.spec_from_file_location('morphology_export', SCRIPT) if SCRIPT.exists() else None
module = importlib.util.module_from_spec(spec) if spec else None
if module:
    spec.loader.exec_module(module)

class MorphologyExportTests(unittest.TestCase):
    def test_precomputed_preserves_source_coordinates_and_string_id(self):
        parser = getattr(module, 'parse_precomputed', None)
        self.assertTrue(callable(parser), 'Precomputed parser has not been implemented')
        data = struct.pack('<II', 3, 2) + struct.pack('<9f', 1000, 2000, 3000, 2000, 2000, 3000, 3000, 2000, 3000) + struct.pack('<4I', 0, 1, 1, 2) + struct.pack('<3f', 100, 100, 100)
        result = parser(data)
        self.assertEqual(result['positions'], [[1000.,2000.,3000.],[2000.,2000.,3000.],[3000.,2000.,3000.]])
        self.assertEqual(result['edges'], [[0,1],[1,2]])
        with self.assertRaises(ValueError):
            parser(data[:-1])

    def test_simplification_preserves_branch_points_endpoints_and_error_bound(self):
        simplify = getattr(module, 'simplify_skeleton', None)
        self.assertTrue(callable(simplify), 'Topology-preserving simplification has not been implemented')
        positions = [[0.,0.,0.], [500.,0.,0.], [1000.,0.,0.], [1500.,20.,0.], [2000.,0.,0.], [1000.,1000.,0.]]
        edges = [[0,1],[1,2],[2,3],[3,4],[2,5]]
        result = simplify(positions,edges,tolerance_nm=100)
        self.assertEqual(set(result['sourceVertexIndices']), {0,2,4,5})
        self.assertEqual(len(result['edges']),3)
        self.assertLessEqual(result['maxDeviationNm'],100)
        self.assertEqual(result['positions'],[positions[i] for i in result['sourceVertexIndices']])
        strict = simplify(positions,edges,tolerance_nm=1)
        self.assertIn(3,strict['sourceVertexIndices'])

if __name__ == '__main__':
    unittest.main()
