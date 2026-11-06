# Haikou map replay

A browser-based 3D scene built from a reconstructed 2D Cartographer occupancy map and recorded trajectory. The camera orbits a fixed map. The low wall height is an illustrative visual convention, not measured height; replay timing is illustrative, not recorded vehicle speed. This is historical data, not live vehicle status.

The published site contains only the reconstructed map image, trajectory coordinates, viewer code, and a locally hosted copy of Three.js. The original archive and raw pbstream are not included. Three.js is MIT licensed; see vendor/THREE-LICENSE.

## Wall visualization

The default enhanced wall layer is an exploratory visualization derived from the reconstructed 2D grid, not a corrected source map. On a 10 cm display grid, it conservatively removes components smaller than three cells, applies a one-cell-radius morphological closing, and lightly smooths the result. Newly inferred cells are colored gold; original and enhanced wall views can be switched in the page. The illustrative wall height is not measured. Small doorways or real objects may be misclassified, and no site survey is available to validate the result, so this layer must not be used for robot navigation.

The reproducible generator is `tools/enhance_walls.py` (requires NumPy and SciPy). The exported mask and statistics are in `assets/`. This processing does not modify the original map asset or pbstream.
