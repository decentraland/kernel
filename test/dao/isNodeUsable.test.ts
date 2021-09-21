import { expect } from "chai"
import { isNodeUsable } from "shared/dao"
import { HealthStatus } from "shared/dao/types"

describe('isNodeUsable', () => {
  it("Should return true for healthy nodes", () => {
    expect(isNodeUsable({
      "lambda": HealthStatus.HEALTHY,
      "content": HealthStatus.HEALTHY,
      "comms": HealthStatus.HEALTHY
    }, false)).to.equal(true)
  })

  function expectResultIfAny(status: HealthStatus, expected: boolean, allowUnhealthy: boolean = false, otherStatuses: HealthStatus = HealthStatus.HEALTHY) {
    expect(isNodeUsable({
      "lambda": otherStatuses,
      "content": status,
      "comms": otherStatuses
    }, allowUnhealthy)).to.equal(expected)

    expect(isNodeUsable({
      "lambda": status,
      "content": otherStatuses,
      "comms": otherStatuses
    }, allowUnhealthy)).to.equal(expected)

    expect(isNodeUsable({
      "lambda": otherStatuses,
      "content": otherStatuses,
      "comms": status
    }, allowUnhealthy)).to.equal(expected)
  }

  it("Should return false if any service is unhealthy", () => {
    expectResultIfAny(HealthStatus.UNHEALTHY, false)
  })

  it("Should return false if any service is down", () => {
    expectResultIfAny(HealthStatus.DOWN, false)
  })

  it("Should return true if any service is unhealthy but allow unhealthy is true", () => {
    expectResultIfAny(HealthStatus.UNHEALTHY, true, true)

    expect(isNodeUsable({
      "lambda": HealthStatus.UNHEALTHY,
      "content": HealthStatus.UNHEALTHY,
      "comms": HealthStatus.UNHEALTHY
    }, true)).to.equal(true)
  })

  it("Should return false if any service is down even when allow unhealthy is true", () => {
    expectResultIfAny(HealthStatus.DOWN, false, false)

    expectResultIfAny(HealthStatus.DOWN, false, false, HealthStatus.UNHEALTHY)
  })

})