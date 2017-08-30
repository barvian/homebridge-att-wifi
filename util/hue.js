const fetch = require('node-fetch')
const { HUE_IP, HUE_USER, HUE_TIMEOUT = 5000 } = process.env

const callApi = async function(endpoint) {
  const response = await fetch(`http://${HUE_IP}/api${endpoint}`, {
    timeout: parseInt(HUE_TIMEOUT, 10)
  })
  if (response.ok) return response
  
  const error = new Error(response.statusText)
  error.response = response
  throw error
}

module.exports.hasLightsOn = async function() {
  return callApi(`/${HUE_USER}/lights`)
    .then((response) => response.json())
    .then((lights) => Object.values(lights).filter((light) => 
      // Unreachable lights are assumed to be off
      light.state.on && light.state.reachable 
    ).length > 0)
}