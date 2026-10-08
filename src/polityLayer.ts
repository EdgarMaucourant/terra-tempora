import {
  ArcType,
  Cartesian3,
  Color,
  GeometryInstance,
  HorizontalOrigin,
  Label,
  LabelCollection,
  LabelStyle,
  Material,
  MaterialAppearance,
  Math as CesiumMath,
  NearFarScalar,
  PolygonGeometry,
  PolygonHierarchy,
  PolylineGeometry,
  PolylineMaterialAppearance,
  Primitive,
  Scene,
  VerticalOrigin,
} from "cesium";
import type { Polity } from "./data";
import { contextColor, featuredColor } from "./colors";

// Shapes float slightly above the globe surface so they never z-fight with it.
const CONTEXT_HEIGHT = 2500;
const FEATURED_HEIGHT = 5000;
const FEATURED_FILL_ALPHA = 0.5;
const CONTEXT_FILL_ALPHA = 0.22;
// Width, in years, of the crossfade between two consecutive snapshots.
const FADE = 0.6;
// Context realms this large (km²) get a name on the globe.
const CONTEXT_LABEL_AREA = 900_000;

interface ShapeGraphics {
  fill: Primitive;
  line: Primitive;
  fillMaterial: Material;
  lineMaterial: Material;
  fillColor: Color;
  lineColor: Color;
  label?: Label;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Opacity of a shape at a (fractional) year. A shape owns the span from half a
 * year before its first year to half a year after its last, and fades across
 * each edge so consecutive snapshots blend into each other.
 */
export function shapeOpacity(p: Polity, year: number): number {
  const start = p.from - 0.5;
  const end = p.to + 0.5;
  return smoothstep(start - FADE / 2, start + FADE / 2, year) * (1 - smoothstep(end - FADE / 2, end + FADE / 2, year));
}

export class PolityLayer {
  private graphics = new Map<number, ShapeGraphics>();
  private labels: LabelCollection;
  showContext = true;

  constructor(
    private scene: Scene,
    private polities: Polity[],
  ) {
    this.labels = scene.primitives.add(new LabelCollection({ scene }));
  }

  /** Shows the shapes that exist at `year`. Returns true while shapes are still being built. */
  update(year: number): boolean {
    let pending = false;
    for (const p of this.polities) {
      const visibleKind = p.featured || this.showContext;
      const opacity = visibleKind ? shapeOpacity(p, year) : 0;
      let g = this.graphics.get(p.id);
      // Build shapes shortly before they are needed so playback stays smooth.
      if (!g && visibleKind && year >= p.from - 3 && year <= p.to + 1) g = this.build(p);
      if (!g) continue;
      const show = opacity > 0.002;
      g.fill.show = show;
      g.line.show = show;
      if (show) {
        const fillAlpha = (p.featured ? FEATURED_FILL_ALPHA : CONTEXT_FILL_ALPHA) * opacity;
        g.fillMaterial.uniforms.color = Color.fromAlpha(g.fillColor, fillAlpha, g.fillMaterial.uniforms.color);
        g.lineMaterial.uniforms.color = Color.fromAlpha(g.lineColor, g.lineColor.alpha * opacity, g.lineMaterial.uniforms.color);
        if (!g.fill.ready || !g.line.ready) pending = true;
      }
      // Labels switch at the midpoint of a fade. Changing a label's colour
      // redraws its glyphs, which is too costly to do every frame.
      if (g.label) g.label.show = opacity > 0.5;
    }
    return pending;
  }

  private build(p: Polity): ShapeGraphics {
    const height = p.featured ? FEATURED_HEIGHT : CONTEXT_HEIGHT;
    const fillColor = Color.fromCssColorString(p.featured ? featuredColor(p.name) : contextColor(p.name));
    const lineColor = p.featured
      ? Color.fromCssColorString(featuredColor(p.name)).brighten(0.35, new Color()).withAlpha(0.95)
      : Color.fromCssColorString("#d9dde3").withAlpha(0.35);

    const fillMaterial = Material.fromType("Color", { color: fillColor.withAlpha(0) });
    const fill = new Primitive({
      geometryInstances: p.rings.map(
        (ring) =>
          new GeometryInstance({
            id: p,
            geometry: new PolygonGeometry({
              polygonHierarchy: new PolygonHierarchy(Cartesian3.fromDegreesArray(ring)),
              height,
              granularity: CesiumMath.RADIANS_PER_DEGREE,
              vertexFormat: MaterialAppearance.MaterialSupport.BASIC.vertexFormat,
            }),
          }),
      ),
      appearance: new MaterialAppearance({
        material: fillMaterial,
        materialSupport: MaterialAppearance.MaterialSupport.BASIC,
        translucent: true,
        flat: true,
        faceForward: true,
      }),
      asynchronous: true,
      show: false,
    });

    const lineMaterial = Material.fromType("Color", { color: lineColor.withAlpha(0) });
    const line = new Primitive({
      geometryInstances: p.rings.map((ring) => {
        const positions: number[] = [];
        for (let i = 0; i < ring.length; i += 2) positions.push(ring[i], ring[i + 1], height + 300);
        positions.push(ring[0], ring[1], height + 300);
        return new GeometryInstance({
          id: p,
          geometry: new PolylineGeometry({
            positions: Cartesian3.fromDegreesArrayHeights(positions),
            width: p.featured ? 2 : 1,
            arcType: ArcType.GEODESIC,
            vertexFormat: PolylineMaterialAppearance.VERTEX_FORMAT,
          }),
        });
      }),
      appearance: new PolylineMaterialAppearance({ material: lineMaterial, translucent: true }),
      asynchronous: true,
      show: false,
    });

    this.scene.primitives.add(fill);
    this.scene.primitives.add(line);

    let label: Label | undefined;
    const labelColor = p.featured ? Color.fromCssColorString("#fbf6ec") : Color.fromCssColorString("#d5dae0");
    if (p.label && (p.featured || p.area >= CONTEXT_LABEL_AREA)) {
      label = this.labels.add({
        id: p,
        position: Cartesian3.fromDegrees(p.label[0], p.label[1], height + 2000),
        text: p.name,
        font: p.featured ? "600 15px 'Instrument Sans', sans-serif" : "500 12px 'Instrument Sans', sans-serif",
        fillColor: labelColor,
        outlineColor: Color.BLACK.withAlpha(0.85),
        outlineWidth: 3,
        style: LabelStyle.FILL_AND_OUTLINE,
        horizontalOrigin: HorizontalOrigin.CENTER,
        verticalOrigin: VerticalOrigin.CENTER,
        scaleByDistance: new NearFarScalar(2e6, 1.15, 2.5e7, 0.8),
        show: false,
      });
    }

    const g: ShapeGraphics = { fill, line, fillMaterial, lineMaterial, fillColor, lineColor, label };
    this.graphics.set(p.id, g);
    return g;
  }
}
