export const stabilityaiInfo = {
  name: "Stability AI",
  baseUrl: "https://api.stability.ai",
  models: [
    {
      id: "sd3",
      name: "Stable Diffusion 3",
      endpoint: "/v2beta/stable-image/generate/sd3",
    },
    {
      id: "core",
      name: "Stable Image Core",
      endpoint: "/v2beta/stable-image/generate/core",
    },
    {
      id: "ultra",
      name: "Stable Image Ultra",
      endpoint: "/v2beta/stable-image/generate/ultra",
    },
  ],
};
