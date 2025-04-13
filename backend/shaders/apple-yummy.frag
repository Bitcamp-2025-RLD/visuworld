#version 330 core

out vec4 fragColor;

uniform vec2 iResolution;
uniform float iTime;

// --- SDF Primitives ---
// Sphere: distance to surface of sphere centered at origin with radius s
float sdSphere( vec3 p, float s ) {
  return length(p)-s;
}

// Capsule: distance to surface of capsule defined by points a, b and radius r
float sdCapsule( vec3 p, vec3 a, vec3 b, float r ) {
  vec3 pa = p - a, ba = b - a;
  // Project p onto the line segment ab, clamp to the segment ends
  float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
  // Return distance from p to the point on the segment minus radius
  return length( pa - ba*h ) - r;
}

// --- SDF Operations ---
// Smooth Subtraction: smoothly subtracts shape d1 from shape d2 with smoothness k
float opSmoothSubtraction( float d1, float d2, float k ) {
    // d1: shape to subtract, d2: original shape
    float h = clamp( 0.5 - 0.5*(d2-d1)/k, 0.0, 1.0 );
    return mix( d2, -d1, h ) + k*h*(1.0-h);
}

// --- Rotation Matrix ---
// Creates a 3x3 rotation matrix for rotation around the Y axis by 'angle' radians
mat3 rotateY(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat3(
        c, 0, -s,
        0, 1, 0,
        s, 0, c
    );
}

// --- Scene Definition ---
// Structure to hold distances to individual components for material lookup
struct SceneDistances {
    float apple;
    float stem;
    float leaf;
};

// Scene Signed Distance Function
// Returns the minimum distance to the scene and calculates component distances
float sceneSDF(vec3 p, out SceneDistances distances) {
    // Apply global rotation to the query point for animation
    mat3 rot = rotateY(iTime * 1.0); // Adjust speed by changing multiplier
    vec3 rp = rot * p; // Rotated point

    // Define Apple components
    float appleRadius = 0.5;
    float dipSmoothness = 0.15; // Controls how smooth the top/bottom dips are
    vec3 bodyPos = vec3(0.0, -0.1, 0.0); // Center apple slightly lower than origin
    // Base sphere for the apple body
    float body = sdSphere(rp - bodyPos, appleRadius);
    // Spheres used to create the dips via smooth subtraction
    vec3 topDipCenter = bodyPos + vec3(0, appleRadius * 0.7, 0);
    vec3 bottomDipCenter = bodyPos - vec3(0, appleRadius * 0.7, 0);
    float topDipSDF = sdSphere(rp - topDipCenter, appleRadius * 0.8);
    float bottomDipSDF = sdSphere(rp - bottomDipCenter, appleRadius * 0.8);
    // Calculate final apple shape distance
    distances.apple = body;
    distances.apple = opSmoothSubtraction(topDipSDF, distances.apple, dipSmoothness);
    distances.apple = opSmoothSubtraction(bottomDipSDF, distances.apple, dipSmoothness);

    // Stem (using a capsule)
    float stemRadius = 0.02;
    float stemHeight = 0.25;
    vec3 stemBase = bodyPos + vec3(0.0, appleRadius * 0.6, 0.0); // Stem base relative to apple center
    vec3 stemDir = normalize(vec3(0.1, 1.0, 0.0)); // Slightly tilted stem direction
    vec3 stemTip = stemBase + stemDir * stemHeight;
    distances.stem = sdCapsule(rp, stemBase, stemTip, stemRadius);

    // Leaf (using a simple flattened sphere)
    float leafRadius = 0.15;
    // Position leaf attached near the middle of the stem, offset slightly sideways
    vec3 leafCenter = stemBase + stemDir * stemHeight * 0.5 + vec3(0.1, 0.0, 0.0);
    vec3 leafP = rp - leafCenter; // Point relative to leaf center
    // Rotate the leaf for a more natural look
    float leafAngle = -0.5; // Rotation angle in radians
    float sl = sin(leafAngle); float cl = cos(leafAngle);
    leafP.xz = mat2(cl, -sl, sl, cl) * leafP.xz;
    // Flatten the leaf by scaling its local y-coordinate before distance calculation
    leafP.y *= 6.0;
    distances.leaf = sdSphere(leafP, leafRadius);

    // Return the minimum distance to any component
    return min(min(distances.apple, distances.stem), distances.leaf);
}

// --- Normal Calculation ---
// Calculates the surface normal at point p using the gradient of the SDF
vec3 calcNormal(vec3 p) {
    const float eps = 0.001; // Small offset for finite difference calculation
    vec2 h = vec2(eps, 0);
    // Need to pass the 'out' parameter, but we don't use its value here
    SceneDistances dummyDistances;
    // Calculate gradient using central differences
    return normalize(vec3(
        sceneSDF(p + h.xyy, dummyDistances) - sceneSDF(p - h.xyy, dummyDistances),
        sceneSDF(p + h.yxy, dummyDistances) - sceneSDF(p - h.yxy, dummyDistances),
        sceneSDF(p + h.yyx, dummyDistances) - sceneSDF(p - h.yyx, dummyDistances)
    ));
}

// --- Material ID Determination ---
// Determines which component (apple, stem, leaf) corresponds to the minimum distance
int getMaterialID(SceneDistances distances, float minDist) {
    // Use a small tolerance to account for floating point inaccuracies
    float tolerance = 0.005;
    if (abs(distances.apple - minDist) < tolerance) return 1; // Apple
    if (abs(distances.stem - minDist) < tolerance) return 2;  // Stem
    if (abs(distances.leaf - minDist) < tolerance) return 3;  // Leaf

    // Fallback check (less robust to precision issues but covers edge cases)
    if (minDist == distances.apple) return 1;
    if (minDist == distances.stem) return 2;
    return 3; // Default to leaf if checks fail
}

// --- Main Render Function ---
// Entry point: calculates the color for each pixel (fragment)
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // Input fragCoord is assumed to be normalized to [-1, 1] range, based on requirements.
    vec2 uv = fragCoord;
    // Adjust UVs to correct aspect ratio, preventing stretching
    uv.x *= iResolution.x / iResolution.y;

    // Simple perspective camera setup
    vec3 ro = vec3(0.0, 0.0, 3.0);      // Ray origin (camera position)
    vec3 lookAt = vec3(0.0, 0.0, 0.0); // Point camera is looking at
    float zoom = 1.0;                  // Camera zoom factor (adjusts FOV)
    vec3 f = normalize(lookAt - ro);   // Forward direction vector
    vec3 r = normalize(cross(vec3(0.0, 1.0, 0.0), f)); // Right direction vector
    vec3 u = cross(f, r);              // Up direction vector
    // Calculate ray direction for the current pixel
    vec3 rd = normalize(f * zoom + uv.x * r + uv.y * u);

    // Raymarching settings
    const int MAX_STEPS = 100;        // Maximum marching steps
    const float MAX_DIST = 100.0;     // Maximum distance to march
    const float HIT_THRESHOLD = 0.001;// Distance threshold for surface hit

    float totalDist = 0.0; // Accumulated distance marched
    vec3 p = ro;           // Current point along the ray, starts at origin
    SceneDistances hitDistances; // Stores component distances at the hit point
    float minDist = 0.0;   // Minimum distance to scene from current point
    bool hit = false;      // Flag indicating if a surface was hit

    // Raymarching loop: step along the ray until hit or max distance/steps reached
    for (int i = 0; i < MAX_STEPS; ++i) {
        minDist = sceneSDF(p, hitDistances); // Evaluate distance to scene
        if (minDist < HIT_THRESHOLD) {
            hit = true; // Found surface
            break;
        }
        if (totalDist > MAX_DIST) {
            break; // Ray went too far
        }
        totalDist += minDist; // Accumulate distance
        p += rd * minDist;    // Advance point along ray direction
    }

    // Default background color (sky blue)
    vec3 col = vec3(0.7, 0.8, 1.0);

    if (hit) {
        // Surface hit, calculate shading
        vec3 normal = calcNormal(p); // Get surface normal at hit point
        vec3 lightDir = normalize(vec3(0.8, 0.7, -0.6)); // Direction of primary light source

        // --- Lighting Calculation ---
        // Ambient light component
        float ambient = 0.2;
        // Diffuse light component (Lambertian)
        float diffuse = max(0.0, dot(normal, lightDir)) * 0.8; // Intensity based on light angle
        // Specular highlight component (Phong-like)
        vec3 viewDir = normalize(ro - p); // Direction from surface point to camera
        vec3 reflectDir = reflect(-lightDir, normal); // Direction of reflected light
        float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0); // Specular power (shininess)
        float specular = spec * 0.5; // Specular intensity

        // --- Material Color ---
        // Determine which part of the apple was hit
        int materialID = getMaterialID(hitDistances, minDist);
        // Assign color based on material ID
        vec3 materialColor;
        if (materialID == 1) { // Apple body
            materialColor = vec3(1.0, 0.15, 0.1); // Vibrant Red
        } else if (materialID == 2) { // Stem
            materialColor = vec3(0.4, 0.25, 0.1); // Brownish
            specular *= 0.1; // Make stem less shiny
        } else { // Leaf (materialID == 3)
            materialColor = vec3(0.2, 0.7, 0.15); // Green
            specular *= 0.3; // Make leaf less shiny than apple
        }

        // Combine lighting components and material color
        col = materialColor * (ambient + diffuse) + vec3(1.0) * specular; // Add specular highlights (usually white)

        // --- Fog ---
        // Simple distance-based fog effect
        float fogFactor = smoothstep(2.5, 5.0, totalDist); // Fog starts at dist 2.5, full by 5.0
        col = mix(col, vec3(0.7, 0.8, 1.0), fogFactor); // Mix shaded color with background fog color

    }

    // Final color output for the fragment, clamped to valid range [0, 1]
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0); // Alpha set to 1.0 (opaque)
}