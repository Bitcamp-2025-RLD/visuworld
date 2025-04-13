precision highp float;

uniform vec2 iResolution;
uniform float iTime;

// Raymarching settings
const int MAX_STEPS = 100;
const float MAX_DIST = 100.0;
const float SURF_DIST = 0.001;

// --- SDF for the Fractal Shape (Mandelbox variation) ---
// This function defines the distance to the surface of our fractal.
float sdFractal(vec3 p) {
    vec3 z = p;
    float scale = 2.1 + 0.2 * sin(iTime * 0.3); // Mandelbox scaling parameter, animated slightly
    float minRadius2 = 0.25; // Inner radius for sphere folding
    float fixedRadius2 = 1.0; // Outer radius for sphere folding
    float dr = 1.0; // Derivative factor for distance estimation

    // Apply some initial rotation based on time
    float angle = iTime * 0.1;
    mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
    z.xz = rot * z.xz;
    z.xy = rot * z.xy;

    for (int i = 0; i < 6; i++) { // Increase iterations for more detail
        // Box folding: clamp coordinates to [-1, 1], reflect outside values
        z = clamp(z, -1.0, 1.0) * 2.0 - z;

        // Sphere folding: invert points inside minRadius or outside fixedRadius
        float r2 = dot(z, z);
        if (r2 < minRadius2) {
            float temp = fixedRadius2 / minRadius2;
            z *= temp;
            dr *= temp;
        } else if (r2 < fixedRadius2) {
            float temp = fixedRadius2 / r2;
            z *= temp;
            dr *= temp;
        }

        // Scaling and offset (z = scale*z + p, where p is the original point)
        z = z * scale + p;
        dr = dr * abs(scale) + 1.0; // Update derivative approximation
    }

    // Base shape after iterations - a sphere
    // The final distance is the length of the iterated point z minus a radius,
    // divided by the derivative dr to approximate the true distance.
    float dist = (length(z) - 1.5) / dr;

    return dist;
}

// --- Raymarching Function ---
// Marches a ray from origin 'ro' in direction 'rd' and returns distance to surface.
float raymarch(vec3 ro, vec3 rd) {
    float dO = 0.0; // Distance traveled along the ray
    for(int i=0; i<MAX_STEPS; i++) {
        vec3 p = ro + rd * dO; // Current point along the ray
        float dS = sdFractal(p); // Distance from current point to the surface
        dO += dS;
        // If we're close enough, or too far, stop marching
        if(dO > MAX_DIST || abs(dS) < SURF_DIST) break;
    }
    return dO;
}

// --- Normal Calculation ---
// Calculates the surface normal at point 'p' using the gradient of the SDF.
vec3 getNormal(vec3 p) {
    vec2 e = vec2(SURF_DIST * 0.5, 0.0); // Small epsilon for gradient calculation
    vec3 n = vec3(
        sdFractal(p + e.xyy) - sdFractal(p - e.xyy),
        sdFractal(p + e.yxy) - sdFractal(p - e.yxy),
        sdFractal(p + e.yyx) - sdFractal(p - e.yyx)
    );
    return normalize(n); // Return the normalized gradient vector
}

// --- Rainbow Color Palette ---
// Generates a rainbow color based on input 't'. (From IQ's palette article)
vec3 palette( float t ) {
    vec3 a = vec3(0.5, 0.5, 0.5); // Base color (grey)
    vec3 b = vec3(0.5, 0.5, 0.5); // Amplitude (controls saturation)
    vec3 c = vec3(1.0, 1.0, 1.0); // Frequency (controls color spread)
    vec3 d = vec3(0.00, 0.33, 0.67); // Phase (controls starting color)
    // The cosine function creates smooth color transitions
    return a + b*cos( 6.28318*(c*t+d) );
}

// --- Main Shader Function ---
void main() {
    // Normalize fragment coordinates to range roughly [-aspect, aspect] x [-1, 1]
    vec2 uv = (gl_FragCoord.xy * 2.0 - iResolution.xy) / iResolution.y;

    // --- Camera Setup ---
    float timeParam = iTime * 0.25;
    vec3 ro = vec3(3.8 * cos(timeParam), 2.5, 3.8 * sin(timeParam)); // Orbiting camera position
    vec3 target = vec3(0.0, 0.5, 0.0); // Look towards this point
    vec3 camUp = vec3(0.0, 1.0, 0.0); // Up direction

    // Calculate camera basis vectors
    vec3 ww = normalize(target - ro); // Forward direction
    vec3 uu = normalize(cross(ww, camUp)); // Right direction
    vec3 vv = normalize(cross(uu, ww)); // Up direction

    // Calculate ray direction based on fragment coordinates and FOV (zoom)
    vec3 rd = normalize(uv.x * uu + uv.y * vv + 2.0 * ww); // FOV approx 1/2.0 = 0.5

    // --- Raymarch to find intersection ---
    float dist = raymarch(ro, rd);

    // --- Shading ---
    vec3 col = vec3(0.05, 0.05, 0.1); // Default background color (dark blue)

    if (dist < MAX_DIST) { // If the ray hit the fractal
        // Calculate hit point and surface normal
        vec3 p = ro + rd * dist;
        vec3 normal = getNormal(p);

        // --- Lighting ---
        vec3 lightPos = vec3(4.0 * cos(iTime * 0.5), 4.0, 4.0 * sin(iTime * 0.5)); // Moving light source
        vec3 lightDir = normalize(lightPos - p);
        float diffuse = pow(max(dot(normal, lightDir), 0.0), 0.8); // Diffuse term with slight falloff adjustment
        float ambient = 0.25; // Ambient light contribution

        // --- Coloring ---
        // Base the color calculation on the hit point's position
        // Using dot products mixes coordinates for interesting patterns
        float colorInput = dot(p, normalize(vec3(1.0, 0.8, 0.6))) * 0.2;
        // Add contribution from the normal's orientation
        colorInput += dot(normal, vec3(0.0, 1.0, 0.0)) * 0.1;
        // Slowly shift the entire palette over time
        colorInput += iTime * 0.05;

        // Generate the rainbow color using the palette function
        vec3 baseCol = palette(colorInput);

        // Combine lighting and base color
        col = baseCol * (ambient + diffuse * 0.8);

        // Add a subtle rim light effect for definition
        float rim = pow(1.0 - max(dot(normal, -rd), 0.0), 3.0);
        col += baseCol * rim * 0.6;

        // --- Fog ---
        // Fade the color to the background based on distance
        float fogFactor = smoothstep(MAX_DIST * 0.1, MAX_DIST * 0.9, dist);
        col = mix(col, vec3(0.05, 0.05, 0.1), fogFactor);

    }

    // Apply simple gamma correction
    col = pow(col, vec3(0.4545));

    // Output the final color
    gl_FragColor = vec4(col, 1.0);
}