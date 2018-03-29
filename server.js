#!/usr/bin/env node

require('dotenv').config()

const http = require('http')
const { toggle: toggleWifi } = require('./util/wifi')
const { hasLightsOn: getHasLightsOn } = require('./util/hue')
const { PORT = 3000, POLL_INTERVAL = 20000 } = process.env

let override = false, prevOverride = false, prevHadLightsOn
const pollForChanges = async function() {
  if (override && override !== prevOverride) {
    try {
      await toggleWifi(false)
      // We shouldn't set this unless ^ goes through
      prevOverride = override
    } catch (error) {
      console.log('Error overriding wifi:', error)
    }
  } else {
    try {
      const hasLightsOn = await getHasLightsOn()
      if (prevHadLightsOn === hasLightsOn) return 
      try {
        await toggleWifi(hasLightsOn)
        // We shouldn't set this unless ^ goes through
        prevHadLightsOn = hasLightsOn
      } catch (error) {
        console.log('Error toggling wifi:', error)
      }
    } catch (error) {
      console.log('Error getting number of on lights:', error)
    }
  }
  
  setTimeout(pollForChanges, parseInt(POLL_INTERVAL, 10))
}

http.createServer((request, response) => {
  let body = []
  request.on('error', (error) => {
    console.log('Server error:', error)
  }).on('data', (chunk) => {
    body.push(chunk)
  }).on('end', () => {
    if (request.method === 'POST' && request.url === '/override') {
      override = body.length > 0
    }

    response.writeHeader(200, { "Content-Type": "text/html" });
    response.write(`<html><title>Wifi</title><form method="POST" action="/override"><input onchange="this.form.submit()" type="checkbox" ${override ? 'checked' : ''} name="override" value="true" />Keep off</form></html>`)
    response.end()
  })
}).listen(parseInt(PORT, 10));

pollForChanges()