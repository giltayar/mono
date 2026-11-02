export const hooks = {
  updateConfig(config) {
    return {
      ...config,
      allowBuilds: {...config.allowBuilds, nx: true},
    }
  },
}
