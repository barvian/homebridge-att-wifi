#!/usr/bin/env node

require('dotenv').config()

const { toggle: toggleWifi } = require('./util/wifi')
const { hasLightsOn: getHasLightsOn } = require('./util/hue')
const { POLL_INTERVAL = 15000 } = process.env

let prevHadLightsOn
const pollForChanges = async function() {
  try {
    const hasLightsOn = await getHasLightsOn()
    if (prevHadLightsOn !== hasLightsOn) {
      try {
        await toggleWifi(hasLightsOn)
        // We shouldn't set this unless ^ goes through
        prevHadLightsOn = hasLightsOn
      } catch (error) {
        console.log('Error toggling wifi:', error)
      }
    }
  } catch (error) {
    console.log('Error getting number of on lights:', error)
  }
  
  setTimeout(pollForChanges, parseInt(POLL_INTERVAL, 10))
}

pollForChanges()