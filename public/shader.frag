precision mediump float;

uniform vec2 iResolution;
uniform float iTime;

// --- Rotation Matrix ---
mat2 rot(float a) {
    float s = sin(a);
    float c = cos(a);
    return mat2(c, -s, s, c);
}

// --- SDFs ---
// Capsule SDF by Inigo Quilez
float sdCapsule( vec3 p, vec3 a, vec3 b, float r )
{
    vec3 pa = p - a, ba = b - a;
    float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
    return length( pa - ba*h ) - r;
}

// --- Scene SDF ---
// Simple bend operator
vec3 opBend( vec3 p, float k )
{
    float c = cos( k*p.x );
    float s = sin( k*p.x );
    mat2  m = mat2(c,-s,s,c);
    vec3  q = vec3(p.x, m*p.yz);
    return q;
}

float map(vec3 p) {
    // Apply rotation for spinning effect
    p.yz *= rot(-iTime * 1.5); // Rotate around X-axis
    p.xz *= rot(iTime * 1.0);  // Rotate around Y-axis

    // Define banana shape using a bent capsule
    float bendFactor = 1.8; // How much the banana curves
    vec3 bent_p = opBend(p, bendFactor);

    // Define capsule parameters (adjust for banana shape)
    vec3 capA = vec3(-0.4, 0.0, 0.0);
    vec3 capB = vec3(0.4, 0.0, 0.0);
    float capR = 0.08 + 0.04 * cos(p.x * 3.0); // Slightly varying radius

    float d = sdCapsule(bent_p, capA, capB, capR);

    return d;
}

// --- Normal Calculation ---
vec3 calcNormal(vec3 p) {
    vec2 e = vec2(1.0, -1.0) * 0.0005; // Small epsilon for gradient calculation
    return normalize(
        e.xyy * map(p + e.xyy) +
        e.yyx * map(p + e.yyx) +
        e.yxy * map(p + e.yxy) +
        e.xxx * map(p + e.xxx)
    );
}

// --- Raymarching ---
float raymarch(vec3 ro, vec3 rd) {
    float dO = 0.0; // Distance traveled along the ray
    for (int i = 0; i < 100; i++) { // Max steps
        vec3 p = ro + rd * dO;
        float dS = map(p);
        dO += dS;
        if (dS < 0.001 || dO > 20.0) break; // Hit or max distance
    }
    return dO;
}

void main() {
    vec2 uv = (gl_FragCoord.xy * 2.0 - iResolution.xy) / iResolution.y;

    // --- Camera ---
    vec3 ro = vec3(0.0, 0.0, -1.5); // Ray origin (camera position)
    vec3 rd = normalize(vec3(uv, 1.0)); // Ray direction

    // --- Raymarch the scene ---
    float d = raymarch(ro, rd);

    vec3 col = vec3(0.5, 0.7, 1.0); // Background color (sky blue)

    if (d < 20.0) { // If we hit something within max distance
        vec3 p = ro + rd * d; // Hit point
        vec3 normal = calcNormal(p);

        // --- Lighting ---
        vec3 lightPos = vec3(2.0, 3.0, -3.0);
        vec3 lightDir = normalize(lightPos - p);
        vec3 viewDir = normalize(ro - p);
        vec3 reflectDir = reflect(-lightDir, normal);

        // --- Material ---
        vec3 bananaColor = vec3(1.0, 0.9, 0.2); // Shiny yellow
        float ambient = 0.3;
        float diffuse = max(dot(normal, lightDir), 0.0);
        float specularStrength = 0.8;
        float shininess = 32.0;
        float specular = pow(max(dot(viewDir, reflectDir), 0.0), shininess) * specularStrength;

        // Apply slight darkening at the ends (like a real banana)
        float endDarkening = smoothstep(0.35, 0.45, abs(p.x));
        bananaColor *= (1.0 - endDarkening * 0.5);


        // Final color calculation
        col = bananaColor * (ambient + diffuse) + vec3(1.0) * specular; // Add white specular highlight
    }

    // --- Output ---
    gl_FragColor = vec4(col, 1.0);
}