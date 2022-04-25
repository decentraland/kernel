import { expect } from 'chai'
import { buildStore } from '../../packages/shared/store/store'
import { getFeatureFlags } from 'shared/meta/selectors'

describe('Meta tests', () => {
  describe('Parse feature flags', () => {

    it('enable feature flags', () => {
      const { store } = buildStore()
      globalThis.globalStore = store

      location.search = '&ENABLE_FEATURE1='

      const features = getFeatureFlags(store.getState())

      expect(features.flags['feature1']).to.equal(true)
    })

    it('disable feature flags', () => {
      const { store } = buildStore()
      globalThis.globalStore = store

      location.search = '&DISABLE_FEATURE1='

      const features = getFeatureFlags(store.getState())

      expect(features.flags['feature1']).to.equal(false)
    })

    it('parse multiple feature flags', () => {
      const { store } = buildStore()
      globalThis.globalStore = store

      location.search = '&DISABLE_ASSET_BUNDLES=&DISABLE_WEARABLES_ASSET_BUNDLES&ENABLE_FEATURE1=&ENABLE_FEATURE2'

      const features = getFeatureFlags(store.getState())

      expect(features.flags['asset_bundles']).to.equal(false)
      expect(features.flags['wearables_asset_bundles']).to.equal(false)
      expect(features.flags['feature1']).to.equal(true)
      expect(features.flags['feature2']).to.equal(true)
    })

    it('override featureflag', () => {
      const { store } = buildStore()
      globalThis.globalStore = store

      location.search = '&ENABLE_FEATURE1=&DISABLE_FEATURE1'

      const features = getFeatureFlags(store.getState())

      expect(features.flags['feature1']).to.equal(false)
    })
  })
})
