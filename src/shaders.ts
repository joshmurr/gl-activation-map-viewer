export const pickingVert = `#version 300 es
precision mediump float;

in vec3 i_Position;

uniform mat4 u_ProjectionMatrix;
uniform mat4 u_ViewMatrix;
uniform mat4 u_ModelMatrix;

out vec2 v_TexCoord;

void main(){
  gl_Position = u_ProjectionMatrix * u_ViewMatrix * u_ModelMatrix * vec4(i_Position, 1.0);
}`

export const pickingFrag = `#version 300 es
precision highp float;

uniform vec3 u_id;

out vec4 outColor;

void main() {
   outColor = vec4(u_id, 0.0);
}
`

export const renderVert = `#version 300 es
precision mediump float;

in vec3 i_Position;
in vec2 i_TexCoord;

uniform mat4 u_ProjectionMatrix;
uniform mat4 u_ViewMatrix;
uniform mat4 u_ModelMatrix;

out vec2 v_TexCoord;
out vec4 v_Colour;

void main(){
  gl_Position = u_ProjectionMatrix * u_ViewMatrix * u_ModelMatrix * vec4(i_Position, 1.0);
  v_TexCoord = i_TexCoord;
}`

export const renderFrag = `#version 300 es
precision mediump float;

in vec2 v_TexCoord;
uniform sampler2D u_texture;
uniform vec3 u_colour;
uniform vec3 u_colourMult;
uniform vec2 u_resolution;

out vec4 OUTCOLOUR;

void main(){
  vec4 data = vec4(texture(u_texture, v_TexCoord).rrr, 1.0);
  OUTCOLOUR = data * vec4(u_colourMult, 1.0);
}`
