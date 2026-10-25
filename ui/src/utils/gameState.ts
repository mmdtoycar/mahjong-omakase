const WIND_NAMES = ['东', '南', '西', '北']

export function getWindName(w: number): string {
  return WIND_NAMES[(w - 1) % 4]
}
