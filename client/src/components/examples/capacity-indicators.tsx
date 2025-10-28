import { CapacityIndicators } from '../capacity-indicators'

export default function CapacityIndicatorsExample() {
  return (
    <CapacityIndicators
      workUsed={2.5}
      workAvailable={3.0}
      forkliftsUsed={2}
      forkliftsAvailable={3}
      docksUsed={2}
      docksAvailable={3}
    />
  )
}
