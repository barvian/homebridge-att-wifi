const path = require('path')
const phantom = require('phantom')

let Service, Characteristic

module.exports = (homebridge) => {
  Service = homebridge.hap.Service
  Characteristic = homebridge.hap.Characteristic
  homebridge.registerAccessory("homebridge-attWifiSwitch", "AttWifiSwitch", AttWifiSwitch)
}

class AttWifiSwitch {
  constructor(log, config) {
    this.log = log
    this.config = { ...AttWifiSwitch.defaultProps, ...config }
  }

  static get defaultProps() {return {
    phantomPath: path.join(__dirname, 'node_modules/phantomjs-prebuilt/bin/phantomjs'),
    
    settingsPageTitle: 'Wi-Fi configuration',
    timeout: 15000,
    toggleSelector: '#WAVE0_ENABLE',
    toggleEnableValue: 'ENABLE',
    toggleDisableValue: 'DISABLE',
    submitSelector: 'input[type="submit"][name="SAVE"]',

    loginPageTitle: 'Login',
    loginCodeSelector: '#ADM_PASSWORD',
    loginSubmitSelector: 'input[type="submit"]'
  }}

  async getPage() {
    if (!this._page) {
      const instance = await phantom.create([], {
        phantomPath: this.config.phantomPath
      })
      
      this._page = await instance.createPage()
      await this._page.setting('resourceTimeout', parseInt(this.config.timeout, 10))
    }
    return this._page
  }

  getServices() {
    this.switchService = new Service.Switch("Wi-fi")
    this.switchService
      .getCharacteristic(Characteristic.On)
      .on('get', this.getSwitchOnCharacteristic.bind(this))
      .on('set', this.setSwitchOnCharacteristic.bind(this))
 
    return [this.switchService]
  }

  async getSwitchOnCharacteristic(next) {
    if (this.on == null) {
      try { this.on = await this.toggle() }
      catch (error) { return next(error) }
    }
    return next(null, this.on)
  }
   
  async setSwitchOnCharacteristic(on, next) {
    try { this.on = await this.toggle(on) }
    catch (error) { return next(error) }
    return next()
  }

  toggle(on) { return new Promise(async (resolve, reject) => {
    const page = await this.getPage()
    const targetValue = on == null ? null :
      this.config[on ? 'toggleEnableValue' : 'toggleDisableValue']
    
    const finish = async (error, data) => {
      await page.off('onLoadFinished')
      if (error) reject(error)
      else resolve(data)
    }
    
    const handlePageLoad = async (status) => {
      if (status !== 'success') return await finish('Failed to load page')
  
      const title = await page.property('title')
      switch (title) {
        case this.config.settingsPageTitle: return handleLoadSettings(status)
        case this.config.loginPageTitle: return handleLoadLogin(status)
        default: return await finish()
      }
    }
  
    const handleLoadSettings = async (status) => {
      try {
        const newValue = await page.evaluate(
          function(toggleSelector, toggleValue, submitSelector) {
            const toggle = document.querySelector(toggleSelector)
            if (!toggle) return new Error('Could not find toggle selector')
            if (toggleValue == null || toggle.value === toggleValue) return toggle.value
            
            toggle.value = toggleValue
            document.querySelector(submitSelector).click()
            return toggleValue
          },
          this.config.toggleSelector,
          targetValue,
          this.config.submitSelector
        )
  
        if (newValue instanceof Error) return finish(newValue)
        if (targetValue == null || newValue === targetValue) {
          await finish(null, newValue === this.config.toggleEnableValue) // no change needed
        }
      } catch(error) {
        await finish(error)
      }
    }
  
    const handleLoadLogin = async (status) => {
      await page.evaluate(
        function(loginSelector, loginValue, submitSelector) {
          document.querySelector(loginSelector).value = loginValue
          document.querySelector(submitSelector).click()
        },
        this.config.loginCodeSelector,
        this.config.accessCode,
        this.config.loginSubmitSelector
      )
    }

    await page.on('onLoadFinished', handlePageLoad)
    await page.open(`http://${this.config.ip}${this.config.settingsUrl}`)
  }) }

}