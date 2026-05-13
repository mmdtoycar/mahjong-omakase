interface TenhouHand {
  hand: string
  melds: string[]
  openHand: boolean
  winningTile: string
  riichiSticks: number
  honbaSticks: number
  roundWind: string
  seatWind: string
  doraIndicators: string[]
  uraDoraIndicators: string[]
  isDealer: boolean
  isTsumo: boolean
  isRiichi: boolean
  yakusAchieved: Record<string, number>
  pointValue: string
  fu: string
  han: number
  fu_details: { fu: number; reason: string }[]
}

declare const tenhouHands: TenhouHand[]
export default tenhouHands
