import { Camera, Cartesian3 } from "cesium";

// CesiumJS zooms toward the cursor by turning the camera about the axis between
// the point under the cursor and the point at the centre of the screen. With
// the cursor exactly on the centre that axis has no length, and turning about
// it throws "normalized result is not a number", which stops the globe from
// drawing anything more. There is nothing to turn then, so skip the turn.
const rotate = Camera.prototype.rotate;
Camera.prototype.rotate = function (this: Camera, axis: Cartesian3, angle?: number) {
  const length = Cartesian3.magnitude(axis);
  if (!(length > 1e-12)) return;
  rotate.call(this, axis, angle);
};
