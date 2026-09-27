export interface Persona {
  name: string;
  /** How they talk in meetings; fed to the model and used to flavour canned lines. */
  voice: string;
}

export const PERSONAS: Persona[] = [
  { name: 'Vasquez', voice: 'terse ex-navy welder; short blunt sentences, no small talk' },
  { name: 'Okafor', voice: 'anxious marine biologist; hedges a lot, over-explains' },
  { name: 'Lindqvist', voice: 'dry, deadpan sonar tech; understated jokes' },
  { name: 'Tanaka', voice: 'overconfident rookie; jumps to conclusions, uses slang' },
  { name: 'Moreau', voice: 'calm station medic; measured, asks clarifying questions' },
  { name: 'Haddad', voice: 'paranoid engineer; suspicious of everyone, a bit dramatic' },
  { name: 'Kowalski', voice: 'cheerful galley cook; friendly, a little rambling' },
  { name: 'Reyes', voice: 'no-nonsense commander; takes charge, demands alibis' },
  { name: 'Nakamura', voice: 'nerdy data analyst; cites times and rooms precisely' },
  { name: 'Abara', voice: 'superstitious old salt; mentions omens and the trench' },
];

export function pickPersona(takenNames: Set<string>): Persona {
  const free = PERSONAS.filter((p) => !takenNames.has(p.name.toLowerCase()));
  if (free.length) return free[Math.floor(Math.random() * free.length)];
  // Every persona already in the room (only possible with renamed humans): number one.
  const base = PERSONAS[Math.floor(Math.random() * PERSONAS.length)];
  let n = 2;
  while (takenNames.has(`${base.name}${n}`.toLowerCase())) n++;
  return { ...base, name: `${base.name}${n}` };
}
