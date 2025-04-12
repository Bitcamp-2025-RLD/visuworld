precision highp float;

uniform float iTime;
uniform vec2 iResolution;

vec3 palette(float t) {
  vec3 a = vec3(0.5);
  vec3 b = vec3(0.5);
  vec3 c = vec3(1.0);
  vec3 d = vec3(0.263, 0.416, 0.557);
  return a + b * cos(6.28318 * (c * t + d));
}

void main() {
  vec2 uv = gl_FragCoord.xy / iResolution.xy;
  uv = uv * 2.0 - 1.0;
  uv.x *= iResolution.x / iResolution.y;

  // Time scroll
  float t = iTime * 0.5;

  // Convert to polar
  float r = length(uv);
  float a = atan(uv.y, uv.x);

  // Spiral distortion
  float depth = 5.0 + sin(t + r * 10.0 + a * 3.0) * 0.5;

  // UV mapping in the tunnel
  float z = mod(t + depth, 1.0);
  float ring = floor(t + depth);
  float mask = smoothstep(0.02, 0.0, abs(z - 0.5));

  // Color cycling using the ring index
  vec3 col = palette(ring * 0.05 + t * 0.1);

  // Brighten center
  col *= mask * 2.0;

  // Fade toward edges
  col *= exp(-r * 1.5);

  gl_FragColor = vec4(col, 1.0);
}