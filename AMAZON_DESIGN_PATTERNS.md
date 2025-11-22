# Amazon-Inspired Design Patterns

This document describes the design patterns and components extracted from the Amazon order page design and implemented in the ConstructAI preconstruction application.

## Design System Updates

### New Color Palette

Added to `app/globals.css`:

```css
/* Accent colors - From Amazon design */
--accent-teal: #047481;       /* Teal accent for section headers */
--accent-teal-dark: #036169;  /* Darker teal for hover states */
--accent-blue: #007185;       /* Blue for links and interactive elements */
--accent-blue-hover: #C7511F; /* Orange-brown for link hover (Amazon style) */
```

### Color Usage Guidelines

- **Teal (#047481)**: Use for section headers like "Arriving today" / "Active Today"
- **Blue (#007185)**: Use for clickable links and product titles
- **Orange-brown (#C7511F)**: Hover state for links (Amazon's signature hover color)
- **Gray backgrounds**: Use gray-100 for summary cards, gray-50 for page backgrounds

## Components

### 1. OrderSummaryCard

**Purpose**: Display key information in a grid layout (similar to Amazon's ORDER PLACED / TOTAL / SHIP TO pattern)

**File**: `components/OrderSummaryCard.tsx`

**Features**:
- Responsive grid layout (automatically adjusts columns based on field count)
- Support for clickable fields with dropdown indicators
- Gray background with subtle borders
- Uppercase labels with larger values

**Usage**:
```tsx
import OrderSummaryCard, { SummaryField } from '@/components/OrderSummaryCard';

const fields: SummaryField[] = [
  {
    label: 'Project Created',
    value: 'November 21, 2025',
  },
  {
    label: 'Total Value',
    value: '$1,245,890',
  },
  {
    label: 'Assigned To',
    value: 'John Smith',
    isLink: true,
    onClick: () => handleUserClick(),
  },
];

<OrderSummaryCard fields={fields} />
```

**Props**:
- `fields`: Array of SummaryField objects
- `className`: Optional additional CSS classes

**SummaryField Interface**:
```typescript
interface SummaryField {
  label: string;                    // Uppercase label
  value: string | React.ReactNode;  // Display value
  isLink?: boolean;                 // Shows dropdown icon and makes clickable
  onClick?: () => void;             // Click handler for links
}
```

### 2. SectionHeader

**Purpose**: Create prominent section headers with teal accent color (like "Arriving today")

**File**: `components/SectionHeader.tsx`

**Features**:
- Teal color variant for Amazon-style sections
- Default variant for standard headers
- Bold, large text

**Usage**:
```tsx
import SectionHeader from '@/components/SectionHeader';

<SectionHeader title="Active Today" variant="teal" />
<SectionHeader title="Project Details" variant="default" />
```

**Props**:
- `title`: Header text
- `variant`: 'teal' (Amazon style) or 'default' (zinc-900)
- `className`: Optional additional CSS classes

### 3. ProductCard

**Purpose**: Display items horizontally with image/icon on left and content on right (Amazon product card pattern)

**File**: `components/ProductCard.tsx`

**Features**:
- Horizontal layout with image thumbnail
- Clickable title links with blue color
- Subtitle and metadata support
- Action button area
- Image placeholder with fallback icon

**Usage**:
```tsx
import ProductCard from '@/components/ProductCard';
import IconButton from '@/components/IconButton';

<ProductCard
  imageUrl="/uploads/diagram.png"
  title="Electrical Systems - Main Building Installation"
  titleLink={true}
  onTitleClick={() => handleViewDetails()}
  subtitle="Review bid items for electrical work"
  metadata={[
    'Return or revise items: Eligible through January 31, 2026',
    'Status: In Progress'
  ]}
  actions={
    <IconButton
      icon="refresh"
      label="Review again"
      variant="outline"
      onClick={handleReview}
    />
  }
/>
```

**Props**:
- `imageUrl`: Optional image URL
- `imagePlaceholder`: Optional custom placeholder component
- `title`: Main title text
- `titleLink`: Whether title should be clickable (default: true)
- `onTitleClick`: Click handler for title
- `subtitle`: Optional subtitle text
- `metadata`: Array of metadata strings
- `actions`: Optional action buttons/components
- `className`: Optional additional CSS classes

### 4. IconButton

**Purpose**: Action buttons with icons (like Amazon's "Buy it again" button)

**File**: `components/IconButton.tsx`

**Features**:
- Multiple predefined icon options
- Custom icon support
- Three variants: outline, solid, ghost
- Three sizes: sm, md, lg
- Hover states and disabled states

**Usage**:
```tsx
import IconButton from '@/components/IconButton';

// With predefined icon
<IconButton
  icon="refresh"
  label="Review again"
  variant="outline"
  size="md"
  onClick={handleClick}
/>

// With custom icon
<IconButton
  icon="custom"
  customIcon={<MyCustomIcon />}
  label="Custom action"
  variant="solid"
  size="lg"
/>
```

**Props**:
- `icon`: Predefined icon type ('refresh', 'add', 'download', 'upload', 'edit', 'delete', 'custom')
- `customIcon`: Custom React node for icon
- `label`: Button text
- `onClick`: Click handler
- `variant`: 'outline' (default), 'solid', or 'ghost'
- `size`: 'sm', 'md' (default), or 'lg'
- `className`: Optional additional CSS classes
- `disabled`: Disable button

## Design Patterns

### 1. Summary Information Layout

**Pattern**: Grid-based summary with key-value pairs
**Example**: Amazon's order header (ORDER PLACED / TOTAL / SHIP TO)

**Implementation**:
- Use `OrderSummaryCard` component
- Gray-100 background with subtle borders
- 2-4 columns depending on information density
- Small uppercase labels, medium-sized values
- Optional clickable fields with dropdown indicators

### 2. Section Dividers

**Pattern**: Prominent colored headers to divide content sections
**Example**: Amazon's "Arriving today" / "Arriving tomorrow" headers

**Implementation**:
- Use `SectionHeader` component with `variant="teal"`
- Teal color (#047481) for emphasis
- Use white background containers with borders

### 3. Horizontal Item Cards

**Pattern**: Left-aligned thumbnail with right-side content
**Example**: Amazon's product items in order list

**Implementation**:
- Use `ProductCard` component
- 96x96px image/icon on left
- Flexible content area on right
- Blue clickable titles
- Gray metadata text
- Action buttons below content

### 4. Action Buttons

**Pattern**: Icon + text buttons with borders
**Example**: Amazon's "Buy it again" button

**Implementation**:
- Use `IconButton` component
- Outline variant for secondary actions
- Solid variant for primary actions
- Ghost variant for tertiary actions
- Icon on left, label on right

## Typography Hierarchy

Based on Amazon's design:

1. **Page Title**: `text-3xl font-bold text-zinc-900` (existing pattern)
2. **Section Headers**: `text-xl font-bold text-[#047481]` (new teal accent)
3. **Card Titles**: `text-lg font-semibold text-zinc-900` (existing pattern)
4. **Product/Item Titles**: `text-base font-medium text-[#007185]` (new blue link)
5. **Body Text**: `text-sm text-gray-600` (existing pattern)
6. **Metadata**: `text-xs text-gray-500` (existing pattern)

## Spacing Guidelines

Based on Amazon's layout:

- **Container padding**: `p-6` for main containers
- **Card internal padding**: `p-5` for cards
- **Vertical spacing between sections**: `space-y-6` or `mb-6`
- **Vertical spacing within cards**: `space-y-3` or `mb-3`
- **Horizontal spacing in grids**: `gap-6` for main grids, `gap-3` for tight layouts

## Demo Component

A complete demo showing all patterns together: `components/AmazonStyleDemo.tsx`

This demo includes:
- Order summary at the top
- Multiple sections with teal headers
- Product cards with different states
- Various button styles and actions

## Integration Examples

### Example 1: Bid Package List View

```tsx
import OrderSummaryCard from '@/components/OrderSummaryCard';
import SectionHeader from '@/components/SectionHeader';
import ProductCard from '@/components/ProductCard';
import IconButton from '@/components/IconButton';

function BidPackageView() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Project Summary */}
        <OrderSummaryCard
          fields={[
            { label: 'Project Number', value: '#2024-1156' },
            { label: 'Total Packages', value: '12' },
            { label: 'Status', value: 'Active' },
          ]}
        />

        {/* Active Packages */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <SectionHeader title="Active Packages" variant="teal" className="mb-4" />

          <ProductCard
            title="Electrical Systems Installation"
            subtitle="Main building electrical work"
            metadata={['Due: Dec 15, 2025', 'Progress: 45%']}
            onTitleClick={() => openPackage()}
            actions={
              <IconButton
                icon="edit"
                label="Edit Package"
                variant="outline"
              />
            }
          />
        </div>
      </div>
    </div>
  );
}
```

### Example 2: Project Dashboard

```tsx
function ProjectDashboard() {
  return (
    <div className="space-y-6">
      {/* Project Info */}
      <OrderSummaryCard
        fields={[
          { label: 'Client', value: 'ABC Construction' },
          { label: 'Value', value: '$2.5M' },
          { label: 'Due Date', value: 'Jan 15, 2026' },
        ]}
      />

      {/* Recent Activity */}
      <SectionHeader title="Recent Activity" variant="teal" />

      {/* Quick Actions */}
      <div className="flex gap-3">
        <IconButton icon="upload" label="Upload Diagram" variant="solid" />
        <IconButton icon="download" label="Export" variant="outline" />
      </div>
    </div>
  );
}
```

## Color Reference

| Element | Color | CSS Variable | Hex Code |
|---------|-------|-------------|----------|
| Section Headers | Teal | `--accent-teal` | #047481 |
| Link Text | Blue | `--accent-blue` | #007185 |
| Link Hover | Orange-brown | `--accent-blue-hover` | #C7511F |
| Background | Light Gray | `--background` | #f9fafb |
| Panel | White | `--panel` | #ffffff |
| Border | Gray | `--border` | #e5e7eb |
| Primary Text | Zinc | `--foreground` | #18181b |
| Muted Text | Gray | `--muted` | #6b7280 |

## Best Practices

1. **Use OrderSummaryCard for key metrics**: Great for project overview, bid summaries, totals
2. **Use SectionHeader with teal for content sections**: Creates visual hierarchy
3. **Use ProductCard for list items**: Perfect for bid packages, diagrams, line items
4. **Use IconButton for actions**: Provides clear, accessible action buttons
5. **Maintain consistent spacing**: Use the spacing guidelines for visual consistency
6. **Follow color hierarchy**: Teal for sections, blue for links, zinc for primary content
7. **Keep cards white**: Use white backgrounds for content cards on gray-50 page background

## Accessibility

All components include:
- Semantic HTML elements
- Proper ARIA labels where needed
- Keyboard navigation support
- Focus states for interactive elements
- Sufficient color contrast ratios
- Disabled states for buttons

## Browser Compatibility

These components use standard CSS and React patterns compatible with:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)
