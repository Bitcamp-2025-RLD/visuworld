#version 330 core

// Input: Normalized fragment coordinates [-1, 1]
in vec2 fragCoord;

// Output: Fragment color
out vec4 fragColor;

// Uniforms provided by the environment
uniform float iTime;       // Time in seconds
uniform vec2 iResolution; // Resolution of the viewport in pixels

#define PI 3.14159265359
#define TAU (2.0 * PI)

// Helper function to generate rainbow colors based on a phase (0 to TAU)
// Uses cosine waves for smooth transitions between R, G, B
vec3 rainbow(float phase) {
    // Wrap phase to keep it within a single cycle for consistency if needed,
    // although cosine handles continuous input fine.
    // phase = mod(phase, TAU);
    return 0.5 + 0.5 * cos(phase + vec3(0.0, TAU / 3.0, 2.0 * TAU / 3.0));
}

void main() {
    // 1. UV Coordinates
    // Use fragCoord directly but correct for aspect ratio to keep the sun circular
    vec2 uv = fragCoord;
    if (iResolution.y > 0.0) { // Avoid division by zero
       uv.x *= iResolution.x / iResolution.y;
    }

    // 2. Polar Coordinates
    // Calculate distance from the center (0,0)
    float dist = length(uv);
    // Calculate angle relative to the positive x-axis
    float angle = atan(uv.y, uv.x);

    // 3. Pulsing Effect
    // Create a value that oscillates smoothly between 0 and 1 over time
    float pulseSpeed = 2.0; // How fast the sun pulses
    float pulse = 0.5 + 0.5 * sin(iTime * pulseSpeed); // Oscillates [0, 1]

    // Define base size and how much the pulse affects it
    float baseRadius = 0.15;
    float pulseMagnitude = 0.1;
    float currentRadius = baseRadius + pulse * pulseMagnitude; // Sun radius changes over time

    // 4. Rainbow Color Cycling
    // Make the base color cycle through the rainbow over time
    float colorCycleSpeed = 0.5;
    vec3 baseSunColor = rainbow(iTime * colorCycleSpeed);

    // 5. Sun Core Glow
    // Use an exponential falloff for a soft, bright center
    // Smaller `glowSharpness` = softer/wider glow, larger = sharper/smaller core
    float glowSharpness = 20.0;
    float coreIntensity = exp(-pow(dist / currentRadius, 2.0) * glowSharpness);

    // Add a subtle shimmer effect based on angle and time
    coreIntensity *= (0.95 + 0.05 * sin(angle * 10.0 + iTime * 1.5));

    // 6. Radiating Rays / Corona
    float rayFrequency = 7.0;   // Number of rays
    float raySpeed = -1.5;       // Speed/direction of ray rotation
    float raySharpness = 3.0;   // How defined the rays are
    float rayStrength = 0.35;   // Overall intensity of the rays

    // Create the ray pattern using sine wave based on angle and time
    float rayPattern = pow(0.5 + 0.5 * sin(angle * rayFrequency + iTime * raySpeed), raySharpness);

    // Make rays appear outside the core and fade out with distance
    // Use smoothstep to define the radial extent of the rays
    float rayFalloff = smoothstep(currentRadius * 1.2, currentRadius * 0.9, dist) * // Fade in near core edge
                       smoothstep(currentRadius * 3.0, currentRadius * 1.5, dist);  // Fade out further away

    // Modulate ray intensity by the pulse effect
    float rayValue = rayPattern * rayFalloff * rayStrength * (0.6 + 0.7 * pulse);

    // Give rays a slightly different color, maybe shifted or based on distance/angle
    vec3 rayColor = rainbow(iTime * colorCycleSpeed + dist * 4.0 + angle * 0.5);

    // 7. Combine Components
    // Start with the core color and intensity
    vec3 finalColor = baseSunColor * coreIntensity;
    // Add the rays on top
    finalColor += rayColor * rayValue;

    // 8. Final Output
    // Clamp the color to [0, 1] range to avoid over-brightness issues
    finalColor = clamp(finalColor, 0.0, 1.0);

    // Set the final fragment color (alpha = 1.0 for opaque)
    fragColor = vec4(finalColor, 1.0);
}