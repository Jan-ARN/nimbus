// „Zu unsicher, um es zu sagen" — reine Funktion.
//
// Wenn die Modelle für einen Tag WEIT auseinanderliegen, ist ein einzelner
// Mittelwert Scheingenauigkeit. Statt eine Zahl vorzutäuschen, sagt die App es
// offen (nach dem Vorbild von Googles Regen-Nowcast, der bei zu großer
// Unsicherheit gröber wird, statt eine Minutenzahl zu erfinden).

export type SpreadVerdict = 'agree' | 'spread' | 'uncertain'

/**
 * Einordnung der Modell-Uneinigkeit anhand der vollen Spanne (max − min, °C)
 * der Tages-Höchstwerte.
 * @param strong Ab dieser Spanne gilt der Tag als „zu unsicher, um ihn festzunageln".
 */
export function spreadVerdict(fullSpread: number, mild = 4, strong = 8): SpreadVerdict {
  if (fullSpread >= strong) return 'uncertain'
  if (fullSpread >= mild) return 'spread'
  return 'agree'
}
