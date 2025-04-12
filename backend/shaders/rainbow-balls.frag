#version 330 core

uniform float iTime;
uniform vec2 iResolution;
// uniform vec4 iMouse; // Not used

in vec2 fragCoord; // Input: Normalized coordinates (-1 to 1)
out vec4 fragColor; // Output: Fragment color

#define MAX_STEPS 100
#define MAX_DIST 100.0
#define HIT_THRESHOLD 0.001

// --- SDFs ---
// Sphere SDF: p is position, s is radius
float sdSphere( vec3 p, float s ) {
  return length(p)-s;
}

// --- Scene Map ---
// Defines the entire scene using SDFs
// Returns the shortest distance from point p to the scene
float map(vec3 p) {
    // Pulsating radius for the orb
    float pulseSpeed = 2.5; // How fast the pulse is
    float pulseAmount = 0.15; // How much the radius changes
    float baseRadius = 0.6;  // The base radius of the sphere
    float radius = baseRadius + pulseAmount * (0.5 + 0.5 * sin(iTime * pulseSpeed)); // Smooth pulse (0 to 1 range)

    // Place the sphere at the origin
    vec3 spherePos = vec3(0.0, 0.0, 0.0);
    return sdSphere(p - spherePos, radius);
}

// --- Normal Calculation ---
// Calculates the surface normal at point p using the gradient of the SDF
// This is needed for lighting calculations
vec3 calcNormal( vec3 p ) {
    // Use a small epsilon to sample the SDF gradient in each dimension
    // A smaller epsilon gives more accuracy but can be sensitive to noise
    const float epsilon = 0.001; // Use a value smaller than HIT_THRESHOLD
    vec2 e = vec2(epsilon, 0.0);

    // Calculate gradient by sampling SDF slightly offset in x, y, z directions
    return normalize( vec3( map(p + e.xyy) - map(p - e.xyy), // Gradient in x
                           map(p + e.yxy) - map(p - e.yxy), // Gradient in y
                           map(p + e.yyx) - map(p - e.yyx) ) ); // Gradient in z
}

// --- Rainbow Palette Function ---
// Generates smooth rainbow colors based on input t (often time or position based)
// Based on Inigo Quilez's palette function: https://iquilezles.org/articles/palettes
vec3 palette( float t ) {
    // Coefficients controlling the color mix:
    vec3 a = vec3(0.5, 0.5, 0.5); // Center color (adjusts brightness/saturation)
    vec3 b = vec3(0.5, 0.5, 0.5); // Oscillation amplitude (adjusts saturation/contrast)
    vec3 c = vec3(1.0, 1.0, 1.0); // Frequency (usually kept at 1.0 for full spectrum)
    vec3 d = vec3(0.00, 0.33, 0.67); // Phase shift (controls the starting color)

    // The cosine function creates smooth oscillations for R, G, B components
    return a + b*cos( 6.28318*(c*t+d) ); // 6.28318 is 2*PI
}

// --- Main ---
void main()
{
    // 1. Setup Camera Ray
    vec2 uv = fragCoord; // Using the input normalized coordinates (-1 to 1)
    // Correct aspect ratio so the scene doesn't look stretched
    uv.x *= iResolution.x / iResolution.y;

    // Camera setup
    vec3 ro = vec3(0.0, 0.0, 3.0);       // Ray Origin (camera position) - looking towards negative Z
    vec3 lookAt = vec3(0.0, 0.0, 0.0);  // Point the camera is looking at
    vec3 camUp = vec3(0.0, 1.0, 0.0);   // Up direction for the camera

    // Calculate camera basis vectors
    vec3 ww = normalize(lookAt - ro); // Forward direction
    vec3 uu = normalize(cross(ww, camUp)); // Right direction
    vec3 vv = normalize(cross(uu, ww)); // Up direction

    // Calculate ray direction based on UV coordinates and camera basis
    float fov = 1.5; // Field of view factor (adjust for zoom) - smaller is more zoomed in
    vec3 rd = normalize(uv.x * uu + uv.y * vv + fov * ww); // Ray Direction

    // 2. Raymarch the scene
    float t = 0.0; // Distance travelled along the ray
    vec3 hitPos = ro; // Initialize hit position to ray origin
    bool hit = false; // Flag to indicate if the ray hit an object

    for(int i = 0; i < MAX_STEPS; i++) {
        vec3 p = ro + rd * t; // Current position along the ray
        float d = map(p);     // Distance from current point to the nearest surface

        // Check if the ray is close enough to the surface
        if (d < HIT_THRESHOLD) {
            hit = true;
            hitPos = p;
            break; // Exit loop on hit
        }

        // Advance the ray by the distance to the nearest surface
        // This ensures we don't step over thin objects (in theory)
        t += d;

        // Check if the ray has travelled too far
        if (t > MAX_DIST) {
            break; // Exit loop if max distance exceeded
        }
    }

    // 3. Shading - Calculate the color based on whether we hit something
    vec3 col = vec3(0.05, 0.05, 0.1); // Default background color (dark blueish)

    if (hit) {
        vec3 normal = calcNormal(hitPos); // Get the surface normal at the hit point

        // --- Lighting ---
        vec3 lightPos = vec3(3.0, 4.0, 5.0); // Position of a point light source
        vec3 lightDir = normalize(lightPos - hitPos); // Direction from hit point to light
        float diffuse = max(dot(normal, lightDir), 0.0); // Basic diffuse lighting

        // Calculate specular highlight (Phong reflection)
        vec3 viewDir = normalize(ro - hitPos); // Direction from hit point to camera
        vec3 reflectDir = reflect(-lightDir, normal); // Direction of reflected light
        float specAngle = max(dot(viewDir, reflectDir), 0.0);
        float specular = pow(specAngle, 32.0); // Shininess factor (higher is sharper)

        // --- Color ---
        // Make the rainbow effect shift over time and based on surface normal/position
        // Using normal.y and time gives a nice swirling effect on the sphere
        float colorPhase = iTime * 0.3 + normal.y * 1.0 + length(hitPos)*0.2;
        vec3 rainbowColor = palette(colorPhase);

        // Combine rainbow color with lighting components
        float ambient = 0.2; // Ambient light level
        col = rainbowColor * (ambient + diffuse * 0.8) + vec3(1.0) * specular * 0.5; // Object color + Specular highlight

        // Optional: Add a subtle rim light for better shape definition
        float rim = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.5);
        col += rainbowColor * rim * 0.3;

        // Optional: Add simple distance fog
        float fogFactor = smoothstep(2.0, MAX_DIST * 0.9, t); // Fog starts near camera, increases with distance t
        col = mix(col, vec3(0.05, 0.05, 0.1), fogFactor); // Mix object color with fog color
    }

    // 4. Output Final Color
    // Apply gamma correction (approximate)
    col = pow(col, vec3(1.0/2.2));
    fragColor = vec4(col, 1.0); // Output final color with full alpha
}