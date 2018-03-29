const path = require('path')
const phantom = require('phantom')
const {
  PHANTOM_PATH = path.join(__dirname, '../node_modules/phantomjs-prebuilt/bin/phantomjs'),
  
  WIFI_IP,
  WIFI_ACCESS_CODE,
  WIFI_SETTINGS_URL,
  WIFI_SETTINGS_PAGE_TITLE = 'Wi-Fi configuration',
  WIFI_TIMEOUT = 15000,
  WIFI_TOGGLE_SELECTOR = '#WAVE0_ENABLE',
  WIFI_TOGGLE_ENABLE_VALUE = 'ENABLE',
  WIFI_TOGGLE_DISABLE_VALUE = 'DISABLE',
  WIFI_SUCCESS_SELECTOR = '.successlist',
  WIFI_SUBMIT_SELECTOR = 'input[type="submit"][name="SAVE"]',
  
  // Login page
  LOGIN_PAGE_TITLE = 'Login',
  LOGIN_CODE_SELECTOR = '#ADM_PASSWORD',
  LOGIN_SUBMIT_SELECTOR = 'input[type="submit"]'
} = process.env

// Wrapped promise was the only way I could figure out how to reject
// immediately from an await'ed .on handler
module.exports.toggle = (state) => new Promise(async (resolve, reject) => {
  const instance = await phantom.create([], {
    phantomPath: PHANTOM_PATH
  })
  const page = await instance.createPage()
  
  await page.setting('resourceTimeout', parseInt(WIFI_TIMEOUT, 10))
  await page.on('onLoadFinished', handlePageLoad)
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

  async function handlePageLoad(status) {
    if (status !== 'success') {
      return await finish('Failed to load page')
    }

    const title = await page.property('title')
    switch (title) {
      case WIFI_SETTINGS_PAGE_TITLE: return handleLoadSettings(status)
      case LOGIN_PAGE_TITLE: return handleLoadLogin(status)
      default: return await finish()
    }
  }

  async function handleSettingsError(error) {
    console.log('Could not check or update settings: ', error)
    await finish()
  }
  
  async function handleLoadSettings(status) {
    try {
      const neededUpdating = await page.evaluate(
        function(successSelector, toggleSelector, toggleValue, submitSelector) {
          const success = document.querySelector(successSelector)
          if (success && success.textContent.trim()) return false

          const toggle = document.querySelector(toggleSelector)
          if (!toggle) return new Error('Could not find toggle selector')
          if (toggle.value === toggleValue) return false
          
          toggle.value = toggleValue
          document.querySelector(submitSelector).click()
          return true
        },
        WIFI_SUCCESS_SELECTOR,
        WIFI_TOGGLE_SELECTOR,
        state ? WIFI_TOGGLE_ENABLE_VALUE : WIFI_TOGGLE_DISABLE_VALUE,
        WIFI_SUBMIT_SELECTOR
      )

      if (neededUpdating instanceof Error) {
        return handleSettingsError(neededUpdating)
      }
      
      console.log('Needed updating:', neededUpdating)
      if (neededUpdating !== true) await finish() // End of the line
    } catch(error) {
      handleSettingsError(error)
    }
  }
  
  async function handleLoadLogin(status) {
    await page.evaluate(
      function(loginSelector, loginValue, submitSelector) {
        document.querySelector(loginSelector).value = loginValue
        document.querySelector(submitSelector).click()
      },
      LOGIN_CODE_SELECTOR, WIFI_ACCESS_CODE, LOGIN_SUBMIT_SELECTOR
    )
  }
})