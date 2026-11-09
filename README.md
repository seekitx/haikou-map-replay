# Haikou map replay

A browser-based 3D scene built from a reconstructed 2D Cartographer occupancy map and recorded trajectory. The camera orbits a fixed map. The low wall height is an illustrative visual convention, not measured height; replay timing is illustrative, not recorded vehicle speed. This is historical data, not live vehicle status.

The published site contains only the reconstructed map image, trajectory coordinates, viewer code, and a locally hosted copy of Three.js. The original archive and raw pbstream are not included. Three.js is MIT licensed; see vendor/THREE-LICENSE.

## Wall visualization

The continuous wall layer is an exploratory rendering reconstructed from the 2D occupancy image, not a corrected source map. It filters small speckles, applies a closing radius of 15 cm, expands the footprint by one 5 cm pixel, smooths and extracts contours, and simplifies them by up to 10 cm. To avoid turning scattered obstacles into pillars, it raises only regions at least 2 m long and fragments at least 0.75 m long within 0.3 m of a long region. Other observations remain visible on the floor and in the original wall view. This heuristic can hide real short walls, and it cannot distinguish furniture from walls with certainty. Closing may bridge gaps up to roughly 30 cm and narrow nearby openings; it cannot reliably identify real doors without surveyed reference data. Height is illustrative and is not measured. Do not use this visualization for robot navigation. The original wall view remains selectable.

The reproducible generator is `tools/build_wall_surfaces.py`, using NumPy, SciPy, contourpy and Shapely 2.1+. `assets/wall-surfaces.json` records processing settings; `assets/wall-surface-preview.png` is a diagnostic where gold denotes candidate bridge pixels. Original input assets and the pbstream are not changed.

## Pillars and curved benches

The user identified the round outlines as pillars and the curved outlines as seats. `assets/map-objects.json` stores manually matched approximate positions and footprints for nine pillars and 20 curved bench rows on the source raster. The viewer arranges the Blender-created `assets/airport-seat.glb` along those rows and provides a layer toggle; its editable source is `assets/airport-seat.blend`. Heights, materials, bench backrests and some partially visible outlines are estimates, not measured geometry. Several benches are close to the historical trajectory and the displayed robot may overlap them; neither collision clearance nor navigation safety has been verified. The source map and trajectory are unchanged.

## Robot model

The robot is a detailed Blender-created visual approximation based on the manufacturer's [AlphaBot 2 product image](https://docs.ai2robotics.com/start/product-introduction/) and [hardware description](https://docs.ai2robotics.com/en/alphabot2/hardware/architecture/). The torso, shell seams, sensors, joints, tool mounts, base, and grippers are hand-modelled visual approximations. It is not an official engineering or CAD model. The wheeled character follows the recorded 2D trajectory and turns according to its path. The two wheel meshes rotate by distance travelled using an illustrative 0.105 m radius; wheel motion is not measured encoder data. Playback speed and body pose are illustrative; the underlying file has not been verified as originating from an AlphaBot 2.

The viewer offers a close robot-follow view and an overhead follow view; these are camera controls over the same recorded trajectory, not live robot tracking.
