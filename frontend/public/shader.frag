uniform vec2 iResolution;
uniform float iTime;

// Signed Distance Functions (SDFs)
float sdSphere( vec3 p, float s ) {
  return length(p)-s;
}

float sdCapsule( vec3 p, vec3 a, vec3 b, float r ) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
  return length( pa - ba*h ) - r;
}

// Smooth minimum function
float smin( float a, float b, float k ) {
    float h = clamp( 0.5 + 0.5*(b-a)/k, 0.0, 1.0 );
    return mix( b, a, h ) - k*h*(1.0-h);
}

// Scene SDF - Defines the person and ground
float map( vec3 p ) {
    // Person's parameters
    float headRadius = 0.25;
    vec3 headPos = vec3(0.0, 1.3, 0.0);

    vec3 torsoA = vec3(0.0, 0.5, 0.0);
    vec3 torsoB = vec3(0.0, 1.1, 0.0);
    float torsoRadius = 0.18;

    float legRadius = 0.1;
    float legLength = 0.6;
    float legSpread = 0.15;
    vec3 hipPos = torsoA; // Legs start from the bottom of the torso

    float armRadius = 0.08;
    float armLength = 0.5;
    vec3 shoulderPos = torsoB + vec3(0.0, -0.1, 0.0); // Arms start near the top of the torso
    float shoulderWidth = torsoRadius + armRadius - 0.02; // Adjust based on radii

    // Head
    float d = sdSphere(p - headPos, headRadius);

    // Torso
    d = smin(d, sdCapsule(p, torsoA, torsoB, torsoRadius), 0.1);

    // Legs (Static pose)
    // Left Leg
    vec3 leftLegA = hipPos + vec3(-legSpread, 0.0, 0.0);
    vec3 leftLegB = leftLegA + vec3(0.0, -legLength, 0.0);
    d = smin(d, sdCapsule(p, leftLegA, leftLegB, legRadius), 0.05);

    // Right Leg
    vec3 rightLegA = hipPos + vec3(legSpread, 0.0, 0.0);
    vec3 rightLegB = rightLegA + vec3(0.0, -legLength, 0.0);
    d = smin(d, sdCapsule(p, rightLegA, rightLegB, legRadius), 0.05);

    // Arms
    // Left Arm (Waving)
    float waveAngle = sin(iTime * 3.0) * 0.8 + 3.14159265359 * 0.6; // Waving animation
    vec3 leftShoulder = shoulderPos + vec3(-shoulderWidth, 0.0, 0.0);
    vec3 leftHand = leftShoulder + vec3(cos(waveAngle) * armLength, sin(waveAngle) * armLength, 0.0);
    d = smin(d, sdCapsule(p, leftShoulder, leftHand, armRadius), 0.05);

    // Right Arm (Static down)
    vec3 rightShoulder = shoulderPos + vec3(shoulderWidth, 0.0, 0.0);
    vec3 rightHand = rightShoulder + vec3(0.05, -armLength, -0.05); // Slightly bent pose
    d = smin(d, sdCapsule(p, rightShoulder, rightHand, armRadius), 0.05);

    // Ground plane - position slightly below the feet
    float groundLevel = -legLength;
    float groundDist = p.y - groundLevel;
    d = min(d, groundDist); // Combine person SDF with ground SDF

    return d;
}

// Calculate normal using the gradient of the SDF
vec3 calcNormal( vec3 p ) {
    const float eps = 0.001; // Epsilon for gradient calculation
    vec2 e = vec2(1.0, -1.0) * 0.5773; // Hexagonal sampling pattern offsets
    return normalize( e.xyy * map( p + e.xyy*eps ) +
                      e.yyx * map( p + e.yyx*eps ) +
                      e.yxy * map( p + e.yxy*eps ) +
                      e.xxx * map( p + e.xxx*eps ) );
    /* // Simpler but potentially less accurate method
    vec3 n = vec3(
        map(p + vec3(eps, 0, 0)) - map(p - vec3(eps, 0, 0)),
        map(p + vec3(0, eps, 0)) - map(p - vec3(0, eps, 0)),
        map(p + vec3(0, 0, eps)) - map(p - vec3(0, 0, eps))
    );
    return normalize(n);
    */
}

// Raymarching function
float raymarch( vec3 ro, vec3 rd ) {
    float dO = 0.0; // Distance from Origin
    for(int i=0; i<128; i++) { // Max steps
        vec3 p = ro + rd * dO;
        float dS = map(p); // Distance to Scene
        dO += dS;
        // Check for hit (close enough) or exceeding max distance
        if(abs(dS) < 0.001 || dO > 100.0) break;
    }
    return dO;
}

// Basic pseudo-random number generator
float random (vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}


void main() {
    // Normalized pixel coordinates (from -1 to 1) centered
    vec2 uv = (gl_FragCoord.xy * 2.0 - iResolution.xy) / iResolution.y;

    // Camera Setup
    vec3 ro = vec3( 0.0, 1.0, 4.0 ); // Ray origin (camera position) - slightly elevated
    vec3 lookAt = vec3( 0.0, 0.5, 0.0 ); // Point camera is looking at (center of person)
    vec3 camUp = vec3(0.0, 1.0, 0.0); // Camera up direction

    // Create camera basis vectors
    vec3 ww = normalize( lookAt - ro ); // Forward vector
    vec3 uu = normalize( cross(ww, camUp) ); // Right vector
    vec3 vv = normalize( cross(uu, ww) ); // Up vector

    // Create view ray direction
    float fov = 1.5; // Field of View adjustment
    vec3 rd = normalize( uv.x*uu + uv.y*vv + fov*ww );

    // Perform raymarching
    float dist = raymarch(ro, rd);

    // Default background color (sky blue)
    vec3 col = vec3(0.5, 0.7, 0.9);

    // If the ray hit something within the max distance
    if (dist < 100.0) {
        vec3 p = ro + rd * dist; // Hit point
        vec3 normal = calcNormal(p); // Normal at hit point

        // Simple lighting (directional light)
        vec3 lightDir = normalize(vec3(0.8, 0.7, -0.5)); // Light direction
        float diffuse = max(dot(normal, lightDir), 0.0); // Basic diffuse term
        float ambient = 0.2; // Ambient light contribution

        // Determine color based on what was hit
        float groundLevel = -0.6; // Matches the ground level in map()
        if (p.y < groundLevel + 0.01) { // Check if the hit point is on the ground plane
            // Checkered ground pattern
            float check = mod(floor(p.x * 2.0) + floor(p.z * 2.0), 2.0);
            vec3 groundColor = mix(vec3(0.3, 0.5, 0.2), vec3(0.2, 0.3, 0.1), check);
            col = groundColor * (diffuse + ambient);
        } else { // Hit the person
            vec3 personColor = vec3(0.9, 0.65, 0.5); // A simple skin-like tone
             // Add slight color variation based on normal/position for detail
            personColor *= (0.8 + 0.2 * normal.y);
            col = personColor * (diffuse + ambient);
        }

        // Add simple fog effect based on distance
        float fogFactor = 1.0 - exp(-0.02 * dist * dist);
        col = mix(col, vec3(0.5, 0.7, 0.9), fogFactor); // Mix with sky color for fog
    }

    // Gamma correction (approx)
    col = pow(col, vec3(0.4545));

    // Output final color
    gl_FragColor = vec4(col, 1.0);
}