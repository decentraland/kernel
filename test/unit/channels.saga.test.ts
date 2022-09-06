import { buildStore } from "shared/store/store"
import sinon from "sinon"

describe('Friends sagas - Channels Feature'), () => {
    sinon.mock()

    describe('Get user joined channels', () => {
        beforeEach(() => {
            const { store } = buildStore()
            globalThis.globalStore = store
        })

        afterEach(() => {
            sinon.restore()
            sinon.reset()
        })

        describe("When the user is joined to channels and there's no skip", () => {
            it('Should send the start of the channel list pagination', () => {
            })
          })

          describe("When the user is joined to channels and there's a skip", () => {
            it('Should filter the channel list to skip the requested amount', () => {
            })
          })
    })
}