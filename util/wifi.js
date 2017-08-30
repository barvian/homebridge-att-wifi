const phantom = require('phantom')
const {
  WIFI_IP,
  WIFI_ACCESS_CODE,
  WIFI_SETTINGS_URL,
  WIFI_TIMEOUT = 15000,
  WIFI_TOGGLE_SELECTOR = '#WAVE0_ENABLE',
  WIFI_TOGGLE_ENABLE_VALUE = 'ENABLE',
  WIFI_TOGGLE_DISABLE_VALUE = 'DISABLE',
  WIFI_SUBMIT_SELECTOR = 'input[type="submit"][name="SAVE"]',
  
  // Login page
  LOGIN_PAGE_TITLE = 'Login',
  LOGIN_CODE_SELECTOR = '#ADM_PASSWORD',
  LOGIN_SUBMIT_SELECTOR = 'input[type="submit"]'
} = process.env

// Wrapped promise was the only way I could figure out how to reject
// immediately from an await'ed .on handler
module.exports.toggle = (state) => new Promise(async (resolve, reject) => {
  const instance = await phantom.create()
  const page = await instance.createPage()
  
  await page.setting('resourceTimeout', parseInt(WIFI_TIMEOUT, 10))
  await page.on('onLoadFinished', handleLoadSettings)
  await page.open(`http://${WIFI_IP}${WIFI_SETTINGS_URL}`)
  
  async function finish(error) {
    await page.off('onLoadFinished')
    await instance.exit()
    if (error) {
      reject(error)
    } else {
      resolve()
    }
  }
  
  async function handleLoadSettings(status) {
    await page.off('onLoadFinished')
    if (status !== 'success') {
      return await finish('Failed to load settings page')
    }
    
    await page.on('onLoadFinished', handleSecondPageLoad)
    const needsUpdating = await page.evaluate(
      function(toggleSelector, toggleValue, submitSelector) {
        const toggle = document.querySelector(toggleSelector)
        if (toggle.value === toggleValue) return false
        
        toggle.value = toggleValue
        document.querySelector(submitSelector).click()
        return true
      },
      WIFI_TOGGLE_SELECTOR,
      state ? WIFI_TOGGLE_ENABLE_VALUE : WIFI_TOGGLE_DISABLE_VALUE,
      WIFI_SUBMIT_SELECTOR
    )
    
    console.log('Needs updating:', needsUpdating)
    if (!needsUpdating) {
      await finish()
    }
  }
  
  async function handleSecondPageLoad(status) {
    await page.off('onLoadFinished')
    if (status !== 'success') {
      return await finish('Failed to change settings')
    }
    
    const title = await page.property('title')
    if (title !== LOGIN_PAGE_TITLE) {
      return await finish()
    }
    
    await page.on('onLoadFinished', handlePostLoginLoad)
    await page.evaluate(
      function(loginSelector, loginValue, submitSelector) {
        document.querySelector(loginSelector).value = loginValue
        document.querySelector(submitSelector).click()
      },
      LOGIN_CODE_SELECTOR, WIFI_ACCESS_CODE, LOGIN_SUBMIT_SELECTOR
    )
  }
  
  async function handlePostLoginLoad() {
    return await finish()
  }
})