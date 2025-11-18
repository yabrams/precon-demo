# Visual Features

Interactive diagram visualization features that link line items in the bid table to their locations on construction diagrams.

## Overview

The visual features system provides three coordinated components that enhance the user's ability to understand how extracted line items relate to specific regions in the source diagram:

1. **Bounding Box Overlay**: Highlights regions on diagrams
2. **Magnifying Glass**: Zooms into diagram details
3. **Connection Lines**: Visual paths linking table rows to diagram regions

## Bounding Box System

### Data Structure

Bounding boxes are stored with each line item:

```typescript
interface LineItem {
  // ... other fields
  boundingBox?: {
    x: number;        // Normalized 0-1 (left edge)
    y: number;        // Normalized 0-1 (top edge)
    width: number;    // Normalized 0-1
    height: number;   // Normalized 0-1
  };
}
```

**Normalized Coordinates**: Values between 0 and 1, independent of image dimensions. Converted to pixels at render time.

### DiagramOverlay Component

**Location**: `components/DiagramOverlay.tsx`

**Purpose**: SVG overlay that renders bounding boxes on top of diagrams.

**Props**:
```typescript
{
  lineItems: LineItem[];
  hoveredItemId: string | null;
  onHoverChange: (itemId: string | null) => void;
  imageWidth: number;
  imageHeight: number;
}
```

**Rendering Logic**:
```typescript
// Convert normalized to pixels
const pixelX = x * imageWidth;
const pixelY = y * imageHeight;
const pixelWidth = width * imageWidth;
const pixelHeight = height * imageHeight;
```

**Visual States**:

1. **Not Hovered** (default):
   - Small colored dot in top-left corner of region
   - Dot: 4px radius, 60% opacity
   - White stroke around dot for visibility

2. **Hovered**:
   - Full bounding box rectangle appears
   - Fill: Color at 40% opacity
   - Stroke: 3px solid color
   - Smooth transition (200ms)

**Color Palette**:
10 pastel colors cycled by item index:
```typescript
const HIGHLIGHT_COLORS = [
  '#93c5fd', // blue-300
  '#fca5a5', // red-300
  '#86efac', // green-300
  '#fcd34d', // yellow-300
  '#c4b5fd', // violet-300
  '#fdba74', // orange-300
  '#f9a8d4', // pink-300
  '#67e8f9', // cyan-300
  '#d8b4fe', // purple-300
  '#a7f3d0', // emerald-300
];
```

**Interaction**:
- Hovering over bounding box rectangle triggers `onHoverChange`
- Hovering over corner dot also triggers highlight
- `pointer-events: auto` on interactive elements
- Cursor changes to pointer on hover

## Magnifying Glass

### MagnifyingGlass Component

**Location**: `components/MagnifyingGlass.tsx`

**Purpose**: Canvas-based zoom lens that follows mouse cursor over diagrams.

**Props**:
```typescript
{
  imageSrc: string;
  imageRef: React.RefObject<HTMLImageElement>;
  zoomFactor?: number;      // Default: 2.5x
  lensWidth?: number;       // Default: 250px
  lensHeight?: number;      // Default: 150px
  enabled: boolean;
}
```

**How It Works**:

1. **Image Loading**:
   - Loads full-resolution image separately for canvas
   - Sets `crossOrigin = 'anonymous'` for CORS support
   - Stored in ref for canvas drawing

2. **Mouse Tracking**:
   - Listens to `mousemove` on original image element
   - Calculates position relative to image bounds
   - Updates lens position and canvas content in real-time

3. **Canvas Drawing**:
   ```typescript
   // Scale factors (displayed image vs natural size)
   const scaleX = sourceImg.naturalWidth / imgRect.width;
   const scaleY = sourceImg.naturalHeight / imgRect.height;

   // Source region to capture
   const sourceWidth = lensWidth / zoomFactor;
   const sourceHeight = lensHeight / zoomFactor;

   // Draw magnified portion
   ctx.drawImage(sourceImg, sx, sy, sourceWidth, sourceHeight,
                 0, 0, lensWidth, lensHeight);
   ```

4. **Positioning**:
   - Lens follows cursor with 20px offset (right and down)
   - Fixed position at cursor coordinates
   - Z-index: 50 (above most UI)

**Visual Design**:
- 4px blue border (`border-blue-500`)
- Heavy shadow: `drop-shadow(0 10px 20px rgba(0, 0, 0, 0.3))`
- Rounded corners
- White background
- Zoom level indicator badge below lens

**Performance**:
- Canvas cleared and redrawn on each mouse move
- Bounds checking prevents out-of-bounds rendering
- Try-catch handles cases where image isn't loaded

## Connection Lines

### ConnectionLine Component

**Location**: `components/ConnectionLine.tsx`

**Purpose**: Animated SVG curved path connecting table rows to diagram regions.

**Props**:
```typescript
{
  hoveredItemId: string | null;
  color: string;
  fromElement: HTMLElement | null;  // Table row
  toX: number;                      // Diagram bounding box center
  toY: number;
}
```

**Path Generation**:

Uses SVG quadratic Bézier curve for smooth arc:
```typescript
const midX = (fromPosition.x + toX) / 2;
const pathD = `
  M ${fromPosition.x} ${fromPosition.y}     // Start at table row
  Q ${midX} ${fromPosition.y},              // Control point
    ${midX} ${(fromPosition.y + toY) / 2}   // Mid-curve point
  T ${toX} ${toY}                           // End at diagram
`;
```

**Position Calculation**:
```typescript
// Table row position (right edge, vertical center)
const rect = fromElement.getBoundingClientRect();
const x = rect.right - containerRect.left;
const y = rect.top + rect.height / 2 - containerRect.top;
```

**Animation**:
- Entry: Path draws from start to end (pathLength: 0 → 1)
- Duration: 300ms, easeInOut
- Opacity: 0 → 0.8
- Circle marker at endpoint animates in with 100ms delay

**Visual Design**:
- Stroke: 3px width
- Color: Matches bounding box color
- Rounded line caps
- Circle endpoint: 5px radius
- Z-index: 1000 (above overlay)

**Responsiveness**:
- Recalculates positions on window resize
- Cleans up resize listener on unmount

## Integration in WorkspaceView

All three features work together in the workspace:

```typescript
const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
const [magnifyEnabled, setMagnifyEnabled] = useState(false);
```

**Hover Synchronization**:
- Table row hover → Set `hoveredItemId`
- DiagramOverlay shows highlighted box with that ID
- ConnectionLine draws path to diagram
- Hover clears on mouse leave

**Image Dimensions**:
Captured on image load:
```typescript
<img
  onLoad={(e) => {
    const img = e.target as HTMLImageElement;
    setImageDimensions({
      width: img.offsetWidth,
      height: img.offsetHeight
    });
  }}
/>
```

**Magnifying Glass Toggle**:
- Keyboard shortcut or button toggles `magnifyEnabled`
- Only active when enabled and mouse is over image

## Coordinate System

### Extraction (Claude Vision API)

Claude returns bounding boxes with normalized coordinates (0-1 range):
```json
{
  "boundingBox": {
    "x": 0.1,      // 10% from left
    "y": 0.2,      // 20% from top
    "width": 0.3,  // 30% of image width
    "height": 0.05 // 5% of image height
  }
}
```

### Display Conversion

At render time, multiply by actual image dimensions:
```typescript
const displayX = boundingBox.x * imageWidth;
const displayY = boundingBox.y * imageHeight;
```

**Benefits**:
- Resolution-independent
- Works with responsive image sizing
- No recalculation needed when image resizes

## User Interaction Flow

1. **User hovers over table row** in BidFormTable
2. **BidFormTable** calls `onRowHover(itemId)`
3. **WorkspaceView** updates `hoveredItemId` state
4. **DiagramOverlay** highlights matching bounding box
5. **ConnectionLine** renders path from row to diagram
6. **User sees**: Table row → Curved line → Highlighted region
7. **Hover on bounding box** also works in reverse (diagram → table)

## Performance Considerations

### DiagramOverlay
- Renders only items with `boundingBox` defined
- Early return if no boxes or zero dimensions
- AnimatePresence handles enter/exit animations efficiently

### MagnifyingGlass
- Only renders when `enabled && isVisible`
- Canvas drawing is efficient for local operations
- Image pre-loaded separately (not re-fetched on each move)

### ConnectionLine
- Single SVG element, no DOM thrashing
- Framer Motion handles animation smoothly
- Cleanup on unmount prevents memory leaks

## CSS Classes and Styling

### DiagramOverlay
```css
.absolute.inset-0.pointer-events-none
/* SVG layer */

.transition-all.duration-200
/* Smooth opacity/stroke changes */
```

### MagnifyingGlass
```css
.fixed.pointer-events-none.z-50
/* Follows cursor, doesn't block clicks */

.rounded.border-4.border-blue-500.shadow-2xl.bg-white
/* Canvas styling */
```

### ConnectionLine
```css
.pointer-events-none.absolute.inset-0
/* Overlay that doesn't interfere */
```

## Future Enhancements

- Click bounding box to scroll table to matching row
- Zoom controls on magnifying glass
- Persistent highlight mode (lock on click)
- Multi-item selection and highlighting
- Bounding box editing (drag to adjust)
- Color customization per item type
- Annotation layer (add notes to diagram regions)
- Export diagram with highlighted boxes
- 3D perspective for multi-page diagrams
