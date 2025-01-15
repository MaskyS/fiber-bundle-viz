# Fiber Bundle Deformation Visualization - Design Document
## Overview
This document describes the implementation of a WebGL-based visualization of a fiber bundle deformation, specifically demonstrating the Poisson effect in a 3x3 grid of fibers where deformation of the central fiber affects surrounding fibers while maintaining physical constraints.
## Core Physical Principles
### Conservation Laws
1. Base Space Area Conservation
   - Total area in the xy-plane must remain constant (9 unit²)
   - As center expands, surrounding fibers must contract to maintain total area
   - Area ratios determine scaling factors through square root (linear scaling)
2. Volume Conservation Per Fiber
   - Each fiber must maintain constant volume
   - Z-axis deformation inversely proportional to xy-area change
   - For any fiber: new_height = original_height / (scale_x * scale_y)
### Topological Constraints
1. Position Anchoring
   - Each fiber must maintain its center position in the base space
   - No fiber should drift from its original xy center coordinates
   - Deformations must be applied in local coordinates relative to fiber centers
2. Height Pinning
   - Top faces of all fibers must remain at their original height
   - Only bottom faces move up during compression
   - This maintains the "fiber bundle" structure during deformation
3. Overlap Prevention
   - No fiber may intersect with any other fiber under any deformation
   - Minimum spacing (MIN_SPACING) must be maintained between fibers
   - Maximum expansion (MAX_EXPANSION) of center fiber limited to prevent forcing overlap
## Implementation Details
### Critical Constants
glsl
const float MAX_EXPANSION = 2.1;  // Maximum allowed expansion factor
const float MIN_SPACING = 0.1;    // Minimum required gap between fibers

### Coordinate Transformations
1. Local-Global Transformation
   glsl
   vec3 localPos = position.xyz - fiberCenter;  // To local
   position.xyz = localPos + fiberCenter;       // Back to global
   
   - All deformations must happen in local coordinates
   - Ensures proper scaling around fiber centers
### Deformation Calculations
1. Center Fiber
   glsl
   float expansionFactor = 1.0 + (uDeformation * (MAX_EXPANSION - 1.0));
   // XY expansion
   localPos.xy *= expansionFactor;
   // Z contraction (bottom only)
   if (localPos.z < 0.0) {
       localPos.z *= (1.0 / (expansionFactor * expansionFactor));
   }
   
2. Surrounding Fibers
   ```glsl
   float centerExpansion = 1.0 + (uDeformation * (MAX_EXPANSION - 1.0));
   float centerArea = centerExpansion * centerExpansion;
   float remainingArea = 9.0 - centerArea;

   // Safe contraction calculation
   float maxContraction = length(uFiberPosition.xy) - (centerExpansion * 0.2) - MIN_SPACING;
   float areaBasedContraction = sqrt(remainingArea / 8.0);
   float contractionFactor = max(maxContraction / length(uFiberPosition.xy), areaBasedContraction);
   ```
## Critical Invariants
1. Physical Invariants
   - Total base space area must remain exactly 9 unit²
   - Each fiber's volume must remain constant
   - Top faces must maintain original z-coordinate
2. Geometric Invariants
   - Minimum spacing between fibers must never be violated
   - Fiber centers must remain fixed in xy-plane
   - Z-axis deformation must only affect bottom faces
3. Visual Invariants
   - Deformation must be smooth and continuous
   - Color mapping must remain consistent
   - Transparency should allow visualization of depth changes
## Modification Guidelines
When modifying this code, ensure:
1. Conservation Laws
   - Any changes to scaling factors must maintain area conservation
   - Volume preservation must be maintained for all fibers
   - Check both center expansion and surrounding contraction calculations
2. Safe Ranges
   - MAX_EXPANSION can be adjusted but must consider spacing
   - MIN_SPACING can be reduced but never below 0.05 to maintain visibility
   - Deformation slider should remain [0,1] range
3. Coordinate Systems
   - Always transform to local coordinates before deformation
   - Maintain proper center positions after transformation
   - Ensure proper matrix multiplication order
4. Performance Considerations
   - Shader calculations should be minimized
   - Avoid conditional branches in shader when possible
   - Buffer updates should be efficient
## Common Pitfalls to Avoid
1. Physical Accuracy
   - Don't allow fibers to overlap
   - Don't break volume conservation
   - Don't allow base space area to change
2. Implementation
   - Don't modify vertices in world coordinates
   - Don't apply z-deformation to top faces
   - Don't use non-linear scaling without careful consideration
3. Visual
   - Don't allow sharp discontinuities in deformation
   - Don't lose transparency for depth perception
   - Don't allow fibers to clip through each other
## Testing Checklist
When modifying, verify:
1. Center fiber expands smoothly without overlapping neighbors
2. Surrounding fibers contract proportionally
3. Total base space area remains constant
4. No fiber intersections occur at any deformation value
5. Top faces remain at constant height
6. Volume conservation is maintained
7. Transparency and colors remain consistent
8. Performance remains smooth for all deformation values