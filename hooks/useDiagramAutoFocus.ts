'use client';

import { useMemo } from 'react';

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ContainerSize {
  width: number;
  height: number;
}

interface DiagramTransform {
  scale: number;
  translateX: number;
  translateY: number;
}

interface UseDiagramAutoFocusProps {
  boundingBox: BoundingBox | null | undefined;
  containerSize: ContainerSize;
  imageNaturalSize: ContainerSize;
  enabled: boolean;
  minScale?: number;
  maxScale?: number;
  padding?: number; // How much of the container the bbox should fill (0.7 = 70%)
}

/**
 * Hook to calculate CSS transform for auto-zooming/panning diagram to focus on a bounding box
 * Returns transform values that can be applied to the image container
 */
export function useDiagramAutoFocus({
  boundingBox,
  containerSize,
  imageNaturalSize,
  enabled,
  minScale = 1,
  maxScale = 4,
  padding = 0.7,
}: UseDiagramAutoFocusProps): DiagramTransform {
  return useMemo(() => {
    // Default transform (no zoom, no pan)
    const defaultTransform: DiagramTransform = {
      scale: 1,
      translateX: 0,
      translateY: 0,
    };

    // Return default if not enabled or no bounding box
    if (!enabled || !boundingBox) {
      return defaultTransform;
    }

    // Ensure we have valid dimensions
    if (
      containerSize.width === 0 ||
      containerSize.height === 0 ||
      imageNaturalSize.width === 0 ||
      imageNaturalSize.height === 0
    ) {
      return defaultTransform;
    }

    const { x, y, width, height } = boundingBox;

    // Calculate the bounding box dimensions in pixels (based on natural image size)
    const bboxPixelWidth = width * imageNaturalSize.width;
    const bboxPixelHeight = height * imageNaturalSize.height;

    // Handle very small bounding boxes
    if (bboxPixelWidth < 10 || bboxPixelHeight < 10) {
      return defaultTransform;
    }

    // Calculate scale to fit bounding box with padding
    const scaleX = (containerSize.width * padding) / bboxPixelWidth;
    const scaleY = (containerSize.height * padding) / bboxPixelHeight;

    // Use the smaller scale to ensure the entire bounding box fits
    let scale = Math.min(scaleX, scaleY);

    // Clamp scale to min/max range
    scale = Math.max(minScale, Math.min(maxScale, scale));

    // Calculate center of bounding box in normalized coordinates (0-1)
    const centerX = x + width / 2;
    const centerY = y + height / 2;

    // Calculate translation to center the bounding box
    // We need to translate so that the bbox center is at the container center
    // The translation is in percentage of the container size
    const translateX = (0.5 - centerX) * 100 * scale;
    const translateY = (0.5 - centerY) * 100 * scale;

    return {
      scale,
      translateX,
      translateY,
    };
  }, [boundingBox, containerSize, imageNaturalSize, enabled, minScale, maxScale, padding]);
}

/**
 * Generate CSS transform string from transform values
 */
export function getTransformStyle(transform: DiagramTransform): React.CSSProperties {
  return {
    transform: `scale(${transform.scale}) translate(${transform.translateX}%, ${transform.translateY}%)`,
    transformOrigin: 'center center',
    transition: 'transform 300ms ease-out',
  };
}
